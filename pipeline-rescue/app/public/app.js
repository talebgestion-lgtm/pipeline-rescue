const appState = {
  catalog: null,
  scenarioId: null,
  overview: null,
  focusedDealId: null,
  installPrompt: null,
  serviceWorkerReady: false,
  installReady: false,
  providerProbe: null,
  liveDraft: null,
  hubspotLivePreview: null,
  hubspotLiveQueue: null
};

function getSearchScenario() {
  return new URLSearchParams(window.location.search).get("scenario");
}

async function fetchJson(url, options) {
  const response = await fetch(url, options);

  if (!response.ok) {
    let detail = `Request failed: ${response.status}`;
    try {
      const payload = await response.json();
      detail = payload.detail
        ? `${payload.error || "Request failed"}: ${payload.detail}`
        : payload.error || detail;
    } catch (error) {
      // Ignore JSON parsing errors for non-JSON responses.
    }

    throw new Error(detail);
  }

  return response.json();
}

function buildScenarioUrl(path) {
  return `${path}${path.includes("?") ? "&" : "?"}scenario=${encodeURIComponent(appState.scenarioId)}`;
}

async function loadScenarios() {
  return fetchJson("/api/scenarios");
}

async function loadOverview(scenarioId) {
  return fetchJson(`/api/overview?scenario=${encodeURIComponent(scenarioId)}`);
}

async function loadDealAnalysis(dealId) {
  return fetchJson(buildScenarioUrl(`/api/deals/${encodeURIComponent(dealId)}/analysis`));
}

async function postAction(path, body) {
  return fetchJson(buildScenarioUrl(path), {
    method: "POST",
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined
  });
}

async function loadEvents() {
  return fetchJson(buildScenarioUrl("/api/events"));
}

async function loadManagerReport() {
  return fetchJson(buildScenarioUrl("/api/manager/report"));
}

async function loadFeedbackReport() {
  return fetchJson(buildScenarioUrl("/api/feedback/report"));
}

async function loadAiPolicy() {
  return fetchJson("/api/ai/policy");
}

async function loadAiProviderConfig() {
  return fetchJson("/api/ai/provider-config");
}

async function loadAiProviderStatus() {
  return fetchJson("/api/ai/provider-status");
}

async function loadHubSpotConfig() {
  return fetchJson("/api/hubspot/config");
}

async function loadHubSpotStatus() {
  return fetchJson("/api/hubspot/status");
}

async function loadHubSpotInstallUrl(accountId) {
  const suffix = accountId ? `?accountId=${encodeURIComponent(accountId)}` : "";
  return fetchJson(`/api/hubspot/install-url${suffix}`);
}

async function loadHubSpotLivePreview(portalId, dealId) {
  const query = portalId ? `?portalId=${encodeURIComponent(portalId)}` : "";
  return fetchJson(`/api/hubspot/live/deals/${encodeURIComponent(dealId)}${query}`);
}

async function createHubSpotLiveTask(portalId, dealId) {
  const query = portalId ? `?portalId=${encodeURIComponent(portalId)}` : "";
  return fetchJson(`/api/hubspot/live/deals/${encodeURIComponent(dealId)}/tasks${query}`, {
    method: "POST"
  });
}

async function createHubSpotLiveDraft(portalId, dealId) {
  const query = portalId ? `?portalId=${encodeURIComponent(portalId)}` : "";
  return fetchJson(`/api/hubspot/live/deals/${encodeURIComponent(dealId)}/draft${query}`, {
    method: "POST"
  });
}

async function createHubSpotLiveNote(portalId, dealId) {
  const query = portalId ? `?portalId=${encodeURIComponent(portalId)}` : "";
  return fetchJson(`/api/hubspot/live/deals/${encodeURIComponent(dealId)}/notes${query}`, {
    method: "POST"
  });
}

async function loadHubSpotLiveQueue(portalId, dealIds) {
  return fetchJson("/api/hubspot/live/queue", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      portalId: portalId || null,
      dealIds
    })
  });
}

async function loadHubSpotLiveSearch(criteria) {
  return fetchJson("/api/hubspot/live/search", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(criteria)
  });
}

async function probeProvider() {
  return fetchJson("/api/ai/provider-probe", {
    method: "POST"
  });
}

async function loadAiControlCenter() {
  return fetchJson(buildScenarioUrl("/api/ai/control-center"));
}

async function runAiCycle() {
  return fetchJson(buildScenarioUrl("/api/ai/run-cycle"), {
    method: "POST"
  });
}

async function generateLiveDraftForDeal(dealId) {
  return fetchJson(buildScenarioUrl(`/api/deals/${encodeURIComponent(dealId)}/live-draft`), {
    method: "POST"
  });
}

async function loadComplianceReport() {
  return fetchJson("/api/compliance/report");
}

async function loadComplianceConfig() {
  return fetchJson("/api/compliance/config");
}

async function loadSystemReport() {
  return fetchJson("/api/system/report");
}

async function resetScenarioState() {
  return postAction("/api/runtime/reset");
}

async function downloadFeedbackExport(format) {
  const response = await fetch(buildScenarioUrl(`/api/feedback/export?format=${encodeURIComponent(format)}`));
  if (!response.ok) {
    throw new Error(`Export failed: ${response.status}`);
  }

  const blob = await response.blob();
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement("a");
  const extension = format === "csv" ? "csv" : "json";

  link.href = url;
  link.download = `pipeline-rescue-feedback-${appState.scenarioId}.${extension}`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(url);
}

async function saveComplianceConfig(config) {
  return fetchJson("/api/compliance/config", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(config)
  });
}

async function saveAiPolicy(policy) {
  return fetchJson("/api/ai/policy", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(policy)
  });
}

async function saveAiProviderConfig(config) {
  return fetchJson("/api/ai/provider-config", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(config)
  });
}

async function saveHubSpotConfig(config) {
  return fetchJson("/api/hubspot/config", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(config)
  });
}

async function exchangeHubSpotCode(code) {
  return fetchJson("/api/hubspot/oauth/exchange", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ code })
  });
}

function isStandaloneMode() {
  return window.matchMedia("(display-mode: standalone)").matches || window.navigator.standalone === true;
}

function formatCurrency(value) {
  if (typeof value !== "number") {
    return "N/A";
  }

  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0
  }).format(value);
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll("\"", "&quot;")
    .replaceAll("'", "&#39;");
}

function formatScore(value) {
  return typeof value === "number" ? String(value) : "N/A";
}

function formatFreshness(deal) {
  const analyzedAt = deal.analyzedAt ? new Date(deal.analyzedAt).toLocaleString("en-GB") : "unknown";
  const freshUntil = deal.freshUntil ? new Date(deal.freshUntil).toLocaleString("en-GB") : "unknown";
  return `Eligibility: ${deal.eligibility || "UNKNOWN"} | analyzed ${analyzedAt} | fresh until ${freshUntil}`;
}

function renderScenarioControls(catalog, activeScenarioId) {
  const select = document.getElementById("scenario-select");
  const description = document.getElementById("scenario-description");

  select.innerHTML = catalog.scenarios
    .map((scenario) => `
      <option value="${scenario.id}" ${scenario.id === activeScenarioId ? "selected" : ""}>
        ${scenario.label}
      </option>
    `)
    .join("");

  const activeScenario = catalog.scenarios.find((scenario) => scenario.id === activeScenarioId) || catalog.scenarios[0];
  description.textContent = activeScenario ? activeScenario.description : "No scenario available.";
}

function renderSummary(summary) {
  const cards = [
    { label: "Analyzed deals", value: summary.analyzedDeals },
    { label: "At-risk deals", value: summary.atRiskDeals },
    { label: "Critical deals", value: summary.criticalDeals },
    { label: "Recovered revenue candidate", value: formatCurrency(summary.recoveredRevenueCandidate) }
  ];

  document.getElementById("summary-grid").innerHTML = cards
    .map((card) => `
      <article class="summary-card">
        <span class="label">${card.label}</span>
        <span class="value">${card.value ?? "N/A"}</span>
      </article>
    `)
    .join("");
}

function renderMeta(meta) {
  document.getElementById("meta-card").innerHTML = `
    <p class="status-label">${meta.portalName}</p>
    <p class="status-value">${meta.appName} ${meta.version}</p>
    <p class="lede">${meta.scenarioLabel}</p>
    <p class="lede">Snapshot generated at ${new Date(meta.generatedAt).toLocaleString("en-GB")}.</p>
  `;
}

function renderTaskState(taskState) {
  const value = document.getElementById("task-state-value");
  if (!taskState || taskState.status === "NOT_CREATED") {
    value.textContent = "Not created";
    return;
  }

  value.textContent = `${taskState.status} ${taskState.taskId ? `| ${taskState.taskId}` : ""}`;
}

function renderFeedbackState(feedbackState) {
  const value = document.getElementById("feedback-state-value");
  const calibration = document.getElementById("feedback-calibration");
  const history = document.getElementById("feedback-history");

  if (!feedbackState || feedbackState.status === "NO_FEEDBACK") {
    value.textContent = "No feedback yet";
  } else {
    value.textContent = `${feedbackState.status} | ${new Date(feedbackState.updatedAt).toLocaleString("en-GB")}`;
  }

  calibration.innerHTML = `
    <div class="verification-grid compact-grid">
      <article class="verification-metric">
        <span class="score-label">Deal signals</span>
        <span class="verification-value">${feedbackState?.dealHistoryCount ?? 0}</span>
      </article>
      <article class="verification-metric">
        <span class="score-label">Matched trust</span>
        <span class="verification-value">${feedbackState?.operatorTrustScore ?? 50}/100</span>
      </article>
      <article class="verification-metric">
        <span class="score-label">Calibrated score</span>
        <span class="verification-value">${feedbackState?.calibratedRecommendationScore ?? feedbackState?.baseRecommendationScore ?? 50}</span>
      </article>
      <article class="verification-metric">
        <span class="score-label">Calibration</span>
        <span class="verification-value">${feedbackState?.calibrationDirection || "NEUTRAL"} ${feedbackState?.calibrationAdjustment ? `(${feedbackState.calibrationAdjustment > 0 ? "+" : ""}${feedbackState.calibrationAdjustment})` : ""}</span>
      </article>
    </div>
    <p class="verification-note">${feedbackState?.reasonCode ? `Latest operator reason: ${feedbackState.reasonCode}.` : "No structured operator reason recorded yet."}</p>
    <p class="verification-note">${feedbackState?.themeLabel ? `Detected theme: ${feedbackState.themeLabel}.` : "No classified operator theme yet."}</p>
    <p class="verification-note">${feedbackState?.note ? `Latest note: ${feedbackState.note}` : "No free-text note recorded yet."}</p>
  `;

  const recentSignals = feedbackState?.recentSignals || [];
  history.innerHTML = `
    <p class="score-label">Recent deal feedback</p>
    ${recentSignals.length
      ? `<ul class="verification-list">${recentSignals
        .map((entry) => `<li>${entry.status} | ${new Date(entry.occurredAt).toLocaleString("en-GB")} | ${entry.topReason}${entry.operatorReasonCode ? ` | ${entry.operatorReasonCode}` : ""}${entry.operatorNote ? ` | ${entry.operatorNote}` : ""}</li>`)
        .join("")}</ul>`
      : `<p class="verification-note">No feedback history for this deal yet.</p>`}
  `;
}

