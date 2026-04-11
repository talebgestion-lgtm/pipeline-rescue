const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");
const { createRuntime } = require("./lib/pilot-runtime");
const { createComplianceReport } = require("./lib/gdpr-compliance");
const { createSystemReport } = require("./lib/system-report");
const { createAiControlReport, validateAiPolicyPayload } = require("./lib/ai-control");
const { createAiOperationsCycle } = require("./lib/ai-operations");

const rootDir = __dirname;
const publicDir = path.join(rootDir, "public");
const dataPath = path.join(rootDir, "data", "scenario-inputs.json");
const gdprConfigPath = path.join(rootDir, "data", "gdpr-config.json");
const aiPolicyPath = path.join(rootDir, "data", "ai-policy.json");
const packagePath = path.join(rootDir, "package.json");
const port = Number(process.env.PORT || 4179);

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

function buildSystemState(appState) {
  const gdprState = getGdprState();
  const aiPolicyState = getAiPolicyState();
  const systemReport = createSystemReport({
    packageManifest: appState.packageManifest,
    fixtures: appState.fixtures,
    gdprState,
    runtimeDiagnostics: appState.runtime ? appState.runtime.getRuntimeDiagnostics() : null,
    startupError: appState.startupError
  });

  return {
    gdprState,
    aiPolicyState,
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

const server = http.createServer(async (request, response) => {
  try {
    const host = request.headers.host || `localhost:${port}`;
    const url = new URL(request.url, `http://${host}`);
    const { gdprState, aiPolicyState, systemReport } = buildSystemState(appState);
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

    if (!ensureRuntimeAvailable(appState, response)) {
      return;
    }

    if (url.pathname === "/api/scenarios") {
      sendJson(response, 200, appState.runtime.getScenarioCatalog());
      return;
    }

    if (request.method === "GET" && url.pathname === "/api/overview") {
      const overview = appState.runtime.getOverview(scenarioId);

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
      const analysis = appState.runtime.getAnalysis(scenarioId, analysisMatch[1]);

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
      error: error.message
    });
  }
});

server.listen(port, () => {
  console.log(`Pipeline Rescue starter running on http://localhost:${port}`);
});
