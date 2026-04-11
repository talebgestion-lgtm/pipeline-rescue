const { createAiProviderStatus, validateAiProviderConfigPayload } = require("./ai-provider");

function createProviderError(message, statusCode = 500, detail = null) {
  const error = new Error(message);
  error.statusCode = statusCode;
  if (detail) {
    error.detail = detail;
  }
  return error;
}

function getFetchImplementation(options = {}) {
  const implementation = options.fetchImpl || globalThis.fetch;
  if (typeof implementation !== "function") {
    throw createProviderError("Global fetch is not available in this Node runtime.", 500);
  }

  return implementation;
}

function getApiKey(config, env = process.env) {
  return env[config.apiKeyEnvVar];
}

function ensureProviderReady(config, env = process.env) {
  const status = createAiProviderStatus({ config, env });
  if (status.status !== "READY") {
    throw createProviderError(status.summary, 409, status.blockers.join(" "));
  }

  return status;
}

function buildAbortController(timeoutMs) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  return {
    controller,
    dispose() {
      clearTimeout(timer);
    }
  };
}

function extractResponseText(payload) {
  const output = Array.isArray(payload.output) ? payload.output : [];
  const textParts = [];

  for (const item of output) {
    const content = Array.isArray(item.content) ? item.content : [];
    for (const part of content) {
      if (part.type === "output_text" && typeof part.text === "string") {
        textParts.push(part.text);
      }
    }
  }

  return textParts.join("\n").trim();
}

async function requestOpenAIResponse({ config, instructions, input, env = process.env, fetchImpl }) {
  const normalizedConfig = validateAiProviderConfigPayload(config);
  ensureProviderReady(normalizedConfig, env);

  const apiKey = getApiKey(normalizedConfig, env);
  const requestBody = {
    model: normalizedConfig.model,
    instructions,
    input,
    temperature: normalizedConfig.temperature,
    max_output_tokens: normalizedConfig.maxOutputTokens,
    store: false
  };

  const { controller, dispose } = buildAbortController(normalizedConfig.requestTimeoutMs);

  try {
    const response = await getFetchImplementation({ fetchImpl })(
      `${normalizedConfig.baseUrl.replace(/\/+$/, "")}/responses`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${apiKey}`
        },
        body: JSON.stringify(requestBody),
        signal: controller.signal
      }
    );

    const payload = await response.json().catch(() => null);
    if (!response.ok) {
      throw createProviderError(
        `OpenAI provider request failed with status ${response.status}.`,
        response.status,
        payload && payload.error ? payload.error.message : null
      );
    }

    return {
      provider: normalizedConfig.provider,
      model: payload.model || normalizedConfig.model,
      responseId: payload.id || null,
      outputText: extractResponseText(payload),
      usage: payload.usage || null
    };
  } catch (error) {
    if (error.name === "AbortError") {
      throw createProviderError("OpenAI provider request timed out.", 504);
    }

    if (error.statusCode) {
      throw error;
    }

    throw createProviderError(`OpenAI provider request failed: ${error.message}`, 502);
  } finally {
    dispose();
  }
}

function parseJsonFromModelText(rawText) {
  const cleaned = String(rawText || "")
    .trim()
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/\s*```$/, "");

  try {
    return JSON.parse(cleaned);
  } catch (error) {
    throw createProviderError("Live AI response did not return valid JSON.", 502, cleaned.slice(0, 400));
  }
}

async function probeAiProvider({ config, env = process.env, fetchImpl }) {
  const result = await requestOpenAIResponse({
    config,
    env,
    fetchImpl,
    instructions: "You are a connectivity probe. Reply with READY only.",
    input: "READY"
  });

  return {
    status: "READY",
    summary: result.outputText || "READY",
    provider: result.provider,
    model: result.model,
    responseId: result.responseId,
    usage: result.usage
  };
}

async function generateLiveDraft({ config, env = process.env, analysis, verification, fetchImpl }) {
  if (!analysis || !analysis.dealId) {
    throw createProviderError("Deal analysis is required for live draft generation.", 400);
  }

  if (!analysis.draft || !analysis.draft.eligible) {
    throw createProviderError(`Live draft is blocked by local guardrails: ${analysis.draft?.blockedReason || "UNSAFE"}.`, 409);
  }

  const instructions = [
    "You generate one safe B2B follow-up email draft.",
    "Return JSON only with keys subject and body.",
    "No markdown, no code fences, no extra keys.",
    "Keep the tone professional, concise, and grounded only in the provided facts.",
    "Do not invent dates, stakeholders, or commitments."
  ].join(" ");

  const input = [
    `Deal name: ${analysis.dealName}`,
    `Owner: ${analysis.owner}`,
    `Risk level: ${analysis.riskLevel}`,
    `Rescue score: ${analysis.rescueScore}`,
    `Recommended action: ${analysis.recommendedAction?.summary || "None"}`,
    `Top reason: ${analysis.reasons && analysis.reasons[0] ? `${analysis.reasons[0].label} - ${analysis.reasons[0].evidence}` : "None"}`,
    `Verification status: ${verification?.validationStatus || "UNKNOWN"}`,
    `Existing deterministic draft subject: ${analysis.draft.subject}`,
    `Existing deterministic draft body: ${analysis.draft.body}`
  ].join("\n");

  const result = await requestOpenAIResponse({
    config,
    env,
    fetchImpl,
    instructions,
    input
  });

  const parsed = parseJsonFromModelText(result.outputText);
  if (!parsed || typeof parsed.subject !== "string" || typeof parsed.body !== "string") {
    throw createProviderError("Live AI response is missing subject/body fields.", 502);
  }

  return {
    provider: result.provider,
    model: result.model,
    responseId: result.responseId,
    usage: result.usage,
    draft: {
      subject: parsed.subject.trim(),
      body: parsed.body.trim()
    }
  };
}

module.exports = {
  generateLiveDraft,
  probeAiProvider,
  requestOpenAIResponse
};
