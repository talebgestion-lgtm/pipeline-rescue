function sanitizeHubSpotInstallState(installState) {
  const installs = Array.isArray(installState && installState.installs) ? installState.installs : [];

  return {
    installCount: installs.length,
    installs: installs.map((install) => ({
      portalId: install.portalId || null,
      hubDomain: install.hubDomain || null,
      connectedAt: install.connectedAt || null,
      expiresAt: install.expiresAt || null,
      scope: install.scope || null
    }))
  };
}

function buildSupportBundle(options = {}) {
  const appPaths = options.appPaths || {};
  const packageManifest = options.packageManifest || {};
  const systemReport = options.systemReport || null;
  const deploymentProfile = options.deploymentProfile || null;
  const runtimeIntegrityReport = options.runtimeIntegrityReport || null;
  const runtimeBootstrapReport = options.runtimeBootstrapReport || null;
  const runtimeExport = options.runtimeExport || null;
  const gdprState = options.gdprState || {};
  const aiPolicyState = options.aiPolicyState || {};
  const aiProviderState = options.aiProviderState || {};
  const hubspotState = options.hubspotState || {};

  return {
    bundleVersion: 1,
    generatedAt: new Date().toISOString(),
    product: {
      name: "Pipeline Rescue",
      version: packageManifest.version || "unknown"
    },
    runtime: {
      storageMode: appPaths.runtimeStorageMode || "unknown",
      runtimeDir: appPaths.runtimeDir || null,
      runtimeStatePath: runtimeExport ? runtimeExport.stateFilePath : null,
      runtimeStateIndexPath: runtimeExport ? (runtimeExport.stateIndexPath || runtimeExport.stateFilePath) : null,
      runtimeStateFormat: runtimeExport ? runtimeExport.stateStorageFormat || "unknown" : "unknown",
      runtimeScenarioStoreDir: runtimeExport ? runtimeExport.scenarioStoreDir || null : null,
      runtimeScenarioShardCount: runtimeExport ? runtimeExport.scenarioShardCount || 0 : 0,
      integrityReport: runtimeIntegrityReport,
      bootstrapReportPath: appPaths.bootstrapReportPath || null,
      bootstrapReport: runtimeBootstrapReport,
      exportState: runtimeExport
    },
    systemReport,
    deploymentProfile,
    compliance: {
      error: gdprState.error || null,
      report: gdprState.complianceReport || null,
      config: gdprState.gdprConfig || null
    },
    ai: {
      policy: aiPolicyState.aiPolicy || null,
      policyError: aiPolicyState.error || null,
      providerConfig: aiProviderState.aiProviderConfig || null,
      providerStatus: aiProviderState.aiProviderStatus || null,
      providerError: aiProviderState.error || null
    },
    hubspot: {
      error: hubspotState.error || null,
      config: hubspotState.hubspotConfig || null,
      status: hubspotState.hubspotStatus || null,
      installState: sanitizeHubSpotInstallState(hubspotState.installState)
    }
  };
}

function validateSupportBundlePayload(payload) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    const error = new Error("Support bundle body must be a JSON object.");
    error.statusCode = 400;
    throw error;
  }

  if (payload.bundleVersion !== 1) {
    const error = new Error("Unsupported support bundle version.");
    error.statusCode = 400;
    throw error;
  }

  if (!payload.runtime || typeof payload.runtime !== "object" || Array.isArray(payload.runtime)) {
    const error = new Error("Support bundle runtime section is required.");
    error.statusCode = 400;
    throw error;
  }

  if (
    !payload.runtime.exportState
    || typeof payload.runtime.exportState !== "object"
    || Array.isArray(payload.runtime.exportState)
  ) {
    const error = new Error("Support bundle runtime export state is required.");
    error.statusCode = 400;
    throw error;
  }

  return payload;
}

module.exports = {
  buildSupportBundle,
  validateSupportBundlePayload
};
