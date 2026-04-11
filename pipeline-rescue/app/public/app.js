const appState = {
  catalog: null,
  scenarioId: null,
  overview: null,
  focusedDealId: null
};

function getSearchScenario() {
  return new URLSearchParams(window.location.search).get("scenario");
}

async function fetchJson(url, options) {
  const response = await fetch(url, options);

  if (!response.ok) {
    throw new Error(`Request failed: ${response.status}`);
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
  const body = document.getElementById("draft-body");
  if (deal.draft?.eligible) {
    subject.textContent = deal.draft.subject || "Untitled draft";
    body.textContent = deal.draft.body || "Draft body unavailable.";
  } else {
    subject.textContent = "Draft blocked";
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

function renderComplianceConfig(config) {
  document.getElementById("compliance-config-input").value = JSON.stringify(config, null, 2);
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

async function refreshComplianceReport() {
  renderComplianceReport(await loadComplianceReport());
}

async function refreshComplianceConfig() {
  renderComplianceConfig(await loadComplianceConfig());
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
  await refreshManagerReport();
  await refreshFeedbackReport();
  await refreshComplianceReport();
  await refreshComplianceConfig();
  await refreshSystemReport();
}

async function handleAnalyzeClick() {
  const payload = await postAction(`/api/deals/${encodeURIComponent(appState.focusedDealId)}/analyze`);
  renderVerification(payload.verification);
  renderFocusedDeal(payload.analysis);
  await refreshEvents();
  await refreshManagerReport();
  await refreshFeedbackReport();
  await refreshComplianceReport();
  await refreshComplianceConfig();
  await refreshSystemReport();
}

async function handleTaskClick() {
  const payload = await postAction(`/api/deals/${encodeURIComponent(appState.focusedDealId)}/tasks`);
  renderFocusedDeal(payload.analysis);
  await refreshScenarioSummary();
  await refreshEvents();
  await refreshManagerReport();
  await refreshFeedbackReport();
  await refreshComplianceReport();
  await refreshComplianceConfig();
  await refreshSystemReport();
}

async function handleDraftClick() {
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
  await refreshComplianceReport();
  await refreshComplianceConfig();
  await refreshSystemReport();
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
    renderComplianceReport(response.complianceReport);
    renderSystemReport(response.systemReport);
  } catch (error) {
    document.getElementById("compliance-report").innerHTML = `
      <p class="verification-note">Compliance config save failed: ${error.message}</p>
    `;
  }
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

  try {
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
    document.getElementById("feedback-useful-button").addEventListener("click", handleFeedbackUsefulClick);
    document.getElementById("feedback-dismiss-button").addEventListener("click", handleFeedbackDismissClick);
    exportJsonButton.addEventListener("click", async () => {
      await handleFeedbackExportClick("json");
    });
    exportCsvButton.addEventListener("click", async () => {
      await handleFeedbackExportClick("csv");
    });
    reloadComplianceConfigButton.addEventListener("click", handleReloadComplianceConfigClick);
    saveComplianceConfigButton.addEventListener("click", handleSaveComplianceConfigClick);

    queueList.addEventListener("click", async (event) => {
      const button = event.target.closest("[data-deal-id]");
      if (!button) {
        return;
      }

      await renderFocusedDealById(button.dataset.dealId);
    });

    await renderScenario(catalog, initialScenario);
  } catch (error) {
    document.getElementById("meta-card").innerHTML = `
      <p class="status-label">Error</p>
      <p class="status-value">Starter data failed to load</p>
      <p class="lede">${error.message}</p>
    `;
  }
}

main();