function renderFocusedDeal(deal) {
  document.getElementById("deal-title").textContent = `${deal.dealName} | ${deal.owner}`;
  document.getElementById("score-value").textContent = formatScore(deal.rescueScore);
  document.getElementById("action-summary").textContent = deal.recommendedAction?.summary || "No action available.";
  document.getElementById("deal-freshness").textContent = formatFreshness(deal);

  const pill = document.getElementById("risk-pill");
  pill.textContent = deal.riskLevel || "UNKNOWN";
  pill.dataset.risk = deal.riskLevel || "UNKNOWN";

  renderTaskState(deal.taskState);
  renderFeedbackState(deal.feedbackState);

  const reasonsList = document.getElementById("reasons-list");
  if (!deal.reasons || deal.reasons.length === 0) {
    reasonsList.innerHTML = `
      <article class="reason-card empty-card">
        <div class="reason-row">
          <span class="reason-title">No ranked reasons available</span>
        </div>
        <p class="reason-evidence">Pipeline Rescue refused to fabricate evidence for this deal.</p>
      </article>
    `;
  } else {
    reasonsList.innerHTML = deal.reasons
      .map((reason) => `
        <article class="reason-card">
          <div class="reason-row">
            <span class="reason-title">${reason.label}</span>
            <span class="reason-weight">+${reason.weight}</span>
          </div>
          <p class="reason-evidence">${reason.evidence}</p>
        </article>
      `)
      .join("");
  }

  const subject = document.getElementById("draft-subject");
  const meta = document.getElementById("draft-meta");
  const body = document.getElementById("draft-body");

  if (
    appState.liveDraft
    && appState.liveDraft.scenarioId === appState.scenarioId
    && appState.liveDraft.dealId === deal.dealId
  ) {
    subject.textContent = appState.liveDraft.draft.subject || "Untitled live draft";
    meta.textContent = `Live provider draft | ${appState.liveDraft.provider} | ${appState.liveDraft.model}`;
    body.textContent = appState.liveDraft.draft.body || "Live draft body unavailable.";
    return;
  }

  if (deal.draft?.eligible) {
    subject.textContent = deal.draft.subject || "Untitled draft";
    meta.textContent = "Deterministic local draft";
    body.textContent = deal.draft.body || "Draft body unavailable.";
  } else {
    subject.textContent = "Draft blocked";
    meta.textContent = "Deterministic guardrail block";
    body.textContent = `Draft generation is blocked: ${deal.draft?.blockedReason || "UNKNOWN_REASON"}.`;
  }
}

function renderVerification(verification) {
  const corrections = verification.correctionsApplied || [];
  const unverifiedFields = verification.unverifiedFields || [];

  document.getElementById("verification-card").innerHTML = `
    <div class="verification-grid">
      <div class="verification-metric">
        <span class="score-label">Validation</span>
        <span class="verification-value">${verification.validationStatus}</span>
      </div>
      <div class="verification-metric">
        <span class="score-label">Stability score</span>
        <span class="verification-value">${verification.stabilityScore}</span>
      </div>
      <div class="verification-metric">
        <span class="score-label">Memory mode</span>
        <span class="verification-value">${verification.memoryProtocol}</span>
      </div>
      <div class="verification-metric">
        <span class="score-label">Hallucination risk</span>
        <span class="verification-value">${verification.hallucinationRisk}</span>
      </div>
    </div>
    <div class="verification-block">
      <p class="score-label">Correction pass</p>
      <ul class="verification-list">
        ${corrections.map((item) => `<li>${item}</li>`).join("") || "<li>No corrections applied.</li>"}
      </ul>
    </div>
    <div class="verification-block">
      <p class="score-label">Unverified fields</p>
      <p class="verification-note">${unverifiedFields.length ? unverifiedFields.join(", ") : "None."}</p>
    </div>
    <div class="verification-block">
      <p class="score-label">Notes</p>
      <p class="verification-note">${verification.notes || "No notes."}</p>
    </div>
  `;
}

function renderManagerReport(report) {
  const metrics = report.metrics || {};
  const topReasons = report.topReasons || [];
  const ownerBreakdown = report.ownerBreakdown || [];
  const digest = report.digest || [];

  document.getElementById("manager-report").innerHTML = `
    <div class="manager-metrics">
      <article class="manager-metric">
        <span class="score-label">Queue coverage</span>
        <span class="verification-value">${metrics.queueCoverageRate ?? 0}%</span>
      </article>
      <article class="manager-metric">
        <span class="score-label">Tasks created</span>
        <span class="verification-value">${metrics.tasksCreated ?? 0}</span>
      </article>
      <article class="manager-metric">
        <span class="score-label">Drafts blocked</span>
        <span class="verification-value">${metrics.draftsBlocked ?? 0}</span>
      </article>
      <article class="manager-metric">
        <span class="score-label">Touched deals</span>
        <span class="verification-value">${metrics.touchedDeals ?? 0}</span>
      </article>
      <article class="manager-metric">
        <span class="score-label">Useful feedback</span>
        <span class="verification-value">${metrics.usefulFeedbackCount ?? 0}</span>
      </article>
      <article class="manager-metric">
        <span class="score-label">Dismissed feedback</span>
        <span class="verification-value">${metrics.dismissedFeedbackCount ?? 0}</span>
      </article>
      <article class="manager-metric">
        <span class="score-label">Operator trust</span>
        <span class="verification-value">${metrics.recommendationTrustScore ?? 50}/100</span>
      </article>
    </div>
    <div class="verification-block">
      <p class="score-label">Digest</p>
      <ul class="verification-list">
        ${digest.map((item) => `<li>${item}</li>`).join("")}
      </ul>
    </div>
    <div class="manager-columns">
      <div class="verification-block">
        <p class="score-label">Top reasons</p>
        <ul class="verification-list">
          ${topReasons.map((item) => `<li>${item.reasonCode}: ${item.count}</li>`).join("") || "<li>No queue reasons yet.</li>"}
        </ul>
      </div>
      <div class="verification-block">
        <p class="score-label">Owner coverage</p>
        <ul class="verification-list">
          ${ownerBreakdown.map((item) => `<li>${item.owner}: ${item.atRiskDeals} at-risk, ${item.taskedDeals} tasked, ${item.usefulFeedback} useful, ${item.dismissedFeedback} dismissed</li>`).join("") || "<li>No owner activity yet.</li>"}
        </ul>
      </div>
    </div>
  `;
}

function renderFeedbackReport(report) {
  const metrics = report.metrics || {};
  const byReason = report.byReason || [];
  const byAction = report.byAction || [];
  const byTheme = report.byTheme || [];
  const byDismissReason = report.byDismissReason || [];
  const topFrictionPatterns = report.topFrictionPatterns || [];
  const recentEntries = report.recentEntries || [];

  document.getElementById("feedback-report").innerHTML = `
    <div class="manager-metrics">
      <article class="manager-metric">
        <span class="score-label">Trust score</span>
        <span class="verification-value">${metrics.trustScore ?? 50}/100</span>
      </article>
      <article class="manager-metric">
        <span class="score-label">Total signals</span>
        <span class="verification-value">${metrics.totalEntries ?? 0}</span>
      </article>
      <article class="manager-metric">
        <span class="score-label">Unique deals</span>
        <span class="verification-value">${metrics.uniqueDeals ?? 0}</span>
      </article>
      <article class="manager-metric">
        <span class="score-label">Notes logged</span>
        <span class="verification-value">${metrics.notesCount ?? 0}</span>
      </article>
      <article class="manager-metric">
        <span class="score-label">Dismiss reasons</span>
        <span class="verification-value">${metrics.dismissedWithReasonCount ?? 0}</span>
      </article>
      <article class="manager-metric">
        <span class="score-label">Friction entries</span>
        <span class="verification-value">${metrics.frictionEntriesCount ?? 0}</span>
      </article>
    </div>
    <div class="verification-block">
      <p class="score-label">Top friction pattern</p>
      <p class="verification-note">${metrics.topFrictionThemeLabel || "No dominant friction pattern yet."}</p>
    </div>
    <div class="manager-columns">
      <div class="verification-block">
        <p class="score-label">Reason calibration</p>
        <ul class="verification-list">
          ${byReason.slice(0, 4).map((item) => `<li>${item.reasonCode}: ${item.usefulCount} useful, ${item.dismissedCount} dismissed, trust ${item.trustScore}/100</li>`).join("") || "<li>No feedback yet.</li>"}
        </ul>
      </div>
      <div class="verification-block">
        <p class="score-label">Action calibration</p>
        <ul class="verification-list">
          ${byAction.slice(0, 4).map((item) => `<li>${item.actionType}: ${item.usefulCount} useful, ${item.dismissedCount} dismissed, trust ${item.trustScore}/100</li>`).join("") || "<li>No feedback yet.</li>"}
        </ul>
      </div>
    </div>
    <div class="verification-block">
      <p class="score-label">Theme calibration</p>
      <ul class="verification-list">
        ${byTheme.slice(0, 5).map((item) => `<li>${item.themeCode}: ${item.usefulCount} useful, ${item.dismissedCount} dismissed, trust ${item.trustScore}/100</li>`).join("") || "<li>No classified theme yet.</li>"}
      </ul>
    </div>
    <div class="verification-block">
      <p class="score-label">Dismiss reasons</p>
      <ul class="verification-list">
        ${byDismissReason.slice(0, 5).map((item) => `<li>${item.reasonCode}: ${item.dismissedCount} dismissed, trust ${item.trustScore}/100</li>`).join("") || "<li>No dismissal reason captured yet.</li>"}
      </ul>
    </div>
    <div class="verification-block">
      <p class="score-label">Top friction patterns</p>
      <ul class="verification-list">
        ${topFrictionPatterns.slice(0, 5).map((item) => `<li>${item.themeLabel}: ${item.count} dismissal(s), ${item.uniqueDeals} deal(s)${item.sampleNote ? `, sample "${item.sampleNote}"` : ""}</li>`).join("") || "<li>No friction pattern captured yet.</li>"}
      </ul>
    </div>
    <div class="verification-block">
      <p class="score-label">Recent signals</p>
      <ul class="verification-list">
        ${recentEntries.slice(0, 5).map((item) => `<li>${item.dealName} | ${item.status} | ${item.topReason}${item.operatorReasonCode ? ` | ${item.operatorReasonCode}` : ""}${item.operatorThemeLabel ? ` | ${item.operatorThemeLabel}` : ""}${item.operatorNote ? ` | ${item.operatorNote}` : ""} | ${new Date(item.occurredAt).toLocaleString("en-GB")}</li>`).join("") || "<li>No feedback signal captured yet.</li>"}
      </ul>
    </div>
  `;
}

