const fs = require("node:fs");
const path = require("node:path");
const {
  loadStructuredRuntimeState,
  isStructuredRuntimeManifest
} = require("./runtime-state-store");

function buildCheck(code, label, status, detail) {
  return {
    code,
    label,
    status,
    detail
  };
}

function readJsonFile(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function countDirectoryEntries(dirPath) {
  if (!dirPath || !fs.existsSync(dirPath)) {
    return 0;
  }

  return fs.readdirSync(dirPath, { withFileTypes: true }).filter((entry) => entry.isDirectory() || entry.isFile()).length;
}

function inspectRuntimeIntegrity(options = {}) {
  const appPaths = options.appPaths || {};
  const runtimeExport = options.runtimeExport || null;
  const runtimeSnapshots = Array.isArray(options.runtimeSnapshots) ? options.runtimeSnapshots : [];
  const checks = [];
  const warnings = [];
  const failures = [];
  const metrics = {
    runtimeDir: appPaths.runtimeDir || null,
    stateIndexPath: appPaths.runtimeStatePath || null,
    scenarioStoreDir: appPaths.runtimeScenarioStateDir || null,
    journalPath: appPaths.runtimeJournalPath || null,
    runtimeScenarioShardCount: 0,
    orphanScenarioShardCount: 0,
    journalEntries: 0,
    snapshotCount: runtimeSnapshots.length,
    backupCount: countDirectoryEntries(appPaths.runtimeBackupsDir),
    logCount: countDirectoryEntries(appPaths.runtimeLogsDir),
    exportScenarioCount: runtimeExport && runtimeExport.scenarios
      ? Object.keys(runtimeExport.scenarios).length
      : 0
  };

  if (!appPaths.runtimeStatePath || !fs.existsSync(appPaths.runtimeStatePath)) {
    const check = buildCheck(
      "state_index",
      "Runtime state index",
      "FAIL",
      "Runtime state index file is missing."
    );
    checks.push(check);
    failures.push(check);
  } else {
    try {
      const manifest = readJsonFile(appPaths.runtimeStatePath);

      if (!isStructuredRuntimeManifest(manifest)) {
        const check = buildCheck(
          "state_format",
          "Runtime state format",
          "FAIL",
          "Runtime state index is not in SCENARIO_SHARDS_V1 format."
        );
        checks.push(check);
        failures.push(check);
      } else {
        const structured = loadStructuredRuntimeState({
          stateFilePath: appPaths.runtimeStatePath,
          scenarioStoreDir: appPaths.runtimeScenarioStateDir,
          manifestPayload: manifest
        });
        const referencedShardNames = new Set(
          Object.values(manifest.scenarios || {}).map((descriptor) => descriptor.fileName).filter(Boolean)
        );
        const shardFiles = fs.existsSync(appPaths.runtimeScenarioStateDir)
          ? fs.readdirSync(appPaths.runtimeScenarioStateDir).filter((entry) => entry.endsWith(".json"))
          : [];
        const orphanShards = shardFiles.filter((entry) => !referencedShardNames.has(entry));

        metrics.runtimeScenarioShardCount = structured.scenarioShardCount;
        metrics.orphanScenarioShardCount = orphanShards.length;

        checks.push(
          buildCheck(
            "state_index",
            "Runtime state index",
            "PASS",
            `Structured state index loaded from ${appPaths.runtimeStatePath}.`
          )
        );
        checks.push(
          buildCheck(
            "scenario_shards",
            "Scenario shards",
            orphanShards.length > 0 ? "WARN" : "PASS",
            orphanShards.length > 0
              ? `${structured.scenarioShardCount} referenced shard(s) are valid and ${orphanShards.length} orphan shard(s) were found.`
              : `${structured.scenarioShardCount} scenario shard(s) validated.`
          )
        );

        if (orphanShards.length > 0) {
          warnings.push(`${orphanShards.length} orphan scenario shard(s) are present in runtime storage.`);
        }

        if (runtimeExport && runtimeExport.scenarios) {
          const exportedScenarioCount = Object.keys(runtimeExport.scenarios).length;
          const mismatch = exportedScenarioCount !== structured.scenarioShardCount;

          checks.push(
            buildCheck(
              "runtime_export_match",
              "Runtime export consistency",
              mismatch ? "WARN" : "PASS",
              mismatch
                ? `In-memory export exposes ${exportedScenarioCount} scenario(s) while the state index references ${structured.scenarioShardCount}.`
                : `In-memory runtime export matches ${structured.scenarioShardCount} scenario shard(s).`
            )
          );

          if (mismatch) {
            warnings.push("In-memory runtime export does not match the persisted scenario shard count.");
          }
        }
      }
    } catch (error) {
      const check = buildCheck(
        "state_integrity",
        "Runtime state integrity",
        "FAIL",
        error.message
      );
      checks.push(check);
      failures.push(check);
    }
  }

  if (!appPaths.runtimeJournalPath || !fs.existsSync(appPaths.runtimeJournalPath)) {
    const check = buildCheck(
      "runtime_journal",
      "Runtime journal",
      "WARN",
      "Runtime journal file is missing."
    );
    checks.push(check);
    warnings.push("Runtime journal file is missing.");
  } else {
    try {
      const lines = fs.readFileSync(appPaths.runtimeJournalPath, "utf8")
        .split(/\r?\n/)
        .filter(Boolean);

      lines.forEach((line) => JSON.parse(line));
      metrics.journalEntries = lines.length;
      checks.push(
        buildCheck(
          "runtime_journal",
          "Runtime journal",
          "PASS",
          `${lines.length} append-only journal entr${lines.length === 1 ? "y" : "ies"} validated.`
        )
      );
    } catch (error) {
      const check = buildCheck(
        "runtime_journal",
        "Runtime journal",
        "WARN",
        `Runtime journal contains invalid JSON lines: ${error.message}`
      );
      checks.push(check);
      warnings.push("Runtime journal contains invalid JSON lines.");
    }
  }

  const status = failures.length > 0
    ? "ERROR"
    : warnings.length > 0
      ? "WARN"
      : "READY";

  return {
    status,
    checkedAt: new Date().toISOString(),
    metrics,
    warnings,
    failures,
    checks
  };
}

function writeRuntimeMaintenanceReport(appPaths, report) {
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const reportPath = path.join(appPaths.runtimeLogsDir, `runtime-maintenance-${timestamp}.json`);
  const tempPath = `${reportPath}.tmp`;

  fs.mkdirSync(appPaths.runtimeLogsDir, { recursive: true });
  fs.writeFileSync(tempPath, JSON.stringify(report, null, 2));
  fs.renameSync(tempPath, reportPath);

  return reportPath;
}

module.exports = {
  inspectRuntimeIntegrity,
  writeRuntimeMaintenanceReport
};
