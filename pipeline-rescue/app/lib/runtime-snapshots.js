const fs = require("node:fs");
const path = require("node:path");
const { buildSupportBundle, validateSupportBundlePayload } = require("./support-bundle");

function createSnapshotId() {
  return `snapshot-${new Date().toISOString().replace(/[:.]/g, "-")}`;
}

function validateSnapshotId(snapshotId) {
  if (!snapshotId || typeof snapshotId !== "string" || !/^snapshot-[A-Za-z0-9-]+$/.test(snapshotId)) {
    const error = new Error("Invalid runtime snapshot id.");
    error.statusCode = 400;
    throw error;
  }

  return snapshotId;
}

function resolveSnapshotPaths(appPaths, snapshotId) {
  const safeSnapshotId = validateSnapshotId(snapshotId);
  const snapshotDir = path.join(appPaths.runtimeSnapshotsDir, safeSnapshotId);

  return {
    snapshotId: safeSnapshotId,
    snapshotDir,
    manifestPath: path.join(snapshotDir, "manifest.json"),
    bundlePath: path.join(snapshotDir, "support-bundle.json")
  };
}

function writeJsonAtomic(filePath, payload) {
  const tempFilePath = `${filePath}.tmp`;
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(tempFilePath, JSON.stringify(payload, null, 2));
  fs.renameSync(tempFilePath, filePath);
}

function readJsonSafe(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function summarizeSnapshot(manifest, snapshotId) {
  return {
    snapshotId,
    label: manifest.label || snapshotId,
    createdAt: manifest.createdAt || null,
    reason: manifest.reason || null,
    version: manifest.version || "unknown",
    systemStatus: manifest.systemStatus || "unknown",
    runtimeStorageMode: manifest.runtimeStorageMode || "unknown",
    scenarioCount: Number.isFinite(manifest.scenarioCount) ? manifest.scenarioCount : 0,
    path: manifest.path || null
  };
}

function createRuntimeSnapshot(options = {}) {
  const appPaths = options.appPaths || {};
  const packageManifest = options.packageManifest || {};
  const systemReport = options.systemReport || null;
  const runtimeBootstrapReport = options.runtimeBootstrapReport || null;
  const runtimeExport = options.runtimeExport || null;
  const gdprState = options.gdprState || {};
  const aiPolicyState = options.aiPolicyState || {};
  const aiProviderState = options.aiProviderState || {};
  const hubspotState = options.hubspotState || {};
  const pilotConfigState = options.pilotConfigState || {};
  const reason = options.reason || "Manual snapshot";

  const bundle = buildSupportBundle({
    appPaths,
    packageManifest,
    systemReport,
    runtimeBootstrapReport,
    runtimeExport,
    gdprState,
    aiPolicyState,
    aiProviderState,
    hubspotState,
    pilotConfigState
  });

  const snapshotId = createSnapshotId();
  const paths = resolveSnapshotPaths(appPaths, snapshotId);
  const createdAt = new Date().toISOString();
  const manifest = {
    snapshotId,
    label: `Runtime snapshot ${createdAt}`,
    createdAt,
    reason,
    version: packageManifest.version || "unknown",
    systemStatus: systemReport ? systemReport.status : "unknown",
    runtimeStorageMode: appPaths.runtimeStorageMode || "unknown",
    scenarioCount: bundle.runtime && bundle.runtime.exportState && bundle.runtime.exportState.scenarios
      ? Object.keys(bundle.runtime.exportState.scenarios).length
      : 0,
    path: paths.snapshotDir
  };

  fs.mkdirSync(paths.snapshotDir, { recursive: true });
  writeJsonAtomic(paths.bundlePath, bundle);
  writeJsonAtomic(paths.manifestPath, manifest);

  return {
    ...summarizeSnapshot(manifest, snapshotId),
    bundlePath: paths.bundlePath
  };
}

function listRuntimeSnapshots(appPaths) {
  if (!fs.existsSync(appPaths.runtimeSnapshotsDir)) {
    return [];
  }

  return fs.readdirSync(appPaths.runtimeSnapshotsDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && /^snapshot-/.test(entry.name))
    .map((entry) => {
      try {
        const paths = resolveSnapshotPaths(appPaths, entry.name);
        if (!fs.existsSync(paths.manifestPath)) {
          return null;
        }

        return summarizeSnapshot(readJsonSafe(paths.manifestPath), entry.name);
      } catch (_error) {
        return null;
      }
    })
    .filter(Boolean)
    .sort((left, right) => String(right.createdAt || "").localeCompare(String(left.createdAt || "")));
}

function loadRuntimeSnapshotBundle(appPaths, snapshotId) {
  const paths = resolveSnapshotPaths(appPaths, snapshotId);
  if (!fs.existsSync(paths.bundlePath)) {
    const error = new Error("Runtime snapshot bundle not found.");
    error.statusCode = 404;
    throw error;
  }

  const bundle = validateSupportBundlePayload(readJsonSafe(paths.bundlePath));
  return {
    snapshotId: paths.snapshotId,
    snapshotDir: paths.snapshotDir,
    bundle
  };
}

module.exports = {
  createRuntimeSnapshot,
  listRuntimeSnapshots,
  loadRuntimeSnapshotBundle,
  validateSnapshotId
};
