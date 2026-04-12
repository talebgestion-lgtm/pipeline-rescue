const {
  createHubSpotStatus,
  normalizeInstallState,
  validateHubSpotConfigPayload
} = require("./hubspot-oauth");
const { buildHubSpotDealSearchRequest } = require("./hubspot-live-search");

function createHubSpotClientError(message, statusCode = 500, detail = null) {
  const error = new Error(message);
  error.statusCode = statusCode;
  if (detail) {
    error.detail = detail;
  }
  return error;
}

function getFetchImplementation(options = {}) {
  const implementation = options.fetchImpl || globalThis.fetch;
  if (typeof implementation !== "function") {
    throw createHubSpotClientError("Global fetch is not available in this Node runtime.", 500);
  }

  return implementation;
}

function getHeaderValue(headers, name) {
  if (!headers) {
    return null;
  }

  if (typeof headers.get === "function") {
    return headers.get(name) || headers.get(String(name).toLowerCase()) || null;
  }

  const match = Object.keys(headers).find((key) => key.toLowerCase() === String(name).toLowerCase());
  return match ? headers[match] : null;
}

function parseRetryAfterMs(headers, now = new Date()) {
  const retryAfterValue = getHeaderValue(headers, "retry-after");
  if (!retryAfterValue) {
    return null;
  }

  const numericSeconds = Number(retryAfterValue);
  if (Number.isFinite(numericSeconds)) {
    return Math.max(0, Math.round(numericSeconds * 1000));
  }

  const retryDate = new Date(retryAfterValue);
  if (Number.isNaN(retryDate.getTime())) {
    return null;
  }

  return Math.max(0, retryDate.getTime() - now.getTime());
}

function isRetryableHubSpotStatus(statusCode) {
  return statusCode === 429 || (statusCode >= 500 && statusCode < 600);
}

function calculateRetryDelayMs(attemptNumber, error) {
  if (Number.isFinite(error && error.retryAfterMs)) {
    return Math.min(Math.max(error.retryAfterMs, 250), 5000);
  }

  return Math.min(250 * (2 ** attemptNumber), 2000);
}

async function pauseBeforeRetry(delayMs, sleepImpl) {
  if (!Number.isFinite(delayMs) || delayMs <= 0) {
    return;
  }

  if (typeof sleepImpl === "function") {
    await sleepImpl(delayMs);
    return;
  }

  await new Promise((resolve) => setTimeout(resolve, delayMs));
}

async function executeHubSpotRetryableRequest(execute, options = {}) {
  const maxRetries = Number.isInteger(options.maxRetries) ? options.maxRetries : 2;

  for (let attempt = 0; ; attempt += 1) {
    try {
      return await execute();
    } catch (error) {
      if (!isRetryableHubSpotStatus(error && error.statusCode) || attempt >= maxRetries) {
        throw error;
      }

      await pauseBeforeRetry(calculateRetryDelayMs(attempt, error), options.sleepImpl);
    }
  }
}

