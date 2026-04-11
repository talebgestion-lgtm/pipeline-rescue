const fs = require("node:fs");
const path = require("node:path");
const {
  buildScenarioCatalog,
  buildOverview,
  buildDealAnalysis
} = require("./analysis-engine");

const ALLOWED_OPERATOR_REASON_CODES = new Set([
  "ACCURATE_PRIORITY",
  "CLEAR_ACTION",
  "SAFE_GUARDRAIL",
  "WRONG_PRIORITY",
  "WEAK_EVIDENCE",
  "WRONG_ACTION",
  "MISSING_CONTEXT",
  "TOO_AGGRESSIVE"
]);

function deepClone(value) {
  return JSON.parse(JSON.stringify(value));
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function escapeCsv(value) {
  if (value == null) {
    return "";
  }

  const text = String(value);
  if (text.includes(",") || text.includes("\"") || text.includes("\n")) {
    return `"${text.replace(/"/g, "\"\"")}"`;
  }

  return text;
}

const FEEDBACK_THEME_LABELS = {
  PRIORITY_VALIDATED: "Priority validated",
  ACTION_CLARITY_VALIDATED: "Action clarity validated",
  GUARDRAIL_VALIDATED: "Guardrail validated",
  PRIORITY_MISMATCH: "Priority mismatch",
  EVIDENCE_GAP: "Evidence gap",
  ACTION_MISMATCH: "Action mismatch",
  CONTEXT_GAP: "Context gap",
  TONE_AGGRESSIVE: "Tone too aggressive",
  TIMING_MISMATCH: "Timing mismatch",
  UNCLASSIFIED: "Unclassified operator signal"
};

const REASON_CODE_THEME_MAP = {
  ACCURATE_PRIORITY: "PRIORITY_VALIDATED",
  CLEAR_ACTION: "ACTION_CLARITY_VALIDATED",
  SAFE_GUARDRAIL: "GUARDRAIL_VALIDATED",
  WRONG_PRIORITY: "PRIORITY_MISMATCH",
  WEAK_EVIDENCE: "EVIDENCE_GAP",
  WRONG_ACTION: "ACTION_MISMATCH",
  MISSING_CONTEXT: "CONTEXT_GAP",
  TOO_AGGRESSIVE: "TONE_AGGRESSIVE"
};

function classifyFeedbackTheme(status, reasonCode, note) {
  const normalizedNote = String(note || "").toLowerCase();

  const noteRules = [
    { pattern: /(too aggressive|aggressive|pushy|hard sell|tone)/, themeCode: "TONE_AGGRESSIVE" },
    { pattern: /(proof|evidence|too thin|unsupported|not enough signal)/, themeCode: "EVIDENCE_GAP" },
    { pattern: /(missing context|context|stakeholder|history|account context|missing buyer)/, themeCode: "CONTEXT_GAP" },
    { pattern: /(too early|too soon|later|not now|budget cycle|next quarter|timing)/, themeCode: "TIMING_MISMATCH" },
    { pattern: /(wrong action|wrong step|email|call|meeting)/, themeCode: "ACTION_MISMATCH" },
    { pattern: /(not urgent|low priority|wrong priority|priority)/, themeCode: "PRIORITY_MISMATCH" },
    { pattern: /(clear action|clear next step)/, themeCode: "ACTION_CLARITY_VALIDATED" },
    { pattern: /(accurate priority|right priority)/, themeCode: "PRIORITY_VALIDATED" },
    { pattern: /(safe guardrail|guardrail)/, themeCode: "GUARDRAIL_VALIDATED" }
  ];

  const noteMatch = noteRules.find((rule) => rule.pattern.test(normalizedNote));
  const themeCode = noteMatch
    ? noteMatch.themeCode
    : REASON_CODE_THEME_MAP[reasonCode]
      || (status === "USEFUL" ? "ACTION_CLARITY_VALIDATED" : "UNCLASSIFIED");

  return {
    themeCode,
    themeLabel: FEEDBACK_THEME_LABELS[themeCode] || FEEDBACK_THEME_LABELS.UNCLASSIFIED,
    themeSource: noteMatch ? "note_keyword" : reasonCode ? "reason_code" : "fallback"
  };
}

function createValidationError(message) {
  const error = new Error(message);
  error.statusCode = 400;
  return error;
}

function validateFeedbackPayload(options = {}) {
  const reasonCode = options.reasonCode || null;
  const note = options.note ? String(options.note).trim() : null;

  if (reasonCode && !ALLOWED_OPERATOR_REASON_CODES.has(reasonCode)) {
    throw createValidationError("Unsupported operator reason code.");
  }

  if (note && note.length > 280) {
    throw createValidationError("Operator note exceeds the 280-character GDPR-safe limit.");
  }

  if (note && /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i.test(note)) {
    throw createValidationError("Operator note must not contain a direct email address.");
  }

  if (note && /\+?\d[\d\s().-]{7,}\d/.test(note)) {
    throw createValidationError("Operator note must not contain a direct phone number.");
  }

  if (
    note
    && /(health|medical|diagnosis|patient|therapy|religion|politic|union|biometric|genetic|sexual|pregnan|disabilit|santé|médical|diagnostic|patient|thérapie|religion|politique|syndicat|biométr|génétique|sexualit|grossesse|handicap)/i.test(note)
  ) {
    throw createValidationError("Operator note contains prohibited sensitive content for this product scope.");
  }

  return {
    reasonCode,
    note
  };
}

function toSerializableState(state) {
  return {
    sequence: state.sequence,
    taskStates: Object.fromEntries(state.taskStates),
    feedbackStates: Object.fromEntries(state.feedbackStates),
    feedbackHistory: state.feedbackHistory,
    events: state.events
  };
}

function fromSerializableState(state) {
  return {
    sequence: state.sequence || 1,
    taskStates: new Map(Object.entries(state.taskStates || {})),
    feedbackStates: new Map(Object.entries(state.feedbackStates || {})),
    feedbackHistory: Array.isArray(state.feedbackHistory) ? state.feedbackHistory : [],
    events: Array.isArray(state.events) ? state.events : []
  };
}

function createRuntime(fixtures, options = {}) {
  const stateFilePath = options.stateFilePath || path.join(__dirname, "..", "data", "runtime-state.json");
  const scenarioState = new Map();

  function persistState() {
    const payload = {
      version: 1,
      scenarios: Object.fromEntries(
        Array.from(scenarioState.entries()).map(([scenarioId, state]) => [
          scenarioId,
          toSerializableState(state)
        ])
      )
    };

    fs.mkdirSync(path.dirname(stateFilePath), { recursive: true });
    fs.writeFileSync(stateFilePath, JSON.stringify(payload, null, 2));
  }

  function loadState() {
    if (!fs.existsSync(stateFilePath)) {
      return;
    }

    const payload = JSON.parse(fs.readFileSync(stateFilePath, "utf8"));
    const scenarios = payload.scenarios || {};

    for (const [scenarioId, state] of Object.entries(scenarios)) {
      scenarioState.set(scenarioId, fromSerializableState(state));
    }
  }

  loadState();

  function ensureScenarioState(scenarioId) {
    if (!scenarioState.has(scenarioId)) {
      scenarioState.set(scenarioId, {
        sequence: 1,
        taskStates: new Map(),
        feedbackStates: new Map(),
        feedbackHistory: [],
        events: []
      });
    }

    return scenarioState.get(scenarioId);
  }

  function createEvent(scenarioId, eventName, properties) {
    const state = ensureScenarioState(scenarioId);
    const event = {
      eventId: `evt_${String(state.sequence).padStart(4, "0")}`,
      eventName,
      scenarioId,
      occurredAt: new Date().toISOString(),
      properties
    };

    state.sequence += 1;
    state.events.push(event);

    if (state.events.length > 40) {
      state.events.shift();
    }

    persistState();
    return event;
  }

  function getTaskStateForDeal(scenarioId, dealId) {
    const state = ensureScenarioState(scenarioId);
    return state.taskStates.get(dealId) || {
      status: "NOT_CREATED",
      taskId: null,
      subject: null,
      createdAt: null
    };
  }

  function getFeedbackStateForDeal(scenarioId, dealId) {
    const state = ensureScenarioState(scenarioId);
    return state.feedbackStates.get(dealId) || {
      status: "NO_FEEDBACK",
      updatedAt: null,
      reasonCode: null,
      note: null,
      themeCode: null,
      themeLabel: null,
      themeSource: null
    };
  }

  function getFeedbackHistoryForDeal(scenarioId, dealId) {
    const state = ensureScenarioState(scenarioId);
    return state.feedbackHistory.filter((entry) => entry.dealId === dealId);
  }

  function getMatchingFeedbackHistory(analysis, feedbackHistory) {
    const topReason = analysis.reasons && analysis.reasons[0] ? analysis.reasons[0].code : null;
    const recommendedActionType = analysis.recommendedAction && analysis.recommendedAction.type
      ? analysis.recommendedAction.type
      : null;

    return feedbackHistory.filter((entry) => {
      if (topReason && entry.topReason === topReason) {
        return true;
      }

      if (recommendedActionType && entry.recommendedActionType === recommendedActionType) {
        return true;
      }

      return false;
    });
  }

  function summarizeFeedbackHistory(feedbackHistory, stabilityScore) {
    const usefulCount = feedbackHistory.filter((entry) => entry.status === "USEFUL").length;
    const dismissedCount = feedbackHistory.filter((entry) => entry.status === "DISMISSED").length;
    const sampleSize = usefulCount + dismissedCount;
    const operatorTrustScore = sampleSize === 0 ? 50 : Math.round((usefulCount / sampleSize) * 100);
    const baseRecommendationScore = typeof stabilityScore === "number"
      ? Math.round(clamp(stabilityScore * 10, 0, 100))
      : 50;
    const calibratedRecommendationScore = sampleSize === 0
      ? baseRecommendationScore
      : Math.round((baseRecommendationScore * 0.7) + (operatorTrustScore * 0.3));
    const calibrationAdjustment = calibratedRecommendationScore - baseRecommendationScore;
    const calibrationDirection = calibrationAdjustment > 2
      ? "POSITIVE"
      : calibrationAdjustment < -2
        ? "NEGATIVE"
        : "NEUTRAL";

    return {
      usefulCount,
      dismissedCount,
      sampleSize,
      operatorTrustScore,
      baseRecommendationScore,
      calibratedRecommendationScore,
      calibrationAdjustment,
      calibrationDirection
    };
  }

  function buildFeedbackState(scenarioId, analysis, verification) {
    const state = ensureScenarioState(scenarioId);
    const baseState = getFeedbackStateForDeal(scenarioId, analysis.dealId);
    const dealHistory = getFeedbackHistoryForDeal(scenarioId, analysis.dealId);
    const matchedHistory = getMatchingFeedbackHistory(analysis, state.feedbackHistory);
    const calibration = summarizeFeedbackHistory(matchedHistory, verification && verification.stabilityScore);

    return {
      ...baseState,
      dealHistoryCount: dealHistory.length,
      dealUsefulCount: dealHistory.filter((entry) => entry.status === "USEFUL").length,
      dealDismissedCount: dealHistory.filter((entry) => entry.status === "DISMISSED").length,
      matchedSignalCount: calibration.sampleSize,
      matchedUsefulCount: calibration.usefulCount,
      matchedDismissedCount: calibration.dismissedCount,
      operatorTrustScore: calibration.operatorTrustScore,
      baseRecommendationScore: calibration.baseRecommendationScore,
      calibratedRecommendationScore: calibration.calibratedRecommendationScore,
      calibrationAdjustment: calibration.calibrationAdjustment,
      calibrationDirection: calibration.calibrationDirection,
      recentSignals: dealHistory.slice(-3).reverse()
    };
  }

  function decorateAnalysis(scenarioId, analysisPayload) {
    const payload = deepClone(analysisPayload);
    payload.analysis.taskState = getTaskStateForDeal(scenarioId, payload.analysis.dealId);
    payload.analysis.feedbackState = buildFeedbackState(scenarioId, payload.analysis, payload.verification);
    return payload;
  }

  function decorateOverview(scenarioId, overviewPayload) {
    const payload = deepClone(overviewPayload);
    const state = ensureScenarioState(scenarioId);

    payload.focusedDeal.taskState = getTaskStateForDeal(scenarioId, payload.focusedDeal.dealId);
    payload.focusedDeal.feedbackState = buildFeedbackState(scenarioId, payload.focusedDeal, payload.verification);
    payload.queue = payload.queue.map((item) => ({
      ...item,
      taskStatus: getTaskStateForDeal(scenarioId, item.dealId).status,
      feedbackStatus: getFeedbackStateForDeal(scenarioId, item.dealId).status,
      feedbackSignalCount: getFeedbackHistoryForDeal(scenarioId, item.dealId).length
    }));
    payload.pilotEvents = state.events.slice(-8).reverse();

    return payload;
  }

  function getScenarioCatalog() {
    return {
      defaultScenario: fixtures.defaultScenario,
      scenarios: buildScenarioCatalog(fixtures)
    };
  }

  function getOverview(scenarioId) {
    const overview = buildOverview(fixtures, scenarioId);

    if (!overview) {
      return null;
    }

    return decorateOverview(scenarioId, overview);
  }

  function getAnalysis(scenarioId, dealId) {
    const analysis = buildDealAnalysis(fixtures, scenarioId, dealId);

    if (!analysis) {
      return null;
    }

    return decorateAnalysis(scenarioId, analysis);
  }

  function analyzeDeal(scenarioId, dealId) {
    const analysis = getAnalysis(scenarioId, dealId);

    if (!analysis) {
      return null;
    }

    createEvent(scenarioId, "deal_analysis_requested", { dealId });
    createEvent(scenarioId, "deal_analysis_completed", {
      dealId,
      rescueScore: analysis.analysis.rescueScore,
      riskLevel: analysis.analysis.riskLevel,
      validationStatus: analysis.verification.validationStatus
    });

    return analysis;
  }

  function createTask(scenarioId, dealId) {
    const analysis = getAnalysis(scenarioId, dealId);

    if (!analysis) {
      return null;
    }

    const state = ensureScenarioState(scenarioId);
    const existing = getTaskStateForDeal(scenarioId, dealId);

    if (existing.status === "CREATED" || existing.status === "ALREADY_EXISTS") {
      const taskState = {
        ...existing,
        status: "ALREADY_EXISTS"
      };
      state.taskStates.set(dealId, taskState);
      persistState();
      createEvent(scenarioId, "task_creation_skipped", {
        dealId,
        reason: "ALREADY_EXISTS"
      });

      return {
        taskState,
        analysis: decorateAnalysis(scenarioId, analysis).analysis
      };
    }

    const taskState = {
      status: "CREATED",
      taskId: `task_${scenarioId}_${dealId}_${String(state.sequence).padStart(4, "0")}`,
      subject: analysis.analysis.recommendedAction.summary,
      createdAt: new Date().toISOString()
    };

    state.taskStates.set(dealId, taskState);
    persistState();
    createEvent(scenarioId, "task_created_from_recommendation", {
      dealId,
      taskId: taskState.taskId,
      recommendedActionType: analysis.analysis.recommendedAction.type
    });

    return {
      taskState,
      analysis: decorateAnalysis(scenarioId, analysis).analysis
    };
  }

  function generateDraft(scenarioId, dealId) {
    const analysis = getAnalysis(scenarioId, dealId);

    if (!analysis) {
      return null;
    }

    const draft = analysis.analysis.draft;
    createEvent(
      scenarioId,
      draft.eligible ? "draft_generated" : "draft_blocked",
      {
        dealId,
        blockedReason: draft.blockedReason || null
      }
    );

    return {
      analysis: analysis.analysis,
      verification: analysis.verification,
      draft
    };
  }

  function recordFeedback(scenarioId, dealId, status, options = {}) {
    const validatedOptions = validateFeedbackPayload(options);
    const analysis = getAnalysis(scenarioId, dealId);

    if (!analysis) {
      return null;
    }

    const state = ensureScenarioState(scenarioId);
    const theme = classifyFeedbackTheme(status, validatedOptions.reasonCode, validatedOptions.note);
    const feedbackState = {
      status,
      updatedAt: new Date().toISOString(),
      reasonCode: validatedOptions.reasonCode,
      note: validatedOptions.note,
      themeCode: theme.themeCode,
      themeLabel: theme.themeLabel,
      themeSource: theme.themeSource
    };
    const feedbackEntry = {
      feedbackId: `fb_${String(state.sequence).padStart(4, "0")}`,
      dealId,
      dealName: analysis.analysis.dealName,
      owner: analysis.analysis.owner,
      status,
      occurredAt: feedbackState.updatedAt,
      topReason: analysis.analysis.reasons[0] ? analysis.analysis.reasons[0].code : "NO_REASON",
      recommendedActionType: analysis.analysis.recommendedAction
        ? analysis.analysis.recommendedAction.type
        : "UNKNOWN",
      rescueScore: analysis.analysis.rescueScore,
      validationStatus: analysis.verification.validationStatus,
      operatorReasonCode: feedbackState.reasonCode,
      operatorNote: feedbackState.note,
      operatorThemeCode: feedbackState.themeCode,
      operatorThemeLabel: feedbackState.themeLabel
    };

    state.sequence += 1;
    state.feedbackStates.set(dealId, feedbackState);
    state.feedbackHistory.push(feedbackEntry);
    if (state.feedbackHistory.length > 200) {
      state.feedbackHistory.shift();
    }
    persistState();
    createEvent(
      scenarioId,
      status === "USEFUL" ? "recommendation_marked_useful" : "recommendation_dismissed",
      {
        dealId,
        feedbackId: feedbackEntry.feedbackId,
        feedbackStatus: status,
        topReason: feedbackEntry.topReason,
        recommendedActionType: feedbackEntry.recommendedActionType,
        operatorReasonCode: feedbackEntry.operatorReasonCode,
        operatorThemeCode: feedbackEntry.operatorThemeCode
      }
    );

    return {
      feedbackState: buildFeedbackState(scenarioId, analysis.analysis, analysis.verification),
      analysis: decorateAnalysis(scenarioId, analysis).analysis
    };
  }

  function getEvents(scenarioId) {
    const state = ensureScenarioState(scenarioId);

    return {
      scenarioId,
      events: state.events.slice().reverse()
    };
  }

  function getManagerReport(scenarioId) {
    const overview = getOverview(scenarioId);

    if (!overview) {
      return null;
    }

    const state = ensureScenarioState(scenarioId);
    const feedbackReport = getFeedbackReport(scenarioId);
    const events = state.events.slice();
    const touchedDealIds = new Set(
      events
        .map((event) => event.properties && event.properties.dealId)
        .filter(Boolean)
    );
    const queue = overview.queue || [];
    const atRiskQueue = queue.filter((item) => typeof item.rescueScore === "number" && item.rescueScore >= 50);
    const atRiskWithTask = atRiskQueue.filter((item) => item.taskStatus && item.taskStatus !== "NOT_CREATED");
    const atRiskWithFeedback = atRiskQueue.filter((item) => item.feedbackStatus && item.feedbackStatus !== "NO_FEEDBACK");

    const topReasons = Object.entries(
      queue.reduce((accumulator, item) => {
        accumulator[item.topReason] = (accumulator[item.topReason] || 0) + 1;
        return accumulator;
      }, {})
    )
      .map(([reasonCode, count]) => ({ reasonCode, count }))
      .sort((left, right) => right.count - left.count)
      .slice(0, 3);

    const ownerBreakdown = Object.values(
      queue.reduce((accumulator, item) => {
        if (!accumulator[item.owner]) {
          accumulator[item.owner] = {
            owner: item.owner,
            queueDeals: 0,
            atRiskDeals: 0,
            taskedDeals: 0,
            usefulFeedback: 0,
            dismissedFeedback: 0
          };
        }

        accumulator[item.owner].queueDeals += 1;
        if (typeof item.rescueScore === "number" && item.rescueScore >= 50) {
          accumulator[item.owner].atRiskDeals += 1;
        }
        if (item.taskStatus && item.taskStatus !== "NOT_CREATED") {
          accumulator[item.owner].taskedDeals += 1;
        }
        if (item.feedbackStatus === "USEFUL") {
          accumulator[item.owner].usefulFeedback += 1;
        }
        if (item.feedbackStatus === "DISMISSED") {
          accumulator[item.owner].dismissedFeedback += 1;
        }

        return accumulator;
      }, {})
    ).sort((left, right) => right.atRiskDeals - left.atRiskDeals || right.taskedDeals - left.taskedDeals);

    const metrics = {
      analyzedDeals: overview.summary.analyzedDeals,
      atRiskDeals: overview.summary.atRiskDeals,
      criticalDeals: overview.summary.criticalDeals,
      tasksCreated: Array.from(state.taskStates.values()).filter((taskState) => taskState.status !== "NOT_CREATED").length,
      analysesRun: events.filter((event) => event.eventName === "deal_analysis_completed").length,
      draftsGenerated: events.filter((event) => event.eventName === "draft_generated").length,
      draftsBlocked: events.filter((event) => event.eventName === "draft_blocked").length,
      usefulFeedbackCount: feedbackReport.metrics.usefulCount,
      dismissedFeedbackCount: feedbackReport.metrics.dismissedCount,
      recommendationTrustScore: feedbackReport.metrics.trustScore,
      topFrictionThemeLabel: feedbackReport.metrics.topFrictionThemeLabel,
      touchedDeals: touchedDealIds.size,
      queueCoverageRate: atRiskQueue.length === 0 ? 0 : Math.round((atRiskWithTask.length / atRiskQueue.length) * 100),
      feedbackCoverageRate: atRiskQueue.length === 0 ? 0 : Math.round((atRiskWithFeedback.length / atRiskQueue.length) * 100),
      lastEventAt: events.length ? events[events.length - 1].occurredAt : null
    };

    const digest = [
      `${metrics.atRiskDeals} at-risk deals detected, including ${metrics.criticalDeals} critical.`,
      `${metrics.tasksCreated} local follow-up task(s) created with ${metrics.queueCoverageRate}% coverage on at-risk queue items.`,
      `${metrics.draftsGenerated} draft(s) generated and ${metrics.draftsBlocked} blocked by guardrails.`,
      `${metrics.usefulFeedbackCount} useful and ${metrics.dismissedFeedbackCount} dismissed recommendation signal(s), covering ${metrics.feedbackCoverageRate}% of at-risk deals.`,
      `Operator trust score is ${metrics.recommendationTrustScore}/100 on the current feedback sample.`,
      metrics.topFrictionThemeLabel
        ? `Top friction pattern: ${metrics.topFrictionThemeLabel}.`
        : "No dominant friction pattern has been observed yet."
    ];

    return {
      scenarioId,
      metrics,
      topReasons,
      ownerBreakdown,
      digest
    };
  }

  function getFeedbackReport(scenarioId) {
    const state = ensureScenarioState(scenarioId);
    const history = state.feedbackHistory.slice();
    const usefulCount = history.filter((entry) => entry.status === "USEFUL").length;
    const dismissedCount = history.filter((entry) => entry.status === "DISMISSED").length;
    const totalEntries = usefulCount + dismissedCount;
    const trustScore = totalEntries === 0 ? 50 : Math.round((usefulCount / totalEntries) * 100);
    const lastFeedbackAt = history.length ? history[history.length - 1].occurredAt : null;

    function groupBy(key, outputKey, sourceEntries = history) {
      return Object.values(
        sourceEntries.reduce((accumulator, entry) => {
          const groupValue = entry[key] || "UNKNOWN";
          if (!accumulator[groupValue]) {
            accumulator[groupValue] = {
              [outputKey]: groupValue,
              usefulCount: 0,
              dismissedCount: 0,
              trustScore: 50,
              sampleSize: 0
            };
          }

          if (entry.status === "USEFUL") {
            accumulator[groupValue].usefulCount += 1;
          }

          if (entry.status === "DISMISSED") {
            accumulator[groupValue].dismissedCount += 1;
          }

          accumulator[groupValue].sampleSize += 1;
          accumulator[groupValue].trustScore = Math.round(
            (accumulator[groupValue].usefulCount / accumulator[groupValue].sampleSize) * 100
          );

          return accumulator;
        }, {})
      ).sort((left, right) => right.sampleSize - left.sampleSize || right.trustScore - left.trustScore);
    }

    const topFrictionPatterns = Object.values(
      history
        .filter((entry) => entry.status === "DISMISSED")
        .reduce((accumulator, entry) => {
          const themeCode = entry.operatorThemeCode || "UNCLASSIFIED";
          if (!accumulator[themeCode]) {
            accumulator[themeCode] = {
              themeCode,
              themeLabel: entry.operatorThemeLabel || FEEDBACK_THEME_LABELS[themeCode] || FEEDBACK_THEME_LABELS.UNCLASSIFIED,
              count: 0,
              uniqueDeals: new Set(),
              latestOccurredAt: null,
              sampleNote: null
            };
          }

          accumulator[themeCode].count += 1;
          accumulator[themeCode].uniqueDeals.add(entry.dealId);
          if (!accumulator[themeCode].sampleNote && entry.operatorNote) {
            accumulator[themeCode].sampleNote = entry.operatorNote;
          }
          if (!accumulator[themeCode].latestOccurredAt || entry.occurredAt > accumulator[themeCode].latestOccurredAt) {
            accumulator[themeCode].latestOccurredAt = entry.occurredAt;
          }

          return accumulator;
        }, {})
    )
      .map((item) => ({
        themeCode: item.themeCode,
        themeLabel: item.themeLabel,
        count: item.count,
        uniqueDeals: item.uniqueDeals.size,
        latestOccurredAt: item.latestOccurredAt,
        sampleNote: item.sampleNote
      }))
      .sort((left, right) => right.count - left.count || String(right.latestOccurredAt).localeCompare(String(left.latestOccurredAt)));

    return {
      scenarioId,
      metrics: {
        totalEntries,
        usefulCount,
        dismissedCount,
        trustScore,
        uniqueDeals: new Set(history.map((entry) => entry.dealId)).size,
        notesCount: history.filter((entry) => entry.operatorNote).length,
        dismissedWithReasonCount: history.filter((entry) => entry.status === "DISMISSED" && entry.operatorReasonCode).length,
        frictionEntriesCount: history.filter((entry) => entry.status === "DISMISSED" && entry.operatorThemeCode).length,
        topFrictionTheme: topFrictionPatterns[0] ? topFrictionPatterns[0].themeCode : null,
        topFrictionThemeLabel: topFrictionPatterns[0] ? topFrictionPatterns[0].themeLabel : null,
        lastFeedbackAt
      },
      byReason: groupBy("topReason", "reasonCode"),
      byAction: groupBy("recommendedActionType", "actionType"),
      byOwner: groupBy("owner", "owner"),
      byTheme: groupBy("operatorThemeCode", "themeCode").filter((item) => item.themeCode !== "UNKNOWN"),
      byDismissReason: groupBy(
        "operatorReasonCode",
        "reasonCode",
        history.filter((entry) => entry.status === "DISMISSED")
      ).filter((item) => item.reasonCode !== "UNKNOWN"),
      topFrictionPatterns,
      recentEntries: history.slice(-10).reverse()
    };
  }

  function exportFeedback(scenarioId, format) {
    const report = getFeedbackReport(scenarioId);
    const state = ensureScenarioState(scenarioId);
    const entries = state.feedbackHistory.slice();

    if (format === "csv") {
      const header = [
        "feedbackId",
        "occurredAt",
        "dealId",
        "dealName",
        "owner",
        "status",
        "operatorReasonCode",
        "operatorNote",
        "operatorThemeCode",
        "operatorThemeLabel",
        "topReason",
        "recommendedActionType",
        "rescueScore",
        "validationStatus"
      ];
      const lines = entries.map((entry) => [
        entry.feedbackId,
        entry.occurredAt,
        entry.dealId,
        entry.dealName,
        entry.owner,
        entry.status,
        entry.operatorReasonCode,
        entry.operatorNote,
        entry.operatorThemeCode,
        entry.operatorThemeLabel,
        entry.topReason,
        entry.recommendedActionType,
        entry.rescueScore,
        entry.validationStatus
      ].map(escapeCsv).join(","));

      return [header.join(","), ...lines].join("\n");
    }

    return {
      scenarioId,
      exportedAt: new Date().toISOString(),
      metrics: report.metrics,
      entries
    };
  }

  function exportState() {
    return {
      stateFilePath,
      scenarios: Object.fromEntries(
        Array.from(scenarioState.entries()).map(([scenarioId, state]) => [
          scenarioId,
          toSerializableState(state)
        ])
      )
    };
  }

  function resetScenario(scenarioId) {
    scenarioState.delete(scenarioId);
    persistState();

    return getOverview(scenarioId);
  }

  return {
    getScenarioCatalog,
    getOverview,
    getAnalysis,
    getManagerReport,
    getFeedbackReport,
    exportFeedback,
    analyzeDeal,
    createTask,
    generateDraft,
    recordFeedback,
    getEvents,
    exportState,
    resetScenario
  };
}

module.exports = {
  createRuntime
};
