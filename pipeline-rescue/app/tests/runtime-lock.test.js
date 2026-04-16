const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const { acquireRuntimeLock, releaseRuntimeLock } = require("../lib/runtime-lock");

function createAppPaths(tempDir) {
  return {
    runtimeDir: tempDir,
    runtimeStorageMode: "EXTERNAL_RUNTIME_DIR",
    runtimeLogsDir: path.join(tempDir, "logs"),
    runtimeLockPath: path.join(tempDir, "runtime.lock.json")
  };
}

test("acquireRuntimeLock creates and releases an owned lock", () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "pipeline-rescue-lock-"));

  try {
    const appPaths = createAppPaths(tempDir);
    fs.mkdirSync(appPaths.runtimeLogsDir, { recursive: true });

    const lockState = acquireRuntimeLock(appPaths);
    assert.equal(lockState.status, "ACQUIRED");
    assert.equal(fs.existsSync(appPaths.runtimeLockPath), true);
    assert.equal(releaseRuntimeLock(lockState), true);
    assert.equal(fs.existsSync(appPaths.runtimeLockPath), false);
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

test("acquireRuntimeLock blocks when a live owner already holds the lock", () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "pipeline-rescue-lock-"));

  try {
    const appPaths = createAppPaths(tempDir);
    fs.mkdirSync(appPaths.runtimeLogsDir, { recursive: true });
    fs.writeFileSync(
      appPaths.runtimeLockPath,
      JSON.stringify({
        pid: process.pid,
        acquiredAt: "2026-04-16T20:00:00.000Z",
        hostname: "local"
      }, null, 2)
    );

    assert.throws(
      () => acquireRuntimeLock(appPaths),
      (error) => error.statusCode === 409 && /already locked/.test(error.message)
    );
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

test("acquireRuntimeLock archives stale locks before taking ownership", () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "pipeline-rescue-lock-"));

  try {
    const appPaths = createAppPaths(tempDir);
    fs.mkdirSync(appPaths.runtimeLogsDir, { recursive: true });
    fs.writeFileSync(
      appPaths.runtimeLockPath,
      JSON.stringify({
        pid: 999999,
        acquiredAt: "2026-04-16T18:00:00.000Z",
        hostname: "stale-host"
      }, null, 2)
    );

    const lockState = acquireRuntimeLock(appPaths);
    assert.equal(lockState.status, "ACQUIRED");
    assert.equal(Boolean(lockState.staleLockArchivePath), true);
    assert.equal(fs.existsSync(lockState.staleLockArchivePath), true);
    assert.equal(releaseRuntimeLock(lockState), true);
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});
