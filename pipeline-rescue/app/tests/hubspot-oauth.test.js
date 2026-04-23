const test = require("node:test");
const assert = require("node:assert/strict");
const {
  buildHubSpotInstallUrl,
  createHubSpotStatus,
  exchangeHubSpotAuthCode,
  getMissingRequiredScopes,
  validateHubSpotConfigPayload
} = require("../lib/hubspot-oauth");

const validConfig = {
  enabled: true,
  authMode: "OAUTH",
  clientId: "client_123",
  clientSecretEnvVar: "HUBSPOT_CLIENT_SECRET",
  privateAppTokenEnvVar: "HUBSPOT_PRIVATE_APP_TOKEN",
  privateAppPortalId: null,
  redirectUri: "http://localhost:4179/api/hubspot/oauth/callback",
  scopes: ["oauth", "crm.objects.deals.read"],
  optionalScopes: ["crm.objects.tasks.write"],
  preferredAccountId: null
};

const privateAppConfig = {
  ...validConfig,
  authMode: "PRIVATE_APP",
  clientId: "",
  scopes: [
    "crm.objects.deals.read",
    "crm.objects.contacts.read",
    "crm.objects.tasks.read",
    "crm.objects.tasks.write",
    "crm.objects.notes.read",
    "crm.objects.notes.write"
  ],
  optionalScopes: [],
  privateAppPortalId: "123456"
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

test("createHubSpotStatus requires reinstall when stored installs miss required scopes", () => {
  const report = createHubSpotStatus({
    config: {
      ...validConfig,
      scopes: ["oauth", "crm.objects.deals.read", "crm.objects.notes.write"]
    },
    env: { HUBSPOT_CLIENT_SECRET: "secret" },
    installState: {
      installs: [
        {
          portalId: "123456",
          scope: "oauth crm.objects.deals.read"
        }
      ]
    }
  });

  assert.equal(report.status, "REINSTALL_REQUIRED");
  assert.match(report.summary, /fresh OAuth install/i);
  assert.deepEqual(report.installs[0].missingRequiredScopes, ["crm.objects.notes.write"]);
});

test("createHubSpotStatus reports ready for private app token mode", () => {
  const report = createHubSpotStatus({
    config: privateAppConfig,
    env: { HUBSPOT_PRIVATE_APP_TOKEN: "pat-na1-token" },
    installState: { installs: [] }
  });

  assert.equal(report.status, "READY");
  assert.equal(report.configSnapshot.authMode, "PRIVATE_APP");
  assert.equal(report.configSnapshot.privateAppTokenEnvVar, "HUBSPOT_PRIVATE_APP_TOKEN");
  assert.equal(report.installCount, 0);
});

test("private app mode accepts CRM scopes without oauth", () => {
  const config = validateHubSpotConfigPayload(privateAppConfig);

  assert.equal(config.authMode, "PRIVATE_APP");
  assert.equal(config.scopes.includes("oauth"), false);
});

test("getMissingRequiredScopes returns the exact missing scope delta", () => {
  assert.deepEqual(
    getMissingRequiredScopes(
      {
        ...validConfig,
        scopes: ["oauth", "crm.objects.deals.read", "crm.objects.tasks.write"]
      },
      {
        scope: "oauth crm.objects.deals.read"
      }
    ),
    ["crm.objects.tasks.write"]
  );
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
  assert.match(result.expiresAt, /^20\d{2}-/);
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