function toNumber(value) {
  if (value == null || value === "") {
    return null;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function toBoolean(value) {
  if (typeof value === "boolean") {
    return value;
  }

  if (typeof value === "string") {
    if (value.toLowerCase() === "true") {
      return true;
    }

    if (value.toLowerCase() === "false") {
      return false;
    }
  }

  return null;
}

function daysSince(timestamp, referenceTimestamp) {
  if (!timestamp) {
    return null;
  }

  const from = new Date(timestamp);
  const to = new Date(referenceTimestamp);

  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) {
    return null;
  }

  return Math.max(0, Math.floor((to.getTime() - from.getTime()) / (24 * 60 * 60 * 1000)));
}

function createExpiresAt(expiresIn, now = new Date()) {
  if (!Number.isFinite(Number(expiresIn))) {
    return null;
  }

  return new Date(now.getTime() + (Number(expiresIn) * 1000)).toISOString();
}

const HUBSPOT_ASSOCIATION_TYPE_IDS = {
  NOTE_TO_CONTACT: 202,
  NOTE_TO_COMPANY: 190,
  NOTE_TO_DEAL: 214,
  TASK_TO_CONTACT: 204,
  TASK_TO_COMPANY: 192,
  TASK_TO_DEAL: 216
};

function chooseInstallRecord(installState, preferredPortalId) {
  const installs = normalizeInstallState(installState).installs;
  if (installs.length === 0) {
    throw createHubSpotClientError("No HubSpot install is stored locally yet.", 409);
  }

  if (preferredPortalId) {
    const selected = installs.find((item) => String(item.portalId) === String(preferredPortalId));
    if (!selected) {
      throw createHubSpotClientError(`No HubSpot install is stored for portal ${preferredPortalId}.`, 404);
    }

    return selected;
  }

  if (installs.length === 1) {
    return installs[0];
  }

  throw createHubSpotClientError(
    "Multiple HubSpot installs are stored locally. Provide a portalId or configure preferredAccountId.",
    400
  );
}

function upsertInstallRecord(installState, installRecord) {
  const nextState = normalizeInstallState(installState);
  const existingIndex = nextState.installs.findIndex((item) => String(item.portalId) === String(installRecord.portalId));

  if (existingIndex >= 0) {
    nextState.installs[existingIndex] = installRecord;
  } else {
    nextState.installs.push(installRecord);
  }

  return nextState;
}

function ensureHubSpotReady(config, installState, portalId, env = process.env) {
  const normalizedConfig = validateHubSpotConfigPayload(config);
  const normalizedInstallState = normalizeInstallState(installState);
  const status = createHubSpotStatus({
    config: normalizedConfig,
    env,
    installState: normalizedInstallState
  });

  if (status.status !== "READY") {
    throw createHubSpotClientError(status.summary, 409, status.blockers.join(" "));
  }

  const targetPortalId = portalId || normalizedConfig.preferredAccountId || null;
  const install = chooseInstallRecord(normalizedInstallState, targetPortalId);

  if (!install.accessToken) {
    throw createHubSpotClientError("Stored HubSpot install is missing an access token.", 409);
  }

  return {
    config: normalizedConfig,
    installState: normalizedInstallState,
    install
  };
}

async function hubSpotRequest({ install, path, method = "GET", body, fetchImpl }) {
  const response = await getFetchImplementation({ fetchImpl })(`https://api.hubapi.com${path}`, {
    method,
    headers: {
      "Authorization": `Bearer ${install.accessToken}`,
      ...(body ? { "Content-Type": "application/json" } : {})
    },
    body: body ? JSON.stringify(body) : undefined
  });

  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    const error = createHubSpotClientError(
      `HubSpot request failed with status ${response.status}.`,
      response.status,
      payload && payload.message ? payload.message : null
    );
    error.retryAfterMs = parseRetryAfterMs(response.headers);
    error.requestId = getHeaderValue(response.headers, "x-hubspot-request-id");
    throw error;
  }

  return payload;
}

async function refreshHubSpotAccessToken({ config, install, env = process.env, fetchImpl, sleepImpl }) {
  const clientSecret = env[config.clientSecretEnvVar];
  if (!clientSecret) {
    throw createHubSpotClientError(`Missing ${config.clientSecretEnvVar} in the process environment.`, 409);
  }

  if (!install.refreshToken) {
    throw createHubSpotClientError("Stored HubSpot install is missing a refresh token.", 409);
  }

  const body = new URLSearchParams({
    grant_type: "refresh_token",
    client_id: config.clientId,
    client_secret: clientSecret,
    refresh_token: install.refreshToken
  });

  const payload = await executeHubSpotRetryableRequest(async () => {
    const response = await getFetchImplementation({ fetchImpl })("https://api.hubapi.com/oauth/v1/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded;charset=utf-8"
      },
      body: body.toString()
    });

    const responsePayload = await response.json().catch(() => null);
    if (!response.ok) {
      const error = createHubSpotClientError(
        `HubSpot token refresh failed with status ${response.status}.`,
        response.status,
        responsePayload && responsePayload.message ? responsePayload.message : null
      );
      error.retryAfterMs = parseRetryAfterMs(response.headers);
      error.requestId = getHeaderValue(response.headers, "x-hubspot-request-id");
      throw error;
    }

    return responsePayload;
  }, {
    sleepImpl
  });

  return {
    ...install,
    accessToken: payload.access_token || payload.accessToken,
    refreshToken: payload.refresh_token || payload.refreshToken || install.refreshToken,
    tokenType: payload.token_type || payload.tokenType || install.tokenType || "bearer",
    expiresIn: payload.expires_in || payload.expiresIn || null,
    expiresAt: createExpiresAt(payload.expires_in || payload.expiresIn),
    refreshedAt: new Date().toISOString()
  };
}

function needsAccessTokenRefresh(install, referenceTimestamp) {
  if (!install || !install.expiresAt) {
    return false;
  }

  const expiry = new Date(install.expiresAt);
  const reference = new Date(referenceTimestamp);
  if (Number.isNaN(expiry.getTime()) || Number.isNaN(reference.getTime())) {
    return false;
  }

  return expiry.getTime() - reference.getTime() <= 60_000;
}

