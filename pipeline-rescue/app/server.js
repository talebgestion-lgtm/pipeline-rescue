const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");
const { buildDealAnalysis, buildOverview } = require("./lib/analysis-engine");
const { createRuntime } = require("./lib/pilot-runtime");
const { createComplianceReport } = require("./lib/gdpr-compliance");
const { createSystemReport } = require("./lib/system-report");
const {
  buildLiveQueueScenario,
  createLiveQueueManagerDigest,
  validateLiveQueueRequestPayload
} = require("./lib/hubspot-live-queue");
const { createAiControlReport, validateAiPolicyPayload } = require("./lib/ai-control");
const { createAiOperationsCycle } = require("./lib/ai-operations");
const { createAiProviderStatus, validateAiProviderConfigPayload } = require("./lib/ai-provider");
const {
  buildHubSpotInstallUrl,
  createDefaultInstallState,
  createHubSpotStatus,
  exchangeHubSpotAuthCode,
  normalizeInstallState,
  validateHubSpotConfigPayload
} = require("./lib/hubspot-oauth");
const { loadEnvFile } = require("./lib/env-loader");
const { createHubSpotDraftNote, createHubSpotRescueTask, loadHubSpotDealPreview } = require("./lib/hubspot-client");
const { probeAiProvider, generateLiveDraft } = require("./lib/ai-provider-client");

const rootDir = __dirname;
const publicDir = path.join(rootDir, "public");
const dataPath = path.join(rootDir, "data", "scenario-inputs.json");
const gdprConfigPath = path.join(rootDir, "data", "gdpr-config.json");
const aiPolicyPath = path.join(rootDir, "data", "ai-policy.json");
const aiProviderConfigPath = path.join(rootDir, "data", "ai-provider-config.json");
const hubspotConfigPath = path.join(rootDir, "data", "hubspot-config.json");
const hubspotInstallStatePath = path.join(rootDir, "data", "hubspot-install-state.json");
const packagePath = path.join(rootDir, "package.json");
const envPath = path.join(rootDir, ".env");
const port = Number(process.env.PORT || 4179);

loadEnvFile(envPath);

function sendJson(response, statusCode, payload) {
  response.writeHead(statusCode, { "Content-Type": "application/json; charset=utf-8" });
  response.end(JSON.stringify(payload, null, 2));
}

function sendText(response, statusCode, contentType, payload) {
  response.writeHead(statusCode, { "Content-Type": contentType });
  response.end(payload);
}

function saveJsonAtomic(filePath, payload) {
  const tempFilePath = `${filePath}.tmp`;
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(tempFilePath, JSON.stringify(payload, null, 2));
  fs.renameSync(tempFilePath, filePath);
}

function stampMetaVersion(payload, version) {
  if (payload && payload.meta && version) {
    payload.meta.version = version;
  }

  return payload;
}

async function buildHubSpotLiveContext({ appState, hubspotState, portalId, dealId }) {
  const preview = await loadHubSpotDealPreview({
    config: hubspotState.hubspotConfig,
    installState: hubspotState.installState,
    portalId,
    dealId,
    analysisTimestamp: new Date().toISOString()
  });

  const liveFixtures = {
    defaultScenario: "hubspot-live-preview",
    stageExpectationsDays: appState.fixtures.stageExpectationsDays,
    scenarios: {
      "hubspot-live-preview": preview.scenario
    }
  };

  const overview = stampMetaVersion(
    buildOverview(liveFixtures, "hubspot-live-preview"),
    appState.packageManifest.version
  );
  const dealAnalysis = stampMetaVersion(
    buildDealAnalysis(liveFixtures, "hubspot-live-preview", preview.normalizedDeal.id),
    appState.packageManifest.version
  );

  return {
    preview,
    overview,
    dealAnalysis
  };
}

async function buildHubSpotLiveQueueContext({ appState, hubspotState, portalId, dealIds }) {
  const analysisTimestamp = new Date().toISOString();
  let installState = hubspotState.installState;
  let tokenRefreshed = false;
  const previews = [];

  for (const dealId of dealIds) {
    const preview = await loadHubSpotDealPreview({
      config: hubspotState.hubspotConfig,
      installState,
      portalId,
      dealId,
      analysisTimestamp
    });

    installState = preview.installState;
    tokenRefreshed = tokenRefreshed || Boolean(preview.source.tokenRefreshed);
    previews.push(preview);
  }

  const liveFixtures = {
    defaultScenario: "hubspot-live-queue",
    stageExpectationsDays: appState.fixtures.stageExpectationsDays,
    scenarios: {
      "hubspot-live-queue": buildLiveQueueScenario(previews, analysisTimestamp)
    }
  };

  const overview = stampMetaVersion(
    buildOverview(liveFixtures, "hubspot-live-queue"),
    appState.packageManifest.version
  );
  const dealAnalyses = previews.map((preview) => stampMetaVersion(
    buildDealAnalysis(liveFixtures, "hubspot-live-queue", preview.normalizedDeal.id),
    appState.packageManifest.version
  ));

  return {
    source: {
      mode: "HUBSPOT_LIVE_QUEUE",
      portalId: previews[0].source.portalId,
      hubDomain: previews[0].source.hubDomain || null,
      fetchedAt: analysisTimestamp,
      tokenRefreshed,
      dealCount: previews.length
    },
    overview,
    deals: previews.map((preview, index) => ({
      source: preview.source,
      normalizedDeal: preview.normalizedDeal,
      normalizationWarnings: preview.normalizationWarnings,
      graph: preview.graph,
      dealAnalysis: dealAnalyses[index]
    })),
    managerDigest: createLiveQueueManagerDigest(overview, previews),
    installState
  };
}