function renderComplianceReport(report) {
  const blockers = report.blockers || [];
  const checks = report.checks || [];

  document.getElementById("compliance-report").innerHTML = `
    <div class="verification-grid">
      <article class="verification-metric">
        <span class="score-label">Status</span>
        <span class="verification-value">${report.status}</span>
      </article>
      <article class="verification-metric">
        <span class="score-label">Strict mode</span>
        <span class="verification-value">${report.strictMode ? "ENABLED" : "DISABLED"}</span>
      </article>
    </div>
    <div class="verification-block">
      <p class="score-label">Summary</p>
      <p class="verification-note">${report.summary}</p>
    </div>
    <div class="verification-block">
      <p class="score-label">Deployment blockers</p>
      <ul class="verification-list">
        ${blockers.map((item) => `<li>${item.label}: ${item.remediation}</li>`).join("") || "<li>No deployment blocker reported.</li>"}
      </ul>
    </div>
    <div class="verification-block">
      <p class="score-label">Control status</p>
      <ul class="verification-list">
        ${checks.map((item) => `<li>${item.status} | ${item.label}: ${item.evidence}</li>`).join("")}
      </ul>
    </div>
    <div class="verification-block">
      <p class="score-label">Assumptions</p>
      <ul class="verification-list">
        ${(report.assumptions || []).map((item) => `<li>${item}</li>`).join("")}
      </ul>
    </div>
  `;
}

function renderSystemReport(report) {
  document.getElementById("system-report").innerHTML = `
    <div class="verification-grid">
      <article class="verification-metric">
        <span class="score-label">Status</span>
        <span class="verification-value">${report.status}</span>
      </article>
      <article class="verification-metric">
        <span class="score-label">Version</span>
        <span class="verification-value">${report.version}</span>
      </article>
    </div>
    <div class="verification-block">
      <p class="score-label">Warnings</p>
      <ul class="verification-list">
        ${(report.warnings || []).map((item) => `<li>${item}</li>`).join("") || "<li>No warning reported.</li>"}
      </ul>
    </div>
    <div class="verification-block">
      <p class="score-label">Checks</p>
      <ul class="verification-list">
        ${(report.checks || []).map((item) => `<li>${item.status} | ${item.label}: ${item.detail}</li>`).join("")}
      </ul>
    </div>
  `;
}

function renderInstallState() {
  const installStatus = document.getElementById("install-status");
  const installButton = document.getElementById("install-app-button");

  if (isStandaloneMode()) {
    installStatus.innerHTML = `
      <span class="install-status-strong">Installed.</span>
      Pipeline Rescue is already running in standalone mode on this device.
    `;
    installButton.hidden = true;
    installButton.disabled = true;
    return;
  }

  if (!("serviceWorker" in navigator)) {
    installStatus.innerHTML = `
      <span class="install-status-strong">Install unavailable.</span>
      This browser cannot register the application shell.
    `;
    installButton.hidden = true;
    installButton.disabled = true;
    return;
  }

  if (appState.installReady) {
    installStatus.innerHTML = `
      <span class="install-status-strong">Install ready.</span>
      The cached shell is active. Use the button to install the app on this device.
      <span class="install-helper">If the prompt closes, reload the page to request it again.</span>
    `;
    installButton.hidden = false;
    installButton.disabled = false;
    return;
  }

  if (appState.serviceWorkerReady) {
    installStatus.innerHTML = `
      <span class="install-status-strong">Shell ready.</span>
      Offline assets are cached. If the browser does not expose the install prompt automatically,
      use the browser menu and choose Install app or Add to home screen.
    `;
    installButton.hidden = true;
    installButton.disabled = true;
    return;
  }

  installStatus.innerHTML = `
    <span class="install-status-strong">Preparing shell.</span>
    Registering the local application shell and install hooks.
  `;
  installButton.hidden = true;
  installButton.disabled = true;
}

function renderAiControlCenter(report) {
  const checks = report.checks || [];
  const blockers = report.blockers || [];
  const envelope = report.automationEnvelope || {};
  const policySnapshot = report.policySnapshot || {};

  document.getElementById("ai-control-report").innerHTML = `
    <div class="verification-grid">
      <article class="verification-metric">
        <span class="score-label">Status</span>
        <span class="verification-value">${report.status}</span>
      </article>
      <article class="verification-metric">
        <span class="score-label">Autonomy mode</span>
        <span class="verification-value">${report.metrics?.autonomyMode || "UNKNOWN"}</span>
      </article>
      <article class="verification-metric">
        <span class="score-label">Trust gate</span>
        <span class="verification-value">${report.metrics?.trustScore ?? 0}/${report.metrics?.trustThreshold ?? 0}</span>
      </article>
      <article class="verification-metric">
        <span class="score-label">Verification gate</span>
        <span class="verification-value">${report.metrics?.verificationScore ?? 0}/${report.metrics?.verificationThreshold ?? 0}</span>
      </article>
    </div>
    <div class="verification-block">
      <p class="score-label">Summary</p>
      <p class="verification-note">${report.summary}</p>
    </div>
    <div class="verification-block">
      <p class="score-label">Automation envelope</p>
      <ul class="verification-list">
        <li>Draft automation: ${envelope.draftAutomationAllowed ? "ALLOWED" : "HUMAN_REVIEW"}</li>
        <li>Task automation: ${envelope.taskAutomationAllowed ? "ALLOWED" : "HUMAN_REVIEW"}</li>
        <li>Digest automation: ${envelope.digestAutomationAllowed ? "ALLOWED" : "HUMAN_REVIEW"}</li>
      </ul>
    </div>
    <div class="verification-block">
      <p class="score-label">Blockers</p>
      <ul class="verification-list">
        ${blockers.map((item) => `<li>${item}</li>`).join("") || "<li>No blocker reported.</li>"}
      </ul>
    </div>
    <div class="verification-block">
      <p class="score-label">Checks</p>
      <ul class="verification-list">
        ${checks.map((item) => `<li>${item.status} | ${item.label}: ${item.detail}</li>`).join("")}
      </ul>
    </div>
    <div class="verification-block">
      <p class="score-label">Policy snapshot</p>
      <p class="verification-note">Memory: ${policySnapshot.memoryProtocol || "UNKNOWN"} | Guard: ${policySnapshot.hallucinationGuard || "UNKNOWN"} | Correction pass: ${policySnapshot.correctionPassEnabled ? "ENABLED" : "DISABLED"} | Human approvals: ${(policySnapshot.humanApprovalRequiredFor || []).join(", ") || "none"}.</p>
    </div>
  `;
}

function renderAiPolicyForm(policy) {
  const approvals = new Set(policy.humanApprovalRequiredFor || []);

  document.getElementById("ai-policy-form").innerHTML = `
    <label class="score-label" for="ai-autonomy-mode-input">Autonomy mode</label>
    <select id="ai-autonomy-mode-input" class="scenario-select">
      <option value="ADVISOR_ONLY" ${policy.autonomyMode === "ADVISOR_ONLY" ? "selected" : ""}>Advisor only</option>
      <option value="ASSISTED" ${policy.autonomyMode === "ASSISTED" ? "selected" : ""}>Assisted</option>
      <option value="SUPERVISED_AUTOPILOT" ${policy.autonomyMode === "SUPERVISED_AUTOPILOT" ? "selected" : ""}>Supervised autopilot</option>
    </select>
    <label class="score-label" for="ai-trust-threshold-input">Minimum trust score</label>
    <input id="ai-trust-threshold-input" class="scenario-select" type="number" min="0" max="100" value="${policy.minimumRecommendationTrustScore}">
    <label class="score-label" for="ai-verification-threshold-input">Minimum verification stability score</label>
    <input id="ai-verification-threshold-input" class="scenario-select" type="number" min="0" max="100" value="${policy.minimumVerificationStabilityScore}">
    <label class="score-label" for="ai-cycle-limit-input">Max automated deals per cycle</label>
    <input id="ai-cycle-limit-input" class="scenario-select" type="number" min="0" value="${policy.maxAutomatedDealsPerCycle}">
    <label class="score-label" for="ai-memory-protocol-input">Memory protocol</label>
    <select id="ai-memory-protocol-input" class="scenario-select">
      <option value="CYCLE_ISOLATED" ${policy.memoryProtocol === "CYCLE_ISOLATED" ? "selected" : ""}>Cycle isolated</option>
      <option value="SCENARIO_SCOPED" ${policy.memoryProtocol === "SCENARIO_SCOPED" ? "selected" : ""}>Scenario scoped</option>
    </select>
    <label class="score-label" for="ai-hallucination-guard-input">Hallucination guard</label>
    <select id="ai-hallucination-guard-input" class="scenario-select">
      <option value="STRICT" ${policy.hallucinationGuard === "STRICT" ? "selected" : ""}>Strict</option>
      <option value="STANDARD" ${policy.hallucinationGuard === "STANDARD" ? "selected" : ""}>Standard</option>
    </select>
    <label class="verification-note"><input type="checkbox" id="ai-correction-pass-input" ${policy.correctionPassEnabled ? "checked" : ""}> Correction pass enabled</label>
    <p class="score-label">Human approval required for</p>
    <label class="verification-note"><input type="checkbox" id="ai-approval-drafts-input" ${approvals.has("CUSTOMER_DRAFTS") ? "checked" : ""}> Customer drafts</label>
    <label class="verification-note"><input type="checkbox" id="ai-approval-tasks-input" ${approvals.has("TASK_WRITES") ? "checked" : ""}> Task writes</label>
    <label class="verification-note"><input type="checkbox" id="ai-approval-digests-input" ${approvals.has("MANAGER_DIGESTS") ? "checked" : ""}> Manager digests</label>
  `;
}

