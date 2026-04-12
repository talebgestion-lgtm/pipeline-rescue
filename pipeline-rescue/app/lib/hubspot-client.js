const {
  createHubSpotStatus,
  normalizeInstallState,
  validateHubSpotConfigPayload
} = require("./hubspot-oauth");

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
    throw createHubSpotClientError(
      `HubSpot request failed with status ${response.status}.`,
      response.status,
      payload && payload.message ? payload.message : null
    );
  }

  return payload;
}

async function refreshHubSpotAccessToken({ config, install, env = process.env, fetchImpl }) {
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

  const response = await getFetchImplementation({ fetchImpl })("https://api.hubapi.com/oauth/v1/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded;charset=utf-8"
    },
    body: body.toString()
  });

  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    throw createHubSpotClientError(
      `HubSpot token refresh failed with status ${response.status}.`,
      response.status,
      payload && payload.message ? payload.message : null
    );
  }

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
    const isFutureOpen = Boolean(
      dueAt
      && status !== "COMPLETED"
      && new Date(dueAt).getTime() >= new Date(referenceTimestamp).getTime()
    );

    return {
      id: String(record.id),
      subject: properties.hs_task_subject || `Task ${record.id}`,
      status,
      dueAt,
      body: properties.hs_task_body || null,
      isFutureOpen
    };
  });
}

function buildNormalizedDeal({ dealRecord, contacts, companies, tasks, analysisTimestamp }) {
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
  }

  const closedWon = toBoolean(properties.hs_is_closed_won) === true || /won/i.test(stageId || "");
  const closedLost = toBoolean(properties.hs_is_closed_lost) === true || /lost/i.test(stageId || "");

  return {
    id: String(dealRecord.id),
    name: properties.dealname || `HubSpot deal ${dealRecord.id}`,
    company: companyName,
    owner: {
      id: ownerId || `owner-${dealRecord.id}`,
      name: ownerId ? `Owner ${ownerId}` : "Unassigned"
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

async function loadHubSpotDealPreview(options) {
  const analysisTimestamp = options.analysisTimestamp || new Date().toISOString();
  const session = ensureHubSpotReady(options.config, options.installState, options.portalId, options.env);
  let activeInstall = session.install;
  let activeInstallState = session.installState;
  let tokenRefreshed = false;

  if (needsAccessTokenRefresh(activeInstall, analysisTimestamp)) {
    activeInstall = await refreshHubSpotAccessToken({
      config: session.config,
      install: activeInstall,
      env: options.env,
      fetchImpl: options.fetchImpl
    });
    activeInstallState = upsertInstallRecord(activeInstallState, activeInstall);
    tokenRefreshed = true;
  }

  async function requestWithRefresh(path, method, body) {
    try {
      return await hubSpotRequest({
        install: activeInstall,
        path,
        method,
        body,
        fetchImpl: options.fetchImpl
      });
    } catch (error) {
      if (error.statusCode === 401 && activeInstall.refreshToken) {
        activeInstall = await refreshHubSpotAccessToken({
          config: session.config,
          install: activeInstall,
          env: options.env,
          fetchImpl: options.fetchImpl
        });
        activeInstallState = upsertInstallRecord(activeInstallState, activeInstall);
        tokenRefreshed = true;

        return hubSpotRequest({
          install: activeInstall,
          path,
          method,
          body,
          fetchImpl: options.fetchImpl
        });
      }

      throw error;
    }
  }

  const dealId = String(options.dealId || "").trim();
  if (!dealId) {
    throw createHubSpotClientError("A HubSpot deal ID is required for live preview.", 400);
  }

  const dealRecord = await requestWithRefresh(
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

  const [contactAssociations, companyAssociations, taskAssociations] = await Promise.all([
    requestWithRefresh(`/crm/v4/objects/deals/${encodeURIComponent(dealId)}/associations/contacts`),
    requestWithRefresh(`/crm/v4/objects/deals/${encodeURIComponent(dealId)}/associations/companies`),
    requestWithRefresh(`/crm/v4/objects/deals/${encodeURIComponent(dealId)}/associations/tasks`)
  ]);

  const contactIds = extractAssociationResults(contactAssociations).map((entry) => String(entry.toObjectId));
  const companyIds = extractAssociationResults(companyAssociations).map((entry) => String(entry.toObjectId));
  const taskIds = extractAssociationResults(taskAssociations).map((entry) => String(entry.toObjectId));

  const [contactRecords, companyRecords, taskRecords] = await Promise.all([
    batchReadObjects({
      install: activeInstall,
      objectType: "contacts",
      ids: contactIds,
      properties: ["firstname", "lastname", "email"],
      fetchImpl: options.fetchImpl,
      requestImpl: requestWithRefresh
    }),
    batchReadObjects({
      install: activeInstall,
      objectType: "companies",
      ids: companyIds,
      properties: ["name"],
      fetchImpl: options.fetchImpl,
      requestImpl: requestWithRefresh
    }),
    batchReadObjects({
      install: activeInstall,
      objectType: "tasks",
      ids: taskIds,
      properties: ["hs_task_subject", "hs_task_status", "hs_timestamp", "hs_task_body"],
      fetchImpl: options.fetchImpl,
      requestImpl: requestWithRefresh
    })
  ]);

  const contacts = normalizeContacts(contactRecords, extractAssociationResults(contactAssociations));
  const companies = normalizeCompanies(companyRecords);
  const tasks = normalizeTasks(taskRecords, analysisTimestamp);
  const normalizedDeal = buildNormalizedDeal({
    dealRecord,
    contacts,
    companies,
    tasks,
    analysisTimestamp
  });

  return {
    source: {
      mode: "HUBSPOT_LIVE",
      portalId: activeInstall.portalId,
      hubDomain: activeInstall.hubDomain || null,
      dealId,
      fetchedAt: analysisTimestamp,
      tokenRefreshed
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
      tasks
    },
    scenario: {
      portalName: activeInstall.hubDomain ? `HubSpot ${activeInstall.hubDomain}` : `HubSpot portal ${activeInstall.portalId}`,
      scenarioLabel: `HubSpot live preview: ${normalizedDeal.name}`,
      scenarioDescription: "Live CRM preview normalized into the deterministic rescue engine.",
      guardrailHint: normalizedDeal.normalizationWarnings.length > 0
        ? `Live preview uses ${normalizedDeal.normalizationWarnings.length} normalization warning(s).`
        : "Live preview is grounded on fetched HubSpot CRM fields.",
      analysisTimestamp,
      focusDealId: normalizedDeal.id,
      deals: [normalizedDeal]
    },
    installState: activeInstallState
  };
}

module.exports = {
  loadHubSpotDealPreview
};