async function resolveHubSpotLiveDraft({ aiProviderState, dealAnalysis }) {
  if (!dealAnalysis || !dealAnalysis.analysis || !dealAnalysis.verification) {
    const error = new Error("A live deal analysis is required before generating a HubSpot draft.");
    error.statusCode = 500;
    throw error;
  }

  if (!dealAnalysis.analysis.draft || !dealAnalysis.analysis.draft.eligible) {
    const error = new Error(`Live draft is blocked by local guardrails: ${dealAnalysis.analysis.draft?.blockedReason || "UNSAFE"}.`);
    error.statusCode = 409;
    throw error;
  }

  if (
    !aiProviderState.error
    && aiProviderState.aiProviderStatus
    && aiProviderState.aiProviderStatus.status === "READY"
    && aiProviderState.aiProviderConfig
    && aiProviderState.aiProviderConfig.allowLiveGeneration
  ) {
    try {
      const liveDraft = await generateLiveDraft({
        config: aiProviderState.aiProviderConfig,
        analysis: dealAnalysis.analysis,
        verification: dealAnalysis.verification
      });

      return {
        mode: "PROVIDER_LIVE",
        provider: liveDraft.provider,
        model: liveDraft.model,
        responseId: liveDraft.responseId || null,
        usage: liveDraft.usage || null,
        draft: liveDraft.draft
      };
    } catch (error) {
      return {
        mode: "DETERMINISTIC_FALLBACK",
        provider: null,
        model: null,
        responseId: null,
        usage: null,
        detail: error.detail || error.message,
        draft: {
          subject: dealAnalysis.analysis.draft.subject,
          body: dealAnalysis.analysis.draft.body
        }
      };
    }
  }

  return {
    mode: "DETERMINISTIC_LOCAL",
    provider: null,
    model: null,
    responseId: null,
    usage: null,
    draft: {
      subject: dealAnalysis.analysis.draft.subject,
      body: dealAnalysis.analysis.draft.body
    }
  };
}

function sendFile(response, filePath, extraHeaders = {}) {
  fs.readFile(filePath, (error, content) => {
    if (error) {
      sendJson(response, 404, { error: "Not found" });
      return;
    }

    const ext = path.extname(filePath);
    const contentType =
      ext === ".html" ? "text/html; charset=utf-8" :
      ext === ".css" ? "text/css; charset=utf-8" :
      ext === ".js" ? "application/javascript; charset=utf-8" :
      ext === ".webmanifest" ? "application/manifest+json; charset=utf-8" :
      ext === ".svg" ? "image/svg+xml; charset=utf-8" :
      "text/plain; charset=utf-8";

    response.writeHead(200, { "Content-Type": contentType, ...extraHeaders });
    response.end(content);
  });
}

function readMockOverview() {
  return JSON.parse(fs.readFileSync(dataPath, "utf8"));
}

function readGdprConfig() {
  return JSON.parse(fs.readFileSync(gdprConfigPath, "utf8"));
}

function readPackageManifest() {
  return JSON.parse(fs.readFileSync(packagePath, "utf8"));
}

function readAiPolicy() {
  return validateAiPolicyPayload(JSON.parse(fs.readFileSync(aiPolicyPath, "utf8")));
}

function readAiProviderConfig() {
  return validateAiProviderConfigPayload(JSON.parse(fs.readFileSync(aiProviderConfigPath, "utf8")));
}

function readHubSpotConfig() {
  return validateHubSpotConfigPayload(JSON.parse(fs.readFileSync(hubspotConfigPath, "utf8")));
}

function readHubSpotInstallState() {
  if (!fs.existsSync(hubspotInstallStatePath)) {
    return createDefaultInstallState();
  }

  return normalizeInstallState(JSON.parse(fs.readFileSync(hubspotInstallStatePath, "utf8")));
}

