const fs = require("node:fs");
const path = require("node:path");

function resolveOptionalPath(baseDir, inputPath) {
  if (!inputPath) {
    return null;
  }

  return path.isAbsolute(inputPath)
    ? inputPath
    : path.resolve(baseDir, inputPath);
}

function resolveAppPaths(options = {}) {
  const appRoot = options.appRoot || path.resolve(__dirname, "..");
  const bundledDataDir = path.join(appRoot, "data");
  const runtimeDir = resolveOptionalPath(
    appRoot,
    options.runtimeDir || process.env.PIPELINE_RESCUE_RUNTIME_DIR || null
  ) || bundledDataDir;

  return {
    appRoot,
    publicDir: path.join(appRoot, "public"),
    bundledDataDir,
    runtimeDir,
    runtimeBackupsDir: path.join(runtimeDir, "backups"),
    runtimeSnapshotsDir: path.join(runtimeDir, "snapshots"),
    runtimeLogsDir: path.join(runtimeDir, "logs"),
    bootstrapReportPath: path.join(runtimeDir, "bootstrap-report.json"),
    runtimeStorageMode: path.resolve(runtimeDir) === path.resolve(bundledDataDir)
      ? "IN_PLACE"
      : "EXTERNAL_RUNTIME_DIR",
    fixturesPath: path.join(bundledDataDir, "scenario-inputs.json"),
    gdprConfigDefaultPath: path.join(bundledDataDir, "gdpr-config.json"),
    gdprConfigPath: path.join(runtimeDir, "gdpr-config.json"),
    aiPolicyDefaultPath: path.join(bundledDataDir, "ai-policy.json"),
    aiPolicyPath: path.join(runtimeDir, "ai-policy.json"),
    aiProviderConfigDefaultPath: path.join(bundledDataDir, "ai-provider-config.json"),
    aiProviderConfigPath: path.join(runtimeDir, "ai-provider-config.json"),
    hubspotConfigDefaultPath: path.join(bundledDataDir, "hubspot-config.json"),
    hubspotConfigPath: path.join(runtimeDir, "hubspot-config.json"),
    hubspotInstallStatePath: path.join(runtimeDir, "hubspot-install-state.json"),
    runtimeStatePath: path.join(runtimeDir, "runtime-state.json"),
    packagePath: path.join(appRoot, "package.json"),
    envPath: path.join(appRoot, ".env")
  };
}

function ensureRuntimeLayout(appPaths) {
  fs.mkdirSync(appPaths.runtimeDir, { recursive: true });
  fs.mkdirSync(appPaths.runtimeBackupsDir, { recursive: true });
  fs.mkdirSync(appPaths.runtimeSnapshotsDir, { recursive: true });
  fs.mkdirSync(appPaths.runtimeLogsDir, { recursive: true });
}

function listRuntimeSeedFiles(appPaths) {
  return [
    {
      label: "GDPR config",
      sourcePath: appPaths.gdprConfigDefaultPath,
      targetPath: appPaths.gdprConfigPath
    },
    {
      label: "AI policy",
      sourcePath: appPaths.aiPolicyDefaultPath,
      targetPath: appPaths.aiPolicyPath
    },
    {
      label: "AI provider config",
      sourcePath: appPaths.aiProviderConfigDefaultPath,
      targetPath: appPaths.aiProviderConfigPath
    },
    {
      label: "HubSpot config",
      sourcePath: appPaths.hubspotConfigDefaultPath,
      targetPath: appPaths.hubspotConfigPath
    }
  ];
}

module.exports = {
  ensureRuntimeLayout,
  listRuntimeSeedFiles,
  resolveAppPaths
};
