const { validateLiveSearchPayload } = require("./hubspot-live-search");

function createLiveRescueRunError(message, statusCode = 400) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

function validateLiveRescueRunPayload(payload) {
  const criteria = validateLiveSearchPayload(payload);
  const maxTaskWrites = Number(payload && payload.maxTaskWrites != null ? payload.maxTaskWrites : Math.min(criteria.limit, 3));

  if (!Number.isInteger(maxTaskWrites) || maxTaskWrites < 1 || maxTaskWrites > 25) {
    throw createLiveRescueRunError("maxTaskWrites must be an integer between 1 and 25.");
  }

  return {
    ...criteria,
    maxTaskWrites
  };
}

function rankLiveDeals(liveQueue) {
  const queue = Array.isArray(liveQueue && liveQueue.overview && liveQueue.overview.queue) ? liveQueue.overview.queue : [];
  const deals = Array.isArray(liveQueue && liveQueue.deals) ? liveQueue.deals : [];
  const dealById = new Map(deals.map((deal) => [String(deal.normalizedDeal && deal.normalizedDeal.id), deal]));
  const ordered = [];
  const seen = new Set();

  for (const item of queue) {
    const id = String(item.dealId || "");
    if (dealById.has(id) && !seen.has(id)) {
      ordered.push(dealById.get(id));
      seen.add(id);
    }
  }

  for (const deal of deals) {
    const id = String(deal.normalizedDeal && deal.normalizedDeal.id);
    if (!seen.has(id)) {
      ordered.push(deal);
      seen.add(id);
    }
  }

  return ordered;
}

function isValidatedAtRisk(deal) {
  const analysis = deal && deal.dealAnalysis && deal.dealAnalysis.analysis ? deal.dealAnalysis.analysis : null;
  const verification = deal && deal.dealAnalysis && deal.dealAnalysis.verification ? deal.dealAnalysis.verification : null;

  return Boolean(
    analysis
    && verification
    && analysis.eligibility === "ELIGIBLE"
    && verification.validationStatus === "VALIDATED"
    && typeof analysis.rescueScore === "number"
    && analysis.rescueScore >= 50
  );
}

function createDecisionRecord(deal, decision, detail, task = null) {
  const analysis = deal && deal.dealAnalysis && deal.dealAnalysis.analysis ? deal.dealAnalysis.analysis : {};
  const verification = deal && deal.dealAnalysis && deal.dealAnalysis.verification ? deal.dealAnalysis.verification : {};

  return {
    dealId: analysis.dealId || deal?.normalizedDeal?.id || null,
    dealName: analysis.dealName || deal?.normalizedDeal?.name || "Unknown deal",
    rescueScore: analysis.rescueScore ?? null,
    riskLevel: analysis.riskLevel || "UNKNOWN",
    validationStatus: verification.validationStatus || "UNKNOWN",
    decision,
    detail,
    taskId: task && task.taskId ? String(task.taskId) : null
  };
}

function createBatchManagerDigest(liveQueue, writtenTasks, decisions) {
  const digest = Array.isArray(liveQueue && liveQueue.managerDigest) ? liveQueue.managerDigest.slice() : [];
  const failedWrites = decisions.filter((item) => item.decision === "FAILED_WRITE").length;
  const blocked = decisions.filter((item) => item.decision.startsWith("BLOCKED")).length;
  const skipped = decisions.filter((item) => item.decision.startsWith("SKIPPED")).length;

  digest.push(`${writtenTasks.length} live HubSpot rescue task(s) written in this batch run.`);
  digest.push(`${blocked} blocked deal(s), ${skipped} skipped deal(s), ${failedWrites} failed write(s).`);
  return digest;
}