function validateComplianceConfigPayload(payload) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    const error = new Error("Compliance config body must be a JSON object.");
    error.statusCode = 400;
    throw error;
  }

  if (!Array.isArray(payload.processingActivities)) {
    const error = new Error("Compliance config must define processingActivities.");
    error.statusCode = 400;
    throw error;
  }

  return payload;
}

function readJsonBody(request) {
  return new Promise((resolve, reject) => {
    let raw = "";

    request.on("data", (chunk) => {
      raw += chunk;
      if (raw.length > 50_000) {
        reject(new Error("Payload too large"));
      }
    });

    request.on("end", () => {
      if (!raw) {
        resolve({});
        return;
      }

      try {
        resolve(JSON.parse(raw));
      } catch (error) {
        reject(new Error("Invalid JSON body"));
      }
    });

    request.on("error", reject);
  });
}

function bootstrapApplication() {
  const packageManifest = readPackageManifest();

  try {
    const fixtures = readMockOverview();
    const runtime = createRuntime(fixtures);

    return {
      packageManifest,
      fixtures,
      runtime,
      startupError: null
    };
  } catch (error) {
    return {
      packageManifest,
      fixtures: null,
      runtime: null,
      startupError: error.message
    };
  }
}

function getGdprState() {
  try {
    const gdprConfig = readGdprConfig();
    return {
      gdprConfig,
      complianceReport: createComplianceReport(gdprConfig),
      error: null
    };
  } catch (error) {
    return {
      gdprConfig: null,
      complianceReport: null,
      error: error.message
    };
  }
}

function getAiPolicyState() {
  try {
    const aiPolicy = readAiPolicy();
    return {
      aiPolicy,
      error: null
    };
  } catch (error) {
    return {
      aiPolicy: null,
      error: error.message
    };
  }
}

function getAiProviderState() {
  try {
    const aiProviderConfig = readAiProviderConfig();
    return {
      aiProviderConfig,
      aiProviderStatus: createAiProviderStatus({ config: aiProviderConfig }),
      error: null
    };
  } catch (error) {
    return {
      aiProviderConfig: null,
      aiProviderStatus: null,
      error: error.message
    };
  }
}

function getHubSpotState() {
  try {
    const hubspotConfig = readHubSpotConfig();
    const installState = readHubSpotInstallState();
    return {
      hubspotConfig,
      installState,
      hubspotStatus: createHubSpotStatus({
        config: hubspotConfig,
        env: process.env,
        installState
      }),
      error: null
    };
  } catch (error) {
    return {
      hubspotConfig: null,
      installState: createDefaultInstallState(),
      hubspotStatus: null,
      error: error.message
    };
  }
}

function buildSystemState(appState) {
  const gdprState = getGdprState();
  const aiPolicyState = getAiPolicyState();
  const aiProviderState = getAiProviderState();
  const hubspotState = getHubSpotState();
  const systemReport = createSystemReport({
    packageManifest: appState.packageManifest,
    fixtures: appState.fixtures,
    gdprState,
    hubspotState,
    runtimeDiagnostics: appState.runtime ? appState.runtime.getRuntimeDiagnostics() : null,
    startupError: appState.startupError
  });

  return {
    gdprState,
    aiPolicyState,
    aiProviderState,
    hubspotState,
    systemReport
  };
}

function ensureRuntimeAvailable(appState, response) {
  if (appState.runtime) {
    return true;
  }

  sendJson(response, 503, {
    error: "Application bootstrap failed",
    detail: appState.startupError
  });
  return false;
}

const appState = bootstrapApplication();

function upsertHubSpotInstall(installState, installRecord) {
  const nextState = normalizeInstallState(installState);
  const existingIndex = nextState.installs.findIndex((item) => item.portalId === installRecord.portalId);

  if (existingIndex >= 0) {
    nextState.installs[existingIndex] = installRecord;
  } else {
    nextState.installs.push(installRecord);
  }

  return nextState;
}

