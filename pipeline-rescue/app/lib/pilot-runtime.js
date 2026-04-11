const {
  buildScenarioCatalog,
  buildOverview,
  buildDealAnalysis
} = require("./analysis-engine");

function deepClone(value) {
  return JSON.parse(JSON.stringify(value));
}

function createRuntime(fixtures) {
  const scenarioState = new Map();

  function ensureScenarioState(scenarioId) {
    if (!scenarioState.has(scenarioId)) {
      scenarioState.set(scenarioId, {
        sequence: 1,
        taskStates: new Map(),
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

  function decorateAnalysis(scenarioId, analysisPayload) {
    const payload = deepClone(analysisPayload);
    payload.analysis.taskState = getTaskStateForDeal(scenarioId, payload.analysis.dealId);
    return payload;
  }

  function decorateOverview(scenarioId, overviewPayload) {
    const payload = deepClone(overviewPayload);
    const state = ensureScenarioState(scenarioId);

    payload.focusedDeal.taskState = getTaskStateForDeal(scenarioId, payload.focusedDeal.dealId);
    payload.queue = payload.queue.map((item) => ({
      ...item,
      taskStatus: getTaskStateForDeal(scenarioId, item.dealId).status
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

  function getEvents(scenarioId) {
    const state = ensureScenarioState(scenarioId);

    return {
      scenarioId,
      events: state.events.slice().reverse()
    };
  }

  return {
    getScenarioCatalog,
    getOverview,
    getAnalysis,
    analyzeDeal,
    createTask,
    generateDraft,
    getEvents
  };
}

module.exports = {
  createRuntime
};
