const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { bootstrapRuntime } = require("../scripts/bootstrap-runtime");

test("bootstrapRuntime seeds runtime config files and writes a report", () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "pipeline-rescue-bootstrap-"));

  try {
    const appRoot = path.resolve(__dirname, "..");
    const runtimeDir = path.join(tempDir, "runtime");
    const result = bootstrapRuntime({ appRoot, runtimeDir });

    assert.equal(result.report.runtimeStorageMode, "EXTERNAL_RUNTIME_DIR");
    assert.equal(fs.existsSync(path.join(runtimeDir, "gdpr-config.json")), true);
    assert.equal(fs.existsSync(path.join(runtimeDir, "ai-policy.json")), true);
    assert.equal(fs.existsSync(path.join(runtimeDir, "ai-provider-config.json")), true);
    assert.equal(fs.existsSync(path.join(runtimeDir, "hubspot-config.json")), true);
    assert.equal(fs.existsSync(path.join(runtimeDir, "pilot-config.json")), true);
    assert.equal(fs.existsSync(path.join(runtimeDir, "hubspot-install-state.json")), true);
    assert.equal(fs.existsSync(path.join(runtimeDir, "bootstrap-report.json")), true);
    assert.equal(
      JSON.parse(fs.readFileSync(path.join(runtimeDir, "hubspot-install-state.json"), "utf8")).installs.length,
      0
    );
    assert.deepEqual(
      result.report.seededFiles.map((entry) => entry.action),
      ["seeded", "seeded", "seeded", "seeded", "seeded", "seeded"]
    );
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

test("bootstrapRuntime preserves existing runtime files on rerun", () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "pipeline-rescue-bootstrap-"));

  try {
    const appRoot = path.resolve(__dirname, "..");
    const runtimeDir = path.join(tempDir, "runtime");
    bootstrapRuntime({ appRoot, runtimeDir });

    const gdprConfigPath = path.join(runtimeDir, "gdpr-config.json");
    const customGdpr = JSON.parse(fs.readFileSync(gdprConfigPath, "utf8"));
    customGdpr.controller.name = "Custom Controller";
    fs.writeFileSync(gdprConfigPath, JSON.stringify(customGdpr, null, 2));

    const rerun = bootstrapRuntime({ appRoot, runtimeDir });

    assert.equal(
      JSON.parse(fs.readFileSync(gdprConfigPath, "utf8")).controller.name,
      "Custom Controller"
    );
    assert.deepEqual(
      rerun.report.seededFiles.map((entry) => entry.action),
      ["preserved", "preserved", "preserved", "preserved", "preserved", "preserved"]
    );
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});
