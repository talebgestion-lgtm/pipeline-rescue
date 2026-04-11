const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");
const {
  buildScenarioCatalog,
  buildOverview,
  buildDealAnalysis
} = require("./lib/analysis-engine");

const rootDir = __dirname;
const publicDir = path.join(rootDir, "public");
const dataPath = path.join(rootDir, "data", "scenario-inputs.json");
const port = Number(process.env.PORT || 4179);

function sendJson(response, statusCode, payload) {
  response.writeHead(statusCode, { "Content-Type": "application/json; charset=utf-8" });
  response.end(JSON.stringify(payload, null, 2));
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

const server = http.createServer((request, response) => {
  const host = request.headers.host || `localhost:${port}`;
  const url = new URL(request.url, `http://${host}`);
  const fixtures = readMockOverview();

  if (url.pathname === "/api/scenarios") {
    sendJson(response, 200, {
      defaultScenario: fixtures.defaultScenario,
      scenarios: buildScenarioCatalog(fixtures)
    });
    return;
  }

  if (url.pathname === "/api/overview") {
    const scenarioId = url.searchParams.get("scenario") || fixtures.defaultScenario;
    const overview = buildOverview(fixtures, scenarioId);

    if (!overview) {
      sendJson(response, 404, {
        error: "Unknown scenario",
        scenarioId,
        availableScenarios: buildScenarioCatalog(fixtures)
      });
      return;
    }

    sendJson(response, 200, overview);
    return;
  }

  const analysisMatch = url.pathname.match(/^\/api\/deals\/([^/]+)\/analysis$/);
  if (analysisMatch) {
    const scenarioId = url.searchParams.get("scenario") || fixtures.defaultScenario;
    const analysis = buildDealAnalysis(fixtures, scenarioId, analysisMatch[1]);

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
});

server.listen(port, () => {
  console.log(`Pipeline Rescue starter running on http://localhost:${port}`);
});
