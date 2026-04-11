const { createAiControlReport } = require("./ai-control");

const AT_RISK_AUTOMATION_THRESHOLD = 50;

function buildCycleSummary(status, metrics, controlReport) {
  if (status === "BLOCKED") {
    return `AI cycle analyzed ${metrics.analyzedDeals} deal(s), but automation remained blocked by the current compliance or control policy.`;
  }

  if (status === "EXECUTED") {
    return `AI cycle analyzed ${metrics.analyzedDeals} deal(s), created ${metrics.tasksCreated} task(s), and generated ${metrics.draftsGenerated} draft(s) inside the configured automation envelope.`;
  }

  return `AI cycle analyzed ${metrics.analyzedDeals} deal(s) in review-only mode. Human approval is still required before customer-facing or write actions expand.`;
}

function createAiOperationsCycle({ runtime, scenarioId, policy, complianceReport }) {
  const overview = runtime.getOverview(scenarioId);
  if (!overview) {
    return null;
  }

  const feedbackReport = runtime.getFeedbackReport(scenarioId);
  const controlReport = createAiControlReport({
    policy,
    overview,
    feedbackReport,
    complianceReport
  });

  const queue = overview.queue || [];
  const selectedDeals = queue.slice(0, policy.maxAutomatedDealsPerCycle);
  const decisions = [];

  const metrics = {
    selectedDeals: selectedDeals.length,
    skippedByCycleLimit: Math.max(0, queue.length - selectedDeals.length),
    analyzedDeals: 0,
    tasksCreated: 0,
    tasksAlreadyPresent: 0,
    draftsGenerated: 0,
    draftsBlocked: 0,
    humanReviewDeals: 0
  };

  for (const item of selectedDeals) {
    const analysisPayload = runtime.analyzeDeal(scenarioId, item.dealId);
    if (!analysisPayload) {
      continue;
    }

    const analysis = analysisPayload.analysis;
    const notes = [];
    let taskDecision = "MONITOR_ONLY";
    let draftDecision = "MONITOR_ONLY";

    metrics.analyzedDeals += 1;

    if (typeof analysis.rescueScore === "number" && analysis.rescueScore >= AT_RISK_AUTOMATION_THRESHOLD) {
      if (controlReport.automationEnvelope.taskAutomationAllowed) {
        const taskResult = runtime.createTask(scenarioId, item.dealId);
        taskDecision = taskResult.taskState.status;

        if (taskResult.taskState.status === "CREATED") {
          metrics.tasksCreated += 1;
        }
        if (taskResult.taskState.status === "ALREADY_EXISTS") {
          metrics.tasksAlreadyPresent += 1;
        }
      } else {
        taskDecision = "HUMAN_REVIEW_REQUIRED";
        notes.push("Task creation stayed under human review.");
      }

      if (analysis.draft?.eligible) {
        if (controlReport.automationEnvelope.draftAutomationAllowed) {
          const draftResult = runtime.generateDraft(scenarioId, item.dealId);
          draftDecision = draftResult.draft.eligible ? "GENERATED" : `BLOCKED_${draftResult.draft.blockedReason || "UNKNOWN"}`;

          if (draftResult.draft.eligible) {
            metrics.draftsGenerated += 1;
          } else {
            metrics.draftsBlocked += 1;
          }
        } else {
          draftDecision = "HUMAN_REVIEW_REQUIRED";
          notes.push("Customer-facing draft stayed under human review.");
        }
      } else {
        draftDecision = `BLOCKED_${analysis.draft?.blockedReason || "UNSAFE"}`;
        notes.push(`Draft blocked by guardrail: ${analysis.draft?.blockedReason || "UNSAFE"}.`);
        metrics.draftsBlocked += 1;
      }
    } else {
      notes.push("Deal stayed below the at-risk automation threshold and remains in monitor mode.");
    }

    const humanReviewRequired =
      taskDecision === "HUMAN_REVIEW_REQUIRED" || draftDecision === "HUMAN_REVIEW_REQUIRED";

    if (humanReviewRequired) {
      metrics.humanReviewDeals += 1;
    }

    decisions.push({
      dealId: analysis.dealId,
      dealName: analysis.dealName,
      owner: analysis.owner,
      riskLevel: analysis.riskLevel,
      rescueScore: analysis.rescueScore,
      topReason: analysis.reasons[0] ? analysis.reasons[0].label : "No ranked reason",
      recommendedAction: analysis.recommendedAction?.summary || "No action available.",
      taskDecision,
      draftDecision,
      humanReviewRequired,
      notes
    });
  }

  const managerReport = runtime.getManagerReport(scenarioId);
  const cycleStatus =
    controlReport.status === "BLOCKED" ? "BLOCKED" :
    metrics.tasksCreated > 0 || metrics.draftsGenerated > 0 ? "EXECUTED" :
    "REVIEW_ONLY";

  return {
    scenarioId,
    executedAt: new Date().toISOString(),
    cycleStatus,
    summary: buildCycleSummary(cycleStatus, metrics, controlReport),
    metrics,
    controlStatus: controlReport.status,
    controlSummary: controlReport.summary,
    managerDigest: controlReport.automationEnvelope.digestAutomationAllowed
      ? managerReport.digest
      : ["Manager digest remains under human review in the current AI policy."],
    decisions
  };
}

module.exports = {
  createAiOperationsCycle
};