async function createLiveRequestSession(options) {
  const analysisTimestamp = options.analysisTimestamp || new Date().toISOString();
  const session = ensureHubSpotReady(options.config, options.installState, options.portalId, options.env);
  let activeInstall = session.install;
  let activeInstallState = session.installState;
  let tokenRefreshed = false;

  async function refreshAndStore() {
    activeInstall = await refreshHubSpotAccessToken({
      config: session.config,
      install: activeInstall,
      env: options.env,
      fetchImpl: options.fetchImpl,
      sleepImpl: options.sleepImpl
    });
    activeInstallState = upsertInstallRecord(activeInstallState, activeInstall);
    tokenRefreshed = true;
  }

  if (needsAccessTokenRefresh(activeInstall, analysisTimestamp)) {
    await refreshAndStore();
  }

  async function requestWithRefresh(path, method = "GET", body) {
    return executeHubSpotRetryableRequest(async () => {
      let refreshedForThisRequest = false;

      for (;;) {
        try {
          return await hubSpotRequest({
            install: activeInstall,
            path,
            method,
            body,
            fetchImpl: options.fetchImpl
          });
        } catch (error) {
          if (error.statusCode === 401 && activeInstall.refreshToken && !refreshedForThisRequest) {
            await refreshAndStore();
            refreshedForThisRequest = true;
            continue;
          }

          throw error;
        }
      }
    }, {
      sleepImpl: options.sleepImpl
    });
  }

  return {
    config: session.config,
    analysisTimestamp,
    requestWithRefresh,
    getInstall() {
      return activeInstall;
    },
    getInstallState() {
      return activeInstallState;
    },
    getTokenRefreshed() {
      return tokenRefreshed;
    }
  };
}

function extractAssociationResults(payload) {
  return Array.isArray(payload && payload.results) ? payload.results : [];
}

function extractAssociationLabels(associationEntry) {
  return (Array.isArray(associationEntry.associationTypes) ? associationEntry.associationTypes : [])
    .map((item) => item.label || item.type || item.category || "")
    .filter(Boolean);
}

function isDecisionMakerLabel(label) {
  return /(decision|economic|buyer|approver|signer|budget)/i.test(label);
}

async function batchReadObjects({ install, objectType, ids, properties, fetchImpl, requestImpl }) {
  if (!Array.isArray(ids) || ids.length === 0) {
    return [];
  }

  const payload = requestImpl
    ? await requestImpl(
      `/crm/v3/objects/${objectType}/batch/read`,
      "POST",
      {
        inputs: ids.map((id) => ({ id: String(id) })),
        properties
      }
    )
    : await hubSpotRequest({
      install,
      path: `/crm/v3/objects/${objectType}/batch/read`,
      method: "POST",
      body: {
        inputs: ids.map((id) => ({ id: String(id) })),
        properties
      },
      fetchImpl
    });

  return Array.isArray(payload.results) ? payload.results : [];
}

function normalizeContacts(records, associationEntries) {
  const labelMap = new Map(
    associationEntries.map((entry) => [String(entry.toObjectId), extractAssociationLabels(entry)])
  );

  return records.map((record) => {
    const properties = record.properties || {};
    const labels = labelMap.get(String(record.id)) || [];
    const firstName = properties.firstname || "";
    const lastName = properties.lastname || "";
    const name = `${firstName} ${lastName}`.trim() || properties.email || `Contact ${record.id}`;

    return {
      id: String(record.id),
      name,
      email: properties.email || null,
      decisionMaker: labels.some(isDecisionMakerLabel),
      associationLabels: labels
    };
  });
}

function normalizeCompanies(records) {
  return records.map((record) => ({
    id: String(record.id),
    name: record.properties && record.properties.name ? record.properties.name : `Company ${record.id}`
  }));
}

function normalizeTasks(records, referenceTimestamp) {
  return records.map((record) => {
    const properties = record.properties || {};
    const dueAt = properties.hs_timestamp || null;
    const status = properties.hs_task_status || "UNKNOWN";
    const subject = properties.hs_task_subject || `Task ${record.id}`;
    const isFutureOpen = Boolean(
      dueAt
      && status !== "COMPLETED"
      && new Date(dueAt).getTime() >= new Date(referenceTimestamp).getTime()
    );
    const isOpen = status !== "COMPLETED";
    const isRescueTask = /^Pipeline Rescue \|/i.test(subject);

    return {
      id: String(record.id),
      subject,
      status,
      dueAt,
      body: properties.hs_task_body || null,
      isFutureOpen,
      isOpen,
      isRescueTask
    };
  });
}

function findOpenRescueTask(tasks) {
  return (Array.isArray(tasks) ? tasks : []).find((task) => task.isRescueTask && task.isOpen) || null;
}

function extractDraftSubjectFromNoteBody(body) {
  if (typeof body !== "string") {
    return null;
  }

  const subjectMatch = body.match(/(?:^|\n)Subject:\s*(.+?)(?:\n|$)/i);
  return subjectMatch ? subjectMatch[1].trim() : null;
}

function normalizeNotes(records) {
  return records.map((record) => {
    const properties = record.properties || {};
    const body = properties.hs_note_body || null;
    const noteAt = properties.hs_timestamp || null;
    const isRescueNote = typeof body === "string" && /Pipeline Rescue follow-up draft/i.test(body);

    return {
      id: String(record.id),
      body,
      noteAt,
      ownerId: properties.hubspot_owner_id ? String(properties.hubspot_owner_id) : null,
      isRescueNote,
      draftSubject: extractDraftSubjectFromNoteBody(body)
    };
  });
}

