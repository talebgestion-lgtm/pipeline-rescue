const ALLOWED_PROVIDERS = new Set(["NONE", "OPENAI"]);

function invalidProvider(message) {
  const error = new Error(message);
  error.statusCode = 400;
  return error;
}

function validateAiProviderConfigPayload(payload) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    throw invalidProvider("AI provider config body must be a JSON object.");
  }

  if (!ALLOWED_PROVIDERS.has(payload.provider)) {
    throw invalidProvider("AI provider config provider is invalid.");
  }

  if (typeof payload.enabled !== "boolean") {
    throw invalidProvider("AI provider config enabled must be boolean.");
  }

  if (typeof payload.allowLiveGeneration !== "boolean") {
    throw invalidProvider("AI provider config allowLiveGeneration must be boolean.");
  }

  if (typeof payload.baseUrl !== "string" || !payload.baseUrl.trim()) {
    throw invalidProvider("AI provider config baseUrl is required.");
  }

  try {
    new URL(payload.baseUrl);
  } catch (error) {
    throw invalidProvider("AI provider config baseUrl must be a valid URL.");
  }

  if (typeof payload.model !== "string" || !payload.model.trim()) {
    throw invalidProvider("AI provider config model is required.");
  }

  if (typeof payload.apiKeyEnvVar !== "string" || !/^[A-Z][A-Z0-9_]*$/.test(payload.apiKeyEnvVar)) {
    throw invalidProvider("AI provider config apiKeyEnvVar must be an uppercase environment variable name.");
  }

  if (!Number.isInteger(payload.requestTimeoutMs) || payload.requestTimeoutMs < 1000) {
    throw invalidProvider("AI provider config requestTimeoutMs must be an integer >= 1000.");
  }

  if (typeof payload.temperature !== "number" || Number.isNaN(payload.temperature) || payload.temperature < 0 || payload.temperature > 2) {
    throw invalidProvider("AI provider config temperature must be a number between 0 and 2.");
  }

  if (!Number.isInteger(payload.maxOutputTokens) || payload.maxOutputTokens < 1) {
    throw invalidProvider("AI provider config maxOutputTokens must be a positive integer.");
  }

  return payload;
}

function createAiProviderStatus({ config, env = process.env }) {
  const normalizedConfig = validateAiProviderConfigPayload(config);
  const apiKeyPresent = normalizedConfig.provider !== "NONE" && Boolean(env[normalizedConfig.apiKeyEnvVar]);
  const checks = [
    {
      status: normalizedConfig.provider === "NONE" ? "WARN" : "PASS",
      label: "Provider selection",
      detail: normalizedConfig.provider === "NONE" ? "No live provider selected." : `Provider is ${normalizedConfig.provider}.`
    },
    {
      status: normalizedConfig.enabled ? "PASS" : "WARN",
      label: "Provider enabled",
      detail: normalizedConfig.enabled ? "Live provider path is enabled." : "Live provider path is disabled."
    },
    {
      status: apiKeyPresent ? "PASS" : "WARN",
      label: "API key environment",
      detail: apiKeyPresent
        ? `${normalizedConfig.apiKeyEnvVar} is present in the environment.`
        : `${normalizedConfig.apiKeyEnvVar} is missing from the environment.`
    },
    {
      status: normalizedConfig.allowLiveGeneration ? "PASS" : "WARN",
      label: "Live generation switch",
      detail: normalizedConfig.allowLiveGeneration
        ? "Live generation is allowed by config."
        : "Live generation is disabled by config."
    }
  ];

  const blockers = [];
  if (normalizedConfig.provider === "NONE") {
    blockers.push("No AI provider is selected.");
  }
  if (!normalizedConfig.enabled) {
    blockers.push("AI provider path is disabled.");
  }
  if (normalizedConfig.provider !== "NONE" && !apiKeyPresent) {
    blockers.push(`Missing ${normalizedConfig.apiKeyEnvVar} in the process environment.`);
  }
  if (!normalizedConfig.allowLiveGeneration) {
    blockers.push("Live generation is intentionally disabled.");
  }

  let status = "DISABLED";
  if (normalizedConfig.provider !== "NONE" || normalizedConfig.enabled) {
    status = blockers.length === 0 ? "READY" : "CONFIGURED_BLOCKED";
  }

  return {
    status,
    summary:
      status === "READY"
        ? `Provider ${normalizedConfig.provider} is configured for live generation with model ${normalizedConfig.model}.`
        : status === "CONFIGURED_BLOCKED"
          ? `Provider ${normalizedConfig.provider} is configured but not yet ready for live generation.`
          : "No live AI provider is active. The application stays on deterministic local logic.",
    provider: normalizedConfig.provider,
    model: normalizedConfig.model,
    checks,
    blockers,
    configSnapshot: {
      enabled: normalizedConfig.enabled,
      allowLiveGeneration: normalizedConfig.allowLiveGeneration,
      baseUrl: normalizedConfig.baseUrl,
      apiKeyEnvVar: normalizedConfig.apiKeyEnvVar,
      requestTimeoutMs: normalizedConfig.requestTimeoutMs,
      temperature: normalizedConfig.temperature,
      maxOutputTokens: normalizedConfig.maxOutputTokens
    }
  };
}

module.exports = {
  createAiProviderStatus,
  validateAiProviderConfigPayload
};