function renderAiProviderStatus(report) {
  document.getElementById("ai-provider-status").innerHTML = `
    <div class="verification-grid">
      <article class="verification-metric">
        <span class="score-label">Status</span>
        <span class="verification-value">${report.status}</span>
      </article>
      <article class="verification-metric">
        <span class="score-label">Provider</span>
        <span class="verification-value">${report.provider}</span>
      </article>
      <article class="verification-metric">
        <span class="score-label">Model</span>
        <span class="verification-value">${report.model}</span>
      </article>
      <article class="verification-metric">
        <span class="score-label">Live generation</span>
        <span class="verification-value">${report.configSnapshot?.allowLiveGeneration ? "ON" : "OFF"}</span>
      </article>
    </div>
    <div class="verification-block">
      <p class="score-label">Summary</p>
      <p class="verification-note">${report.summary}</p>
    </div>
    <div class="verification-block">
      <p class="score-label">Blockers</p>
      <ul class="verification-list">
        ${(report.blockers || []).map((item) => `<li>${item}</li>`).join("") || "<li>No blocker reported.</li>"}
      </ul>
    </div>
    <div class="verification-block">
      <p class="score-label">Checks</p>
      <ul class="verification-list">
        ${(report.checks || []).map((item) => `<li>${item.status} | ${item.label}: ${item.detail}</li>`).join("")}
      </ul>
    </div>
    <div class="verification-block">
      <p class="score-label">Last probe</p>
      <p class="verification-note">${appState.providerProbe ? `${appState.providerProbe.summary} | ${appState.providerProbe.provider} | ${appState.providerProbe.model}` : "No live provider probe has been run yet."}</p>
    </div>
  `;
}

function renderAiProviderForm(config) {
  document.getElementById("ai-provider-form").innerHTML = `
    <label class="score-label" for="ai-provider-select">Provider</label>
    <select id="ai-provider-select" class="scenario-select">
      <option value="NONE" ${config.provider === "NONE" ? "selected" : ""}>None</option>
      <option value="OPENAI" ${config.provider === "OPENAI" ? "selected" : ""}>OpenAI</option>
    </select>
    <label class="verification-note"><input type="checkbox" id="ai-provider-enabled-input" ${config.enabled ? "checked" : ""}> Provider enabled</label>
    <label class="verification-note"><input type="checkbox" id="ai-provider-live-input" ${config.allowLiveGeneration ? "checked" : ""}> Allow live generation</label>
    <label class="score-label" for="ai-provider-base-url-input">Base URL</label>
    <input id="ai-provider-base-url-input" class="scenario-select" value="${escapeHtml(config.baseUrl)}">
    <label class="score-label" for="ai-provider-model-input">Model</label>
    <input id="ai-provider-model-input" class="scenario-select" value="${escapeHtml(config.model)}">
    <label class="score-label" for="ai-provider-env-input">API key env var</label>
    <input id="ai-provider-env-input" class="scenario-select" value="${escapeHtml(config.apiKeyEnvVar)}">
    <label class="score-label" for="ai-provider-timeout-input">Request timeout (ms)</label>
    <input id="ai-provider-timeout-input" class="scenario-select" type="number" min="1000" value="${config.requestTimeoutMs}">
    <label class="score-label" for="ai-provider-temperature-input">Temperature</label>
    <input id="ai-provider-temperature-input" class="scenario-select" type="number" min="0" max="2" step="0.1" value="${config.temperature}">
    <label class="score-label" for="ai-provider-max-tokens-input">Max output tokens</label>
    <input id="ai-provider-max-tokens-input" class="scenario-select" type="number" min="1" value="${config.maxOutputTokens}">
  `;
}

function renderHubSpotStatus(report) {
  document.getElementById("hubspot-status").innerHTML = `
    <div class="verification-grid">
      <article class="verification-metric">
        <span class="score-label">Status</span>
        <span class="verification-value">${report.status}</span>
      </article>
      <article class="verification-metric">
        <span class="score-label">Stored installs</span>
        <span class="verification-value">${report.installCount ?? 0}</span>
      </article>
    </div>
    <div class="verification-block">
      <p class="score-label">Summary</p>
      <p class="verification-note">${report.summary}</p>
    </div>
    <div class="verification-block">
      <p class="score-label">Blockers</p>
      <ul class="verification-list">
        ${(report.blockers || []).map((item) => `<li>${item}</li>`).join("") || "<li>No blocker reported.</li>"}
      </ul>
    </div>
    <div class="verification-block">
      <p class="score-label">Checks</p>
      <ul class="verification-list">
        ${(report.checks || []).map((item) => `<li>${item.status} | ${item.label}: ${item.detail}</li>`).join("")}
      </ul>
    </div>
    <div class="verification-block">
      <p class="score-label">Stored installs</p>
      <ul class="verification-list">
        ${(report.installs || []).map((item) => `<li>Portal ${item.portalId || "unknown"} | ${item.hubDomain || "no domain"} | ${new Date(item.connectedAt).toLocaleString("en-GB")}</li>`).join("") || "<li>No HubSpot portal connected yet.</li>"}
      </ul>
    </div>
  `;
}

function renderHubSpotConfigForm(config) {
  document.getElementById("hubspot-config-form").innerHTML = `
    <label class="verification-note"><input type="checkbox" id="hubspot-enabled-input" ${config.enabled ? "checked" : ""}> HubSpot integration enabled</label>
    <label class="score-label" for="hubspot-client-id-input">Client ID</label>
    <input id="hubspot-client-id-input" class="scenario-select" value="${escapeHtml(config.clientId)}">
    <label class="score-label" for="hubspot-secret-env-input">Client secret env var</label>
    <input id="hubspot-secret-env-input" class="scenario-select" value="${escapeHtml(config.clientSecretEnvVar)}">
    <label class="score-label" for="hubspot-redirect-uri-input">Redirect URI</label>
    <input id="hubspot-redirect-uri-input" class="scenario-select" value="${escapeHtml(config.redirectUri)}">
    <label class="score-label" for="hubspot-scopes-input">Required scopes</label>
    <textarea id="hubspot-scopes-input" class="feedback-note-input" rows="3" placeholder="One scope per line">${escapeHtml((config.scopes || []).join("\n"))}</textarea>
    <label class="score-label" for="hubspot-optional-scopes-input">Optional scopes</label>
    <textarea id="hubspot-optional-scopes-input" class="feedback-note-input" rows="2" placeholder="One optional scope per line">${escapeHtml((config.optionalScopes || []).join("\n"))}</textarea>
    <label class="score-label" for="hubspot-preferred-account-input">Preferred account ID</label>
    <input id="hubspot-preferred-account-input" class="scenario-select" value="${escapeHtml(config.preferredAccountId || "")}">
  `;
}

function renderHubSpotInstallOutput(payload) {
  document.getElementById("hubspot-install-output").innerHTML = `
    <div class="verification-block">
      <p class="score-label">${escapeHtml(payload.title)}</p>
      <p class="verification-note">${escapeHtml(payload.message)}</p>
      ${payload.url ? `<p class="verification-note"><a href="${escapeHtml(payload.url)}" target="_blank" rel="noreferrer">${escapeHtml(payload.url)}</a></p>` : ""}
    </div>
  `;
}

function renderHubSpotLivePreview(preview) {
  const container = document.getElementById("hubspot-live-preview");

  if (!preview) {
    container.innerHTML = `
      <p class="score-label">Live preview</p>
      <p class="verification-note">No live HubSpot deal preview loaded yet.</p>
    `;
    return;
  }

  const analysis = preview.dealAnalysis?.analysis || {};
  const verification = preview.dealAnalysis?.verification || {};
  const contacts = preview.graph?.contacts || [];
  const tasks = preview.graph?.tasks || [];
  const warnings = preview.normalizationWarnings || [];
  const liveTask = preview.hubspotTask || null;
  const liveDraft = preview.liveDraft || null;
  const hubspotNote = preview.hubspotNote || null;

  container.innerHTML = `
    <div class="verification-grid">
      <article class="verification-metric">
        <span class="score-label">Portal</span>
        <span class="verification-value">${escapeHtml(preview.source?.portalId || "unknown")}</span>
      </article>
      <article class="verification-metric">
        <span class="score-label">Deal</span>
        <span class="verification-value">${escapeHtml(analysis.dealId || preview.source?.dealId || "unknown")}</span>
      </article>
      <article class="verification-metric">
        <span class="score-label">Rescue score</span>
        <span class="verification-value">${formatScore(analysis.rescueScore)}</span>
      </article>
      <article class="verification-metric">
        <span class="score-label">Verification</span>
        <span class="verification-value">${escapeHtml(verification.validationStatus || "UNKNOWN")}</span>
      </article>
    </div>
    <div class="verification-block">
      <p class="score-label">Summary</p>
      <p class="verification-note">${escapeHtml(preview.source?.hubDomain || "Unknown HubSpot portal")} | ${escapeHtml(analysis.dealName || preview.normalizedDeal?.name || "Unknown deal")} | ${escapeHtml(analysis.riskLevel || "UNKNOWN")}</p>
      <p class="verification-note">${escapeHtml(analysis.recommendedAction?.summary || "No recommended action available.")}</p>
      <p class="verification-note">${escapeHtml(preview.source?.tokenRefreshed ? "Access token was refreshed automatically for this live preview." : "Stored access token was used without refresh.")}</p>
    </div>
    <div class="verification-block">
      <p class="score-label">Normalization warnings</p>
      <ul class="verification-list">
        ${warnings.map((item) => `<li>${escapeHtml(item)}</li>`).join("") || "<li>No normalization warning reported.</li>"}
      </ul>
    </div>
    <div class="verification-block">
      <p class="score-label">Top reasons</p>
      <ul class="verification-list">
        ${(analysis.reasons || []).map((reason) => `<li>${escapeHtml(reason.label)} | ${escapeHtml(reason.evidence)}</li>`).join("") || "<li>No rescue reason available.</li>"}
      </ul>
    </div>
    <div class="verification-block">
      <p class="score-label">Contacts</p>
      <ul class="verification-list">
        ${contacts.map((contact) => `<li>${escapeHtml(contact.name)} | ${escapeHtml(contact.email || "no email")} | ${contact.decisionMaker ? "decision maker" : "standard contact"}</li>`).join("") || "<li>No associated contact returned.</li>"}
      </ul>
    </div>
    <div class="verification-block">
      <p class="score-label">Tasks</p>
      <ul class="verification-list">
        ${tasks.map((task) => `<li>${escapeHtml(task.subject)} | ${escapeHtml(task.status)}${task.dueAt ? ` | ${escapeHtml(new Date(task.dueAt).toLocaleString("en-GB"))}` : ""}</li>`).join("") || "<li>No associated task returned.</li>"}
      </ul>
    </div>
    ${liveDraft ? `
      <div class="verification-block">
        <p class="score-label">Live draft</p>
        <ul class="verification-list">
          <li>${escapeHtml(liveDraft.mode || "UNKNOWN")} ${liveDraft.provider ? `| ${escapeHtml(liveDraft.provider)} | ${escapeHtml(liveDraft.model || "unknown model")}` : ""}</li>
          ${liveDraft.detail ? `<li>${escapeHtml(liveDraft.detail)}</li>` : ""}
          <li>${escapeHtml(liveDraft.draft?.subject || "No draft subject")}</li>
          <li>${escapeHtml(liveDraft.draft?.body || "No draft body")}</li>
        </ul>
      </div>
    ` : ""}
    ${liveTask ? `
      <div class="verification-block">
        <p class="score-label">Last live HubSpot task write</p>
        <ul class="verification-list">
          <li>${escapeHtml(liveTask.taskId)} | ${escapeHtml(liveTask.subject)}</li>
          <li>${escapeHtml(liveTask.status)} | ${escapeHtml(liveTask.priority)} | ${escapeHtml(liveTask.taskType)}</li>
          <li>${liveTask.dueAt ? escapeHtml(new Date(liveTask.dueAt).toLocaleString("en-GB")) : "No due date"} | contacts ${liveTask.associatedContactCount} | companies ${liveTask.associatedCompanyCount}</li>
        </ul>
      </div>
    ` : ""}
    ${hubspotNote ? `
      <div class="verification-block">
        <p class="score-label">Last live HubSpot note write</p>
        <ul class="verification-list">
          <li>${escapeHtml(hubspotNote.noteId)} | contacts ${hubspotNote.associatedContactCount} | companies ${hubspotNote.associatedCompanyCount}</li>
          <li>${escapeHtml(hubspotNote.body)}</li>
        </ul>
      </div>
    ` : ""}
  `;
}

