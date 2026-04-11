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

async function postAction(path) {
  return fetchJson(buildScenarioUrl(path), {
    method: "POST"
  });
}

async function loadEvents() {
  return fetchJson(buildScenarioUrl("/api/events"));
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

function renderFocusedDeal(deal) {
  document.getElementById("deal-title").textContent = `${deal.dealName} | ${deal.owner}`;
  document.getElementById("score-value").textContent = formatScore(deal.rescueScore);
  document.getElementById("action-summary").textContent = deal.recommendedAction?.summary || "No action available.";
  document.getElementById("deal-freshness").textContent = formatFreshness(deal);

  const pill = document.getElementById("risk-pill");
  pill.textContent = deal.riskLevel || "UNKNOWN";
  pill.dataset.risk = deal.riskLevel || "UNKNOWN";

  renderTaskState(deal.taskState);

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

async function renderScenario(catalog, scenarioId) {
  const overview = await loadOverview(scenarioId);
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

async function handleAnalyzeClick() {
  const payload = await postAction(`/api/deals/${encodeURIComponent(appState.focusedDealId)}/analyze`);
  renderVerification(payload.verification);
  renderFocusedDeal(payload.analysis);
  await refreshEvents();
}

async function handleTaskClick() {
  const payload = await postAction(`/api/deals/${encodeURIComponent(appState.focusedDealId)}/tasks`);
  renderFocusedDeal(payload.analysis);
  await refreshScenarioSummary();
  await refreshEvents();
}

async function handleDraftClick() {
  const payload = await postAction(`/api/deals/${encodeURIComponent(appState.focusedDealId)}/draft`);
  renderVerification(payload.verification);
  renderFocusedDeal(payload.analysis);
  await refreshEvents();
}

async function refreshScenarioSummary() {
  const overview = await loadOverview(appState.scenarioId);
  appState.overview = overview;
  renderSummary(overview.summary);
  renderQueue(overview.queue);
}

async function main() {
  const select = document.getElementById("scenario-select");
  const refreshButton = document.getElementById("refresh-button");
  const queueList = document.getElementById("queue-list");

  try {
    const catalog = await loadScenarios();
    const initialScenario = getSearchScenario() || catalog.defaultScenario;

    select.addEventListener("change", async (event) => {
      await renderScenario(catalog, event.target.value);
    });

    refreshButton.addEventListener("click", async () => {
      await renderScenario(catalog, select.value || initialScenario);
    });

    document.getElementById("analyze-button").addEventListener("click", handleAnalyzeClick);
    document.getElementById("task-button").addEventListener("click", handleTaskClick);
    document.getElementById("draft-button").addEventListener("click", handleDraftClick);

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
