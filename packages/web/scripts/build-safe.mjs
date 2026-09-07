import { cp, mkdir, mkdtemp, readFile, rm } from "node:fs/promises";
import { existsSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const webDir = path.resolve(scriptDir, "..");
const repoRoot = path.resolve(webDir, "../..");
const npmExecPath = process.env.npm_execpath;

function fail(message) {
  console.error(`\n[repowise] ${message}`);
  process.exit(1);
}

function run(command, args, cwd) {
  const result = spawnSync(command, args, {
    cwd,
    env: process.env,
    stdio: "inherit",
    shell: false,
  });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error(`${command} ${args.join(" ")} exited with code ${result.status}`);
  }
}

function runNpm(args, cwd) {
  // npm sets npm_execpath for every lifecycle script. Calling the CLI through
  // Node avoids Windows .cmd quoting/path handling entirely.
  if (npmExecPath && existsSync(npmExecPath)) {
    run(process.execPath, [npmExecPath, ...args], cwd);
    return;
  }

  if (process.platform === "win32") {
    run(process.env.ComSpec ?? "cmd.exe", ["/d", "/s", "/c", "npm", ...args], cwd);
    return;
  }

  run("npm", args, cwd);
}

function runNextBuild(root, web) {
  const nextBin = path.join(root, "node_modules", "next", "dist", "bin", "next");
  if (!existsSync(nextBin)) {
    throw new Error(`Next.js was not installed at ${nextBin}`);
  }
  run(process.execPath, [nextBin, "build"], web);
}

const ignoredParts = new Set([
  ".git",
  ".next",
  ".turbo",
  "coverage",
  "dist",
  "node_modules",
]);

function shouldCopy(sourcePath) {
  const relative = path.relative(repoRoot, sourcePath);
  if (!relative || relative.startsWith("..")) return true;
  return !relative.split(path.sep).some((part) => ignoredParts.has(part));
}

async function copyWorkspace(sourceRoot, destinationRoot) {
  const rootPackagePath = path.join(sourceRoot, "package.json");
  const lockPath = path.join(sourceRoot, "package-lock.json");
  if (!existsSync(rootPackagePath) || !existsSync(lockPath)) {
    throw new Error("RepoWise root package.json/package-lock.json is missing");
  }

  await mkdir(destinationRoot, { recursive: true });
  await cp(rootPackagePath, path.join(destinationRoot, "package.json"));
  await cp(lockPath, path.join(destinationRoot, "package-lock.json"));

  const npmrc = path.join(sourceRoot, ".npmrc");
  if (existsSync(npmrc)) await cp(npmrc, path.join(destinationRoot, ".npmrc"));

  const rootPackage = JSON.parse(await readFile(rootPackagePath, "utf8"));
  const workspaces = Array.isArray(rootPackage.workspaces)
    ? rootPackage.workspaces
    : rootPackage.workspaces?.packages ?? [];

  for (const workspace of workspaces) {
    if (typeof workspace !== "string" || workspace.includes("*")) {
      throw new Error(`Unsupported workspace pattern: ${String(workspace)}`);
    }

    const source = path.join(sourceRoot, workspace);
    if (!existsSync(source)) throw new Error(`Workspace is missing: ${workspace}`);

    const destination = path.join(destinationRoot, workspace);
    await mkdir(path.dirname(destination), { recursive: true });
    await cp(source, destination, {
      recursive: true,
      filter: shouldCopy,
      force: true,
    });
  }
}

async function replaceBuild(stagedWebDir) {
  const stagedNext = path.join(stagedWebDir, ".next");
  const stagedServer = path.join(
    stagedNext,
    "standalone",
    "packages",
    "web",
    "server.js",
  );
  if (!existsSync(stagedServer)) {
    throw new Error("Next.js standalone server was not produced");
  }

  const destinationNext = path.join(webDir, ".next");
  await rm(destinationNext, { recursive: true, force: true });
  await cp(stagedNext, destinationNext, { recursive: true, force: true });
}

async function main() {
  // Next's metadata webpack loader embeds absolute source paths into generated
  // JavaScript. Apostrophes in paths such as `King's College London` can make
  // that generated module invalid, and native npm modules are also prone to
  // being locked by sync clients. Build outside synced paths and copy only the
  // completed standalone bundle back.
  const normalized = repoRoot.toLowerCase();
  const needsSafeBuild = normalized.includes("onedrive") || repoRoot.includes("'");

  if (!needsSafeBuild) {
    runNextBuild(repoRoot, webDir);
    return;
  }

  const stageRoot = await mkdtemp(path.join(tmpdir(), "repowise-web-build-"));
  try {
    console.log("[repowise] Building web UI outside the synced project path...");
    await copyWorkspace(repoRoot, stageRoot);
    runNpm(["ci"], stageRoot);

    const stagedWebDir = path.join(stageRoot, "packages", "web");
    runNextBuild(stageRoot, stagedWebDir);
    await replaceBuild(stagedWebDir);
  } finally {
    await rm(stageRoot, { recursive: true, force: true }).catch(() => {});
  }
}

main().catch((error) => {
  fail(error instanceof Error ? error.message : String(error));
});
