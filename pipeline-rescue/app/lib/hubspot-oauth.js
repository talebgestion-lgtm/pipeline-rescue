function invalidHubSpotConfig(message) {
  const error = new Error(message);
  error.statusCode = 400;
  return error;
}

function validateHubSpotConfigPayload(payload) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    throw invalidHubSpotConfig("HubSpot config body must be a JSON object.");
  }

  if (typeof payload.enabled !== "boolean") {
    throw invalidHubSpotConfig("HubSpot config enabled must be boolean.");
  }

  if (typeof payload.clientId !== "string") {
    throw invalidHubSpotConfig("HubSpot config clientId must be a string.");
  }

  if (typeof payload.clientSecretEnvVar !== "string" || !/^[A-Z][A-Z0-9_]*$/.test(payload.clientSecretEnvVar)) {
    throw invalidHubSpotConfig("HubSpot config clientSecretEnvVar must be an uppercase environment variable name.");
  }

  if (typeof payload.redirectUri !== "string" || !payload.redirectUri.trim()) {
    throw invalidHubSpotConfig("HubSpot config redirectUri is required.");
  }

  try {
    new URL(payload.redirectUri);
  } catch (error) {
    throw invalidHubSpotConfig("HubSpot config redirectUri must be a valid URL.");
  }

  if (!Array.isArray(payload.scopes) || payload.scopes.some((item) => typeof item !== "string" || !item.trim())) {
    throw invalidHubSpotConfig("HubSpot config scopes must be a non-empty string array.");
  }

  if (!payload.scopes.includes("oauth")) {
    throw invalidHubSpotConfig("HubSpot config scopes must include oauth.");
  }

  if (!Array.isArray(payload.optionalScopes) || payload.optionalScopes.some((item) => typeof item !== "string" || !item.trim())) {
    throw invalidHubSpotConfig("HubSpot config optionalScopes must be a string array.");
  }

  if (payload.preferredAccountId != null && !/^\d+$/.test(String(payload.preferredAccountId))) {
    throw invalidHubSpotConfig("HubSpot config preferredAccountId must be numeric when provided.");
  }

  return {
    enabled: payload.enabled,
    clientId: payload.clientId.trim(),
    clientSecretEnvVar: payload.clientSecretEnvVar.trim(),
    redirectUri: payload.redirectUri.trim(),
    scopes: payload.scopes.map((item) => item.trim()),
    optionalScopes: payload.optionalScopes.map((item) => item.trim()),
    preferredAccountId: payload.preferredAccountId == null || payload.preferredAccountId === ""
      ? null
      : String(payload.preferredAccountId)
  };
}

function createDefaultInstallState() {
  return {
    installs: []
  };
}

function normalizeInstallState(payload) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return createDefaultInstallState();
  }

  return {
    installs: Array.isArray(payload.installs) ? payload.installs : []
  };
}

function createHubSpotStatus({ config, env = process.env, installState = createDefaultInstallState() }) {
  const normalizedConfig = validateHubSpotConfigPayload(config);
  const normalizedInstallState = normalizeInstallState(installState);
  const clientSecretPresent = Boolean(env[normalizedConfig.clientSecretEnvVar]);
  const installCount = normalizedInstallState.installs.length;
  const configReady = Boolean(normalizedConfig.clientId) && Boolean(normalizedConfig.redirectUri) && normalizedConfig.scopes.length > 0;

  const blockers = [];
  if (!normalizedConfig.enabled) {
    blockers.push("HubSpot integration is disabled.");
  }
  if (!normalizedConfig.clientId) {
    blockers.push("HubSpot client ID is missing.");
  }
  if (!clientSecretPresent) {
    blockers.push(`Missing ${normalizedConfig.clientSecretEnvVar} in the process environment.`);
  }

  let status = "DISABLED";
  if (normalizedConfig.enabled && !configReady) {
    status = "CONFIGURED_BLOCKED";
  } else if (normalizedConfig.enabled && configReady && !clientSecretPresent) {
    status = "CONFIGURED_BLOCKED";
  } else if (normalizedConfig.enabled && configReady && clientSecretPresent && installCount === 0) {
    status = "READY_FOR_INSTALL";
  } else if (normalizedConfig.enabled && configReady && clientSecretPresent && installCount > 0) {
    status = "READY";
  }

  return {
    status,
    summary:
      status === "READY"
        ? `HubSpot OAuth is configured and ${installCount} portal install(s) are stored locally.`
        : status === "READY_FOR_INSTALL"
          ? "HubSpot OAuth is configured and ready for the first install."
          : status === "CONFIGURED_BLOCKED"
            ? "HubSpot OAuth is partially configured but still blocked."
            : "HubSpot live integration is disabled.",
    checks: [
      {
        status: normalizedConfig.enabled ? "PASS" : "WARN",
        label: "Integration enabled",
        detail: normalizedConfig.enabled ? "HubSpot integration is enabled." : "HubSpot integration is disabled."
      },
      {
        status: normalizedConfig.clientId ? "PASS" : "WARN",
        label: "Client ID",
        detail: normalizedConfig.clientId ? "Client ID is configured." : "Client ID is missing."
      },
      {
        status: clientSecretPresent ? "PASS" : "WARN",
        label: "Client secret environment",
        detail: clientSecretPresent ? `${normalizedConfig.clientSecretEnvVar} is present.` : `${normalizedConfig.clientSecretEnvVar} is missing.`
      },
      {
        status: installCount > 0 ? "PASS" : "WARN",
        label: "Stored installs",
        detail: `${installCount} local install(s) recorded.`
      }
    ],
    blockers,
    installCount,
    configSnapshot: {
      clientId: normalizedConfig.clientId,
      clientSecretEnvVar: normalizedConfig.clientSecretEnvVar,
      redirectUri: normalizedConfig.redirectUri,
      scopes: normalizedConfig.scopes,
      optionalScopes: normalizedConfig.optionalScopes,
      preferredAccountId: normalizedConfig.preferredAccountId
    },
    installs: normalizedInstallState.installs.map((item) => ({
      portalId: item.portalId,
      hubDomain: item.hubDomain || null,
      connectedAt: item.connectedAt,
      scope: item.scope || null
    }))
  };
}