function findMatchingRescueNote(notes, draftSubject) {
  const normalizedSubject = String(draftSubject || "").trim().toLowerCase();
  if (!normalizedSubject) {
    return null;
  }

  return (Array.isArray(notes) ? notes : []).find((note) => (
    note.isRescueNote
    && String(note.draftSubject || "").trim().toLowerCase() === normalizedSubject
  )) || null;
}

function formatOwnerDisplayName(ownerRecord, ownerId) {
  if (!ownerRecord) {
    return ownerId ? `Owner ${ownerId}` : "Unassigned";
  }

  const firstName = String(ownerRecord.firstName || "").trim();
  const lastName = String(ownerRecord.lastName || "").trim();
  const fullName = `${firstName} ${lastName}`.trim();
  if (fullName) {
    return fullName;
  }

  if (ownerRecord.email) {
    return String(ownerRecord.email).trim();
  }

  return ownerId ? `Owner ${ownerId}` : "Unassigned";
}

async function loadOwnerRecord(liveSession, ownerId) {
  if (!ownerId) {
    return {
      ownerRecord: null,
      warning: null
    };
  }

  try {
    const ownerRecord = await liveSession.requestWithRefresh(`/crm/v3/owners/${encodeURIComponent(ownerId)}`);
    return {
      ownerRecord,
      warning: null
    };
  } catch (error) {
    if (error.statusCode === 404) {
      try {
        const ownerRecord = await liveSession.requestWithRefresh(`/crm/v3/owners/${encodeURIComponent(ownerId)}?archived=true`);
        return {
          ownerRecord,
          warning: null
        };
      } catch (archivedError) {
        return {
          ownerRecord: null,
          warning: `HubSpot owner ${ownerId} could not be resolved from the Owners API.`
        };
      }
    }

    if (error.statusCode === 403) {
      return {
        ownerRecord: null,
        warning: `HubSpot owner ${ownerId} could not be resolved because the token lacks owner-read access.`
      };
    }

    return {
      ownerRecord: null,
      warning: `HubSpot owner ${ownerId} resolution failed: ${error.detail || error.message}.`
    };
  }
}

function buildNormalizedDeal({
  dealRecord,
  contacts,
  companies,
  tasks,
  notes,
  analysisTimestamp,
  ownerRecord,
  ownerLookupWarning,
  noteLookupWarning
}) {
  const properties = dealRecord.properties || {};
  const stageId = properties.dealstage || null;
  const amount = toNumber(properties.amount);
  const createdTimestamp = properties.createdate || dealRecord.createdAt || null;
  const lastActivityTimestamp = properties.hs_lastactivitydate || null;
  const ownerId = properties.hubspot_owner_id ? String(properties.hubspot_owner_id) : null;
  const companyName = companies[0] ? companies[0].name : "Unknown company";
  const normalizationWarnings = [];

  const stageAgeDays = daysSince(createdTimestamp, analysisTimestamp);
  if (!properties[`hs_date_entered_${stageId || ""}`] && stageAgeDays != null) {
    normalizationWarnings.push("Stage age is estimated from the deal creation timestamp because stage-entry history was not available.");
  }

  const lastActivityAgeDays = daysSince(
    lastActivityTimestamp || dealRecord.updatedAt || createdTimestamp,
    analysisTimestamp
  );
  if (!lastActivityTimestamp) {
    normalizationWarnings.push("Last activity age is estimated from the last modified timestamp because hs_lastactivitydate was not available.");
  }

  const hasFutureTask = tasks.some((task) => task.isFutureOpen);
  if (contacts.length === 0) {
    normalizationWarnings.push("No associated contacts were returned for this deal.");
  }
  if (!ownerId) {
    normalizationWarnings.push("HubSpot owner ID is missing, so owner display is synthetic.");
  } else if (ownerLookupWarning) {
    normalizationWarnings.push(ownerLookupWarning);
  }
  const existingRescueTask = findOpenRescueTask(tasks);
  if (existingRescueTask) {
    normalizationWarnings.push(`An open Pipeline Rescue task already exists on this deal (${existingRescueTask.id}).`);
  }
  if (noteLookupWarning) {
    normalizationWarnings.push(noteLookupWarning);
  }
  const existingRescueNote = (Array.isArray(notes) ? notes : []).find((note) => note.isRescueNote) || null;
  if (existingRescueNote) {
    normalizationWarnings.push(`A Pipeline Rescue note already exists on this deal (${existingRescueNote.id}).`);
  }

  const closedWon = toBoolean(properties.hs_is_closed_won) === true || /won/i.test(stageId || "");
  const closedLost = toBoolean(properties.hs_is_closed_lost) === true || /lost/i.test(stageId || "");

  return {
    id: String(dealRecord.id),
    name: properties.dealname || `HubSpot deal ${dealRecord.id}`,
    company: companyName,
    owner: {
      id: ownerId || `owner-${dealRecord.id}`,
      name: formatOwnerDisplayName(ownerRecord, ownerId)
    },
    pipelineId: properties.pipeline || "default",
    stageId,
    stageAgeDays,
    amount,
    closeDate: properties.closedate ? String(properties.closedate).slice(0, 10) : null,
    archived: Boolean(dealRecord.archived),
    closedState: closedWon ? "WON" : closedLost ? "LOST" : "OPEN",
    lastActivityAgeDays,
    hasNextStep: Boolean(String(properties.hs_next_step || "").trim()),
    hasFutureTask,
    hasOpenRescueTask: Boolean(existingRescueTask),
    hasRescueNote: Boolean(existingRescueNote),
    contacts: contacts.map((contact) => ({
      id: contact.id,
      name: contact.name,
      email: contact.email,
      decisionMaker: contact.decisionMaker
    })),
    engagedRescue: false,
    normalizationWarnings
  };
}

