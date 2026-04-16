const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

function createTimestampToken() {
  return new Date().toISOString().replace(/[:.]/g, "-");
}

function isProcessRunning(pid) {
  if (!Number.isInteger(pid) || pid <= 0) {
    return false;
  }

  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    if (error && error.code === "EPERM") {
      return true;
    }

    return false;
  }
}

function writeJsonAtomic(filePath, payload, flags = "w") {
  const tempFilePath = `${filePath}.tmp`;
  fs.mkdirSync(path.dirname(filePath), { recursive: true });

  if (flags.includes("x")) {
    const fileHandle = fs.openSync(filePath, flags);
    try {
      fs.writeFileSync(fileHandle, JSON.stringify(payload, null, 2));
    } finally {
      fs.closeSync(fileHandle);
    }
    return;
  }

  fs.writeFileSync(tempFilePath, JSON.stringify(payload, null, 2));
  fs.renameSync(tempFilePath, filePath);
}

function readLockPayload(lockPath) {
  return JSON.parse(fs.readFileSync(lockPath, "utf8"));
}

function archiveStaleLock(appPaths, payload) {
  const archivePath = path.join(
    appPaths.runtimeLogsDir,
    `stale-runtime-lock-${createTimestampToken()}.json`
  );
  writeJsonAtomic(archivePath, payload);
  fs.rmSync(appPaths.runtimeLockPath, { force: true });
  return archivePath;
}

function buildOwnedLockState(appPaths) {
  const owner = {
    pid: process.pid,
    hostname: os.hostname(),
    acquiredAt: new Date().toISOString(),
    runtimeDir: appPaths.runtimeDir,
    storageMode: appPaths.runtimeStorageMode,
    lockVersion: 1
  };

  return {
    status: "ACQUIRED",
    owner,
    lockPath: appPaths.runtimeLockPath,
    staleLockArchivePath: null
  };
}

function acquireRuntimeLock(appPaths) {
  const lockState = buildOwnedLockState(appPaths);

  try {
    writeJsonAtomic(appPaths.runtimeLockPath, lockState.owner, "wx");
    return lockState;
  } catch (error) {
    if (!error || error.code !== "EEXIST") {
      throw error;
    }
  }

  let existingPayload = null;
  try {
    existingPayload = readLockPayload(appPaths.runtimeLockPath);
  } catch (error) {
    existingPayload = {
      pid: null,
      acquiredAt: null,
      detail: "Existing lock file was unreadable."
    };
  }

  if (isProcessRunning(existingPayload.pid)) {
    const blockingError = new Error(
      `Runtime directory is already locked by process ${existingPayload.pid}.`
    );
    blockingError.statusCode = 409;
    blockingError.runtimeLockState = {
      status: "BLOCKED",
      owner: existingPayload,
      lockPath: appPaths.runtimeLockPath,
      staleLockArchivePath: null
    };
    throw blockingError;
  }

  const archivePath = archiveStaleLock(appPaths, existingPayload);
  const nextLockState = buildOwnedLockState(appPaths);
  nextLockState.staleLockArchivePath = archivePath;
  writeJsonAtomic(appPaths.runtimeLockPath, nextLockState.owner, "wx");
  return nextLockState;
}

function releaseRuntimeLock(lockState) {
  if (!lockState || lockState.status !== "ACQUIRED" || !lockState.lockPath) {
    return false;
  }

  if (!fs.existsSync(lockState.lockPath)) {
    return false;
  }

  try {
    const payload = readLockPayload(lockState.lockPath);
    if (payload.pid !== lockState.owner.pid || payload.acquiredAt !== lockState.owner.acquiredAt) {
      return false;
    }

    fs.rmSync(lockState.lockPath, { force: true });
    return true;
  } catch (_error) {
    return false;
  }
}

module.exports = {
  acquireRuntimeLock,
  isProcessRunning,
  releaseRuntimeLock
};