function renderHubSpotLiveQueue(payload) {
  const container = document.getElementById("hubspot-live-queue");

  if (!payload) {
    container.innerHTML = `
      <p class="score-label">Live queue</p>
      <p class="verification-note">No live HubSpot queue loaded yet.</p>
    `;
    return;
  }

  const summary = payload.overview?.summary || {};
  const queue = payload.overview?.queue || [];
  const digest = payload.managerDigest || [];
  const discoveredDealIds = payload.discoveredDealIds || [];
  const criteria = payload.criteria || null;
  const criteriaSummary = criteria
    ? [
      `stale >= ${criteria.minimumLastActivityAgeDays ?? 0} day(s)`,
      `limit ${criteria.limit ?? 0}`,
      criteria.pipelineId ? `pipeline ${criteria.pipelineId}` : "all pipelines"
    ].join(" | ")
    : "Manual deal-ID batch";
  const queuePortalId = payload.source?.portalId ? String(payload.source.portalId) : "";

  container.innerHTML = `
    <div class="verification-block">
      <p class="score-label">Source</p>
      <p class="verification-note">${escapeHtml(payload.source?.mode || "HUBSPOT_LIVE_QUEUE")} | ${escapeHtml(criteriaSummary)}</p>
      <p class="verification-note">Discovered deals: ${discoveredDealIds.length > 0 ? escapeHtml(discoveredDealIds.join(", ")) : "none"}</p>
    </div>
    <div class="verification-grid">
      <article class="verification-metric">
        <span class="score-label">Deals</span>
        <span class="verification-value">${summary.analyzedDeals ?? 0}</span>
      </article>
      <article class="verification-metric">
        <span class="score-label">At risk</span>
        <span class="verification-value">${summary.atRiskDeals ?? 0}</span>
      </article>
      <article class="verification-metric">
        <span class="score-label">Critical</span>
        <span class="verification-value">${summary.criticalDeals ?? 0}</span>
      </article>
      <article class="verification-metric">
        <span class="score-label">Revenue candidate</span>
        <span class="verification-value">${formatCurrency(summary.recoveredRevenueCandidate)}</span>
      </article>
    </div>
    <div class="verification-block">
      <p class="score-label">Manager digest</p>
      <ul class="verification-list">
        ${digest.map((item) => `<li>${escapeHtml(item)}</li>`).join("") || "<li>No manager digest available.</li>"}
      </ul>
    </div>
    <div class="verification-block">
      <p class="score-label">Ranked queue</p>
      <ul class="verification-list">
        ${queue.map((item) => `
          <li>
            ${escapeHtml(item.dealName)} | ${escapeHtml(item.riskLevel)} | ${formatScore(item.rescueScore)} | ${escapeHtml(item.nextBestAction || "No action")}
            <button type="button" class="queue-open-button" data-hubspot-live-deal-id="${escapeHtml(item.dealId)}" data-hubspot-portal-id="${escapeHtml(queuePortalId)}">Open live deal</button>
          </li>
        `).join("") || "<li>No at-risk live queue item returned.</li>"}
      </ul>
    </div>
  `;
}

function renderAiCycleReport(report) {
  const container = document.getElementById("ai-cycle-report");

  if (!report) {
    container.innerHTML = `
      <p class="score-label">AI cycle</p>
      <p class="verification-note">No AI cycle has been run yet for this scenario.</p>
    `;
    return;
  }

  container.innerHTML = `
    <div class="verification-grid">
      <article class="verification-metric">
        <span class="score-label">Cycle status</span>
        <span class="verification-value">${report.cycleStatus}</span>
      </article>
      <article class="verification-metric">
        <span class="score-label">Control status</span>
        <span class="verification-value">${report.controlStatus}</span>
      </article>
      <article class="verification-metric">
        <span class="score-label">Analyzed</span>
        <span class="verification-value">${report.metrics?.analyzedDeals ?? 0}</span>
      </article>
      <article class="verification-metric">
        <span class="score-label">Automated tasks</span>
        <span class="verification-value">${report.metrics?.tasksCreated ?? 0}</span>
      </article>
    </div>
    <div class="verification-block">
      <p class="score-label">Summary</p>
      <p class="verification-note">${report.summary}</p>
      <p class="verification-note">${report.controlSummary}</p>
    </div>
    <div class="verification-block">
      <p class="score-label">Manager digest</p>
      <ul class="verification-list">
        ${(report.managerDigest || []).map((item) => `<li>${item}</li>`).join("")}
      </ul>
    </div>
    <div class="verification-block">
      <p class="score-label">Deal decisions</p>
      <ul class="verification-list">
        ${(report.decisions || []).map((item) => `<li>${item.dealName} | ${item.riskLevel} | task ${item.taskDecision} | draft ${item.draftDecision} | ${item.recommendedAction}</li>`).join("") || "<li>No deal selected for this cycle.</li>"}
      </ul>
    </div>
  `;
}

function collectAiPolicyForm() {
  const approvals = [];
  if (document.getElementById("ai-approval-drafts-input").checked) {
    approvals.push("CUSTOMER_DRAFTS");
  }
  if (document.getElementById("ai-approval-tasks-input").checked) {
    approvals.push("TASK_WRITES");
  }
  if (document.getElementById("ai-approval-digests-input").checked) {
    approvals.push("MANAGER_DIGESTS");
  }

  return {
    autonomyMode: document.getElementById("ai-autonomy-mode-input").value,
    minimumRecommendationTrustScore: Number(document.getElementById("ai-trust-threshold-input").value),
    minimumVerificationStabilityScore: Number(document.getElementById("ai-verification-threshold-input").value),
    maxAutomatedDealsPerCycle: Number(document.getElementById("ai-cycle-limit-input").value),
    correctionPassEnabled: document.getElementById("ai-correction-pass-input").checked,
    memoryProtocol: document.getElementById("ai-memory-protocol-input").value,
    hallucinationGuard: document.getElementById("ai-hallucination-guard-input").value,
    humanApprovalRequiredFor: approvals
  };
}

function collectAiProviderForm() {
  return {
    provider: document.getElementById("ai-provider-select").value,
    enabled: document.getElementById("ai-provider-enabled-input").checked,
    allowLiveGeneration: document.getElementById("ai-provider-live-input").checked,
    baseUrl: document.getElementById("ai-provider-base-url-input").value.trim(),
    model: document.getElementById("ai-provider-model-input").value.trim(),
    apiKeyEnvVar: document.getElementById("ai-provider-env-input").value.trim(),
    requestTimeoutMs: Number(document.getElementById("ai-provider-timeout-input").value),
    temperature: Number(document.getElementById("ai-provider-temperature-input").value),
    maxOutputTokens: Number(document.getElementById("ai-provider-max-tokens-input").value)
  };
}

function collectHubSpotConfigForm() {
  const parseLines = (value) =>
    String(value)
      .split(/\r?\n/)
      .map((item) => item.trim())
      .filter(Boolean);

  return {
    enabled: document.getElementById("hubspot-enabled-input").checked,
    clientId: document.getElementById("hubspot-client-id-input").value.trim(),
    clientSecretEnvVar: document.getElementById("hubspot-secret-env-input").value.trim(),
    redirectUri: document.getElementById("hubspot-redirect-uri-input").value.trim(),
    scopes: parseLines(document.getElementById("hubspot-scopes-input").value),
    optionalScopes: parseLines(document.getElementById("hubspot-optional-scopes-input").value),
    preferredAccountId: document.getElementById("hubspot-preferred-account-input").value.trim() || null
  };
}

function renderComplianceConfig(config) {
  document.getElementById("compliance-config-input").value = JSON.stringify(config, null, 2);
}

