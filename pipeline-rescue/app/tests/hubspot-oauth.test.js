const test = require("node:test");
const assert = require("node:assert/strict");
const {
  buildHubSpotInstallUrl,
  createHubSpotStatus,
  exchangeHubSpotAuthCode,
  validateHubSpotConfigPayload
} = require("../lib/hubspot-oauth");

const validConfig = {
  enabled: true,
  clientId: "client_123",
  clientSecretEnvVar: "HUBSPOT_CLIENT_SECRET",
  redirectUri: "http://localhost:4179/api/hubspot/oauth/callback",
  scopes: ["oauth", "crm.objects.deals.read"],
  optionalScopes: ["crm.objects.tasks.write"],
  preferredAccountId: null
};

test("buildHubSpotInstallUrl builds the expected OAuth URL", () => {
  const url = buildHubSpotInstallUrl({
    config: validConfig,
    state: "state_123",
    accountId: "123456"
  });

  assert.match(url, /oauth\/123456\/authorize/);
  assert.match(url, /client_id=client_123/);
  assert.match(url, /state=state_123/);
  assert.match(url, /optional_scope=/);
});

test("createHubSpotStatus reports ready-for-install when config is complete", () => {
  const report = createHubSpotStatus({
    config: validConfig,
    env: { HUBSPOT_CLIENT_SECRET: "secret" },
    installState: { installs: [] }
  });

  assert.equal(report.status, "READY_FOR_INSTALL");
});

test("exchangeHubSpotAuthCode parses a successful token exchange response", async () => {
  const result = await exchangeHubSpotAuthCode({
    config: validConfig,
    code: "code_123",
    env: { HUBSPOT_CLIENT_SECRET: "secret" },
    fetchImpl: async () => ({
      ok: true,
      json: async () => ({
        hub_id: 123456,
        hub_domain: "demo.hubspot.com",
        access_token: "access_token",
        refresh_token: "refresh_token",
        expires_in: 1800,
        token_type: "bearer",
        scope: "oauth crm.objects.deals.read"
      })
    })
  });

  assert.equal(result.portalId, "123456");
  assert.equal(result.refreshToken, "refresh_token");
});

test("validateHubSpotConfigPayload rejects a config without oauth scope", () => {
  assert.throws(
    () => validateHubSpotConfigPayload({
      ...validConfig,
      scopes: ["crm.objects.deals.read"]
    }),
    /must include oauth/
  );
});