function buildPreviewPayload({ liveSession, dealId, dealRecord, normalizedDeal, companies, contacts, tasks, notes }) {
  const activeInstall = liveSession.getInstall();

  return {
    source: {
      mode: "HUBSPOT_LIVE",
      portalId: activeInstall.portalId,
      hubDomain: activeInstall.hubDomain || null,
      dealId,
      fetchedAt: liveSession.analysisTimestamp,
      tokenRefreshed: liveSession.getTokenRefreshed()
    },
    normalizedDeal,
    normalizationWarnings: normalizedDeal.normalizationWarnings,
    graph: {
      deal: {
        id: String(dealRecord.id),
        properties: dealRecord.properties || {},
        createdAt: dealRecord.createdAt || null,
        updatedAt: dealRecord.updatedAt || null,
        archived: Boolean(dealRecord.archived)
      },
      companies,
      contacts,
      tasks,
      notes
    },
    scenario: {
      portalName: activeInstall.hubDomain ? `HubSpot ${activeInstall.hubDomain}` : `HubSpot portal ${activeInstall.portalId}`,
      scenarioLabel: `HubSpot live preview: ${normalizedDeal.name}`,
      scenarioDescription: "Live CRM preview normalized into the deterministic rescue engine.",
      guardrailHint: normalizedDeal.normalizationWarnings.length > 0
        ? `Live preview uses ${normalizedDeal.normalizationWarnings.length} normalization warning(s).`
        : "Live preview is grounded on fetched HubSpot CRM fields.",
      analysisTimestamp: liveSession.analysisTimestamp,
      focusDealId: normalizedDeal.id,
      deals: [normalizedDeal]
    },
    installState: liveSession.getInstallState()
  };
}

function normalizeTaskType(actionType) {
  if (actionType === "FOLLOW_UP_EMAIL") {
    return "EMAIL";
  }

  if (actionType === "ESCALATE_MANAGER_REVIEW") {
    return "CALL";
  }

  return "TODO";
}

function normalizeTaskPriority(priority) {
  if (priority === "LOW" || priority === "MEDIUM" || priority === "HIGH") {
    return priority;
  }

  return "HIGH";
}

function createTaskDueAt(referenceTimestamp) {
  const reference = new Date(referenceTimestamp || Date.now());
  return new Date(reference.getTime() + (24 * 60 * 60 * 1000)).toISOString();
}

function createNoteTimestamp(referenceTimestamp) {
  return new Date(referenceTimestamp || Date.now()).toISOString();
}

function buildTaskAssociations(preview) {
  const associations = [];

  if (preview.graph && preview.graph.deal && preview.graph.deal.id) {
    associations.push({
      to: { id: String(preview.graph.deal.id) },
      types: [
        {
          associationCategory: "HUBSPOT_DEFINED",
          associationTypeId: HUBSPOT_ASSOCIATION_TYPE_IDS.TASK_TO_DEAL
        }
      ]
    });
  }

  for (const company of preview.graph?.companies || []) {
    associations.push({
      to: { id: String(company.id) },
      types: [
        {
          associationCategory: "HUBSPOT_DEFINED",
          associationTypeId: HUBSPOT_ASSOCIATION_TYPE_IDS.TASK_TO_COMPANY
        }
      ]
    });
  }

  for (const contact of preview.graph?.contacts || []) {
    associations.push({
      to: { id: String(contact.id) },
      types: [
        {
          associationCategory: "HUBSPOT_DEFINED",
          associationTypeId: HUBSPOT_ASSOCIATION_TYPE_IDS.TASK_TO_CONTACT
        }
      ]
    });
  }

  return associations;
}