function renderComplianceGuidedForm(config) {
  const processors = Array.isArray(config.processors) ? config.processors : [];
  const activities = Array.isArray(config.processingActivities) ? config.processingActivities : [];
  const container = document.getElementById("compliance-guided-form");

  container.innerHTML = `
    <p class="score-label">Guided compliance form</p>
    <label class="score-label" for="controller-name-input">Controller legal name</label>
    <input id="controller-name-input" class="scenario-select" value="${escapeHtml(config.controller?.name || "")}">
    <label class="score-label" for="controller-email-input">Privacy contact email</label>
    <input id="controller-email-input" class="scenario-select" value="${escapeHtml(config.controller?.contactEmail || "")}">
    <label class="score-label" for="controller-country-input">EU establishment country</label>
    <input id="controller-country-input" class="scenario-select" value="${escapeHtml(config.controller?.euEstablishmentCountry || "")}">
    <label class="score-label" for="dsar-email-input">DSAR channel email</label>
    <input id="dsar-email-input" class="scenario-select" value="${escapeHtml(config.dataSubjectRights?.requestChannelEmail || "")}">
    <label class="score-label" for="breach-owner-input">Breach owner</label>
    <input id="breach-owner-input" class="scenario-select" value="${escapeHtml(config.breachResponse?.owner || "")}">
    <div class="manager-columns">
      <div class="verification-block">
        <p class="score-label">Registers</p>
        <label class="verification-note"><input type="checkbox" id="controller-register-input" ${config.records?.controllerRegisterMaintained ? "checked" : ""}> Controller register maintained</label>
        <label class="verification-note"><input type="checkbox" id="processor-register-input" ${config.records?.processorRegisterMaintained ? "checked" : ""}> Processor register maintained</label>
      </div>
      <div class="verification-block">
        <p class="score-label">Security</p>
        <label class="verification-note"><input type="checkbox" id="security-at-rest-input" ${config.security?.encryptionAtRest ? "checked" : ""}> Encryption at rest</label>
        <label class="verification-note"><input type="checkbox" id="security-rbac-input" ${config.security?.rbac ? "checked" : ""}> RBAC enabled</label>
        <label class="verification-note"><input type="checkbox" id="security-mfa-input" ${config.security?.mfa ? "checked" : ""}> MFA enabled</label>
        <label class="verification-note"><input type="checkbox" id="security-backup-input" ${config.security?.backupRestoreTested ? "checked" : ""}> Backup restore tested</label>
      </div>
    </div>
    <div class="verification-block">
      <p class="score-label">Processor DPAs</p>
      ${(processors.map((processor, index) => `<label class="verification-note"><input type="checkbox" data-processor-index="${index}" ${processor.dpaSigned ? "checked" : ""}> ${escapeHtml(processor.name)} DPA signed</label>`).join("") || "<p class='verification-note'>No processor configured.</p>")}
    </div>
    <div class="verification-block">
      <p class="score-label">Lawful basis by activity</p>
      <div class="stack">
        ${activities.map((activity, index) => `
          <article class="reason-card">
            <div class="reason-row">
              <span class="reason-title">${escapeHtml(activity.id)}</span>
            </div>
            <label class="score-label" for="activity-basis-${index}">Lawful basis</label>
            <select id="activity-basis-${index}" class="scenario-select" data-activity-index="${index}">
              <option value="">Select lawful basis</option>
              <option value="CONSENT" ${activity.lawfulBasis === "CONSENT" ? "selected" : ""}>CONSENT</option>
              <option value="CONTRACT" ${activity.lawfulBasis === "CONTRACT" ? "selected" : ""}>CONTRACT</option>
              <option value="LEGAL_OBLIGATION" ${activity.lawfulBasis === "LEGAL_OBLIGATION" ? "selected" : ""}>LEGAL_OBLIGATION</option>
              <option value="PUBLIC_TASK" ${activity.lawfulBasis === "PUBLIC_TASK" ? "selected" : ""}>PUBLIC_TASK</option>
              <option value="VITAL_INTERESTS" ${activity.lawfulBasis === "VITAL_INTERESTS" ? "selected" : ""}>VITAL_INTERESTS</option>
              <option value="LEGITIMATE_INTEREST" ${activity.lawfulBasis === "LEGITIMATE_INTEREST" ? "selected" : ""}>LEGITIMATE_INTEREST</option>
            </select>
            <label class="verification-note"><input type="checkbox" id="activity-lia-${index}" ${activity.legitimateInterestAssessmentCompleted ? "checked" : ""}> Legitimate-interest assessment completed</label>
          </article>
        `).join("")}
      </div>
    </div>
  `;
}

function applyGuidedComplianceFormToJson() {
  const config = JSON.parse(document.getElementById("compliance-config-input").value);
  const nextConfig = JSON.parse(JSON.stringify(config));

  nextConfig.controller = nextConfig.controller || {};
  nextConfig.controller.name = document.getElementById("controller-name-input").value.trim() || null;
  nextConfig.controller.contactEmail = document.getElementById("controller-email-input").value.trim() || null;
  nextConfig.controller.euEstablishmentCountry = document.getElementById("controller-country-input").value.trim() || null;

  nextConfig.dataSubjectRights = nextConfig.dataSubjectRights || {};
  nextConfig.dataSubjectRights.requestChannelEmail = document.getElementById("dsar-email-input").value.trim() || null;

  nextConfig.breachResponse = nextConfig.breachResponse || {};
  nextConfig.breachResponse.owner = document.getElementById("breach-owner-input").value.trim() || null;

  nextConfig.records = nextConfig.records || {};
  nextConfig.records.controllerRegisterMaintained = document.getElementById("controller-register-input").checked;
  nextConfig.records.processorRegisterMaintained = document.getElementById("processor-register-input").checked;

  nextConfig.security = nextConfig.security || {};
  nextConfig.security.encryptionAtRest = document.getElementById("security-at-rest-input").checked;
  nextConfig.security.rbac = document.getElementById("security-rbac-input").checked;
  nextConfig.security.mfa = document.getElementById("security-mfa-input").checked;
  nextConfig.security.backupRestoreTested = document.getElementById("security-backup-input").checked;

  nextConfig.processors = (nextConfig.processors || []).map((processor, index) => ({
    ...processor,
    dpaSigned: document.querySelector(`[data-processor-index="${index}"]`)?.checked || false
  }));

  nextConfig.processingActivities = (nextConfig.processingActivities || []).map((activity, index) => ({
    ...activity,
    lawfulBasis: document.getElementById(`activity-basis-${index}`).value || null,
    legitimateInterestAssessmentCompleted: document.getElementById(`activity-lia-${index}`).checked
  }));

  renderComplianceConfig(nextConfig);
}

function renderEvents(eventsPayload) {
  const events = eventsPayload.events || [];
  const eventList = document.getElementById("event-list");

  if (events.length === 0) {
    eventList.innerHTML = `
      <article class="event-card empty-card">
        <p class="queue-meta">No pilot events yet. Trigger analyze, task creation, or draft generation.</p>
      </article>
    `;
    return;
  }

  eventList.innerHTML = events
    .map((event) => `
      <article class="event-card">
        <p class="eyebrow">${event.eventName}</p>
        <p class="queue-meta">${new Date(event.occurredAt).toLocaleString("en-GB")}</p>
        <p class="queue-meta">${Object.entries(event.properties || {}).map(([key, value]) => `${key}: ${value}`).join(" | ")}</p>
      </article>
    `)
    .join("");
}

function renderQueue(queue) {
  const queueList = document.getElementById("queue-list");

  if (!queue || queue.length === 0) {
    queueList.innerHTML = `
      <article class="queue-card empty-card">
        <h3>No urgent queue</h3>
        <p class="queue-meta">This scenario verifies that Pipeline Rescue does not invent pressure when the pipeline is healthy.</p>
      </article>
    `;
    return;
  }

  queueList.innerHTML = queue
    .map((item) => `
      <article class="queue-card">
        <h3>${item.dealName}</h3>
        <p class="queue-meta">${item.owner} | ${item.riskLevel} | score ${formatScore(item.rescueScore)}</p>
        <p class="queue-meta">Top reason: ${item.topReason}. Last activity ${item.lastActivityAgeDays ?? "unknown"} day(s) ago.</p>
        <p class="queue-meta">Task state: ${item.taskStatus || "NOT_CREATED"}</p>
        <p class="queue-meta">Feedback: ${item.feedbackStatus || "NO_FEEDBACK"} | ${item.feedbackSignalCount ?? 0} signal(s)</p>
        <p class="queue-action">${item.nextBestAction}</p>
        <button type="button" class="queue-open-button" data-deal-id="${item.dealId}">Open deal</button>
      </article>
    `)
    .join("");
}

function setScenarioInUrl(scenarioId) {
  const url = new URL(window.location.href);
  url.searchParams.set("scenario", scenarioId);
  window.history.replaceState({}, "", url);
}

async function renderFocusedDealById(dealId) {
  const payload = await loadDealAnalysis(dealId);
  appState.focusedDealId = payload.analysis.dealId;
  renderVerification(payload.verification);
  renderFocusedDeal(payload.analysis);
}

async function refreshEvents() {
  renderEvents(await loadEvents());
}

async function refreshManagerReport() {
  renderManagerReport(await loadManagerReport());
}

async function refreshFeedbackReport() {
  renderFeedbackReport(await loadFeedbackReport());
}

async function refreshAiControlCenter() {
  renderAiControlCenter(await loadAiControlCenter());
}

async function refreshAiPolicy() {
  renderAiPolicyForm(await loadAiPolicy());
}

async function refreshAiProvider() {
  const [config, status] = await Promise.all([loadAiProviderConfig(), loadAiProviderStatus()]);
  renderAiProviderForm(config);
  renderAiProviderStatus(status);
}

async function refreshHubSpot() {
  const [config, status] = await Promise.all([loadHubSpotConfig(), loadHubSpotStatus()]);
  renderHubSpotConfigForm(config);
  renderHubSpotStatus(status);
}

async function refreshComplianceReport() {
  renderComplianceReport(await loadComplianceReport());
}

async function refreshComplianceConfig() {
  const config = await loadComplianceConfig();
  renderComplianceConfig(config);
  renderComplianceGuidedForm(config);
}

async function refreshSystemReport() {
  renderSystemReport(await loadSystemReport());
}

function getFeedbackPayload() {
  const reasonCode = document.getElementById("feedback-reason-select").value || null;
  const note = document.getElementById("feedback-note-input").value.trim() || null;

  return {
    reasonCode,
    note
  };
}

function clearFeedbackInputs() {
  document.getElementById("feedback-reason-select").value = "";
  document.getElementById("feedback-note-input").value = "";
}

function applyOverview(catalog, scenarioId, overview) {
  appState.catalog = catalog;
  appState.scenarioId = scenarioId;
  appState.overview = overview;
  appState.focusedDealId = overview.focusedDeal.dealId;

  renderScenarioControls(catalog, scenarioId);
  renderMeta(overview.meta);
  renderSummary(overview.summary);
  renderVerification(overview.verification);
  renderFocusedDeal(overview.focusedDeal);
  renderQueue(overview.queue);
  renderEvents({ events: overview.pilotEvents || [] });
  setScenarioInUrl(scenarioId);
}

async function renderScenario(catalog, scenarioId) {
  const overview = await loadOverview(scenarioId);
  applyOverview(catalog, scenarioId, overview);
  renderAiCycleReport(null);
  appState.liveDraft = null;
  appState.hubspotLivePreview = null;
  appState.hubspotLiveQueue = null;
  renderHubSpotLivePreview(null);
  renderHubSpotLiveQueue(null);
  await refreshManagerReport();
  await refreshFeedbackReport();
  await refreshAiControlCenter();
  await refreshAiPolicy();
  await refreshAiProvider();
  await refreshHubSpot();
  await refreshComplianceReport();
  await refreshComplianceConfig();
  await refreshSystemReport();
}

async function handleAnalyzeClick() {
  appState.liveDraft = null;
  const payload = await postAction(`/api/deals/${encodeURIComponent(appState.focusedDealId)}/analyze`);
  renderVerification(payload.verification);
  renderFocusedDeal(payload.analysis);
  await refreshEvents();
  await refreshManagerReport();
  await refreshFeedbackReport();
  await refreshAiControlCenter();
  await refreshAiPolicy();
  await refreshComplianceReport();
  await refreshComplianceConfig();
  await refreshSystemReport();
}

async function handleTaskClick() {
  appState.liveDraft = null;
  const payload = await postAction(`/api/deals/${encodeURIComponent(appState.focusedDealId)}/tasks`);
  renderFocusedDeal(payload.analysis);
  await refreshScenarioSummary();
  await refreshEvents();
  await refreshManagerReport();
  await refreshFeedbackReport();
  await refreshAiControlCenter();
  await refreshAiPolicy();
  await refreshComplianceReport();
  await refreshComplianceConfig();
  await refreshSystemReport();
}

