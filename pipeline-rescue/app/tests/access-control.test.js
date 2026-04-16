const test = require("node:test");
const assert = require("node:assert/strict");

const {
  createAccessStatus,
  ensureAccess,
  readAccessConfig,
  verifyAccessToken
} = require("../lib/access-control");

test("readAccessConfig defaults to disabled mode", () => {
  const config = readAccessConfig({});
  assert.equal(config.mode, "DISABLED");
  assert.equal(config.tokenEnvVar, "PIPELINE_RESCUE_ACCESS_TOKEN");
});

test("createAccessStatus reports a protected instance when secret is configured", () => {
  const status = createAccessStatus({
    mode: "SHARED_SECRET",
    tokenEnvVar: "PIPELINE_RESCUE_ACCESS_TOKEN",
    configuredToken: "secret"
  });

  assert.equal(status.status, "PROTECTED");
  assert.equal(status.protectedRoutes, true);
});

test("verifyAccessToken and ensureAccess reject invalid secrets", () => {
  const config = {
    mode: "SHARED_SECRET",
    tokenEnvVar: "PIPELINE_RESCUE_ACCESS_TOKEN",
    configuredToken: "secret"
  };

  assert.equal(verifyAccessToken(config, "wrong").ok, false);

  assert.throws(
    () => ensureAccess({
      headers: {
        authorization: "Bearer wrong"
      }
    }, {
      config,
      status: createAccessStatus(config)
    }),
    (error) => error.statusCode === 401
  );
});

test("ensureAccess accepts the configured bearer token", () => {
  const config = {
    mode: "SHARED_SECRET",
    tokenEnvVar: "PIPELINE_RESCUE_ACCESS_TOKEN",
    configuredToken: "secret"
  };

  assert.doesNotThrow(() => ensureAccess({
    headers: {
      authorization: "Bearer secret"
    }
  }, {
    config,
    status: createAccessStatus(config)
  }));
});