async function executeLiveRescueRun({ liveQueue, criteria, portalId, taskWriter }) {
  if (!liveQueue || !Array.isArray(liveQueue.deals)) {
    throw createLiveRescueRunError("A live queue is required before running a live rescue batch.", 500);
  }

  if (typeof taskWriter !== "function") {
    throw createLiveRescueRunError("A live rescue task writer is required.", 500);
  }

  const orderedDeals = rankLiveDeals(liveQueue);
  const writtenTasks = [];
  const decisions = [];
  let installState = liveQueue.installState;
  let tokenRefreshed = Boolean(liveQueue.source && liveQueue.source.tokenRefreshed);

  for (const deal of orderedDeals) {
    const analysis = deal.dealAnalysis && deal.dealAnalysis.analysis ? deal.dealAnalysis.analysis : null;
    const verification = deal.dealAnalysis && deal.dealAnalysis.verification ? deal.dealAnalysis.verification : null;

    if (!analysis || !verification) {
      decisions.push(createDecisionRecord(deal, "BLOCKED_MISSING_ANALYSIS", "Live queue item is missing analysis context."));
      continue;
    }

    if (analysis.eligibility !== "ELIGIBLE") {
      decisions.push(createDecisionRecord(deal, "BLOCKED_INELIGIBLE", `Deal eligibility is ${analysis.eligibility}.`));
      continue;
    }

    if (verification.validationStatus !== "VALIDATED") {
      decisions.push(createDecisionRecord(deal, "BLOCKED_UNVERIFIED", `Deal validation status is ${verification.validationStatus}.`));
      continue;
    }

    if (typeof analysis.rescueScore !== "number" || analysis.rescueScore < 50) {
      decisions.push(createDecisionRecord(deal, "SKIPPED_BELOW_THRESHOLD", "Rescue score is below the at-risk action threshold."));
      continue;
    }

    if (writtenTasks.length >= criteria.maxTaskWrites) {
      decisions.push(createDecisionRecord(deal, "SKIPPED_LIMIT_REACHED", `Batch write limit ${criteria.maxTaskWrites} already reached.`));
      continue;
    }

    try {
      const writeResult = await taskWriter({
        installState,
        portalId: portalId || deal.source?.portalId || null,
        preview: {
          source: deal.source,
          normalizedDeal: deal.normalizedDeal,
          graph: deal.graph
        },
        analysis: deal.dealAnalysis
      });

      installState = writeResult.installState || installState;
      tokenRefreshed = tokenRefreshed || Boolean(writeResult.source && writeResult.source.tokenRefreshed);
      writtenTasks.push(writeResult.task);
      decisions.push(createDecisionRecord(deal, "TASK_WRITTEN", "Live HubSpot rescue task created.", writeResult.task));
    } catch (error) {
      if (error.hubspotInstallState) {
        installState = error.hubspotInstallState;
      }
      tokenRefreshed = tokenRefreshed || Boolean(error.hubspotTokenRefreshed);

      const detail = error.detail || error.message || "Live HubSpot task write failed.";
      if (error.statusCode === 409 && /already exists/i.test(detail)) {
        decisions.push(createDecisionRecord(
          deal,
          "SKIPPED_EXISTING_RESCUE_TASK",
          detail
        ));
        continue;
      }

      decisions.push(createDecisionRecord(
        deal,
        "FAILED_WRITE",
        detail
      ));
    }
  }

  return {
    criteria,
    source: {
      mode: "HUBSPOT_LIVE_RESCUE_RUN",
      portalId: liveQueue.source?.portalId || null,
      hubDomain: liveQueue.source?.hubDomain || null,
      fetchedAt: liveQueue.source?.fetchedAt || new Date().toISOString(),
      tokenRefreshed,
      dealCount: liveQueue.deals.length,
      writtenTaskCount: writtenTasks.length
    },
    overview: liveQueue.overview,
    managerDigest: createBatchManagerDigest(liveQueue, writtenTasks, decisions),
    decisions,
    writtenTasks,
    metrics: {
      discoveredDeals: liveQueue.deals.length,
      queuedDeals: Array.isArray(liveQueue.overview?.queue) ? liveQueue.overview.queue.length : 0,
      writtenTasks: writtenTasks.length,
      blockedDeals: decisions.filter((item) => item.decision.startsWith("BLOCKED")).length,
      skippedDeals: decisions.filter((item) => item.decision.startsWith("SKIPPED")).length,
      failedWrites: decisions.filter((item) => item.decision === "FAILED_WRITE").length,
      eligibleDeals: decisions.filter((item) => item.decision === "TASK_WRITTEN").length
    },
    installState
  };
}

module.exports = {
  executeLiveRescueRun,
  validateLiveRescueRunPayload,
  isValidatedAtRisk
};
