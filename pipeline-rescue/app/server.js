const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");
const { createRuntime } = require("./lib/pilot-runtime");

const rootDir = __dirname;
const publicDir = path.join(rootDir, "public");
const dataPath = path.join(rootDir, "data", "scenario-inputs.json");
const port = Number(process.env.PORT || 4179);

function sendJson(response, statusCode, payload) {
  response.writeHead(statusCode, { "Content-Type": "application/json; charset=utf-8" });
  response.end(JSON.stringify(payload, null, 2));
}

function sendText(response, statusCode, contentType, payload) {
  response.writeHead(statusCode, { "Content-Type": contentType });
  response.end(payload);
}

function sendFile(response, filePath) {
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
      "text/plain; charset=utf-8";

    response.writeHead(200, { "Content-Type": contentType });
    response.end(content);
  });
}

function readMockOverview() {
  return JSON.parse(fs.readFileSync(dataPath, "utf8"));
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

const fixtures = readMockOverview();
const runtime = createRuntime(fixtures);

const server = http.createServer(async (request, response) => {
  try {
    const host = request.headers.host || `localhost:${port}`;
    const url = new URL(request.url, `http://${host}`);
    const scenarioId = url.searchParams.get("scenario") || fixtures.defaultScenario;

    if (url.pathname === "/api/scenarios") {
      sendJson(response, 200, runtime.getScenarioCatalog());
      return;
    }

    if (request.method === "GET" && url.pathname === "/api/overview") {
      const overview = runtime.getOverview(scenarioId);

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
      const analysis = runtime.getAnalysis(scenarioId, analysisMatch[1]);

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
      const analysis = runtime.analyzeDeal(scenarioId, analyzeMatch[1]);

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
      const taskResult = runtime.createTask(scenarioId, taskMatch[1]);

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
      const draftResult = runtime.generateDraft(scenarioId, draftMatch[1]);

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
      const feedbackResult = runtime.recordFeedback(scenarioId, feedbackUsefulMatch[1], "USEFUL", body);

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
      const feedbackResult = runtime.recordFeedback(scenarioId, feedbackDismissMatch[1], "DISMISSED", body);

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
      sendJson(response, 200, runtime.getEvents(scenarioId));
      return;
    }

    if (request.method === "GET" && url.pathname === "/api/manager/report") {
      sendJson(response, 200, runtime.getManagerReport(scenarioId));
      return;
    }

    if (request.method === "GET" && url.pathname === "/api/feedback/report") {
      sendJson(response, 200, runtime.getFeedbackReport(scenarioId));
      return;
    }

    if (request.method === "GET" && url.pathname === "/api/feedback/export") {
      const format = url.searchParams.get("format") === "csv" ? "csv" : "json";
      const payload = runtime.exportFeedback(scenarioId, format);

      if (format === "csv") {
        sendText(response, 200, "text/csv; charset=utf-8", payload);
        return;
      }

      sendJson(response, 200, payload);
      return;
    }

    if (request.method === "GET" && url.pathname === "/api/runtime/export") {
      sendJson(response, 200, runtime.exportState());
      return;
    }

    if (request.method === "POST" && url.pathname === "/api/runtime/reset") {
      const overview = runtime.resetScenario(scenarioId);
      sendJson(response, 200, {
        scenarioId,
        overview
      });
      return;
    }

    if (url.pathname === "/health") {
      sendJson(response, 200, { ok: true });
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

    sendJson(response, 404, { error: "Not found" });
  } catch (error) {
    sendJson(response, error.message === "Invalid JSON body" ? 400 : 500, {
      error: error.message
    });
  }
});

server.listen(port, () => {
  console.log(`Pipeline Rescue starter running on http://localhost:${port}`);
});
