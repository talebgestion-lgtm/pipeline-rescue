function buildCheck(code, label, status, detail) {
  return {
    code,
    label,
    status,
    detail
  };
}

function createSystemReport(options) {
  const startupError = options.startupError || null;
  const packageManifest = options.packageManifest || {};
  const fixtures = options.fixtures || null;
  const accessState = options.accessState || null;
  const gdprState = options.gdprState || {};
  const hubspotState = options.hubspotState || {};
  const appPaths = options.appPaths || {};
  const runtimeBootstrapReport = options.runtimeBootstrapReport || null;
  const runtimeDiagnostics = options.runtimeDiagnostics || null;
  const runtimeLock = options.runtimeLock || null;
  const runtimeSnapshots = Array.isArray(options.runtimeSnapshots) ? options.runtimeSnapshots : [];
  const latestSnapshot = runtimeSnapshots[0] || null;

  const checks = [];

  checks.push(
    buildCheck(
      "access_control",
      "Access control",
      accessState && accessState.status && accessState.status.status === "MISCONFIGURED"
        ? "FAIL"
        : accessState && accessState.status && accessState.status.status === "PROTECTED"
          ? "PASS"
          : "WARN",
      accessState && accessState.status
        ? accessState.status.summary
        : "Access control state unavailable."
    )
  );

  checks.push(
    buildCheck(
      "bootstrap",
      "Application bootstrap",
      startupError ? "FAIL" : "PASS",
      startupError || "Core application bootstrapped."
    )
  );

  checks.push(
    buildCheck(
      "scenario_catalog",
      "Scenario inputs loaded",
      fixtures && fixtures.scenarios && Object.keys(fixtures.scenarios).length > 0 ? "PASS" : "FAIL",
      fixtures && fixtures.defaultScenario
        ? `${Object.keys(fixtures.scenarios || {}).length} scenario(s), default ${fixtures.defaultScenario}.`
        : "Scenario catalog is unavailable."
    )
  );

  checks.push(
    buildCheck(
      "runtime_layout",
      "Runtime storage layout",
      appPaths.runtimeStorageMode === "EXTERNAL_RUNTIME_DIR" && !runtimeBootstrapReport ? "WARN" : "PASS",
      appPaths.runtimeDir
        ? appPaths.runtimeStorageMode === "EXTERNAL_RUNTIME_DIR"
          ? runtimeBootstrapReport
            ? `External runtime dir ${appPaths.runtimeDir}. Bootstrap report generated at ${runtimeBootstrapReport.generatedAt}.`
            : `External runtime dir ${appPaths.runtimeDir}. Bootstrap report not found yet.`
          : `Bundled runtime dir ${appPaths.runtimeDir}.`
        : "Runtime path information unavailable."
    )
  );

  checks.push(
    buildCheck(
      "runtime_lock",
      "Runtime lock ownership",
      runtimeLock && runtimeLock.status === "BLOCKED" ? "FAIL" : "PASS",
      runtimeLock
        ? runtimeLock.status === "ACQUIRED"
          ? `Runtime lock owned by process ${runtimeLock.owner.pid} at ${runtimeLock.lockPath}.`
          : `Runtime lock blocked by process ${runtimeLock.owner && runtimeLock.owner.pid ? runtimeLock.owner.pid : "unknown"} at ${runtimeLock.lockPath}.`
        : "Runtime lock state unavailable."
    )
  );

  checks.push(
    buildCheck(
      "runtime_state",
      "Runtime state storage",
      runtimeDiagnostics && runtimeDiagnostics.lastPersistSucceeded !== false ? "PASS" : "FAIL",
      runtimeDiagnostics
        ? `State index ${runtimeDiagnostics.stateIndexPath || runtimeDiagnostics.stateFilePath}. Format ${runtimeDiagnostics.stateStorageFormat || "unknown"} with ${runtimeDiagnostics.scenarioShardCount || 0} scenario shard(s). Recovered corrupt state: ${Boolean(runtimeDiagnostics.stateLoadRecovered)}.`
        : "Runtime diagnostics unavailable."
    )
  );

  checks.push(
    buildCheck(
      "runtime_journal",
      "Runtime journal",
      runtimeDiagnostics && runtimeDiagnostics.archivedCorruptJournalPath ? "WARN" : "PASS",
      runtimeDiagnostics
        ? `Journal file ${runtimeDiagnostics.journalFilePath || "unavailable"}. Entries loaded: ${runtimeDiagnostics.journalEntriesLoaded || 0}. Journal replay used: ${Boolean(runtimeDiagnostics.journalReplayUsed)}.`
        : "Runtime journal diagnostics unavailable."
    )
  );

  checks.push(
    buildCheck(
      "gdpr_config",
      "GDPR configuration",
      gdprState.error ? "FAIL" : "PASS",
      gdprState.error
        ? gdprState.error
        : gdprState.complianceReport
          ? `Compliance status: ${gdprState.complianceReport.status}.`
          : "GDPR configuration not loaded."
    )
  );

  if (hubspotState.hubspotStatus || hubspotState.error) {
    checks.push(
      buildCheck(
        "hubspot_oauth",
        "HubSpot OAuth",
        hubspotState.error ? "FAIL" : "PASS",
        hubspotState.error
          ? hubspotState.error
          : `HubSpot status: ${hubspotState.hubspotStatus.status}.`
      )
    );
  }

  const failures = checks.filter((check) => check.status === "FAIL");
  const warnings = [];

  if (runtimeDiagnostics && runtimeDiagnostics.stateLoadRecovered) {
    warnings.push("A corrupt runtime-state file was archived and a clean state was rebuilt.");
  }

  if (runtimeDiagnostics && runtimeDiagnostics.journalReplayUsed) {
    warnings.push("Runtime state was rebuilt from the append-only journal.");
  }

  if (runtimeDiagnostics && runtimeDiagnostics.archivedCorruptJournalPath) {
    warnings.push(`A corrupt runtime journal was archived to ${runtimeDiagnostics.archivedCorruptJournalPath}.`);
  }

  if (runtimeDiagnostics && Array.isArray(runtimeDiagnostics.archivedCorruptScenarioShardPaths) && runtimeDiagnostics.archivedCorruptScenarioShardPaths.length > 0) {
    warnings.push(`One or more corrupt scenario shards were archived (${runtimeDiagnostics.archivedCorruptScenarioShardPaths.length}).`);
  }

  if (runtimeDiagnostics && runtimeDiagnostics.legacyStateMigrated) {
    warnings.push("A legacy runtime-state snapshot was migrated into structured scenario shards.");
  }

  if (appPaths.runtimeStorageMode === "EXTERNAL_RUNTIME_DIR" && !runtimeBootstrapReport) {
    warnings.push("External runtime storage is enabled but no bootstrap report was found yet.");
  }

  if (runtimeLock && runtimeLock.status === "ACQUIRED" && runtimeLock.staleLockArchivePath) {
    warnings.push(`A stale runtime lock was archived to ${runtimeLock.staleLockArchivePath}.`);
  }

  if (accessState && accessState.status && accessState.status.status === "DISABLED") {
    warnings.push("Access control is disabled for this instance.");
  }

  if (gdprState.complianceReport && gdprState.complianceReport.status === "BLOCKED_FOR_DEPLOYMENT") {
    warnings.push("GDPR strict mode is blocking deployment until mandatory controls are documented.");
  }

  if (hubspotState.hubspotStatus && hubspotState.hubspotStatus.status !== "READY") {
    warnings.push(`HubSpot live integration status is ${hubspotState.hubspotStatus.status}.`);
  }

  const status = failures.length > 0
    ? "ERROR"
    : warnings.length > 0
      ? "DEGRADED"
      : "READY";

  return {
    productName: "Pipeline Rescue",
    version: packageManifest.version || "unknown",
    status,
    readiness: status === "READY",
    runtime: {
      storageMode: appPaths.runtimeStorageMode || "unknown",
      runtimeDir: appPaths.runtimeDir || null,
      runtimeStatePath: runtimeDiagnostics ? runtimeDiagnostics.stateFilePath : null,
      runtimeStateIndexPath: runtimeDiagnostics ? (runtimeDiagnostics.stateIndexPath || runtimeDiagnostics.stateFilePath) : null,
      runtimeStateFormat: runtimeDiagnostics ? (runtimeDiagnostics.stateStorageFormat || "unknown") : "unknown",
      runtimeScenarioStoreDir: runtimeDiagnostics ? runtimeDiagnostics.scenarioStoreDir || null : null,
      runtimeScenarioShardCount: runtimeDiagnostics ? runtimeDiagnostics.scenarioShardCount || 0 : 0,
      runtimeJournalPath: runtimeDiagnostics ? runtimeDiagnostics.journalFilePath : (appPaths.runtimeJournalPath || null),
      runtimeJournalEntriesLoaded: runtimeDiagnostics ? runtimeDiagnostics.journalEntriesLoaded || 0 : 0,
      runtimeJournalReplayUsed: runtimeDiagnostics ? Boolean(runtimeDiagnostics.journalReplayUsed) : false,
      runtimeLastMaintenanceAt: runtimeDiagnostics ? runtimeDiagnostics.lastMaintenanceAt || null : null,
      runtimeLastMaintenanceType: runtimeDiagnostics ? runtimeDiagnostics.lastMaintenanceType || null : null,
      runtimeLockPath: runtimeLock ? runtimeLock.lockPath : (appPaths.runtimeLockPath || null),
      runtimeLockStatus: runtimeLock ? runtimeLock.status : "unknown",
      runtimeLockOwnerPid: runtimeLock && runtimeLock.owner ? runtimeLock.owner.pid || null : null,
      snapshotCount: runtimeSnapshots.length,
      latestSnapshotAt: latestSnapshot ? latestSnapshot.createdAt : null,
      latestSnapshotId: latestSnapshot ? latestSnapshot.snapshotId : null,
      bootstrapReportPresent: Boolean(runtimeBootstrapReport),
      bootstrapGeneratedAt: runtimeBootstrapReport ? runtimeBootstrapReport.generatedAt : null
    },
    access: accessState && accessState.status
      ? {
        mode: accessState.status.mode,
        status: accessState.status.status,
        protectedRoutes: accessState.status.protectedRoutes,
        tokenEnvVar: accessState.status.tokenEnvVar
      }
      : null,
    failures,
    warnings,
    checks
  };
}

module.exports = {
  createSystemReport
};