async function handleDraftClick() {
  appState.liveDraft = null;
  const payload = await postAction(`/api/deals/${encodeURIComponent(appState.focusedDealId)}/draft`);
  renderVerification(payload.verification);
  renderFocusedDeal(payload.analysis);
  await refreshEvents();
  await refreshManagerReport();
  await refreshFeedbackReport();
  await refreshComplianceReport();
  await refreshComplianceConfig();
  await refreshSystemReport();
}

async function handleFeedbackUsefulClick() {
  const payload = await postAction(
    `/api/deals/${encodeURIComponent(appState.focusedDealId)}/feedback/useful`,
    getFeedbackPayload()
  );
  renderFocusedDeal(payload.analysis);
  clearFeedbackInputs();
  await refreshScenarioSummary();
  await refreshEvents();
  await refreshManagerReport();
  await refreshFeedbackReport();
  await refreshAiControlCenter();
  await refreshAiPolicy();
  await refreshComplianceReport();
  await refreshComplianceConfig();
  await refreshSystemReport();
}

async function handleFeedbackDismissClick() {
  const payload = await postAction(
    `/api/deals/${encodeURIComponent(appState.focusedDealId)}/feedback/dismiss`,
    getFeedbackPayload()
  );
  renderFocusedDeal(payload.analysis);
  clearFeedbackInputs();
  await refreshScenarioSummary();
  await refreshEvents();
  await refreshManagerReport();
  await refreshFeedbackReport();
  await refreshAiControlCenter();
  await refreshAiPolicy();
  await refreshComplianceReport();
  await refreshComplianceConfig();
  await refreshSystemReport();
}

async function handleFeedbackExportClick(format) {
  await downloadFeedbackExport(format);
}

async function refreshScenarioSummary() {
  const overview = await loadOverview(appState.scenarioId);
  appState.overview = overview;
  renderSummary(overview.summary);
  renderQueue(overview.queue);
}

async function handleResetClick() {
  const payload = await resetScenarioState();
  applyOverview(appState.catalog, appState.scenarioId, payload.overview);
  await refreshManagerReport();
  await refreshFeedbackReport();
  await refreshAiControlCenter();
  await refreshAiPolicy();
  await refreshComplianceReport();
  await refreshComplianceConfig();
  await refreshSystemReport();
}

async function handleReloadAiPolicyClick() {
  try {
    await refreshAiPolicy();
    await refreshAiControlCenter();
  } catch (error) {
    document.getElementById("ai-control-report").innerHTML = `
      <p class="verification-note">AI policy reload failed: ${error.message}</p>
    `;
  }
}

async function handleSaveAiPolicyClick() {
  try {
    const response = await saveAiPolicy(collectAiPolicyForm());
    renderAiPolicyForm(response.policy);
    renderAiControlCenter(response.report);
  } catch (error) {
    document.getElementById("ai-control-report").innerHTML = `
      <p class="verification-note">AI policy save failed: ${error.message}</p>
    `;
  }
}

async function handleRunAiCycleClick() {
  try {
    const report = await runAiCycle();
    renderAiCycleReport(report);
    await refreshScenarioSummary();
    await refreshEvents();
    await refreshManagerReport();
    await refreshFeedbackReport();
    await refreshAiControlCenter();
    await refreshAiPolicy();
    await refreshAiProvider();
    await refreshHubSpot();
  } catch (error) {
    document.getElementById("ai-cycle-report").innerHTML = `
      <p class="verification-note">AI cycle failed: ${error.message}</p>
    `;
  }
}

async function handleHubSpotInstallUrlClick() {
  try {
    const accountId = document.getElementById("hubspot-install-account-input").value.trim();
    const payload = await loadHubSpotInstallUrl(accountId || "");
    renderHubSpotInstallOutput({
      title: "HubSpot install URL",
      message: "Open this URL in a browser to start the OAuth install flow.",
      url: payload.installUrl
    });
  } catch (error) {
    renderHubSpotInstallOutput({
      title: "HubSpot install URL failed",
      message: error.message
    });
  }
}

async function handleReloadHubSpotConfigClick() {
  try {
    await refreshHubSpot();
  } catch (error) {
    renderHubSpotInstallOutput({
      title: "HubSpot reload failed",
      message: error.message
    });
  }
}

async function handleSaveHubSpotConfigClick() {
  try {
    const response = await saveHubSpotConfig(collectHubSpotConfigForm());
    renderHubSpotConfigForm(response.config);
    renderHubSpotStatus(response.status);
    renderHubSpotInstallOutput({
      title: "HubSpot config saved",
      message: "Local HubSpot OAuth config was updated."
    });
  } catch (error) {
    renderHubSpotInstallOutput({
      title: "HubSpot config save failed",
      message: error.message
    });
  }
}

async function handleExchangeHubSpotCodeClick() {
  try {
    const code = document.getElementById("hubspot-oauth-code-input").value.trim();
    const response = await exchangeHubSpotCode(code);
    document.getElementById("hubspot-oauth-code-input").value = "";
    renderHubSpotStatus(response.status);
    renderHubSpotInstallOutput({
      title: "HubSpot connected",
      message: `Portal ${response.install.portalId || "unknown"} was stored locally.`
    });
  } catch (error) {
    renderHubSpotInstallOutput({
      title: "HubSpot OAuth exchange failed",
      message: error.message
    });
  }
}

async function handleHubSpotLivePreviewClick() {
  try {
    const portalId = document.getElementById("hubspot-live-portal-input").value.trim();
    const dealId = document.getElementById("hubspot-live-deal-input").value.trim();

    if (!dealId) {
      throw new Error("A HubSpot deal ID is required for live preview.");
    }

    appState.hubspotLivePreview = await loadHubSpotLivePreview(portalId || "", dealId);
    renderHubSpotLivePreview(appState.hubspotLivePreview);
    await refreshHubSpot();
    await refreshSystemReport();
  } catch (error) {
    document.getElementById("hubspot-live-preview").innerHTML = `
      <p class="score-label">Live preview failed</p>
      <p class="verification-note">${escapeHtml(error.message)}</p>
    `;
  }
}

async function handleHubSpotLiveTaskClick() {
  try {
    const portalId = document.getElementById("hubspot-live-portal-input").value.trim();
    const dealId = document.getElementById("hubspot-live-deal-input").value.trim();

    if (!dealId) {
      throw new Error("A HubSpot deal ID is required for live task creation.");
    }

    const response = await createHubSpotLiveTask(portalId || "", dealId);
    appState.hubspotLivePreview = {
      source: response.source,
      normalizedDeal: response.normalizedDeal,
      normalizationWarnings: response.normalizationWarnings,
      graph: response.graph,
      dealAnalysis: response.dealAnalysis,
      hubspotTask: response.hubspotTask
    };
    renderHubSpotLivePreview(appState.hubspotLivePreview);
    await refreshHubSpot();
    await refreshSystemReport();
  } catch (error) {
    document.getElementById("hubspot-live-preview").innerHTML = `
      <p class="score-label">Live task write failed</p>
      <p class="verification-note">${escapeHtml(error.message)}</p>
    `;
  }
}

async function handleHubSpotLiveDraftClick() {
  try {
    const portalId = document.getElementById("hubspot-live-portal-input").value.trim();
    const dealId = document.getElementById("hubspot-live-deal-input").value.trim();

    if (!dealId) {
      throw new Error("A HubSpot deal ID is required for live draft generation.");
    }

    const response = await createHubSpotLiveDraft(portalId || "", dealId);
    appState.hubspotLivePreview = {
      source: response.source,
      normalizedDeal: response.normalizedDeal,
      normalizationWarnings: response.normalizationWarnings,
      graph: response.graph,
      dealAnalysis: response.dealAnalysis,
      liveDraft: response.liveDraft
    };
    renderHubSpotLivePreview(appState.hubspotLivePreview);
    await refreshHubSpot();
    await refreshAiProvider();
    await refreshSystemReport();
  } catch (error) {
    document.getElementById("hubspot-live-preview").innerHTML = `
      <p class="score-label">Live draft failed</p>
      <p class="verification-note">${escapeHtml(error.message)}</p>
    `;
  }
}

async function handleHubSpotLiveNoteClick() {
  try {
    const portalId = document.getElementById("hubspot-live-portal-input").value.trim();
    const dealId = document.getElementById("hubspot-live-deal-input").value.trim();

    if (!dealId) {
      throw new Error("A HubSpot deal ID is required for live note creation.");
    }

    const response = await createHubSpotLiveNote(portalId || "", dealId);
    appState.hubspotLivePreview = {
      source: response.source,
      normalizedDeal: response.normalizedDeal,
      normalizationWarnings: response.normalizationWarnings,
      graph: response.graph,
      dealAnalysis: response.dealAnalysis,
      liveDraft: response.liveDraft,
      hubspotNote: response.hubspotNote
    };
    renderHubSpotLivePreview(appState.hubspotLivePreview);
    await refreshHubSpot();
    await refreshAiProvider();
    await refreshSystemReport();
  } catch (error) {
    document.getElementById("hubspot-live-preview").innerHTML = `
      <p class="score-label">Live note write failed</p>
      <p class="verification-note">${escapeHtml(error.message)}</p>
    `;
  }
}

async function handleHubSpotLiveQueueClick() {
  try {
    const portalId = document.getElementById("hubspot-live-portal-input").value.trim();
    const dealIds = document.getElementById("hubspot-live-queue-input").value;

    appState.hubspotLiveQueue = await loadHubSpotLiveQueue(portalId || "", dealIds);
    if ((appState.hubspotLiveQueue.deals || []).length > 0) {
      document.getElementById("hubspot-live-deal-input").value = appState.hubspotLiveQueue.deals[0].normalizedDeal.id;
    }
    renderHubSpotLiveQueue(appState.hubspotLiveQueue);
    await refreshHubSpot();
    await refreshSystemReport();
  } catch (error) {
    document.getElementById("hubspot-live-queue").innerHTML = `
      <p class="score-label">Live queue failed</p>
      <p class="verification-note">${escapeHtml(error.message)}</p>
    `;
  }
}

async function handleHubSpotLiveSearchClick() {
  try {
    const portalId = document.getElementById("hubspot-live-portal-input").value.trim();
    const pipelineId = document.getElementById("hubspot-live-search-pipeline-input").value.trim();
    const minimumLastActivityAgeDays = Number(document.getElementById("hubspot-live-search-stale-days-input").value);
    const limit = Number(document.getElementById("hubspot-live-search-limit-input").value);

    appState.hubspotLiveQueue = await loadHubSpotLiveSearch({
      portalId: portalId || null,
      pipelineId: pipelineId || null,
      minimumLastActivityAgeDays,
      limit
    });
    if ((appState.hubspotLiveQueue.discoveredDealIds || []).length > 0) {
      document.getElementById("hubspot-live-deal-input").value = appState.hubspotLiveQueue.discoveredDealIds[0];
    }
    renderHubSpotLiveQueue(appState.hubspotLiveQueue);
    await refreshHubSpot();
    await refreshSystemReport();
  } catch (error) {
    document.getElementById("hubspot-live-queue").innerHTML = `
      <p class="score-label">Live search failed</p>
      <p class="verification-note">${escapeHtml(error.message)}</p>
    `;
  }
}

