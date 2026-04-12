function createQueueError(message, statusCode = 400) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

function normalizeDealIds(input) {
  if (Array.isArray(input)) {
    return input
      .map((item) => String(item || "").trim())
      .filter(Boolean);
  }

  if (typeof input === "string") {
    return input
      .split(/[,\r\n;]+/)
      .map((item) => item.trim())
      .filter(Boolean);
  }

  return [];
}

function validateLiveQueueRequestPayload(payload) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    throw createQueueError("Live queue request body must be a JSON object.");
  }

  const dealIds = normalizeDealIds(payload.dealIds);
  if (dealIds.length === 0) {
    throw createQueueError("Live queue request must include at least one deal ID.");
  }

  const deduplicated = Array.from(new Set(dealIds));
  if (deduplicated.length > 25) {
    throw createQueueError("Live queue request is limited to 25 deal IDs per batch.");
  }

  return {
    portalId: payload.portalId ? String(payload.portalId).trim() : null,
    dealIds: deduplicated
  };
}

function buildLiveQueueScenario(previews, analysisTimestamp) {
  if (!Array.isArray(previews) || previews.length === 0) {
    throw createQueueError("At least one live HubSpot preview is required to build a live queue.", 500);
  }

  const first = previews[0];
  const warningCount = previews.reduce((sum, preview) => sum + (preview.normalizationWarnings || []).length, 0);

  return {
    portalName: first.source.hubDomain ? `HubSpot ${first.source.hubDomain}` : `HubSpot portal ${first.source.portalId}`,
    scenarioLabel: `HubSpot live queue (${previews.length} deals)`,
    scenarioDescription: "Live multi-deal queue normalized into the deterministic rescue engine.",
    guardrailHint: warningCount > 0
      ? `Live queue uses ${warningCount} normalization warning(s) across ${previews.length} deals.`
      : "Live queue is grounded on fetched HubSpot CRM fields.",
    analysisTimestamp,
    focusDealId: previews[0].normalizedDeal.id,
    deals: previews.map((preview) => preview.normalizedDeal)
  };
}

function createLiveQueueManagerDigest(overview, previews) {
  const summary = overview && overview.summary ? overview.summary : {};
  const queue = Array.isArray(overview && overview.queue) ? overview.queue : [];
  const warningCount = previews.reduce((sum, preview) => sum + (preview.normalizationWarnings || []).length, 0);
  const topQueueItem = queue[0] || null;

  return [
    `${summary.analyzedDeals || 0} live deal(s) analyzed, including ${summary.atRiskDeals || 0} at-risk and ${summary.criticalDeals || 0} critical.`,
    `${summary.recoveredRevenueCandidate || 0} candidate revenue sits behind the current at-risk live queue.`,
    topQueueItem
      ? `Highest live priority: ${topQueueItem.dealName} (${topQueueItem.riskLevel}) with action "${topQueueItem.nextBestAction}".`
      : "No live queue item currently exceeds the at-risk threshold.",
    warningCount > 0
      ? `${warningCount} normalization warning(s) are still active across the live queue.`
      : "No normalization warning is currently active across the live queue."
  ];
}

module.exports = {
  buildLiveQueueScenario,
  createLiveQueueManagerDigest,
  validateLiveQueueRequestPayload
};
