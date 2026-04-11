const fs = require("node:fs");
const path = require("node:path");

function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function copyRecursive(sourcePath, targetPath, options = {}) {
  const { exclude = new Set() } = options;
  const sourceStat = fs.statSync(sourcePath);

  if (sourceStat.isDirectory()) {
    ensureDir(targetPath);
    for (const entry of fs.readdirSync(sourcePath)) {
      if (exclude.has(entry)) {
        continue;
      }

      copyRecursive(
        path.join(sourcePath, entry),
        path.join(targetPath, entry),
        options
      );
    }
    return;
  }

  ensureDir(path.dirname(targetPath));
  fs.copyFileSync(sourcePath, targetPath);
}

function writeTextFile(filePath, content) {
  ensureDir(path.dirname(filePath));
  fs.writeFileSync(filePath, content);
}

function buildRelease(options = {}) {
  const appRoot = options.appRoot || path.resolve(__dirname, "..");
  const outputDir = options.outputDir || path.join(appRoot, "release", "pipeline-rescue-portable");
  const packageManifest = JSON.parse(fs.readFileSync(path.join(appRoot, "package.json"), "utf8"));
  const appDir = path.join(outputDir, "app");

  fs.rmSync(outputDir, { recursive: true, force: true });
  ensureDir(appDir);

  for (const asset of ["server.js", "package.json", "README.md", ".env.example", "data", "lib", "public"]) {
    copyRecursive(path.join(appRoot, asset), path.join(appDir, asset), {
      exclude: new Set(["runtime-state.json", "release"])
    });
  }

  writeTextFile(
    path.join(outputDir, "launch-pipeline-rescue.cmd"),
    `@echo off
setlocal
set PORT=4179
cd /d "%~dp0app"
where node >nul 2>nul
if errorlevel 1 (
  echo Node.js 20+ is required to run Pipeline Rescue.
  echo Download Node.js from https://nodejs.org/ and rerun this launcher.
  pause
  exit /b 1
)
start "" cmd /c "timeout /t 2 >nul && start http://localhost:%PORT%"
node server.js
`
  );

  writeTextFile(
    path.join(outputDir, "README.txt"),
    `Pipeline Rescue portable package

Version: ${packageManifest.version}

How to run on Windows:
1. Install Node.js 20 or later.
2. Open launch-pipeline-rescue.cmd.
3. The browser opens on http://localhost:4179.

This package contains:
- deterministic rescue analysis
- operator feedback loop
- GDPR compliance gate
- installable PWA shell

The application remains deployment-blocked until the real GDPR config is completed.
`
  );

  writeTextFile(
    path.join(outputDir, "build-metadata.json"),
    JSON.stringify(
      {
        product: "Pipeline Rescue",
        version: packageManifest.version,
        generatedAt: new Date().toISOString(),
        entrypoint: "launch-pipeline-rescue.cmd"
      },
      null,
      2
    )
  );

  return {
    outputDir,
    appDir,
    launcherPath: path.join(outputDir, "launch-pipeline-rescue.cmd")
  };
}

if (require.main === module) {
  const result = buildRelease();
  console.log(`Portable release created in ${result.outputDir}`);
}

module.exports = {
  buildRelease
};
