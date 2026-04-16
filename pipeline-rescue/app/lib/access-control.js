const crypto = require("node:crypto");

const ACCESS_MODES = new Set(["DISABLED", "SHARED_SECRET"]);
const DEFAULT_TOKEN_ENV_VAR = "PIPELINE_RESCUE_ACCESS_TOKEN";

function invalidAccessConfig(message) {
  const error = new Error(message);
  error.statusCode = 500;
  return error;
}

function readAccessConfig(env = process.env) {
  const mode = String(env.PIPELINE_RESCUE_ACCESS_MODE || "DISABLED").trim().toUpperCase();
  if (!ACCESS_MODES.has(mode)) {
    throw invalidAccessConfig("PIPELINE_RESCUE_ACCESS_MODE must be DISABLED or SHARED_SECRET.");
  }

  const tokenEnvVar = String(env.PIPELINE_RESCUE_ACCESS_TOKEN_ENV_VAR || DEFAULT_TOKEN_ENV_VAR).trim() || DEFAULT_TOKEN_ENV_VAR;
  const configuredToken = env[tokenEnvVar] || "";

  return {
    mode,
    tokenEnvVar,
    configuredToken
  };
}

function createAccessStatus(config) {
  const normalizedConfig = config || readAccessConfig();
  const missingSecret = normalizedConfig.mode === "SHARED_SECRET" && !normalizedConfig.configuredToken;
  const status = normalizedConfig.mode === "DISABLED"
    ? "DISABLED"
    : missingSecret
      ? "MISCONFIGURED"
      : "PROTECTED";

  return {
    mode: normalizedConfig.mode,
    status,
    protectedRoutes: normalizedConfig.mode !== "DISABLED",
    tokenEnvVar: normalizedConfig.tokenEnvVar,
    summary: status === "DISABLED"
      ? "Access control is disabled for this instance."
      : status === "MISCONFIGURED"
        ? `Access control is enabled but ${normalizedConfig.tokenEnvVar} is missing from the environment.`
        : `Access control is enabled. API requests require the shared secret from ${normalizedConfig.tokenEnvVar}.`
  };
}

function extractAccessToken(request) {
  const authorizationHeader = request.headers.authorization || "";
  const bearerMatch = authorizationHeader.match(/^Bearer\s+(.+)$/i);
  if (bearerMatch) {
    return bearerMatch[1].trim();
  }

  const headerToken = request.headers["x-pipeline-rescue-key"];
  return typeof headerToken === "string" ? headerToken.trim() : "";
}

function timingSafeEqualString(left, right) {
  const leftBuffer = Buffer.from(String(left), "utf8");
  const rightBuffer = Buffer.from(String(right), "utf8");
  if (leftBuffer.length !== rightBuffer.length) {
    return false;
  }

  return crypto.timingSafeEqual(leftBuffer, rightBuffer);
}

function verifyAccessToken(config, candidateToken) {
  const normalizedConfig = config || readAccessConfig();
  const status = createAccessStatus(normalizedConfig);

  if (status.status === "DISABLED") {
    return {
      ok: true,
      status
    };
  }

  if (status.status === "MISCONFIGURED") {
    return {
      ok: false,
      status
    };
  }

  return {
    ok: Boolean(candidateToken) && timingSafeEqualString(normalizedConfig.configuredToken, candidateToken),
    status
  };
}

function ensureAccess(request, accessState) {
  if (!accessState || accessState.status === "DISABLED") {
    return;
  }

  if (accessState.status === "MISCONFIGURED") {
    const error = new Error("Access control is enabled but misconfigured.");
    error.statusCode = 503;
    error.detail = accessState.summary;
    throw error;
  }

  const token = extractAccessToken(request);
  const verification = verifyAccessToken(accessState.config, token);
  if (!verification.ok) {
    const error = new Error("Unauthorized");
    error.statusCode = 401;
    error.detail = "Provide the configured shared secret to access protected API routes.";
    throw error;
  }
}

module.exports = {
  createAccessStatus,
  ensureAccess,
  extractAccessToken,
  readAccessConfig,
  verifyAccessToken
};
