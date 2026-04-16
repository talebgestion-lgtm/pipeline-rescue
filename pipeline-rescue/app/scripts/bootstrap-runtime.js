const fs = require("node:fs");
const path = require("node:path");
const { createDefaultInstallState } = require("../lib/hubspot-oauth");
const {
  ensureRuntimeLayout,
  listRuntimeSeedFiles,
  resolveAppPaths
} = require("../lib/app-paths");

function writeJsonAtomic(filePath, payload) {
  const tempFilePath = `${filePath}.tmp`;
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(tempFilePath, JSON.stringify(payload, null, 2));
  fs.renameSync(tempFilePath, filePath);
}

function seedJsonFile(sourcePath, targetPath) {
  if (fs.existsSync(targetPath)) {
    return {
      targetPath,
      action: "preserved"
    };
  }

  const payload = JSON.parse(fs.readFileSync(sourcePath, "utf8"));
  writeJsonAtomic(targetPath, payload);
  return {
    targetPath,
    action: "seeded"
  };
}

function seedInstallStateFile(targetPath) {
  if (fs.existsSync(targetPath)) {
    return {
      targetPath,
      action: "preserved"
    };
  }

  writeJsonAtomic(targetPath, createDefaultInstallState());
  return {
    targetPath,
    action: "seeded"
  };
}

function bootstrapRuntime(options = {}) {
  const appPaths = resolveAppPaths({
    appRoot: options.appRoot || path.resolve(__dirname, ".."),
    runtimeDir: options.runtimeDir
  });

  ensureRuntimeLayout(appPaths);

  const seededFiles = listRuntimeSeedFiles(appPaths).map((entry) => ({
    label: entry.label,
    ...seedJsonFile(entry.sourcePath, entry.targetPath)
  }));

  seededFiles.push({
    label: "HubSpot install state",
    ...seedInstallStateFile(appPaths.hubspotInstallStatePath)
  });

  const report = {
    product: "Pipeline Rescue",
    generatedAt: new Date().toISOString(),
    runtimeDir: appPaths.runtimeDir,
    runtimeStorageMode: appPaths.runtimeStorageMode,
    seededFiles,
    bootstrapVersion: 1
  };

  writeJsonAtomic(path.join(appPaths.runtimeDir, "bootstrap-report.json"), report);

  return {
    appPaths,
    report
  };
}

if (require.main === module) {
  const result = bootstrapRuntime();
  console.log(`Runtime bootstrapped in ${result.report.runtimeDir}`);
}

module.exports = {
  bootstrapRuntime
};