function buildNoteAssociations(preview) {
  const associations = [];

  if (preview.graph && preview.graph.deal && preview.graph.deal.id) {
    associations.push({
      to: { id: String(preview.graph.deal.id) },
      types: [
        {
          associationCategory: "HUBSPOT_DEFINED",
          associationTypeId: HUBSPOT_ASSOCIATION_TYPE_IDS.NOTE_TO_DEAL
        }
      ]
    });
  }

  for (const company of preview.graph?.companies || []) {
    associations.push({
      to: { id: String(company.id) },
      types: [
        {
          associationCategory: "HUBSPOT_DEFINED",
          associationTypeId: HUBSPOT_ASSOCIATION_TYPE_IDS.NOTE_TO_COMPANY
        }
      ]
    });
  }

  for (const contact of preview.graph?.contacts || []) {
    associations.push({
      to: { id: String(contact.id) },
      types: [
        {
          associationCategory: "HUBSPOT_DEFINED",
          associationTypeId: HUBSPOT_ASSOCIATION_TYPE_IDS.NOTE_TO_CONTACT
        }
      ]
    });
  }

  return associations;
}

function buildHubSpotTaskPayload({ preview, analysis, dueAt }) {
  const analysisPayload = analysis && analysis.analysis ? analysis.analysis : null;
  const verification = analysis && analysis.verification ? analysis.verification : null;

  if (!analysisPayload || !verification) {
    throw createHubSpotClientError("A validated live analysis is required before writing a HubSpot task.", 500);
  }

  if (analysisPayload.eligibility !== "ELIGIBLE" || verification.validationStatus === "UNVERIFIED") {
    throw createHubSpotClientError(
      "HubSpot task creation is blocked because the live analysis is not trusted enough.",
      409
    );
  }

  if (!analysisPayload.recommendedAction || !analysisPayload.recommendedAction.summary) {
    throw createHubSpotClientError("HubSpot task creation is blocked because no recommended action is available.", 409);
  }

  const existingRescueTask = findOpenRescueTask(preview.graph?.tasks || []);
  if (existingRescueTask) {
    throw createHubSpotClientError(
      "HubSpot task creation is blocked because an open Pipeline Rescue task already exists on this deal.",
      409,
      `Existing rescue task ${existingRescueTask.id}: ${existingRescueTask.subject}`
    );
  }

  const topReason = analysisPayload.reasons && analysisPayload.reasons[0] ? analysisPayload.reasons[0] : null;
  const subject = `Pipeline Rescue | ${analysisPayload.dealName}`;
  const bodyLines = [
    `Recommended action: ${analysisPayload.recommendedAction.summary}`,
    `Risk level: ${analysisPayload.riskLevel || "UNKNOWN"}`,
    typeof analysisPayload.rescueScore === "number" ? `Rescue score: ${analysisPayload.rescueScore}` : null,
    topReason ? `Top reason: ${topReason.label} - ${topReason.evidence}` : null,
    `Verification status: ${verification.validationStatus}`
  ].filter(Boolean);

  const ownerId = preview.normalizedDeal && /^\d+$/.test(String(preview.normalizedDeal.owner?.id || ""))
    ? String(preview.normalizedDeal.owner.id)
    : null;

  return {
    properties: {
      hs_timestamp: dueAt || createTaskDueAt(preview.source?.fetchedAt),
      hs_task_body: bodyLines.join("\n"),
      hs_task_subject: subject,
      hs_task_status: "NOT_STARTED",
      hs_task_priority: normalizeTaskPriority(analysisPayload.recommendedAction.priority),
      hs_task_type: normalizeTaskType(analysisPayload.recommendedAction.type),
      ...(ownerId ? { hubspot_owner_id: ownerId } : {})
    },
    associations: buildTaskAssociations(preview)
  };
}

