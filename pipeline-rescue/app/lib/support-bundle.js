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
      bootstrapReportPath: appPaths.bootstrapReportPath || null,
      bootstrapReport: runtimeBootstrapReport,
      exportState: runtimeExport
    },
    systemReport,
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

module.exports = {
  buildSupportBundle
};