const server = http.createServer(async (request, response) => {
  try {
    const host = request.headers.host || `localhost:${port}`;
    const url = new URL(request.url, `http://${host}`);
    const { gdprState, aiPolicyState, aiProviderState, hubspotState, systemReport } = buildSystemState(appState);
    const scenarioId = url.searchParams.get("scenario")
      || (appState.fixtures ? appState.fixtures.defaultScenario : null);

    if (url.pathname === "/health/live") {
      sendJson(response, 200, { ok: true });
      return;
    }

    if (url.pathname === "/health/ready") {
      sendJson(response, systemReport.readiness ? 200 : 503, systemReport);
      return;
    }

    if (request.method === "GET" && url.pathname === "/api/system/report") {
      sendJson(response, 200, systemReport);
      return;
    }

    if (request.method === "GET" && url.pathname === "/api/ai/policy") {
      if (aiPolicyState.error) {
        sendJson(response, 500, {
          error: "AI policy unavailable",
          detail: aiPolicyState.error
        });
        return;
      }

      sendJson(response, 200, aiPolicyState.aiPolicy);
      return;
    }

    if (request.method === "GET" && url.pathname === "/api/ai/provider-config") {
      if (aiProviderState.error) {
        sendJson(response, 500, {
          error: "AI provider config unavailable",
          detail: aiProviderState.error
        });
        return;
      }

      sendJson(response, 200, aiProviderState.aiProviderConfig);
      return;
    }

    if (request.method === "GET" && url.pathname === "/api/ai/provider-status") {
      if (aiProviderState.error) {
        sendJson(response, 500, {
          error: "AI provider status unavailable",
          detail: aiProviderState.error
        });
        return;
      }

      sendJson(response, 200, aiProviderState.aiProviderStatus);
      return;
    }

    if (request.method === "GET" && url.pathname === "/api/hubspot/config") {
      if (hubspotState.error) {
        sendJson(response, 500, {
          error: "HubSpot config unavailable",
          detail: hubspotState.error
        });
        return;
      }

      sendJson(response, 200, hubspotState.hubspotConfig);
      return;
    }

    if (request.method === "GET" && url.pathname === "/api/hubspot/status") {
      if (hubspotState.error) {
        sendJson(response, 500, {
          error: "HubSpot status unavailable",
          detail: hubspotState.error
        });
        return;
      }

      sendJson(response, 200, hubspotState.hubspotStatus);
      return;
    }

    if (request.method === "GET" && url.pathname === "/api/hubspot/install-url") {
      if (hubspotState.error) {
        sendJson(response, 500, {
          error: "HubSpot config unavailable",
          detail: hubspotState.error
        });
        return;
      }

      const accountId = url.searchParams.get("accountId") || hubspotState.hubspotConfig.preferredAccountId || null;
      const stateToken = url.searchParams.get("state") || `pipeline-rescue-${Date.now()}`;
      sendJson(response, 200, {
        installUrl: buildHubSpotInstallUrl({
          config: hubspotState.hubspotConfig,
          state: stateToken,
          accountId
        }),
        state: stateToken,
        accountId
      });
      return;
    }

    if (request.method === "GET" && url.pathname === "/api/hubspot/oauth/callback") {
      if (url.searchParams.get("error")) {
        sendText(
          response,
          400,
          "text/html; charset=utf-8",
          `<html><body><h1>HubSpot OAuth failed</h1><p>${url.searchParams.get("error")}</p></body></html>`
        );
        return;
      }

      if (hubspotState.error) {
        sendText(
          response,
          500,
          "text/html; charset=utf-8",
          `<html><body><h1>HubSpot config unavailable</h1><p>${hubspotState.error}</p></body></html>`
        );
        return;
      }

      const code = url.searchParams.get("code");
      if (!code) {
        sendText(
          response,
          400,
          "text/html; charset=utf-8",
          "<html><body><h1>Missing OAuth code</h1><p>HubSpot did not return an authorization code.</p></body></html>"
        );
        return;
      }

      const installRecord = await exchangeHubSpotAuthCode({
        config: hubspotState.hubspotConfig,
        code
      });
      const nextInstallState = upsertHubSpotInstall(hubspotState.installState, installRecord);
      saveJsonAtomic(hubspotInstallStatePath, nextInstallState);

      sendText(
        response,
        200,
        "text/html; charset=utf-8",
        `<html><body><h1>HubSpot connected</h1><p>Portal ${installRecord.portalId || "unknown"} was stored locally.</p><p>You can close this window and return to Pipeline Rescue.</p></body></html>`
      );
      return;
    }

    const hubspotLiveDealMatch = url.pathname.match(/^\/api\/hubspot\/live\/deals\/([^/]+)$/);
    if (request.method === "GET" && hubspotLiveDealMatch) {
      if (!appState.fixtures) {
        sendJson(response, 503, {
          error: "Live preview unavailable",
          detail: appState.startupError || "Scenario fixtures are unavailable."
        });
        return;
      }

      if (hubspotState.error) {
        sendJson(response, 500, {
          error: "HubSpot live preview unavailable",
          detail: hubspotState.error
        });
        return;
      }

      const liveContext = await buildHubSpotLiveContext({
        appState,
        hubspotState,
        portalId: url.searchParams.get("portalId") || null,
        dealId: hubspotLiveDealMatch[1]
      });
      const { preview, overview, dealAnalysis } = liveContext;

      if (preview.source.tokenRefreshed) {
        saveJsonAtomic(hubspotInstallStatePath, preview.installState);
      }

      sendJson(response, 200, {
        source: preview.source,
        normalizedDeal: preview.normalizedDeal,
        normalizationWarnings: preview.normalizationWarnings,
        graph: preview.graph,
        overview,
        dealAnalysis
      });
      return;
    }

    const hubspotLiveTaskMatch = url.pathname.match(/^\/api\/hubspot\/live\/deals\/([^/]+)\/tasks$/);
    if (request.method === "POST" && hubspotLiveTaskMatch) {
      if (!appState.fixtures) {
        sendJson(response, 503, {
          error: "Live task creation unavailable",
          detail: appState.startupError || "Scenario fixtures are unavailable."
        });
        return;
      }

      if (hubspotState.error) {
        sendJson(response, 500, {
          error: "HubSpot live task creation unavailable",
          detail: hubspotState.error
        });
        return;
      }

      const liveContext = await buildHubSpotLiveContext({
        appState,
        hubspotState,
        portalId: url.searchParams.get("portalId") || null,
        dealId: hubspotLiveTaskMatch[1]
      });
      const { preview, dealAnalysis } = liveContext;

      const taskWrite = await createHubSpotRescueTask({
        config: hubspotState.hubspotConfig,
        installState: preview.installState,
        portalId: url.searchParams.get("portalId") || preview.source.portalId || null,
        analysisTimestamp: preview.source.fetchedAt,
        preview,
        analysis: dealAnalysis
      });

      if (preview.source.tokenRefreshed || taskWrite.source.tokenRefreshed) {
        saveJsonAtomic(hubspotInstallStatePath, taskWrite.installState);
      }

      sendJson(response, 200, {
        source: preview.source,
        normalizedDeal: preview.normalizedDeal,
        normalizationWarnings: preview.normalizationWarnings,
        graph: preview.graph,
        dealAnalysis,
        hubspotTask: taskWrite.task
      });
      return;
    }

    const hubspotLiveDraftMatch = url.pathname.match(/^\/api\/hubspot\/live\/deals\/([^/]+)\/draft$/);
    if (request.method === "POST" && hubspotLiveDraftMatch) {
      if (!appState.fixtures) {
        sendJson(response, 503, {
          error: "Live draft generation unavailable",
          detail: appState.startupError || "Scenario fixtures are unavailable."
        });
        return;
      }

      if (hubspotState.error) {
        sendJson(response, 500, {
          error: "HubSpot live draft unavailable",
          detail: hubspotState.error
        });
        return;
      }

      const liveContext = await buildHubSpotLiveContext({
        appState,
        hubspotState,
        portalId: url.searchParams.get("portalId") || null,
        dealId: hubspotLiveDraftMatch[1]
      });
      const { preview, dealAnalysis } = liveContext;
      const draftResult = await resolveHubSpotLiveDraft({
        aiProviderState,
        dealAnalysis
      });

      if (preview.source.tokenRefreshed) {
        saveJsonAtomic(hubspotInstallStatePath, preview.installState);
      }

      sendJson(response, 200, {
        source: preview.source,
        normalizedDeal: preview.normalizedDeal,
        normalizationWarnings: preview.normalizationWarnings,
        graph: preview.graph,
        dealAnalysis,
        liveDraft: draftResult
      });
      return;
    }

    if (request.method === "POST" && url.pathname === "/api/hubspot/live/queue") {
      if (!appState.fixtures) {
        sendJson(response, 503, {
          error: "Live queue unavailable",
          detail: appState.startupError || "Scenario fixtures are unavailable."
        });
        return;
      }

      if (hubspotState.error) {
        sendJson(response, 500, {
          error: "HubSpot live queue unavailable",
          detail: hubspotState.error
        });
        return;
      }

      const body = validateLiveQueueRequestPayload(await readJsonBody(request));
      const liveQueue = await buildHubSpotLiveQueueContext({
        appState,
        hubspotState,
        portalId: body.portalId || null,
        dealIds: body.dealIds
      });

      if (liveQueue.source.tokenRefreshed) {
        saveJsonAtomic(hubspotInstallStatePath, liveQueue.installState);
      }

      sendJson(response, 200, {
        source: liveQueue.source,
        overview: liveQueue.overview,
        deals: liveQueue.deals,
        managerDigest: liveQueue.managerDigest
      });
      return;
    }

    const hubspotLiveNoteMatch = url.pathname.match(/^\/api\/hubspot\/live\/deals\/([^/]+)\/notes$/);
    if (request.method === "POST" && hubspotLiveNoteMatch) {
      if (!appState.fixtures) {
        sendJson(response, 503, {
          error: "Live note creation unavailable",
          detail: appState.startupError || "Scenario fixtures are unavailable."
        });
        return;
      }

      if (hubspotState.error) {
        sendJson(response, 500, {
          error: "HubSpot live note creation unavailable",
          detail: hubspotState.error
        });
        return;
      }

      const liveContext = await buildHubSpotLiveContext({
        appState,
        hubspotState,
        portalId: url.searchParams.get("portalId") || null,
        dealId: hubspotLiveNoteMatch[1]
      });
      const { preview, dealAnalysis } = liveContext;
      const draftResult = await resolveHubSpotLiveDraft({
        aiProviderState,
        dealAnalysis
      });
      const noteWrite = await createHubSpotDraftNote({
        config: hubspotState.hubspotConfig,
        installState: preview.installState,
        portalId: url.searchParams.get("portalId") || preview.source.portalId || null,
        analysisTimestamp: preview.source.fetchedAt,
        preview,
        analysis: dealAnalysis,
        draftResult
      });

      if (preview.source.tokenRefreshed || noteWrite.source.tokenRefreshed) {
        saveJsonAtomic(hubspotInstallStatePath, noteWrite.installState);
      }

      sendJson(response, 200, {
        source: preview.source,
        normalizedDeal: preview.normalizedDeal,
        normalizationWarnings: preview.normalizationWarnings,
        graph: preview.graph,
        dealAnalysis,
        liveDraft: draftResult,
        hubspotNote: noteWrite.note
      });
      return;
    }

    if (!ensureRuntimeAvailable(appState, response)) {
      return;
    }

    if (url.pathname === "/api/scenarios") {
      sendJson(response, 200, appState.runtime.getScenarioCatalog());
      return;
    }

    if (request.method === "GET" && url.pathname === "/api/overview") {
      const overview = stampMetaVersion(
        appState.runtime.getOverview(scenarioId),
        appState.packageManifest.version
      );

      if (!overview) {
        sendJson(response, 404, {
          error: "Unknown scenario",
          scenarioId
        });
        return;
      }

      sendJson(response, 200, overview);
      return;
    }

    const analysisMatch = url.pathname.match(/^\/api\/deals\/([^/]+)\/analysis$/);
    if (request.method === "GET" && analysisMatch) {
      const analysis = stampMetaVersion(
        appState.runtime.getAnalysis(scenarioId, analysisMatch[1]),
        appState.packageManifest.version
      );

      if (!analysis) {
        sendJson(response, 404, {
          error: "Unknown deal analysis",
          scenarioId,
          dealId: analysisMatch[1]
        });
        return;
      }

      sendJson(response, 200, analysis);
      return;
    }

    const analyzeMatch = url.pathname.match(/^\/api\/deals\/([^/]+)\/analyze$/);
    if (request.method === "POST" && analyzeMatch) {
      const analysis = appState.runtime.analyzeDeal(scenarioId, analyzeMatch[1]);

      if (!analysis) {
        sendJson(response, 404, {
          error: "Unknown deal analysis",
          scenarioId,
          dealId: analyzeMatch[1]
        });
        return;
      }

      sendJson(response, 200, analysis);
      return;
    }

    const taskMatch = url.pathname.match(/^\/api\/deals\/([^/]+)\/tasks$/);
    if (request.method === "POST" && taskMatch) {
      const taskResult = appState.runtime.createTask(scenarioId, taskMatch[1]);

      if (!taskResult) {
        sendJson(response, 404, {
          error: "Unknown deal task target",
          scenarioId,
          dealId: taskMatch[1]
        });
        return;
      }

      sendJson(response, 200, taskResult);
      return;
    }

    const draftMatch = url.pathname.match(/^\/api\/deals\/([^/]+)\/draft$/);
    if (request.method === "POST" && draftMatch) {
      const draftResult = appState.runtime.generateDraft(scenarioId, draftMatch[1]);

      if (!draftResult) {
        sendJson(response, 404, {
          error: "Unknown draft target",
          scenarioId,
          dealId: draftMatch[1]
        });
        return;
      }

      sendJson(response, 200, draftResult);
      return;
    }

    const feedbackUsefulMatch = url.pathname.match(/^\/api\/deals\/([^/]+)\/feedback\/useful$/);
    if (request.method === "POST" && feedbackUsefulMatch) {
      const body = await readJsonBody(request);
      const feedbackResult = appState.runtime.recordFeedback(scenarioId, feedbackUsefulMatch[1], "USEFUL", body);

      if (!feedbackResult) {
        sendJson(response, 404, {
          error: "Unknown feedback target",
          scenarioId,
          dealId: feedbackUsefulMatch[1]
        });
        return;
      }

      sendJson(response, 200, feedbackResult);
      return;
    }

    const feedbackDismissMatch = url.pathname.match(/^\/api\/deals\/([^/]+)\/feedback\/dismiss$/);
    if (request.method === "POST" && feedbackDismissMatch) {
      const body = await readJsonBody(request);
      const feedbackResult = appState.runtime.recordFeedback(scenarioId, feedbackDismissMatch[1], "DISMISSED", body);

      if (!feedbackResult) {
        sendJson(response, 404, {
          error: "Unknown feedback target",
          scenarioId,
          dealId: feedbackDismissMatch[1]
        });
        return;
      }

      sendJson(response, 200, feedbackResult);
      return;
    }

    const liveDraftMatch = url.pathname.match(/^\/api\/deals\/([^/]+)\/live-draft$/);
    if (request.method === "POST" && liveDraftMatch) {
      if (aiProviderState.error) {
        sendJson(response, 500, {
          error: "AI provider unavailable",
          detail: aiProviderState.error
        });
        return;
      }

      const analysisPayload = appState.runtime.getAnalysis(scenarioId, liveDraftMatch[1]);
      if (!analysisPayload) {
        sendJson(response, 404, {
          error: "Unknown live draft target",
          scenarioId,
          dealId: liveDraftMatch[1]
        });
        return;
      }

      const liveDraft = await generateLiveDraft({
        config: aiProviderState.aiProviderConfig,
        analysis: analysisPayload.analysis,
        verification: analysisPayload.verification
      });

      sendJson(response, 200, {
        scenarioId,
        dealId: liveDraftMatch[1],
        liveDraft
      });
      return;
    }

    if (request.method === "GET" && url.pathname === "/api/events") {
      sendJson(response, 200, appState.runtime.getEvents(scenarioId));
      return;
    }

    if (request.method === "GET" && url.pathname === "/api/manager/report") {
      sendJson(response, 200, appState.runtime.getManagerReport(scenarioId));
      return;
    }

    if (request.method === "GET" && url.pathname === "/api/feedback/report") {
      sendJson(response, 200, appState.runtime.getFeedbackReport(scenarioId));
      return;
    }

    if (request.method === "GET" && url.pathname === "/api/ai/control-center") {
      if (aiPolicyState.error) {
        sendJson(response, 500, {
          error: "AI policy unavailable",
          detail: aiPolicyState.error
        });
        return;
      }

      const overview = appState.runtime.getOverview(scenarioId);
      if (!overview) {
        sendJson(response, 404, {
          error: "Unknown scenario",
          scenarioId
        });
        return;
      }

      const feedbackReport = appState.runtime.getFeedbackReport(scenarioId);
      const complianceReport = gdprState.complianceReport || createComplianceReport(readGdprConfig());
      sendJson(response, 200, createAiControlReport({
        policy: aiPolicyState.aiPolicy,
        overview,
        feedbackReport,
        complianceReport
      }));
      return;
    }

    if (request.method === "POST" && url.pathname === "/api/ai/run-cycle") {
      if (aiPolicyState.error) {
        sendJson(response, 500, {
          error: "AI policy unavailable",
          detail: aiPolicyState.error
        });
        return;
      }

      const complianceReport = gdprState.complianceReport || createComplianceReport(readGdprConfig());
      const cycleReport = createAiOperationsCycle({
        runtime: appState.runtime,
        scenarioId,
        policy: aiPolicyState.aiPolicy,
        complianceReport
      });

      if (!cycleReport) {
        sendJson(response, 404, {
          error: "Unknown scenario",
          scenarioId
        });
        return;
      }

      sendJson(response, 200, cycleReport);
      return;
    }

    if (request.method === "GET" && url.pathname === "/api/compliance/report") {
      if (gdprState.error) {
        sendJson(response, 500, {
          error: "GDPR configuration unavailable",
          detail: gdprState.error
        });
        return;
      }

      sendJson(response, 200, gdprState.complianceReport);
      return;
    }

    if (request.method === "GET" && url.pathname === "/api/compliance/config") {
      if (gdprState.error) {
        sendJson(response, 500, {
          error: "GDPR configuration unavailable",
          detail: gdprState.error
        });
        return;
      }

      sendJson(response, 200, gdprState.gdprConfig);
      return;
    }

    if (request.method === "POST" && url.pathname === "/api/compliance/config") {
      const body = validateComplianceConfigPayload(await readJsonBody(request));
      createComplianceReport(body);
      saveJsonAtomic(gdprConfigPath, body);

      const refreshedState = getGdprState();
      sendJson(response, 200, {
        config: refreshedState.gdprConfig,
        complianceReport: refreshedState.complianceReport,
        systemReport: createSystemReport({
          packageManifest: appState.packageManifest,
          fixtures: appState.fixtures,
          gdprState: refreshedState,
          hubspotState,
          runtimeDiagnostics: appState.runtime ? appState.runtime.getRuntimeDiagnostics() : null,
          startupError: appState.startupError
        })
      });
      return;
    }

    if (request.method === "POST" && url.pathname === "/api/ai/policy") {
      const body = validateAiPolicyPayload(await readJsonBody(request));
      saveJsonAtomic(aiPolicyPath, body);

      const refreshedPolicyState = getAiPolicyState();
      const overview = appState.runtime.getOverview(scenarioId);
      const feedbackReport = appState.runtime.getFeedbackReport(scenarioId);
      sendJson(response, 200, {
        policy: refreshedPolicyState.aiPolicy,
        report: createAiControlReport({
          policy: refreshedPolicyState.aiPolicy,
          overview,
          feedbackReport,
          complianceReport: gdprState.complianceReport || createComplianceReport(readGdprConfig())
        })
      });
      return;
    }

    if (request.method === "POST" && url.pathname === "/api/ai/provider-config") {
      const body = validateAiProviderConfigPayload(await readJsonBody(request));
      saveJsonAtomic(aiProviderConfigPath, body);

      const refreshedProviderState = getAiProviderState();
      sendJson(response, 200, {
        config: refreshedProviderState.aiProviderConfig,
        status: refreshedProviderState.aiProviderStatus
      });
      return;
    }

    if (request.method === "POST" && url.pathname === "/api/hubspot/config") {
      const body = validateHubSpotConfigPayload(await readJsonBody(request));
      saveJsonAtomic(hubspotConfigPath, body);
      const refreshedHubSpotState = getHubSpotState();
      sendJson(response, 200, {
        config: refreshedHubSpotState.hubspotConfig,
        status: refreshedHubSpotState.hubspotStatus
      });
      return;
    }

    if (request.method === "POST" && url.pathname === "/api/hubspot/oauth/exchange") {
      if (hubspotState.error) {
        sendJson(response, 500, {
          error: "HubSpot config unavailable",
          detail: hubspotState.error
        });
        return;
      }

      const body = await readJsonBody(request);
      const installRecord = await exchangeHubSpotAuthCode({
        config: hubspotState.hubspotConfig,
        code: body.code
      });
      const nextInstallState = upsertHubSpotInstall(hubspotState.installState, installRecord);
      saveJsonAtomic(hubspotInstallStatePath, nextInstallState);
      const refreshedHubSpotState = getHubSpotState();

      sendJson(response, 200, {
        install: {
          portalId: installRecord.portalId,
          hubDomain: installRecord.hubDomain,
          connectedAt: installRecord.connectedAt,
          scope: installRecord.scope
        },
        status: refreshedHubSpotState.hubspotStatus
      });
      return;
    }

    if (request.method === "POST" && url.pathname === "/api/ai/provider-probe") {
      if (aiProviderState.error) {
        sendJson(response, 500, {
          error: "AI provider unavailable",
          detail: aiProviderState.error
        });
        return;
      }

      const probe = await probeAiProvider({
        config: aiProviderState.aiProviderConfig
      });

      sendJson(response, 200, probe);
      return;
    }

    if (request.method === "GET" && url.pathname === "/api/feedback/export") {
      const format = url.searchParams.get("format") === "csv" ? "csv" : "json";
      const payload = appState.runtime.exportFeedback(scenarioId, format);

      if (format === "csv") {
        sendText(response, 200, "text/csv; charset=utf-8", payload);
        return;
      }

      sendJson(response, 200, payload);
      return;
    }

    if (request.method === "GET" && url.pathname === "/api/runtime/export") {
      sendJson(response, 200, appState.runtime.exportState());
      return;
    }

    if (request.method === "POST" && url.pathname === "/api/runtime/reset") {
      const overview = appState.runtime.resetScenario(scenarioId);
      sendJson(response, 200, {
        scenarioId,
        overview
      });
      return;
    }

    if (url.pathname === "/health") {
      sendJson(response, 200, { ok: true, status: systemReport.status });
      return;
    }

    if (url.pathname === "/" || url.pathname === "/index.html") {
      sendFile(response, path.join(publicDir, "index.html"));
      return;
    }

    if (url.pathname === "/styles.css") {
      sendFile(response, path.join(publicDir, "styles.css"));
      return;
    }

    if (url.pathname === "/app.js") {
      sendFile(response, path.join(publicDir, "app.js"));
      return;
    }

    if (url.pathname === "/manifest.webmanifest") {
      sendFile(response, path.join(publicDir, "manifest.webmanifest"));
      return;
    }

    if (url.pathname === "/service-worker.js") {
      sendFile(response, path.join(publicDir, "service-worker.js"), {
        "Cache-Control": "no-cache"
      });
      return;
    }

    if (url.pathname === "/app-icon.svg") {
      sendFile(response, path.join(publicDir, "app-icon.svg"));
      return;
    }

    sendJson(response, 404, { error: "Not found" });
  } catch (error) {
    sendJson(response, error.statusCode || (error.message === "Invalid JSON body" ? 400 : 500), {
      error: error.message,
      ...(error.detail ? { detail: error.detail } : {})
    });
  }
});

server.listen(port, () => {
  console.log(`Pipeline Rescue starter running on http://localhost:${port}`);
});
