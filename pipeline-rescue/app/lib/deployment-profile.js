const fs = require("node:fs");
const path = require("node:path");

function buildCheck(code, label, status, detail, remediation) {
  return {
    code,
    label,
    status,
    detail,
    remediation
  };
}

function createDeploymentProfile(options = {}) {
  const appPaths = options.appPaths || {};
  const accessState = options.accessState || {};
  const gdprState = options.gdprState || {};
  const hubspotState = options.hubspotState || {};
  const aiProviderState = options.aiProviderState || {};

  const artifactPaths = {
    dockerfilePath: path.join(appPaths.appRoot || "", "Dockerfile"),
    dockerignorePath: path.join(appPaths.appRoot || "", ".dockerignore"),
    composePath: path.join(appPaths.appRoot || "", "docker-compose.pilot.yml")
  };

  const artifacts = {
    dockerfilePresent: fs.existsSync(artifactPaths.dockerfilePath),
    dockerignorePresent: fs.existsSync(artifactPaths.dockerignorePath),
    composePresent: fs.existsSync(artifactPaths.composePath)
  };

  const checks = [];

  checks.push(
    buildCheck(
      "deployment_artifacts",
      "Deployment artifacts",
      artifacts.dockerfilePresent && artifacts.dockerignorePresent && artifacts.composePresent ? "PASS" : "FAIL",
      artifacts.dockerfilePresent && artifacts.dockerignorePresent && artifacts.composePresent
        ? "Dockerfile, .dockerignore, and docker-compose.pilot.yml are present."
        : "One or more deployment artifacts are missing.",
      "Ship the container deployment files with the app bundle."
    )
  );

  checks.push(
    buildCheck(
      "runtime_mode",
      "External runtime storage",
      appPaths.runtimeStorageMode === "EXTERNAL_RUNTIME_DIR" ? "PASS" : "WARN",
      appPaths.runtimeStorageMode === "EXTERNAL_RUNTIME_DIR"
        ? `Runtime storage uses ${appPaths.runtimeDir}.`
        : "Runtime storage still points at bundled app data.",
      "Set PIPELINE_RESCUE_RUNTIME_DIR to a writable external volume or host path."
    )
  );

  checks.push(
    buildCheck(
      "access_control",
      "Access protection",
      accessState.status && accessState.status.status === "PROTECTED" ? "PASS" : "FAIL",
      accessState.status
        ? accessState.status.summary
        : "Access control state unavailable.",
      "Enable SHARED_SECRET mode and provide PIPELINE_RESCUE_ACCESS_TOKEN."
    )
  );

  checks.push(
    buildCheck(
      "gdpr_gate",
      "GDPR deployment gate",
      gdprState.complianceReport && gdprState.complianceReport.status === "READY_FOR_FORMAL_REVIEW" ? "PASS" : "FAIL",
      gdprState.complianceReport
        ? `Compliance status is ${gdprState.complianceReport.status}.`
        : gdprState.error || "GDPR compliance report unavailable.",
      "Complete the real GDPR configuration until deployment is no longer blocked."
    )
  );

  checks.push(
    buildCheck(
      "hubspot_live",
      "HubSpot live readiness",
      hubspotState.hubspotStatus && hubspotState.hubspotStatus.status === "READY" ? "PASS" : "WARN",
      hubspotState.hubspotStatus
        ? `HubSpot status is ${hubspotState.hubspotStatus.status}.`
        : hubspotState.error || "HubSpot status unavailable.",
      "Complete the real HubSpot install and scopes on the pilot portal."
    )
  );

  checks.push(
    buildCheck(
      "ai_provider",
      "AI provider readiness",
      aiProviderState.aiProviderStatus && aiProviderState.aiProviderStatus.status === "READY" ? "PASS" : "WARN",
      aiProviderState.aiProviderStatus
        ? `AI provider status is ${aiProviderState.aiProviderStatus.status}.`
        : aiProviderState.error || "AI provider status unavailable.",
      "Configure a live provider and inject the required secret before pilot rollout."
    )
  );

  const failures = checks.filter((item) => item.status === "FAIL");
  const warnings = checks.filter((item) => item.status === "WARN");
  const status = failures.length > 0
    ? "BLOCKED"
    : warnings.length > 0
      ? "NEEDS_HARDENING"
      : "READY_FOR_PILOT";

  return {
    status,
    generatedAt: new Date().toISOString(),
    summary: status === "READY_FOR_PILOT"
      ? "Deployment profile is ready for a pilot rollout."
      : status === "NEEDS_HARDENING"
        ? "Deployment profile is usable but still has hardening gaps."
        : "Deployment profile is blocked by mandatory rollout prerequisites.",
    metrics: {
      failureCount: failures.length,
      warningCount: warnings.length,
      runtimeStorageMode: appPaths.runtimeStorageMode || "unknown",
      accessStatus: accessState.status ? accessState.status.status : "unknown",
      gdprStatus: gdprState.complianceReport ? gdprState.complianceReport.status : "unknown",
      hubspotStatus: hubspotState.hubspotStatus ? hubspotState.hubspotStatus.status : "unknown",
      aiProviderStatus: aiProviderState.aiProviderStatus ? aiProviderState.aiProviderStatus.status : "unknown"
    },
    artifacts: {
      ...artifactPaths,
      ...artifacts
    },
    checks,
    blockers: failures.map((item) => ({
      label: item.label,
      remediation: item.remediation
    })),
    hardening: warnings.map((item) => ({
      label: item.label,
      remediation: item.remediation
    })),
    requiredEnvironment: [
      "PIPELINE_RESCUE_RUNTIME_DIR",
      "PIPELINE_RESCUE_ACCESS_MODE",
      "PIPELINE_RESCUE_ACCESS_TOKEN",
      "HUBSPOT_CLIENT_SECRET",
      "OPENAI_API_KEY"
    ]
  };
}

module.exports = {
  createDeploymentProfile
};