async function loadHubSpotDealData(options) {
  const liveSession = await createLiveRequestSession(options);
  const dealId = String(options.dealId || "").trim();
  if (!dealId) {
    throw createHubSpotClientError("A HubSpot deal ID is required for live preview.", 400);
  }

  const dealRecord = await liveSession.requestWithRefresh(
    `/crm/v3/objects/deals/${encodeURIComponent(dealId)}?properties=${encodeURIComponent([
      "dealname",
      "amount",
      "closedate",
      "dealstage",
      "pipeline",
      "hubspot_owner_id",
      "hs_next_step",
      "hs_lastactivitydate",
      "hs_is_closed_won",
      "hs_is_closed_lost",
      "createdate"
    ].join(","))}`
  );
  const ownerId = dealRecord.properties && dealRecord.properties.hubspot_owner_id
    ? String(dealRecord.properties.hubspot_owner_id)
    : null;

  const [ownerResolution, contactAssociations, companyAssociations, taskAssociations] = await Promise.all([
    loadOwnerRecord(liveSession, ownerId),
    liveSession.requestWithRefresh(`/crm/v4/objects/deals/${encodeURIComponent(dealId)}/associations/contacts`),
    liveSession.requestWithRefresh(`/crm/v4/objects/deals/${encodeURIComponent(dealId)}/associations/companies`),
    liveSession.requestWithRefresh(`/crm/v4/objects/deals/${encodeURIComponent(dealId)}/associations/tasks`)
  ]);

  let noteAssociations = { results: [] };
  let noteLookupWarning = null;
  try {
    noteAssociations = await liveSession.requestWithRefresh(`/crm/v4/objects/deals/${encodeURIComponent(dealId)}/associations/notes`);
  } catch (error) {
    if (error.statusCode === 403) {
      noteLookupWarning = "HubSpot notes could not be loaded because the token lacks note-read access.";
    } else if (error.statusCode === 404) {
      noteLookupWarning = "HubSpot notes association lookup is unavailable for this portal.";
    } else {
      throw error;
    }
  }

  const contactIds = extractAssociationResults(contactAssociations).map((entry) => String(entry.toObjectId));
  const companyIds = extractAssociationResults(companyAssociations).map((entry) => String(entry.toObjectId));
  const taskIds = extractAssociationResults(taskAssociations).map((entry) => String(entry.toObjectId));
  const noteIds = extractAssociationResults(noteAssociations).map((entry) => String(entry.toObjectId));

  const [contactRecords, companyRecords, taskRecords, noteRecords] = await Promise.all([
    batchReadObjects({
      install: liveSession.getInstall(),
      objectType: "contacts",
      ids: contactIds,
      properties: ["firstname", "lastname", "email"],
      fetchImpl: options.fetchImpl,
      requestImpl: liveSession.requestWithRefresh
    }),
    batchReadObjects({
      install: liveSession.getInstall(),
      objectType: "companies",
      ids: companyIds,
      properties: ["name"],
      fetchImpl: options.fetchImpl,
      requestImpl: liveSession.requestWithRefresh
    }),
    batchReadObjects({
      install: liveSession.getInstall(),
      objectType: "tasks",
      ids: taskIds,
      properties: ["hs_task_subject", "hs_task_status", "hs_timestamp", "hs_task_body"],
      fetchImpl: options.fetchImpl,
      requestImpl: liveSession.requestWithRefresh
    }),
    batchReadObjects({
      install: liveSession.getInstall(),
      objectType: "notes",
      ids: noteIds,
      properties: ["hs_note_body", "hs_timestamp", "hubspot_owner_id"],
      fetchImpl: options.fetchImpl,
      requestImpl: liveSession.requestWithRefresh
    })
  ]);

  const contacts = normalizeContacts(contactRecords, extractAssociationResults(contactAssociations));
  const companies = normalizeCompanies(companyRecords);
  const tasks = normalizeTasks(taskRecords, liveSession.analysisTimestamp);
  const notes = normalizeNotes(noteRecords);
  const normalizedDeal = buildNormalizedDeal({
    dealRecord,
    contacts,
    companies,
    tasks,
    notes,
    analysisTimestamp: liveSession.analysisTimestamp,
    ownerRecord: ownerResolution.ownerRecord,
    ownerLookupWarning: ownerResolution.warning,
    noteLookupWarning
  });

  return {
    liveSession,
    dealId,
    dealRecord,
    contacts,
    companies,
    tasks,
    notes,
    normalizedDeal
  };
}

async function loadHubSpotDealPreview(options) {
  const liveData = await loadHubSpotDealData(options);

  return buildPreviewPayload({
    liveSession: liveData.liveSession,
    dealId: liveData.dealId,
    dealRecord: liveData.dealRecord,
    normalizedDeal: liveData.normalizedDeal,
    companies: liveData.companies,
    contacts: liveData.contacts,
    tasks: liveData.tasks,
    notes: liveData.notes
  });
}

async function searchHubSpotDeals(options) {
  const liveSession = await createLiveRequestSession(options);
  const criteria = options.criteria || {};
  const searchRequest = buildHubSpotDealSearchRequest(criteria, liveSession.analysisTimestamp);
  const searchResult = await liveSession.requestWithRefresh(
    "/crm/v3/objects/deals/search",
    "POST",
    searchRequest
  );
  const dealIds = Array.from(new Set(
    (Array.isArray(searchResult && searchResult.results) ? searchResult.results : [])
      .map((item) => String(item && item.id ? item.id : "").trim())
      .filter(Boolean)
  ));

  return {
    criteria,
    searchRequest,
    dealIds,
    source: {
      portalId: String(liveSession.getInstall().portalId),
      hubDomain: liveSession.getInstall().hubDomain || null,
      fetchedAt: liveSession.analysisTimestamp,
      tokenRefreshed: liveSession.getTokenRefreshed(),
      dealCount: dealIds.length
    },
    installState: liveSession.getInstallState()
  };
}

