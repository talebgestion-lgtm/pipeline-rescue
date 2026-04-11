const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { buildRelease } = require("../scripts/build-release");

test("buildRelease creates a portable package without runtime state", () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "pipeline-rescue-release-"));

  try {
    const result = buildRelease({
      appRoot: path.resolve(__dirname, ".."),
      outputDir: path.join(tempDir, "pipeline-rescue-portable")
    });

    assert.equal(fs.existsSync(result.launcherPath), true);
    assert.equal(fs.existsSync(path.join(result.appDir, "server.js")), true);
    assert.equal(fs.existsSync(path.join(result.appDir, ".env.example")), true);
    assert.equal(fs.existsSync(path.join(result.appDir, "public", "manifest.webmanifest")), true);
    assert.equal(fs.existsSync(path.join(result.outputDir, "README.txt")), true);
    assert.equal(fs.existsSync(path.join(result.appDir, "data", "runtime-state.json")), false);
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});
