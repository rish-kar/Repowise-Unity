"""Regression tests for one-command API/UI startup ordering."""

from __future__ import annotations

import socket
import threading

from repowise.cli.commands import serve_unified_cmd


def test_unified_serve_keeps_public_command_name() -> None:
    assert serve_unified_cmd.serve_command.name == "serve"


def test_frontend_is_deferred_until_api_socket_is_listening(monkeypatch) -> None:
    host = "127.0.0.1"
    api_socket = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    api_socket.bind((host, 0))
    port = api_socket.getsockname()[1]

    launched = threading.Event()

    class FakeProcess:
        def terminate(self) -> None:
            pass

        def wait(self, timeout=None):
            return 0

    def fake_start(*args, **kwargs):
        launched.set()
        return FakeProcess()

    monkeypatch.setattr(serve_unified_cmd, "_ORIGINAL_START_FRONTEND", fake_start)

    deferred = serve_unified_cmd._DeferredFrontend(
        node="node",
        backend_port=port,
        frontend_port=3000,
        local_web=None,
        host=host,
    )

    try:
        # Bound but not listening: the frontend must remain hidden.
        assert launched.wait(0.15) is False

        # This models uvicorn becoming ready. The watcher should now expose the
        # frontend without any second command or terminal.
        api_socket.listen(1)
        assert launched.wait(2.0) is True
    finally:
        deferred.terminate()
        deferred.wait(timeout=1)
        api_socket.close()
