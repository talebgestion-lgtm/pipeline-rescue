function getSearchScenario() {
  return new URLSearchParams(window.location.search).get("scenario");
}

async function loadScenarios() {
  const response = await fetch("/api/scenarios");

  if (!response.ok) {
    throw new Error("Failed to load scenario catalog");
  }

  return response.json();
}

async function loadOverview(scenarioId) {
  const response = await fetch(`/api/overview?scenario=${encodeURIComponent(scenarioId)}`);

  if (!response.ok) {
    throw new Error("Failed to load overview");
  }

  return response.json();
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

  const grid = document.getElementById("summary-grid");
  grid.innerHTML = cards
    .map((card) => `
      <article class="summary-card">
        <span class="label">${card.label}</span>
        <span class="value">${card.value ?? "N/A"}</span>
      </article>
    `)
    .join("");
}

function renderFocusedDeal(deal) {
  document.getElementById("deal-title").textContent = `${deal.dealName} | ${deal.owner}`;
  document.getElementById("score-value").textContent = formatScore(deal.rescueScore);
  document.getElementById("action-summary").textContent = deal.recommendedAction?.summary || "No action available.";
  document.getElementById("deal-freshness").textContent = formatFreshness(deal);

  const pill = document.getElementById("risk-pill");
  pill.textContent = deal.riskLevel || "UNKNOWN";
  pill.dataset.risk = deal.riskLevel || "UNKNOWN";

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
  const card = document.getElementById("verification-card");
  const corrections = verification.correctionsApplied || [];
  const unverifiedFields = verification.unverifiedFields || [];

  card.innerHTML = `
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
        <p class="queue-action">${item.nextBestAction}</p>
      </article>
    `)
    .join("");
}

function renderMeta(meta) {
  const card = document.getElementById("meta-card");
  card.innerHTML = `
    <p class="status-label">${meta.portalName}</p>
    <p class="status-value">${meta.appName} ${meta.version}</p>
    <p class="lede">${meta.scenarioLabel}</p>
    <p class="lede">Snapshot generated at ${new Date(meta.generatedAt).toLocaleString("en-GB")}.</p>
  `;
}

function setScenarioInUrl(scenarioId) {
  const url = new URL(window.location.href);
  url.searchParams.set("scenario", scenarioId);
  window.history.replaceState({}, "", url);
}

async function renderScenario(catalog, scenarioId) {
  const overview = await loadOverview(scenarioId);
  renderScenarioControls(catalog, scenarioId);
  renderMeta(overview.meta);
  renderSummary(overview.summary);
  renderVerification(overview.verification);
  renderFocusedDeal(overview.focusedDeal);
  renderQueue(overview.queue);
  setScenarioInUrl(scenarioId);
}

async function main() {
  const select = document.getElementById("scenario-select");
  const refreshButton = document.getElementById("refresh-button");

  try {
    const catalog = await loadScenarios();
    const initialScenario = getSearchScenario() || catalog.defaultScenario;

    select.addEventListener("change", async (event) => {
      await renderScenario(catalog, event.target.value);
    });

    refreshButton.addEventListener("click", async () => {
      await renderScenario(catalog, select.value || initialScenario);
    });

    await renderScenario(catalog, initialScenario);
  } catch (error) {
    const card = document.getElementById("meta-card");
    card.innerHTML = `
      <p class="status-label">Error</p>
      <p class="status-value">Starter data failed to load</p>
      <p class="lede">${error.message}</p>
    `;
  }
}

main();
