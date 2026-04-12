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
  const gdprState = options.gdprState || {};
  const hubspotState = options.hubspotState || {};
  const runtimeDiagnostics = options.runtimeDiagnostics || null;

  const checks = [];

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
      "runtime_state",
      "Runtime state storage",
      runtimeDiagnostics && runtimeDiagnostics.lastPersistSucceeded !== false ? "PASS" : "FAIL",
      runtimeDiagnostics
        ? `State file ${runtimeDiagnostics.stateFilePath}. Recovered corrupt state: ${Boolean(runtimeDiagnostics.stateLoadRecovered)}.`
        : "Runtime diagnostics unavailable."
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
    failures,
    warnings,
    checks
  };
}

module.exports = {
  createSystemReport
};
