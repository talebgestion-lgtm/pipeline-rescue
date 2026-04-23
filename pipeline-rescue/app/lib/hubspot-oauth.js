function invalidHubSpotConfig(message) {
  const error = new Error(message);
  error.statusCode = 400;
  return error;
}

function createExpiresAt(expiresIn, now = new Date()) {
  if (!Number.isFinite(Number(expiresIn))) {
    return null;
  }

  return new Date(now.getTime() + (Number(expiresIn) * 1000)).toISOString();
}

function validateHubSpotConfigPayload(payload) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    throw invalidHubSpotConfig("HubSpot config body must be a JSON object.");
  }

  if (typeof payload.enabled !== "boolean") {
    throw invalidHubSpotConfig("HubSpot config enabled must be boolean.");
  }

  const authMode = payload.authMode == null ? "OAUTH" : String(payload.authMode).trim().toUpperCase();
  if (authMode !== "OAUTH" && authMode !== "PRIVATE_APP") {
    throw invalidHubSpotConfig("HubSpot config authMode must be OAUTH or PRIVATE_APP.");
  }

  if (typeof payload.clientId !== "string") {
    throw invalidHubSpotConfig("HubSpot config clientId must be a string.");
  }

  if (typeof payload.clientSecretEnvVar !== "string" || !/^[A-Z][A-Z0-9_]*$/.test(payload.clientSecretEnvVar)) {
    throw invalidHubSpotConfig("HubSpot config clientSecretEnvVar must be an uppercase environment variable name.");
  }

  const privateAppTokenEnvVar = payload.privateAppTokenEnvVar == null
    ? "HUBSPOT_PRIVATE_APP_TOKEN"
    : String(payload.privateAppTokenEnvVar).trim();
  if (!/^[A-Z][A-Z0-9_]*$/.test(privateAppTokenEnvVar)) {
    throw invalidHubSpotConfig("HubSpot config privateAppTokenEnvVar must be an uppercase environment variable name.");
  }

  if (payload.privateAppPortalId != null && payload.privateAppPortalId !== "" && !/^\d+$/.test(String(payload.privateAppPortalId))) {
    throw invalidHubSpotConfig("HubSpot config privateAppPortalId must be numeric when provided.");
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

  if (authMode === "OAUTH" && !payload.scopes.includes("oauth")) {
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
    authMode,
    clientId: payload.clientId.trim(),
    clientSecretEnvVar: payload.clientSecretEnvVar.trim(),
    privateAppTokenEnvVar,
    privateAppPortalId: payload.privateAppPortalId == null || payload.privateAppPortalId === ""
      ? null
      : String(payload.privateAppPortalId),
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

function normalizeGrantedScopes(scopeValue) {
  if (typeof scopeValue !== "string") {
    return [];
  }

  return Array.from(new Set(
    scopeValue
      .split(/\s+/)
      .map((item) => item.trim())
      .filter(Boolean)
  ));
}

function getMissingRequiredScopes(config, installRecord) {
  const grantedScopes = new Set(normalizeGrantedScopes(installRecord && installRecord.scope));
  return config.scopes.filter((scope) => !grantedScopes.has(scope));
}

function createHubSpotStatus({ config, env = process.env, installState = createDefaultInstallState() }) {
  const normalizedConfig = validateHubSpotConfigPayload(config);
  const normalizedInstallState = normalizeInstallState(installState);
  const privateAppTokenPresent = Boolean(env[normalizedConfig.privateAppTokenEnvVar]);

  if (normalizedConfig.authMode === "PRIVATE_APP") {
    const blockers = [];
    if (!normalizedConfig.enabled) {
      blockers.push("HubSpot integration is disabled.");
    }
    if (!privateAppTokenPresent) {
      blockers.push(`Missing ${normalizedConfig.privateAppTokenEnvVar} in the process environment.`);
    }

    const status = !normalizedConfig.enabled
      ? "DISABLED"
      : privateAppTokenPresent
        ? "READY"
        : "CONFIGURED_BLOCKED";

    return {
      status,
      summary:
        status === "READY"
          ? "HubSpot Private App token is configured for this local instance."
          : status === "CONFIGURED_BLOCKED"
            ? "HubSpot Private App mode is enabled but the token is missing."
            : "HubSpot live integration is disabled.",
      checks: [
        {
          status: normalizedConfig.enabled ? "PASS" : "WARN",
          label: "Integration enabled",
          detail: normalizedConfig.enabled ? "HubSpot integration is enabled." : "HubSpot integration is disabled."
        },
        {
          status: "PASS",
          label: "Auth mode",
          detail: "Private App token mode is selected."
        },
        {
          status: privateAppTokenPresent ? "PASS" : "WARN",
          label: "Private App token environment",
          detail: privateAppTokenPresent
            ? `${normalizedConfig.privateAppTokenEnvVar} is present.`
            : `${normalizedConfig.privateAppTokenEnvVar} is missing.`
        },
        {
          status: normalizedConfig.scopes.length > 0 ? "PASS" : "WARN",
          label: "Declared scopes",
          detail: `${normalizedConfig.scopes.filter((scope) => scope !== "oauth").length} non-OAuth scope(s) declared for operator guidance.`
        }
      ],
      blockers,
      installCount: 0,
      configSnapshot: {
        authMode: normalizedConfig.authMode,
        privateAppTokenEnvVar: normalizedConfig.privateAppTokenEnvVar,
        privateAppPortalId: normalizedConfig.privateAppPortalId,
        scopes: normalizedConfig.scopes.filter((scope) => scope !== "oauth"),
        optionalScopes: normalizedConfig.optionalScopes,
        preferredAccountId: normalizedConfig.preferredAccountId
      },
      installs: []
    };
  }

  const clientSecretPresent = Boolean(env[normalizedConfig.clientSecretEnvVar]);
  const installCount = normalizedInstallState.installs.length;
  const configReady = Boolean(normalizedConfig.clientId) && Boolean(normalizedConfig.redirectUri) && normalizedConfig.scopes.length > 0;
  const installsWithScopeCoverage = normalizedInstallState.installs.map((item) => ({
    ...item,
    grantedScopes: normalizeGrantedScopes(item.scope),
    missingRequiredScopes: getMissingRequiredScopes(normalizedConfig, item)
  }));
  const preferredInstall = normalizedConfig.preferredAccountId
    ? installsWithScopeCoverage.find((item) => String(item.portalId) === String(normalizedConfig.preferredAccountId))
    : null;
  const compatibleInstallCount = installsWithScopeCoverage.filter((item) => item.missingRequiredScopes.length === 0).length;
  const selectedInstallMissingScopes = preferredInstall ? preferredInstall.missingRequiredScopes : [];

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
  if (installCount > 0 && compatibleInstallCount === 0) {
    blockers.push("Stored HubSpot installs are missing one or more required scopes. Reinstall HubSpot with the current scope set.");
  }
  if (preferredInstall && selectedInstallMissingScopes.length > 0) {
    blockers.push(`Preferred HubSpot install ${preferredInstall.portalId} is missing required scopes: ${selectedInstallMissingScopes.join(", ")}.`);
  }

  let status = "DISABLED";
  if (normalizedConfig.enabled && !configReady) {
    status = "CONFIGURED_BLOCKED";
  } else if (normalizedConfig.enabled && configReady && !clientSecretPresent) {
    status = "CONFIGURED_BLOCKED";
  } else if (normalizedConfig.enabled && configReady && clientSecretPresent && installCount === 0) {
    status = "READY_FOR_INSTALL";
  } else if (
    normalizedConfig.enabled
    && configReady
    && clientSecretPresent
    && installCount > 0
    && (compatibleInstallCount === 0 || selectedInstallMissingScopes.length > 0)
  ) {
    status = "REINSTALL_REQUIRED";
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
          : status === "REINSTALL_REQUIRED"
            ? "Stored HubSpot installs need a fresh OAuth install to match the current required scopes."
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
      },
      {
        status: installCount === 0 || compatibleInstallCount > 0 ? "PASS" : "WARN",
        label: "Required scope coverage",
        detail: installCount === 0
          ? "No install stored yet, so scope coverage will be validated at install time."
          : `${compatibleInstallCount} install(s) satisfy the current required scopes.`
      }
    ],
    blockers,
    installCount,
    configSnapshot: {
      authMode: normalizedConfig.authMode,
      clientId: normalizedConfig.clientId,
      clientSecretEnvVar: normalizedConfig.clientSecretEnvVar,
      privateAppTokenEnvVar: normalizedConfig.privateAppTokenEnvVar,
      privateAppPortalId: normalizedConfig.privateAppPortalId,
      redirectUri: normalizedConfig.redirectUri,
      scopes: normalizedConfig.scopes,
      optionalScopes: normalizedConfig.optionalScopes,
      preferredAccountId: normalizedConfig.preferredAccountId
    },
    installs: installsWithScopeCoverage.map((item) => ({
      portalId: item.portalId,
      hubDomain: item.hubDomain || null,
      connectedAt: item.connectedAt,
      scope: item.scope || null,
      missingRequiredScopes: item.missingRequiredScopes
    }))
  };
}

function buildHubSpotInstallUrl({ config, state, accountId }) {
  const normalizedConfig = validateHubSpotConfigPayload(config);
  if (normalizedConfig.authMode !== "OAUTH") {
    throw invalidHubSpotConfig("HubSpot install URL is only available in OAuth mode.");
  }

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
  if (normalizedConfig.authMode !== "OAUTH") {
    throw invalidHubSpotConfig("HubSpot OAuth code exchange is only available in OAuth mode.");
  }

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
    expiresAt: createExpiresAt(payload.expires_in),
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
  getMissingRequiredScopes,
  normalizeInstallState,
  validateHubSpotConfigPayload
};
