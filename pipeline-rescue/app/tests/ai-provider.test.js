const test = require("node:test");
const assert = require("node:assert/strict");
const { createAiProviderStatus, validateAiProviderConfigPayload } = require("../lib/ai-provider");

test("AI provider status stays disabled when no provider is selected", () => {
  const report = createAiProviderStatus({
    config: {
      provider: "NONE",
      enabled: false,
      allowLiveGeneration: false,
      baseUrl: "https://api.openai.com/v1",
      model: "gpt-5.4-mini",
      apiKeyEnvVar: "OPENAI_API_KEY",
      requestTimeoutMs: 15000,
      temperature: 0.2,
      maxOutputTokens: 900
    },
    env: {}
  });

  assert.equal(report.status, "DISABLED");
  assert.match(report.summary, /deterministic local logic/);
});

test("AI provider status becomes ready when config and env are complete", () => {
  const report = createAiProviderStatus({
    config: {
      provider: "OPENAI",
      enabled: true,
      allowLiveGeneration: true,
      baseUrl: "https://api.openai.com/v1",
      model: "gpt-5.4-mini",
      apiKeyEnvVar: "OPENAI_API_KEY",
      requestTimeoutMs: 15000,
      temperature: 0.2,
      maxOutputTokens: 900
    },
    env: {
      OPENAI_API_KEY: "test-key"
    }
  });

  assert.equal(report.status, "READY");
});

test("AI provider validator rejects invalid env variable names", () => {
  assert.throws(
    () => validateAiProviderConfigPayload({
      provider: "OPENAI",
      enabled: true,
      allowLiveGeneration: true,
      baseUrl: "https://api.openai.com/v1",
      model: "gpt-5.4-mini",
      apiKeyEnvVar: "openai-key",
      requestTimeoutMs: 15000,
      temperature: 0.2,
      maxOutputTokens: 900
    }),
    /apiKeyEnvVar/
  );
});
