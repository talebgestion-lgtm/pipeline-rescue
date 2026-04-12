function createSearchError(message, statusCode = 400) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

function validateLiveSearchPayload(payload) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    throw createSearchError("Live search body must be a JSON object.");
  }

  const limit = Number(payload.limit ?? 5);
  const minimumLastActivityAgeDays = Number(payload.minimumLastActivityAgeDays ?? 7);
  if (!Number.isInteger(limit) || limit < 1 || limit > 25) {
    throw createSearchError("Live search limit must be an integer between 1 and 25.");
  }

  if (!Number.isInteger(minimumLastActivityAgeDays) || minimumLastActivityAgeDays < 0 || minimumLastActivityAgeDays > 365) {
    throw createSearchError("minimumLastActivityAgeDays must be an integer between 0 and 365.");
  }

  return {
    portalId: payload.portalId ? String(payload.portalId).trim() || null : null,
    pipelineId: payload.pipelineId ? String(payload.pipelineId).trim() || null : null,
    limit,
    minimumLastActivityAgeDays
  };
}

function buildHubSpotDealSearchRequest(criteria, referenceTimestamp) {
  const cutoff = new Date(new Date(referenceTimestamp).getTime() - (criteria.minimumLastActivityAgeDays * 24 * 60 * 60 * 1000));
  if (Number.isNaN(cutoff.getTime())) {
    throw createSearchError("A valid reference timestamp is required for live search.", 500);
  }

  const filters = [
    {
      propertyName: "hs_lastactivitydate",
      operator: "LT",
      value: String(cutoff.getTime())
    },
    {
      propertyName: "hs_is_closed_won",
      operator: "EQ",
      value: "false"
    },
    {
      propertyName: "hs_is_closed_lost",
      operator: "EQ",
      value: "false"
    }
  ];

  if (criteria.pipelineId) {
    filters.push({
      propertyName: "pipeline",
      operator: "EQ",
      value: criteria.pipelineId
    });
  }

  return {
    limit: criteria.limit,
    properties: [
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
    ],
    filterGroups: [
      {
        filters
      }
    ],
    sorts: ["-hs_lastactivitydate"]
  };
}

module.exports = {
  buildHubSpotDealSearchRequest,
  validateLiveSearchPayload
};
