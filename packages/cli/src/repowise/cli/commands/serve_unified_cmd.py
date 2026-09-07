"""Single-application startup guard for ``repowise serve``.

The upstream serve command prepares and launches the standalone Next.js UI
before entering ``uvicorn.run``. On a cold start that lets a browser render the
UI while the API socket is still closed. Server Components then cache that one
transient connection refusal as "Can't reach the API" / "No repositories yet"
until the user reloads.

Keep the upstream command and all of its options intact, but defer the actual
frontend process until the API is accepting connections. The user still runs
one command in one terminal; this module only fixes the internal startup order.
"""

from __future__ import annotations

import socket
import threading
import time
from pathlib import Path
from typing import Any

from repowise.cli.commands import serve_cmd as _serve

_ORIGINAL_START_FRONTEND = _serve._start_frontend


def _connect_host(host: str) -> str:
    """Return a connectable host for a server that may bind a wildcard."""
    return "127.0.0.1" if host in ("0.0.0.0", "::") else host


def _api_is_ready(host: str, port: int) -> bool:
    """True once the API TCP socket is accepting local connections."""
    try:
        with socket.create_connection((_connect_host(host), port), timeout=0.25):
            return True
    except OSError:
        return False


class _DeferredFrontend:
    """Popen-like handle that launches Next.js only after uvicorn is ready.

    ``serve_cmd`` only relies on truthiness plus ``terminate()`` and ``wait()``
    for the frontend handle, so this small proxy lets the existing command keep
    ownership of shutdown without moving uvicorn away from the main thread
    (which would break its normal signal handling on Windows).
    """

    def __init__(
        self,
        *,
        node: str,
        backend_port: int,
        frontend_port: int,
        local_web: Path | None,
        host: str,
    ) -> None:
        self._node = node
        self._backend_port = backend_port
        self._frontend_port = frontend_port
        self._local_web = local_web
        self._host = host
        self._cancelled = threading.Event()
        self._started = threading.Event()
        self._proc: Any | None = None
        self._thread = threading.Thread(
            target=self._launch_when_api_ready,
            name="repowise-ui-startup",
            daemon=True,
        )
        self._thread.start()

    def _launch_when_api_ready(self) -> None:
        # No fixed sleep: expose the UI at the first instant the API can answer,
        # but never before it. A bounded deadline prevents a failed backend from
        # leaving a daemon thread polling forever.
        deadline = time.monotonic() + 60.0
        while not self._cancelled.is_set() and time.monotonic() < deadline:
            if _api_is_ready(self._host, self._backend_port):
                try:
                    self._proc = _ORIGINAL_START_FRONTEND(
                        self._node,
                        self._backend_port,
                        self._frontend_port,
                        local_web=self._local_web,
                        host=self._host,
                    )
                    if self._proc is None:
                        _serve.console.print(
                            "[yellow]Could not start web UI — running API only.[/yellow]"
                        )
                except Exception as exc:  # pragma: no cover - defensive startup guard
                    _serve.console.print(
                        f"[yellow]Could not start web UI after API startup: {exc}[/yellow]"
                    )
                finally:
                    self._started.set()
                return
            self._cancelled.wait(0.05)

        self._started.set()

    def terminate(self) -> None:
        self._cancelled.set()
        proc = self._proc
        if proc is not None:
            try:
                proc.terminate()
            except (OSError, ProcessLookupError):
                pass

    def wait(self, timeout: float | None = None) -> Any:
        # ``serve_cmd`` calls terminate first, so the watcher exits promptly
        # even if the API itself never became healthy.
        self._thread.join(timeout=timeout)
        proc = self._proc
        if proc is None:
            return None
        try:
            return proc.wait(timeout=timeout)
        except (OSError, ProcessLookupError):
            return None


def _start_frontend_after_api(
    node: str,
    backend_port: int,
    frontend_port: int,
    local_web: Path | None = None,
    host: str = "127.0.0.1",
) -> _DeferredFrontend:
    return _DeferredFrontend(
        node=node,
        backend_port=backend_port,
        frontend_port=frontend_port,
        local_web=local_web,
        host=host,
    )


# Patch only this lazy-loaded serve module. Every other upstream helper and
# Click option remains unchanged.
_serve._start_frontend = _start_frontend_after_api  # type: ignore[assignment]
serve_command = _serve.serve_command