async function handleHubSpotLiveQueueResultClick(event) {
  const button = event.target.closest("[data-hubspot-live-deal-id]");
  if (!button) {
    return;
  }

  try {
    const portalId = button.getAttribute("data-hubspot-portal-id") || "";
    const dealId = button.getAttribute("data-hubspot-live-deal-id") || "";

    document.getElementById("hubspot-live-portal-input").value = portalId;
    document.getElementById("hubspot-live-deal-input").value = dealId;
    appState.hubspotLivePreview = await loadHubSpotLivePreview(portalId, dealId);
    renderHubSpotLivePreview(appState.hubspotLivePreview);
    await refreshHubSpot();
    await refreshSystemReport();
  } catch (error) {
    document.getElementById("hubspot-live-preview").innerHTML = `
      <p class="score-label">Live preview failed</p>
      <p class="verification-note">${escapeHtml(error.message)}</p>
    `;
  }
}

async function handleProbeAiProviderClick() {
  try {
    appState.providerProbe = await probeProvider();
    await refreshAiProvider();
  } catch (error) {
    document.getElementById("ai-provider-status").innerHTML = `
      <p class="verification-note">AI provider probe failed: ${error.message}</p>
    `;
  }
}

async function handleLiveDraftClick() {
  try {
    const response = await generateLiveDraftForDeal(appState.focusedDealId);
    appState.liveDraft = {
      scenarioId: response.scenarioId,
      dealId: response.dealId,
      ...response.liveDraft
    };
    await renderFocusedDealById(appState.focusedDealId);
    await refreshAiProvider();
  } catch (error) {
    document.getElementById("draft-meta").textContent = "Live provider draft failed";
    document.getElementById("draft-body").textContent = error.message;
  }
}

async function handleReloadAiProviderClick() {
  try {
    await refreshAiProvider();
  } catch (error) {
    document.getElementById("ai-provider-status").innerHTML = `
      <p class="verification-note">AI provider reload failed: ${error.message}</p>
    `;
  }
}

async function handleSaveAiProviderClick() {
  try {
    const response = await saveAiProviderConfig(collectAiProviderForm());
    renderAiProviderForm(response.config);
    renderAiProviderStatus(response.status);
  } catch (error) {
    document.getElementById("ai-provider-status").innerHTML = `
      <p class="verification-note">AI provider save failed: ${error.message}</p>
    `;
  }
}

async function handleReloadComplianceConfigClick() {
  try {
    await refreshComplianceConfig();
    await refreshComplianceReport();
    await refreshSystemReport();
  } catch (error) {
    document.getElementById("compliance-report").innerHTML = `
      <p class="verification-note">Compliance config reload failed: ${error.message}</p>
    `;
  }
}

async function handleSaveComplianceConfigClick() {
  try {
    const raw = document.getElementById("compliance-config-input").value;
    const payload = JSON.parse(raw);
    const response = await saveComplianceConfig(payload);
    renderComplianceConfig(response.config);
    renderComplianceGuidedForm(response.config);
    renderComplianceReport(response.complianceReport);
    renderSystemReport(response.systemReport);
  } catch (error) {
    document.getElementById("compliance-report").innerHTML = `
      <p class="verification-note">Compliance config save failed: ${error.message}</p>
    `;
  }
}

function handleApplyGuidedComplianceClick() {
  try {
    applyGuidedComplianceFormToJson();
  } catch (error) {
    document.getElementById("compliance-report").innerHTML = `
      <p class="verification-note">Guided form apply failed: ${error.message}</p>
    `;
  }
}

async function registerInstallShell() {
  renderInstallState();

  if (!("serviceWorker" in navigator)) {
    return;
  }

  try {
    await navigator.serviceWorker.register("/service-worker.js");
    appState.serviceWorkerReady = true;
  } catch (error) {
    document.getElementById("install-status").innerHTML = `
      <span class="install-status-strong">Shell failed.</span>
      Service worker registration failed: ${escapeHtml(error.message)}
    `;
    return;
  }

  renderInstallState();
}

async function handleInstallAppClick() {
  if (!appState.installPrompt) {
    renderInstallState();
    return;
  }

  await appState.installPrompt.prompt();
  await appState.installPrompt.userChoice;
  appState.installPrompt = null;
  appState.installReady = false;
  renderInstallState();
}

async function main() {
  const select = document.getElementById("scenario-select");
  const refreshButton = document.getElementById("refresh-button");
  const resetButton = document.getElementById("reset-button");
  const queueList = document.getElementById("queue-list");
  const exportJsonButton = document.getElementById("export-feedback-json-button");
  const exportCsvButton = document.getElementById("export-feedback-csv-button");
  const reloadComplianceConfigButton = document.getElementById("reload-compliance-config-button");
  const saveComplianceConfigButton = document.getElementById("save-compliance-config-button");
  const applyGuidedComplianceButton = document.getElementById("apply-guided-compliance-button");
  const installAppButton = document.getElementById("install-app-button");
  const reloadAiPolicyButton = document.getElementById("reload-ai-policy-button");
  const saveAiPolicyButton = document.getElementById("save-ai-policy-button");
  const runAiCycleButton = document.getElementById("run-ai-cycle-button");
  const reloadAiProviderButton = document.getElementById("reload-ai-provider-button");
  const saveAiProviderButton = document.getElementById("save-ai-provider-button");
  const probeAiProviderButton = document.getElementById("probe-ai-provider-button");
  const liveDraftButton = document.getElementById("live-draft-button");
  const hubSpotInstallUrlButton = document.getElementById("hubspot-install-url-button");
  const reloadHubSpotConfigButton = document.getElementById("reload-hubspot-config-button");
  const saveHubSpotConfigButton = document.getElementById("save-hubspot-config-button");
  const exchangeHubSpotCodeButton = document.getElementById("exchange-hubspot-code-button");
  const hubSpotLivePreviewButton = document.getElementById("hubspot-live-preview-button");
  const hubSpotLiveTaskButton = document.getElementById("hubspot-live-task-button");
  const hubSpotLiveDraftButton = document.getElementById("hubspot-live-draft-button");
  const hubSpotLiveNoteButton = document.getElementById("hubspot-live-note-button");
  const hubSpotLiveQueueButton = document.getElementById("hubspot-live-queue-button");
  const hubSpotLiveSearchButton = document.getElementById("hubspot-live-search-button");
  const hubSpotLiveQueuePanel = document.getElementById("hubspot-live-queue");

  try {
    window.addEventListener("beforeinstallprompt", (event) => {
      event.preventDefault();
      appState.installPrompt = event;
      appState.installReady = true;
      renderInstallState();
    });

    window.addEventListener("appinstalled", () => {
      appState.installPrompt = null;
      appState.installReady = false;
      renderInstallState();
    });

    const displayModeQuery = window.matchMedia("(display-mode: standalone)");
    if (typeof displayModeQuery.addEventListener === "function") {
      displayModeQuery.addEventListener("change", renderInstallState);
    }

    installAppButton.addEventListener("click", handleInstallAppClick);
    await registerInstallShell();

    const catalog = await loadScenarios();
    const initialScenario = getSearchScenario() || catalog.defaultScenario;

    select.addEventListener("change", async (event) => {
      await renderScenario(catalog, event.target.value);
    });

    refreshButton.addEventListener("click", async () => {
      await renderScenario(catalog, select.value || initialScenario);
    });

    resetButton.addEventListener("click", handleResetClick);

    document.getElementById("analyze-button").addEventListener("click", handleAnalyzeClick);
    document.getElementById("task-button").addEventListener("click", handleTaskClick);
    document.getElementById("draft-button").addEventListener("click", handleDraftClick);
    liveDraftButton.addEventListener("click", handleLiveDraftClick);
    document.getElementById("feedback-useful-button").addEventListener("click", handleFeedbackUsefulClick);
    document.getElementById("feedback-dismiss-button").addEventListener("click", handleFeedbackDismissClick);
    exportJsonButton.addEventListener("click", async () => {
      await handleFeedbackExportClick("json");
    });
    exportCsvButton.addEventListener("click", async () => {
      await handleFeedbackExportClick("csv");
    });
    runAiCycleButton.addEventListener("click", handleRunAiCycleClick);
    reloadAiPolicyButton.addEventListener("click", handleReloadAiPolicyClick);
    saveAiPolicyButton.addEventListener("click", handleSaveAiPolicyClick);
    probeAiProviderButton.addEventListener("click", handleProbeAiProviderClick);
    reloadAiProviderButton.addEventListener("click", handleReloadAiProviderClick);
    saveAiProviderButton.addEventListener("click", handleSaveAiProviderClick);
    hubSpotInstallUrlButton.addEventListener("click", handleHubSpotInstallUrlClick);
    reloadHubSpotConfigButton.addEventListener("click", handleReloadHubSpotConfigClick);
    saveHubSpotConfigButton.addEventListener("click", handleSaveHubSpotConfigClick);
    exchangeHubSpotCodeButton.addEventListener("click", handleExchangeHubSpotCodeClick);
    hubSpotLivePreviewButton.addEventListener("click", handleHubSpotLivePreviewClick);
    hubSpotLiveTaskButton.addEventListener("click", handleHubSpotLiveTaskClick);
    hubSpotLiveDraftButton.addEventListener("click", handleHubSpotLiveDraftClick);
    hubSpotLiveNoteButton.addEventListener("click", handleHubSpotLiveNoteClick);
    hubSpotLiveQueueButton.addEventListener("click", handleHubSpotLiveQueueClick);
    hubSpotLiveSearchButton.addEventListener("click", handleHubSpotLiveSearchClick);
    reloadComplianceConfigButton.addEventListener("click", handleReloadComplianceConfigClick);
    saveComplianceConfigButton.addEventListener("click", handleSaveComplianceConfigClick);
    applyGuidedComplianceButton.addEventListener("click", handleApplyGuidedComplianceClick);
    hubSpotLiveQueuePanel.addEventListener("click", handleHubSpotLiveQueueResultClick);

    queueList.addEventListener("click", async (event) => {
      const button = event.target.closest("[data-deal-id]");
      if (!button) {
        return;
      }

      appState.liveDraft = null;
      await renderFocusedDealById(button.dataset.dealId);
    });

    await renderScenario(catalog, initialScenario);
    renderInstallState();
  } catch (error) {
    document.getElementById("meta-card").innerHTML = `
      <p class="status-label">Error</p>
      <p class="status-value">Starter data failed to load</p>
      <p class="lede">${error.message}</p>
    `;
  }
}

main();
