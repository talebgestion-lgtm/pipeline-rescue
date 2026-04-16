const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");
const { resolveAppPaths } = require("../lib/app-paths");

test("resolveAppPaths defaults runtime storage to bundled app data", () => {
  const appRoot = path.resolve(__dirname, "..");
  const appPaths = resolveAppPaths({ appRoot });

  assert.equal(appPaths.runtimeStorageMode, "IN_PLACE");
  assert.equal(appPaths.runtimeDir, path.join(appRoot, "data"));
  assert.equal(appPaths.runtimeStatePath, path.join(appRoot, "data", "runtime-state.json"));
  assert.equal(appPaths.bootstrapReportPath, path.join(appRoot, "data", "bootstrap-report.json"));
  assert.equal(appPaths.fixturesPath, path.join(appRoot, "data", "scenario-inputs.json"));
});

test("resolveAppPaths supports an external runtime directory override", () => {
  const appRoot = path.resolve(__dirname, "..");
  const appPaths = resolveAppPaths({
    appRoot,
    runtimeDir: "runtime"
  });

  assert.equal(appPaths.runtimeStorageMode, "EXTERNAL_RUNTIME_DIR");
  assert.equal(appPaths.runtimeDir, path.join(appRoot, "runtime"));
  assert.equal(appPaths.gdprConfigPath, path.join(appRoot, "runtime", "gdpr-config.json"));
  assert.equal(appPaths.bootstrapReportPath, path.join(appRoot, "runtime", "bootstrap-report.json"));
  assert.equal(appPaths.fixturesPath, path.join(appRoot, "data", "scenario-inputs.json"));
});
