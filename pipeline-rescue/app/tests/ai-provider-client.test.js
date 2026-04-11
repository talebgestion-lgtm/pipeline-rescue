const test = require("node:test");
const assert = require("node:assert/strict");
const { probeAiProvider, generateLiveDraft } = require("../lib/ai-provider-client");

const readyConfig = {
  provider: "OPENAI",
  enabled: true,
  allowLiveGeneration: true,
  baseUrl: "https://api.openai.com/v1",
  model: "gpt-5.4-mini",
  apiKeyEnvVar: "OPENAI_API_KEY",
  requestTimeoutMs: 15000,
  temperature: 0.2,
  maxOutputTokens: 900
};

test("probeAiProvider returns READY on a successful provider response", async () => {
  const report = await probeAiProvider({
    config: readyConfig,
    env: { OPENAI_API_KEY: "test-key" },
    fetchImpl: async () => ({
      ok: true,
      json: async () => ({
        id: "resp_probe",
        model: "gpt-5.4-mini",
        output: [
          {
            content: [{ type: "output_text", text: "READY" }]
          }
        ],
        usage: { total_tokens: 10 }
      })
    })
  });

  assert.equal(report.status, "READY");
  assert.equal(report.summary, "READY");
});

test("generateLiveDraft parses subject and body JSON from a provider response", async () => {
  const result = await generateLiveDraft({
    config: readyConfig,
    env: { OPENAI_API_KEY: "test-key" },
    analysis: {
      dealId: "DL-1001",
      dealName: "Acme Expansion",
      owner: "Sarah Lane",
      riskLevel: "CRITICAL",
      rescueScore: 88,
      recommendedAction: { summary: "Send a direct follow-up." },
      reasons: [{ label: "Deal activity is stale", evidence: "No reply in 19 days." }],
      draft: {
        eligible: true,
        subject: "Checking in on next steps",
        body: "Hi team, following up on next steps."
      }
    },
    verification: {
      validationStatus: "VALIDATED"
    },
    fetchImpl: async () => ({
      ok: true,
      json: async () => ({
        id: "resp_live_draft",
        model: "gpt-5.4-mini",
        output: [
          {
            content: [
              {
                type: "output_text",
                text: "{\"subject\":\"Quick check-in on next steps\",\"body\":\"Hi team, I wanted to check in on next steps and see whether a short call this week would help move things forward.\"}"
              }
            ]
          }
        ],
        usage: { total_tokens: 42 }
      })
    })
  });

  assert.equal(result.draft.subject, "Quick check-in on next steps");
  assert.match(result.draft.body, /check in on next steps/);
});
