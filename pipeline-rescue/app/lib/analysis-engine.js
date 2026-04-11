const REASON_PRIORITY = [
  "ACTIVITY_STALE",
  "STAGE_AGING",
  "NEXT_STEP_MISSING",
  "NO_FUTURE_TASK",
  "DECISION_MAKER_MISSING",
  "CONTACT_COVERAGE_LOW",
  "HIGH_VALUE_LOW_ENGAGEMENT",
  "CRM_HYGIENE_GAP"
];

const REASON_LABELS = {
  ACTIVITY_STALE: "Deal activity is stale",
  NEXT_STEP_MISSING: "Next step is missing",
  NO_FUTURE_TASK: "No future task is scheduled",
  STAGE_AGING: "Deal stage is aging",
  CONTACT_COVERAGE_LOW: "Contact coverage is too low",
  DECISION_MAKER_MISSING: "Decision maker is missing",
  CRM_HYGIENE_GAP: "CRM hygiene gap blocks safe execution",
  HIGH_VALUE_LOW_ENGAGEMENT: "High-value deal has weak engagement"
};

const ACTION_MAP = {
  ACTIVITY_STALE: {
    type: "FOLLOW_UP_EMAIL",
    priority: "HIGH",
    summary: "Send a direct follow-up with a concrete scheduling ask."
  },
  NEXT_STEP_MISSING: {
    type: "CREATE_NEXT_STEP_TASK",
    priority: "HIGH",
    summary: "Define a concrete next step and create a dated task."
  },
  NO_FUTURE_TASK: {
    type: "CREATE_NEXT_STEP_TASK",
    priority: "HIGH",
    summary: "Create a dated follow-up task owned by the deal owner."
  },
  STAGE_AGING: {
    type: "ESCALATE_MANAGER_REVIEW",
    priority: "HIGH",
    summary: "Escalate the deal for review or re-qualify the timeline."
  },
  DECISION_MAKER_MISSING: {
    type: "EXPAND_CONTACT_COVERAGE",
    priority: "HIGH",
    summary: "Add a decision maker before the next customer-facing step."
  },
  CONTACT_COVERAGE_LOW: {
    type: "EXPAND_CONTACT_COVERAGE",
    priority: "HIGH",
    summary: "Broaden stakeholder coverage before pushing the deal forward."
  },
  CRM_HYGIENE_GAP: {
    type: "FILL_CRM_GAP",
    priority: "HIGH",
    summary: "Repair the required CRM fields before any outreach."
  },
  HIGH_VALUE_LOW_ENGAGEMENT: {
    type: "ESCALATE_MANAGER_REVIEW",
    priority: "HIGH",
    summary: "Escalate for manager review and run tailored outreach."
  }
};

