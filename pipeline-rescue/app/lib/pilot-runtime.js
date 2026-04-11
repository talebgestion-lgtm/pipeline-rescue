const fs = require("node:fs");
const path = require("node:path");
const {
  buildScenarioCatalog,
  buildOverview,
  buildDealAnalysis
} = require("./analysis-engine");

function deepClone(value) {
  return JSON.parse(JSON.stringify(value));
}

function toSerializableState(state) {
  return {
    sequence: state.sequence,
    taskStates: Object.fromEntries(state.taskStates),
    feedbackStates: Object.fromEntries(state.feedbackStates),
    events: state.events
  };
}

function fromSerializableState(state) {
  return {
    sequence: state.sequence || 1,
    taskStates: new Map(Object.entries(state.taskStates || {})),
    feedbackStates: new Map(Object.entries(state.feedbackStates || {})),
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
      updatedAt: null
    };
  }

  function decorateAnalysis(scenarioId, analysisPayload) {
    const payload = deepClone(analysisPayload);
    payload.analysis.taskState = getTaskStateForDeal(scenarioId, payload.analysis.dealId);
    payload.analysis.feedbackState = getFeedbackStateForDeal(scenarioId, payload.analysis.dealId);
    return payload;
  }

  function decorateOverview(scenarioId, overviewPayload) {
    const payload = deepClone(overviewPayload);
    const state = ensureScenarioState(scenarioId);

    payload.focusedDeal.taskState = getTaskStateForDeal(scenarioId, payload.focusedDeal.dealId);
    payload.focusedDeal.feedbackState = getFeedbackStateForDeal(scenarioId, payload.focusedDeal.dealId);
    payload.queue = payload.queue.map((item) => ({
      ...item,
      taskStatus: getTaskStateForDeal(scenarioId, item.dealId).status,
      feedbackStatus: getFeedbackStateForDeal(scenarioId, item.dealId).status
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

  function recordFeedback(scenarioId, dealId, status) {
    const analysis = getAnalysis(scenarioId, dealId);

    if (!analysis) {
      return null;
    }

    const state = ensureScenarioState(scenarioId);
    const feedbackState = {
      status,
      updatedAt: new Date().toISOString()
    };

    state.feedbackStates.set(dealId, feedbackState);
    persistState();
    createEvent(
      scenarioId,
      status === "USEFUL" ? "recommendation_marked_useful" : "recommendation_dismissed",
      { dealId, feedbackStatus: status }
    );

    return {
      feedbackState,
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
      usefulFeedbackCount: events.filter((event) => event.eventName === "recommendation_marked_useful").length,
      dismissedFeedbackCount: events.filter((event) => event.eventName === "recommendation_dismissed").length,
      touchedDeals: touchedDealIds.size,
      queueCoverageRate: atRiskQueue.length === 0 ? 0 : Math.round((atRiskWithTask.length / atRiskQueue.length) * 100),
      feedbackCoverageRate: atRiskQueue.length === 0 ? 0 : Math.round((atRiskWithFeedback.length / atRiskQueue.length) * 100),
      lastEventAt: events.length ? events[events.length - 1].occurredAt : null
    };

    const digest = [
      `${metrics.atRiskDeals} at-risk deals detected, including ${metrics.criticalDeals} critical.`,
      `${metrics.tasksCreated} local follow-up task(s) created with ${metrics.queueCoverageRate}% coverage on at-risk queue items.`,
      `${metrics.draftsGenerated} draft(s) generated and ${metrics.draftsBlocked} blocked by guardrails.`,
      `${metrics.usefulFeedbackCount} useful and ${metrics.dismissedFeedbackCount} dismissed recommendation signal(s), covering ${metrics.feedbackCoverageRate}% of at-risk deals.`
    ];

    return {
      scenarioId,
      metrics,
      topReasons,
      ownerBreakdown,
      digest
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