function buildHubSpotInstallUrl({ config, state, accountId }) {
  const normalizedConfig = validateHubSpotConfigPayload(config);
  if (!normalizedConfig.clientId) {
    throw invalidHubSpotConfig("HubSpot client ID is required to build the install URL.");
  }

  const baseUrl = accountId
    ? `https://app.hubspot.com/oauth/${encodeURIComponent(String(accountId))}/authorize`
    : "https://app.hubspot.com/oauth/authorize";

  const url = new URL(baseUrl);
  url.searchParams.set("client_id", normalizedConfig.clientId);
  url.searchParams.set("redirect_uri", normalizedConfig.redirectUri);
  url.searchParams.set("scope", normalizedConfig.scopes.join(" "));

  if (normalizedConfig.optionalScopes.length > 0) {
    url.searchParams.set("optional_scope", normalizedConfig.optionalScopes.join(" "));
  }

  if (state) {
    url.searchParams.set("state", state);
  }

  return url.toString();
}

async function exchangeHubSpotAuthCode({ config, code, env = process.env, fetchImpl = globalThis.fetch }) {
  const normalizedConfig = validateHubSpotConfigPayload(config);
  if (!normalizedConfig.clientId) {
    throw invalidHubSpotConfig("HubSpot client ID is required for token exchange.");
  }

  const clientSecret = env[normalizedConfig.clientSecretEnvVar];
  if (!clientSecret) {
    const error = new Error(`Missing ${normalizedConfig.clientSecretEnvVar} in the process environment.`);
    error.statusCode = 409;
    throw error;
  }

  if (!code || typeof code !== "string") {
    throw invalidHubSpotConfig("HubSpot OAuth code is required.");
  }

  if (typeof fetchImpl !== "function") {
    const error = new Error("Global fetch is not available in this Node runtime.");
    error.statusCode = 500;
    throw error;
  }

  const body = new URLSearchParams({
    grant_type: "authorization_code",
    client_id: normalizedConfig.clientId,
    client_secret: clientSecret,
    redirect_uri: normalizedConfig.redirectUri,
    code
  });

  const response = await fetchImpl("https://api.hubapi.com/oauth/v3/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded;charset=utf-8"
    },
    body: body.toString()
  });

  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    const error = new Error(
      payload && payload.message
        ? `HubSpot token exchange failed: ${payload.message}`
        : `HubSpot token exchange failed with status ${response.status}.`
    );
    error.statusCode = response.status;
    throw error;
  }

  return {
    portalId: payload.hub_id ? String(payload.hub_id) : null,
    hubDomain: payload.hub_domain || null,
    accessToken: payload.access_token,
    refreshToken: payload.refresh_token,
    expiresIn: payload.expires_in,
    tokenType: payload.token_type,
    scope: payload.scope || null,
    connectedAt: new Date().toISOString()
  };
}

module.exports = {
  buildHubSpotInstallUrl,
  createDefaultInstallState,
  createHubSpotStatus,
  exchangeHubSpotAuthCode,
  normalizeInstallState,
  validateHubSpotConfigPayload
};