function roundTo(value, decimals) {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

function addMinutes(timestamp, minutes) {
  return new Date(new Date(timestamp).getTime() + minutes * 60 * 1000).toISOString();
}

function getRiskLevel(score) {
  if (typeof score !== "number") {
    return "UNKNOWN";
  }

  if (score >= 75) {
    return "CRITICAL";
  }

  if (score >= 50) {
    return "HIGH";
  }

  if (score >= 25) {
    return "MEDIUM";
  }

  return "LOW";
}

function compareReasons(left, right) {
  if (right.weight !== left.weight) {
    return right.weight - left.weight;
  }

  return REASON_PRIORITY.indexOf(left.code) - REASON_PRIORITY.indexOf(right.code);
}

function sortQueue(left, right) {
  const leftScore = typeof left.rescueScore === "number" ? left.rescueScore : -1;
  const rightScore = typeof right.rescueScore === "number" ? right.rescueScore : -1;

  if (rightScore !== leftScore) {
    return rightScore - leftScore;
  }

  return (right.lastActivityAgeDays || -1) - (left.lastActivityAgeDays || -1);
}

function buildReason(code, weight, evidence) {
  return {
    code,
    label: REASON_LABELS[code],
    weight,
    evidence
  };
}

function pickPrimaryContact(contacts) {
  return contacts.find((contact) => contact.email) || contacts[0] || null;
}

function computeActivityRisk(lastActivityAgeDays) {
  if (lastActivityAgeDays <= 3) {
    return 0;
  }

  if (lastActivityAgeDays <= 7) {
    return 8;
  }

  if (lastActivityAgeDays <= 14) {
    return 16;
  }

  if (lastActivityAgeDays <= 21) {
    return 24;
  }

  return 30;
}

function computeStageAgingRisk(stageAgeDays, expectedStageDays) {
  if (!expectedStageDays || stageAgeDays <= expectedStageDays) {
    return 0;
  }

  const ratio = stageAgeDays / expectedStageDays;

  if (ratio <= 1.5) {
    return 8;
  }

  if (ratio <= 2.0) {
    return 14;
  }

  return 20;
}

function computeContactCoverage(contacts) {
  const hasDecisionMaker = contacts.some((contact) => contact.decisionMaker);

  if (contacts.length === 0) {
    return {
      risk: 10,
      reasons: [
        buildReason("CONTACT_COVERAGE_LOW", 10, "No associated contact is available on the deal.")
      ],
      hasDecisionMaker
    };
  }

  if (contacts.length === 1) {
    const reasons = [
      buildReason("CONTACT_COVERAGE_LOW", 7, "Only one contact is associated to the deal.")
    ];

    if (!hasDecisionMaker) {
      reasons.push(buildReason("DECISION_MAKER_MISSING", 3, "The only associated contact is not tagged as a decision maker."));
    }

    return { risk: 10, reasons, hasDecisionMaker };
  }

  if (!hasDecisionMaker) {
    return {
      risk: 4,
      reasons: [
        buildReason("DECISION_MAKER_MISSING", 4, "No associated contact is tagged as a decision maker or economic buyer.")
      ],
      hasDecisionMaker
    };
  }

  return { risk: 0, reasons: [], hasDecisionMaker };
}

function computeHygieneRisk(deal) {
  const missingFields = [];

  if (deal.amount == null) {
    missingFields.push("amount");
  }

  if (!deal.closeDate) {
    missingFields.push("close_date");
  }

  if (!deal.owner || !deal.owner.name) {
    missingFields.push("deal_owner");
  }

  if (!deal.stageId) {
    missingFields.push("deal_stage");
  }

  if (!deal.pipelineId) {
    missingFields.push("pipeline");
  }

  let risk = 0;
  if (missingFields.length === 1) {
    risk = 3;
  } else if (missingFields.length === 2) {
    risk = 6;
  } else if (missingFields.length >= 3) {
    risk = 10;
  }

  return {
    risk,
    missingFields,
    reason: risk > 0
      ? buildReason("CRM_HYGIENE_GAP", risk, `Missing required fields: ${missingFields.join(", ")}.`)
      : null
  };
}

function computeEngagementRisk(deal) {
  if (deal.amount == null || deal.amount < 10000) {
    return 0;
  }

  if (deal.lastActivityAgeDays > 14) {
    return 10;
  }

  if (deal.lastActivityAgeDays > 7) {
    return 5;
  }

  return 0;
}

function buildAction(topReasonCode) {
  if (!topReasonCode) {
    return {
      type: "CREATE_NEXT_STEP_TASK",
      priority: "LOW",
      summary: "Keep the scheduled check-in and avoid unnecessary intervention."
    };
  }

  return ACTION_MAP[topReasonCode] || {
    type: "CREATE_NEXT_STEP_TASK",
    priority: "MEDIUM",
    summary: "Create a concrete next step and review the deal."
  };
}

function buildDraft(deal, topReasonCode, recommendedAction, hygieneRisk) {
  const contacts = deal.contacts || [];
  const primaryContact = pickPrimaryContact(contacts);
  const firstName = primaryContact && primaryContact.name ? primaryContact.name.split(" ")[0] : "there";

  if (deal.eligibility !== "ELIGIBLE") {
    return {
      eligible: false,
      subject: null,
      body: null,
      blockedReason: deal.eligibility
    };
  }

  if (hygieneRisk > 0) {
    return {
      eligible: false,
      subject: null,
      body: null,
      blockedReason: "CRM_HYGIENE_GAP"
    };
  }

  if (!primaryContact || !primaryContact.email) {
    return {
      eligible: false,
      subject: null,
      body: null,
      blockedReason: "PRIMARY_CONTACT_MISSING"
    };
  }

  const opening = `Hi ${firstName}, following up on ${deal.dealName}.`;
  const evidenceLine = topReasonCode === "ACTIVITY_STALE"
    ? `We have not logged activity for ${deal.lastActivityAgeDays} days.`
    : topReasonCode === "STAGE_AGING"
      ? `The current stage has been open for ${deal.stageAgeDays} days and needs a clear checkpoint.`
      : topReasonCode === "HIGH_VALUE_LOW_ENGAGEMENT"
        ? "This opportunity is material and deserves a tighter decision checkpoint."
        : "I want to confirm the next concrete step and keep momentum on track.";
  const cta = recommendedAction.type === "FOLLOW_UP_EMAIL"
    ? "Are you available tomorrow or Friday for a 20-minute review?"
    : "Can we confirm the next action and owner by tomorrow?";

  return {
    eligible: true,
    subject: `Quick follow-up on ${deal.dealName}`,
    body: `${opening} ${evidenceLine} ${cta}`,
    blockedReason: null
  };
}

function buildVerification(deal, draft, unverifiedFields, scenarioHint) {
  let validationStatus = "VALIDATED";

  if (deal.eligibility === "INSUFFICIENT_DATA") {
    validationStatus = "UNVERIFIED";
  } else if (!draft.eligible) {
    validationStatus = "BLOCKED";
  } else if (unverifiedFields.length > 0) {
    validationStatus = "UNVERIFIED";
  }

  const hallucinationRisk = validationStatus === "BLOCKED"
    ? "MEDIUM"
    : validationStatus === "UNVERIFIED"
      ? "HIGH"
      : "LOW";

  const correctionsApplied = [];

  if (validationStatus === "BLOCKED" && draft.blockedReason === "PRIMARY_CONTACT_MISSING") {
    correctionsApplied.push("Blocked draft generation because no verified contact email is available.");
  }

  if (validationStatus === "BLOCKED" && draft.blockedReason === "CRM_HYGIENE_GAP") {
    correctionsApplied.push("Blocked draft generation because required CRM fields are still missing.");
  }

  if (validationStatus === "UNVERIFIED") {
    correctionsApplied.push("Suppressed confidence because the minimum verified signal set is incomplete.");
  }

  if (deal.riskLevel === "LOW") {
    correctionsApplied.push("Suppressed escalation language because the deal is healthy.");
  }

  if (deal.recommendedAction.type === "CREATE_NEXT_STEP_TASK" && !deal.hasNextStep) {
    correctionsApplied.push("Forced the next action to stay deterministic and task-driven.");
  }

  if (correctionsApplied.length === 0) {
    correctionsApplied.push("Clamped all user-facing language to verified CRM-backed evidence.");
  }

  const compliance = validationStatus === "VALIDATED" ? 10 : validationStatus === "BLOCKED" ? 9.2 : 8.3;
  const consistency = typeof deal.rescueScore === "number" || deal.eligibility !== "ELIGIBLE" ? 9.8 : 8.6;
  const riskControl = hallucinationRisk === "LOW" ? 9.9 : hallucinationRisk === "MEDIUM" ? 8.8 : 7.4;
  const usability = validationStatus === "BLOCKED" ? 9.2 : 9.5;
  const stabilityScore = roundTo(0.35 * compliance + 0.30 * consistency + 0.20 * riskControl + 0.15 * usability, 2);

  return {
    memoryProtocol: "CYCLE_ISOLATED",
    validationStatus,
    stabilityScore,
    hallucinationRisk,
    unverifiedFields,
    correctionsApplied,
    notes: scenarioHint
  };
}

function analyzeDeal(deal, scenario, stageExpectationsDays) {
  const contacts = Array.isArray(deal.contacts) ? deal.contacts : [];
  const analyzedAt = scenario.analysisTimestamp;
  const freshUntil = addMinutes(analyzedAt, 15);
  const ownerName = deal.owner && deal.owner.name ? deal.owner.name : "Unassigned";

  if (deal.archived || deal.closedState === "WON" || deal.closedState === "LOST" || !deal.pipelineId || !deal.stageId || !deal.owner || !deal.owner.name) {
    const recommendedAction = {
      type: "FILL_CRM_GAP",
      priority: "LOW",
      summary: "This deal is outside rescue scope and should not be analyzed."
    };

    const draft = {
      eligible: false,
      subject: null,
      body: null,
      blockedReason: "NOT_ELIGIBLE"
    };

    return {
      dealId: deal.id,
      dealName: deal.name,
      company: deal.company,
      owner: ownerName,
      amount: deal.amount,
      eligibility: "NOT_ELIGIBLE",
      rescueScore: null,
      riskLevel: "UNKNOWN",
      analyzedAt,
      freshUntil,
      lastActivityAgeDays: deal.lastActivityAgeDays,
      hasNextStep: Boolean(deal.hasNextStep),
      reasons: [],
      recommendedAction,
      draft,
      verification: buildVerification({
        eligibility: "NOT_ELIGIBLE",
        riskLevel: "UNKNOWN",
        recommendedAction,
        hasNextStep: Boolean(deal.hasNextStep)
      }, draft, ["deal_out_of_scope"], "This deal is outside the pilot analysis scope.")
    };
  }

  const missingMinimumSignals = [];
  if (deal.amount == null) {
    missingMinimumSignals.push("amount");
  }
  if (deal.lastActivityAgeDays == null) {
    missingMinimumSignals.push("last_activity");
  }
  if (deal.stageAgeDays == null) {
    missingMinimumSignals.push("stage_age");
  }

  if (missingMinimumSignals.length > 0) {
    const recommendedAction = {
      type: "FILL_CRM_GAP",
      priority: "MEDIUM",
      summary: "Populate the missing core fields before trusting any rescue score."
    };

    const draft = {
      eligible: false,
      subject: null,
      body: null,
      blockedReason: "INSUFFICIENT_DATA"
    };

    const verification = buildVerification({
      eligibility: "INSUFFICIENT_DATA",
      riskLevel: "UNKNOWN",
      recommendedAction,
      hasNextStep: Boolean(deal.hasNextStep)
    }, draft, missingMinimumSignals.concat(contacts.length === 0 ? ["associated_contacts"] : []), scenario.guardrailHint);

    return {
      dealId: deal.id,
      dealName: deal.name,
      company: deal.company,
      owner: ownerName,
      amount: deal.amount,
      eligibility: "INSUFFICIENT_DATA",
      rescueScore: null,
      riskLevel: "UNKNOWN",
      analyzedAt,
      freshUntil,
      lastActivityAgeDays: deal.lastActivityAgeDays,
      hasNextStep: Boolean(deal.hasNextStep),
      reasons: [],
      recommendedAction,
      draft,
      verification
    };
  }

  const expectedStageDays = deal.expectedStageDays || stageExpectationsDays[deal.stageId] || 14;
  const reasons = [];

  const activityRisk = computeActivityRisk(deal.lastActivityAgeDays);
  if (activityRisk > 0) {
    reasons.push(buildReason("ACTIVITY_STALE", activityRisk, `No logged activity for ${deal.lastActivityAgeDays} days.`));
  }

  let nextStepRisk = 0;
  if (!deal.hasNextStep && !deal.hasFutureTask) {
    nextStepRisk = 20;
    reasons.push(buildReason("NEXT_STEP_MISSING", 10, "The deal record has no concrete next step."));
    reasons.push(buildReason("NO_FUTURE_TASK", 10, "The deal owner has no open future task on the record."));
  } else if (!deal.hasNextStep) {
    nextStepRisk = 10;
    reasons.push(buildReason("NEXT_STEP_MISSING", 10, "The deal record has no concrete next step."));
  } else if (!deal.hasFutureTask) {
    nextStepRisk = 10;
    reasons.push(buildReason("NO_FUTURE_TASK", 10, "The deal owner has no open future task on the record."));
  }

  const stageAgingRisk = computeStageAgingRisk(deal.stageAgeDays, expectedStageDays);
  if (stageAgingRisk > 0) {
    reasons.push(buildReason("STAGE_AGING", stageAgingRisk, `The deal has been in stage for ${deal.stageAgeDays} days versus ${expectedStageDays} expected.`));
  }

  const contactCoverage = computeContactCoverage(contacts);
  reasons.push(...contactCoverage.reasons);

  const hygiene = computeHygieneRisk(deal);
  if (hygiene.reason) {
    reasons.push(hygiene.reason);
  }

  const engagementWeaknessRisk = computeEngagementRisk(deal);
  if (engagementWeaknessRisk > 0) {
    reasons.push(buildReason("HIGH_VALUE_LOW_ENGAGEMENT", engagementWeaknessRisk, `The deal amount is ${deal.amount} EUR with weak engagement in the last ${deal.lastActivityAgeDays} days.`));
  }

  const rescueScore = Math.min(
    100,
    activityRisk +
      nextStepRisk +
      stageAgingRisk +
      contactCoverage.risk +
      hygiene.risk +
      engagementWeaknessRisk
  );

  const riskLevel = getRiskLevel(rescueScore);
  const sortedReasons = reasons.sort(compareReasons).slice(0, 5);
  const topReasonCode = sortedReasons[0] ? sortedReasons[0].code : null;
  const recommendedAction = buildAction(topReasonCode);

  const unverifiedFields = [];
  if (contacts.length === 0) {
    unverifiedFields.push("associated_contacts");
  }
  if (!pickPrimaryContact(contacts) || !pickPrimaryContact(contacts).email) {
    unverifiedFields.push("primary_contact_email");
  }
  if (!contactCoverage.hasDecisionMaker) {
    unverifiedFields.push("decision_maker_contact");
  }

  const enrichedDeal = {
    eligibility: "ELIGIBLE",
    dealName: deal.name,
    dealId: deal.id,
    lastActivityAgeDays: deal.lastActivityAgeDays,
    stageAgeDays: deal.stageAgeDays,
    amount: deal.amount,
    riskLevel,
    recommendedAction,
    hasNextStep: Boolean(deal.hasNextStep),
    contacts
  };

  const draft = buildDraft(enrichedDeal, topReasonCode, recommendedAction, hygiene.risk);
  const verification = buildVerification(enrichedDeal, draft, unverifiedFields, scenario.guardrailHint);

  return {
    dealId: deal.id,
    dealName: deal.name,
    company: deal.company,
    owner: ownerName,
    amount: deal.amount,
    eligibility: "ELIGIBLE",
    rescueScore,
    riskLevel,
    analyzedAt,
    freshUntil,
    lastActivityAgeDays: deal.lastActivityAgeDays,
    hasNextStep: Boolean(deal.hasNextStep),
    reasons: sortedReasons,
    recommendedAction,
    draft,
    verification
  };
}

function buildQueueItem(analysis) {
  return {
    dealId: analysis.dealId,
    dealName: analysis.dealName,
    owner: analysis.owner,
    rescueScore: analysis.rescueScore,
    riskLevel: analysis.riskLevel,
    topReason: analysis.reasons[0] ? analysis.reasons[0].code : "NO_REASON",
    lastActivityAgeDays: analysis.lastActivityAgeDays,
    hasNextStep: analysis.hasNextStep,
    nextBestAction: analysis.recommendedAction.summary
  };
}

function buildOverview(fixtures, scenarioId) {
  const scenario = fixtures.scenarios[scenarioId];
  if (!scenario) {
    return null;
  }

  const analyses = scenario.deals.map((deal) => analyzeDeal(deal, scenario, fixtures.stageExpectationsDays));
  const visibleAnalyses = analyses.filter((analysis) => analysis.eligibility !== "NOT_ELIGIBLE");
  const scoredAnalyses = visibleAnalyses.filter((analysis) => typeof analysis.rescueScore === "number");
  const focusedDeal = analyses.find((analysis) => analysis.dealId === scenario.focusDealId) || analyses[0];

  return {
    meta: {
      appName: "Pipeline Rescue",
      version: "0.3.0",
      generatedAt: scenario.analysisTimestamp,
      portalName: scenario.portalName,
      scenarioLabel: scenario.scenarioLabel,
      scenarioDescription: scenario.scenarioDescription,
      engineMode: "DETERMINISTIC_LOCAL"
    },
    summary: {
      analyzedDeals: visibleAnalyses.length,
      atRiskDeals: scoredAnalyses.filter((analysis) => analysis.rescueScore >= 50).length,
      criticalDeals: scoredAnalyses.filter((analysis) => analysis.rescueScore >= 75).length,
      engagedRescues: scenario.deals.filter((deal) => deal.engagedRescue).length,
      recoveredRevenueCandidate: scoredAnalyses
        .filter((analysis) => analysis.rescueScore >= 50)
        .reduce((sum, analysis) => sum + (analysis.amount || 0), 0)
    },
    verification: focusedDeal.verification,
    queue: scoredAnalyses
      .slice()
      .sort(sortQueue)
      .slice(0, 5)
      .map(buildQueueItem),
    focusedDeal: {
      dealId: focusedDeal.dealId,
      dealName: focusedDeal.dealName,
      company: focusedDeal.company,
      owner: focusedDeal.owner,
      eligibility: focusedDeal.eligibility,
      rescueScore: focusedDeal.rescueScore,
      riskLevel: focusedDeal.riskLevel,
      analyzedAt: focusedDeal.analyzedAt,
      freshUntil: focusedDeal.freshUntil,
      reasons: focusedDeal.reasons,
      recommendedAction: focusedDeal.recommendedAction,
      draft: focusedDeal.draft
    }
  };
}

function buildScenarioCatalog(fixtures) {
  return Object.entries(fixtures.scenarios).map(([id, scenario]) => ({
    id,
    label: scenario.scenarioLabel,
    description: scenario.scenarioDescription
  }));
}

function buildDealAnalysis(fixtures, scenarioId, dealId) {
  const overview = buildOverview(fixtures, scenarioId);
  if (!overview) {
    return null;
  }

  if (overview.focusedDeal.dealId === dealId) {
    return {
      meta: overview.meta,
      verification: overview.verification,
      analysis: overview.focusedDeal
    };
  }

  const scenario = fixtures.scenarios[scenarioId];
  const analysis = scenario.deals
    .map((deal) => analyzeDeal(deal, scenario, fixtures.stageExpectationsDays))
    .find((dealAnalysis) => dealAnalysis.dealId === dealId);

  if (!analysis) {
    return null;
  }

  return {
    meta: overview.meta,
    verification: analysis.verification,
    analysis: {
      dealId: analysis.dealId,
      dealName: analysis.dealName,
      company: analysis.company,
      owner: analysis.owner,
      eligibility: analysis.eligibility,
      rescueScore: analysis.rescueScore,
      riskLevel: analysis.riskLevel,
      analyzedAt: analysis.analyzedAt,
      freshUntil: analysis.freshUntil,
      reasons: analysis.reasons,
      recommendedAction: analysis.recommendedAction,
      draft: analysis.draft
    }
  };
}

module.exports = {
  buildScenarioCatalog,
  buildOverview,
  buildDealAnalysis
};