async function createHubSpotRescueTask(options) {
  const liveSession = await createLiveRequestSession(options);
  const preview = options.preview;
  if (!preview || !preview.graph || !preview.graph.deal || !preview.graph.deal.id) {
    throw createHubSpotClientError("A live HubSpot preview is required before creating a HubSpot task.", 500);
  }

  const payload = buildHubSpotTaskPayload({
    preview,
    analysis: options.analysis,
    dueAt: options.dueAt || null
  });

  const result = await liveSession.requestWithRefresh("/crm/v3/objects/tasks", "POST", payload);
  const properties = result.properties || payload.properties;

  return {
    source: {
      portalId: liveSession.getInstall().portalId,
      hubDomain: liveSession.getInstall().hubDomain || null,
      tokenRefreshed: liveSession.getTokenRefreshed(),
      writtenAt: new Date().toISOString()
    },
    task: {
      taskId: String(result.id),
      subject: properties.hs_task_subject || payload.properties.hs_task_subject,
      status: properties.hs_task_status || payload.properties.hs_task_status,
      dueAt: properties.hs_timestamp || payload.properties.hs_timestamp,
      body: properties.hs_task_body || payload.properties.hs_task_body,
      ownerId: properties.hubspot_owner_id || payload.properties.hubspot_owner_id || null,
      taskType: properties.hs_task_type || payload.properties.hs_task_type,
      priority: properties.hs_task_priority || payload.properties.hs_task_priority,
      associatedDealId: preview.graph.deal.id,
      associatedCompanyCount: (preview.graph.companies || []).length,
      associatedContactCount: (preview.graph.contacts || []).length
    },
    installState: liveSession.getInstallState()
  };
}

function buildHubSpotNotePayload({ preview, analysis, draftResult, noteAt }) {
  const analysisPayload = analysis && analysis.analysis ? analysis.analysis : null;
  const verification = analysis && analysis.verification ? analysis.verification : null;
  const draft = draftResult && draftResult.draft ? draftResult.draft : null;

  if (!analysisPayload || !verification) {
    throw createHubSpotClientError("A validated live analysis is required before writing a HubSpot note.", 500);
  }

  if (!draft || typeof draft.subject !== "string" || typeof draft.body !== "string") {
    throw createHubSpotClientError("A usable draft is required before writing a HubSpot note.", 409);
  }

  const existingRescueNote = findMatchingRescueNote(preview.graph?.notes || [], draft.subject);
  if (existingRescueNote) {
    throw createHubSpotClientError(
      "HubSpot note creation is blocked because an equivalent Pipeline Rescue note already exists on this deal.",
      409,
      `Existing rescue note ${existingRescueNote.id}: ${existingRescueNote.draftSubject || draft.subject}`
    );
  }

  const ownerId = preview.normalizedDeal && /^\d+$/.test(String(preview.normalizedDeal.owner?.id || ""))
    ? String(preview.normalizedDeal.owner.id)
    : null;

  const bodyLines = [
    "<strong>Pipeline Rescue follow-up draft</strong>",
    `Draft mode: ${draftResult.mode || "UNKNOWN"}`,
    `Verification status: ${verification.validationStatus}`,
    typeof analysisPayload.rescueScore === "number" ? `Rescue score: ${analysisPayload.rescueScore}` : null,
    `Subject: ${draft.subject}`,
    "",
    draft.body
  ].filter((item) => item != null);

  return {
    properties: {
      hs_timestamp: noteAt || createNoteTimestamp(preview.source?.fetchedAt),
      hs_note_body: bodyLines.join("\n"),
      ...(ownerId ? { hubspot_owner_id: ownerId } : {})
    },
    associations: buildNoteAssociations(preview)
  };
}

async function createHubSpotDraftNote(options) {
  const liveSession = await createLiveRequestSession(options);
  const preview = options.preview;
  if (!preview || !preview.graph || !preview.graph.deal || !preview.graph.deal.id) {
    throw createHubSpotClientError("A live HubSpot preview is required before creating a HubSpot note.", 500);
  }

  const payload = buildHubSpotNotePayload({
    preview,
    analysis: options.analysis,
    draftResult: options.draftResult,
    noteAt: options.noteAt || null
  });

  const result = await liveSession.requestWithRefresh("/crm/v3/objects/notes", "POST", payload);
  const properties = result.properties || payload.properties;

  return {
    source: {
      portalId: liveSession.getInstall().portalId,
      hubDomain: liveSession.getInstall().hubDomain || null,
      tokenRefreshed: liveSession.getTokenRefreshed(),
      writtenAt: new Date().toISOString()
    },
    note: {
      noteId: String(result.id),
      body: properties.hs_note_body || payload.properties.hs_note_body,
      ownerId: properties.hubspot_owner_id || payload.properties.hubspot_owner_id || null,
      associatedDealId: preview.graph.deal.id,
      associatedCompanyCount: (preview.graph.companies || []).length,
      associatedContactCount: (preview.graph.contacts || []).length
    },
    installState: liveSession.getInstallState()
  };
}

module.exports = {
  createHubSpotDraftNote,
  createHubSpotRescueTask,
  loadHubSpotDealPreview,
  searchHubSpotDeals
};
