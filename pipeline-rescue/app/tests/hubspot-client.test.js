const test = require("node:test");
const assert = require("node:assert/strict");
const {
  createHubSpotDraftNote,
  createHubSpotRescueTask,
  loadHubSpotDealPreview,
  searchHubSpotDeals
} = require("../lib/hubspot-client");

const validConfig = {
  enabled: true,
  clientId: "client_123",
  clientSecretEnvVar: "HUBSPOT_CLIENT_SECRET",
  redirectUri: "http://localhost:4179/api/hubspot/oauth/callback",
  scopes: ["oauth", "crm.objects.deals.read", "crm.objects.contacts.read", "crm.objects.tasks.read"],
  optionalScopes: [],
  preferredAccountId: null
};

function createJsonResponse(status, payload) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => payload
  };
}

test("loadHubSpotDealPreview normalizes a live HubSpot deal graph", async () => {
  const installState = {
    installs: [
      {
        portalId: "123456",
        hubDomain: "demo.hubspot.com",
        accessToken: "access_token",
        refreshToken: "refresh_token",
        connectedAt: "2026-04-12T08:00:00Z"
      }
    ]
  };

  const preview = await loadHubSpotDealPreview({
    config: validConfig,
    installState,
    dealId: "987",
    portalId: "123456",
    analysisTimestamp: "2026-04-12T10:00:00Z",
    env: {
      HUBSPOT_CLIENT_SECRET: "secret"
    },
    fetchImpl: async (url, options = {}) => {
      const parsedUrl = new URL(url);

      if (options.method === "GET" && parsedUrl.pathname === "/crm/v3/objects/deals/987") {
        return createJsonResponse(200, {
          id: "987",
          createdAt: "2026-03-01T10:00:00Z",
          updatedAt: "2026-04-10T10:00:00Z",
          archived: false,
          properties: {
            dealname: "Acme Expansion",
            amount: "48000",
            closedate: "2026-05-10",
            dealstage: "proposal",
            pipeline: "default",
            hubspot_owner_id: "44",
            hs_next_step: "Confirm legal review",
            hs_lastactivitydate: "2026-03-24T10:00:00Z"
          }
        });
      }

      if (options.method === "GET" && parsedUrl.pathname === "/crm/v3/owners/44") {
        return createJsonResponse(200, {
          id: "44",
          email: "owner@demo.hubspot.com",
          firstName: "Maya",
          lastName: "Manager",
          archived: false
        });
      }

      if (options.method === "GET" && parsedUrl.pathname === "/crm/v4/objects/deals/987/associations/contacts") {
        return createJsonResponse(200, {
          results: [
            {
              toObjectId: 201,
              associationTypes: [
                {
                  label: "Decision maker"
                }
              ]
            }
          ]
        });
      }

      if (options.method === "GET" && parsedUrl.pathname === "/crm/v4/objects/deals/987/associations/companies") {
        return createJsonResponse(200, {
          results: [
            {
              toObjectId: 301,
              associationTypes: []
            }
          ]
        });
      }

      if (options.method === "GET" && parsedUrl.pathname === "/crm/v4/objects/deals/987/associations/tasks") {
        return createJsonResponse(200, {
          results: [
            {
              toObjectId: 401,
              associationTypes: []
            }
          ]
        });
      }

      if (options.method === "POST" && parsedUrl.pathname === "/crm/v3/objects/contacts/batch/read") {
        return createJsonResponse(200, {
          results: [
            {
              id: "201",
              properties: {
                firstname: "Maya",
                lastname: "Brooks",
                email: "maya@acme.example"
              }
            }
          ]
        });
      }

      if (options.method === "POST" && parsedUrl.pathname === "/crm/v3/objects/companies/batch/read") {
        return createJsonResponse(200, {
          results: [
            {
              id: "301",
              properties: {
                name: "Acme"
              }
            }
          ]
        });
      }

      if (options.method === "POST" && parsedUrl.pathname === "/crm/v3/objects/tasks/batch/read") {
        return createJsonResponse(200, {
          results: [
            {
              id: "401",
              properties: {
                hs_task_subject: "Schedule review",
                hs_task_status: "NOT_STARTED",
                hs_timestamp: "2026-04-14T10:00:00Z",
                hs_task_body: "Call the buyer"
              }
            }
          ]
        });
      }

      throw new Error(`Unexpected request: ${options.method || "GET"} ${parsedUrl.pathname}`);
    }
  });

  assert.equal(preview.source.portalId, "123456");
  assert.equal(preview.normalizedDeal.name, "Acme Expansion");
  assert.equal(preview.normalizedDeal.company, "Acme");
  assert.equal(preview.normalizedDeal.owner.name, "Maya Manager");
  assert.equal(preview.normalizedDeal.contacts[0].decisionMaker, true);
  assert.equal(preview.normalizedDeal.hasFutureTask, true);
  assert.equal(preview.normalizedDeal.lastActivityAgeDays, 19);
  assert.match(preview.scenario.guardrailHint, /normalization warning/i);
});

test("loadHubSpotDealPreview requires portal selection when multiple installs are stored", async () => {
  await assert.rejects(
    () => loadHubSpotDealPreview({
      config: validConfig,
      installState: {
        installs: [
          { portalId: "1", accessToken: "a", refreshToken: "r1", connectedAt: "2026-04-12T08:00:00Z" },
          { portalId: "2", accessToken: "b", refreshToken: "r2", connectedAt: "2026-04-12T08:10:00Z" }
        ]
      },
      dealId: "987",
      env: {
        HUBSPOT_CLIENT_SECRET: "secret"
      },
      fetchImpl: async () => createJsonResponse(200, {})
    }),
    /Multiple HubSpot installs/
  );
});

test("loadHubSpotDealPreview refreshes the access token when the stored token is expired", async () => {
  const installState = {
    installs: [
      {
        portalId: "123456",
        hubDomain: "demo.hubspot.com",
        accessToken: "expired_token",
        refreshToken: "refresh_token",
        expiresAt: "2026-04-12T09:59:00Z",
        connectedAt: "2026-04-12T08:00:00Z"
      }
    ]
  };

  let refreshed = false;
  const preview = await loadHubSpotDealPreview({
    config: validConfig,
    installState,
    dealId: "987",
    portalId: "123456",
    analysisTimestamp: "2026-04-12T10:00:00Z",
    env: {
      HUBSPOT_CLIENT_SECRET: "secret"
    },
    fetchImpl: async (url, options = {}) => {
      const parsedUrl = new URL(url);

      if (options.method === "POST" && parsedUrl.pathname === "/oauth/v1/token") {
        refreshed = true;
        return createJsonResponse(200, {
          access_token: "fresh_token",
          refresh_token: "fresh_refresh_token",
          expires_in: 1800,
          token_type: "bearer"
        });
      }

      if (options.method === "GET" && parsedUrl.pathname === "/crm/v3/objects/deals/987") {
        assert.equal(options.headers.Authorization, "Bearer fresh_token");
        return createJsonResponse(200, {
          id: "987",
          createdAt: "2026-03-01T10:00:00Z",
          updatedAt: "2026-04-10T10:00:00Z",
          archived: false,
          properties: {
            dealname: "Acme Expansion",
            amount: "48000",
            closedate: "2026-05-10",
            dealstage: "proposal",
            pipeline: "default",
            hubspot_owner_id: "44",
            hs_lastactivitydate: "2026-03-24T10:00:00Z"
          }
        });
      }

      if (options.method === "GET" && parsedUrl.pathname === "/crm/v3/owners/44") {
        return createJsonResponse(200, {
          id: "44",
          email: "owner@demo.hubspot.com",
          firstName: "Fresh",
          lastName: "Owner",
          archived: false
        });
      }

      if (options.method === "GET" && parsedUrl.pathname.startsWith("/crm/v4/objects/deals/987/associations/")) {
        return createJsonResponse(200, { results: [] });
      }

      if (options.method === "POST" && /\/crm\/v3\/objects\/(contacts|companies|tasks)\/batch\/read$/.test(parsedUrl.pathname)) {
        return createJsonResponse(200, { results: [] });
      }

      throw new Error(`Unexpected request: ${options.method || "GET"} ${parsedUrl.pathname}`);
    }
  });

  assert.equal(refreshed, true);
  assert.equal(preview.source.tokenRefreshed, true);
  assert.equal(preview.installState.installs[0].accessToken, "fresh_token");
  assert.equal(preview.normalizedDeal.owner.name, "Fresh Owner");
});

test("loadHubSpotDealPreview falls back to synthetic owner when owner lookup is forbidden", async () => {
  const preview = await loadHubSpotDealPreview({
    config: validConfig,
    installState: {
      installs: [
        {
          portalId: "123456",
          hubDomain: "demo.hubspot.com",
          accessToken: "access_token",
          refreshToken: "refresh_token",
          connectedAt: "2026-04-12T08:00:00Z"
        }
      ]
    },
    dealId: "987",
    portalId: "123456",
    analysisTimestamp: "2026-04-12T10:00:00Z",
    env: {
      HUBSPOT_CLIENT_SECRET: "secret"
    },
    fetchImpl: async (url, options = {}) => {
      const parsedUrl = new URL(url);

      if (options.method === "GET" && parsedUrl.pathname === "/crm/v3/objects/deals/987") {
        return createJsonResponse(200, {
          id: "987",
          createdAt: "2026-03-01T10:00:00Z",
          updatedAt: "2026-04-10T10:00:00Z",
          archived: false,
          properties: {
            dealname: "Acme Expansion",
            amount: "48000",
            closedate: "2026-05-10",
            dealstage: "proposal",
            pipeline: "default",
            hubspot_owner_id: "44",
            hs_lastactivitydate: "2026-03-24T10:00:00Z"
          }
        });
      }

      if (options.method === "GET" && parsedUrl.pathname === "/crm/v3/owners/44") {
        return {
          ok: false,
          status: 403,
          json: async () => ({ message: "forbidden owner scope" })
        };
      }

      if (options.method === "GET" && parsedUrl.pathname.startsWith("/crm/v4/objects/deals/987/associations/")) {
        return createJsonResponse(200, { results: [] });
      }

      if (options.method === "POST" && /\/crm\/v3\/objects\/(contacts|companies|tasks)\/batch\/read$/.test(parsedUrl.pathname)) {
        return createJsonResponse(200, { results: [] });
      }

      throw new Error(`Unexpected request: ${options.method || "GET"} ${parsedUrl.pathname}`);
    }
  });

  assert.equal(preview.normalizedDeal.owner.name, "Owner 44");
  assert.match(
    preview.normalizationWarnings.join(" "),
    /lacks owner-read access/
  );
});

test("searchHubSpotDeals posts deterministic CRM criteria and returns discovered IDs", async () => {
  const result = await searchHubSpotDeals({
    config: validConfig,
    installState: {
      installs: [
        {
          portalId: "123456",
          hubDomain: "demo.hubspot.com",
          accessToken: "access_token",
          refreshToken: "refresh_token",
          connectedAt: "2026-04-12T08:00:00Z"
        }
      ]
    },
    portalId: "123456",
    analysisTimestamp: "2026-04-12T10:00:00Z",
    criteria: {
      portalId: "123456",
      pipelineId: "default",
      minimumLastActivityAgeDays: 7,
      limit: 3
    },
    env: { HUBSPOT_CLIENT_SECRET: "secret" },
    fetchImpl: async (url, options = {}) => {
      const parsedUrl = new URL(url);

      if (options.method === "POST" && parsedUrl.pathname === "/crm/v3/objects/deals/search") {
        const body = JSON.parse(options.body);
        assert.equal(body.limit, 3);
        assert.equal(body.filterGroups[0].filters[0].propertyName, "hs_lastactivitydate");
        assert.equal(body.filterGroups[0].filters[0].operator, "LT");
        assert.equal(body.filterGroups[0].filters[3].propertyName, "pipeline");
        assert.equal(body.filterGroups[0].filters[3].value, "default");
        assert.deepEqual(body.sorts, ["-hs_lastactivitydate"]);

        return createJsonResponse(200, {
          results: [
            { id: "987" },
            { id: "988" },
            { id: "987" }
          ]
        });
      }

      throw new Error(`Unexpected request: ${options.method || "GET"} ${parsedUrl.pathname}`);
    }
  });

  assert.deepEqual(result.dealIds, ["987", "988"]);
  assert.equal(result.source.portalId, "123456");
  assert.equal(result.source.hubDomain, "demo.hubspot.com");
});

test("createHubSpotRescueTask writes an associated HubSpot task from live analysis", async () => {
  const installState = {
    installs: [
      {
        portalId: "123456",
        hubDomain: "demo.hubspot.com",
        accessToken: "access_token",
        refreshToken: "refresh_token",
        connectedAt: "2026-04-12T08:00:00Z"
      }
    ]
  };

  const fetchImpl = async (url, options = {}) => {
    const parsedUrl = new URL(url);

    if (options.method === "GET" && parsedUrl.pathname === "/crm/v3/objects/deals/987") {
      return createJsonResponse(200, {
        id: "987",
        createdAt: "2026-03-01T10:00:00Z",
        updatedAt: "2026-04-10T10:00:00Z",
        archived: false,
        properties: {
          dealname: "Acme Expansion",
          amount: "48000",
          closedate: "2026-05-10",
          dealstage: "proposal",
          pipeline: "default",
          hubspot_owner_id: "44",
          hs_next_step: "Confirm legal review",
          hs_lastactivitydate: "2026-03-24T10:00:00Z"
        }
      });
    }

    if (options.method === "GET" && parsedUrl.pathname === "/crm/v3/owners/44") {
      return createJsonResponse(200, {
        id: "44",
        email: "owner@demo.hubspot.com",
        firstName: "Maya",
        lastName: "Manager",
        archived: false
      });
    }

    if (options.method === "GET" && parsedUrl.pathname === "/crm/v4/objects/deals/987/associations/contacts") {
      return createJsonResponse(200, {
        results: [{ toObjectId: 201, associationTypes: [{ label: "Decision maker" }] }]
      });
    }

    if (options.method === "GET" && parsedUrl.pathname === "/crm/v4/objects/deals/987/associations/companies") {
      return createJsonResponse(200, {
        results: [{ toObjectId: 301, associationTypes: [] }]
      });
    }

    if (options.method === "GET" && parsedUrl.pathname === "/crm/v4/objects/deals/987/associations/tasks") {
      return createJsonResponse(200, { results: [] });
    }

    if (options.method === "POST" && parsedUrl.pathname === "/crm/v3/objects/contacts/batch/read") {
      return createJsonResponse(200, {
        results: [{ id: "201", properties: { firstname: "Maya", lastname: "Brooks", email: "maya@acme.example" } }]
      });
    }

    if (options.method === "POST" && parsedUrl.pathname === "/crm/v3/objects/companies/batch/read") {
      return createJsonResponse(200, {
        results: [{ id: "301", properties: { name: "Acme" } }]
      });
    }

    if (options.method === "POST" && parsedUrl.pathname === "/crm/v3/objects/tasks/batch/read") {
      return createJsonResponse(200, { results: [] });
    }

    if (options.method === "POST" && parsedUrl.pathname === "/crm/v3/objects/tasks") {
      const body = JSON.parse(options.body);
      assert.equal(body.associations.length, 3);
      assert.equal(body.associations[0].types[0].associationTypeId, 216);
      assert.equal(body.associations[1].types[0].associationTypeId, 192);
      assert.equal(body.associations[2].types[0].associationTypeId, 204);
      assert.equal(body.properties.hubspot_owner_id, "44");
      assert.match(body.properties.hs_task_body, /Recommended action/);

      return createJsonResponse(201, {
        id: "task_9001",
        properties: body.properties
      });
    }

    throw new Error(`Unexpected request: ${options.method || "GET"} ${parsedUrl.pathname}`);
  };

  const preview = await loadHubSpotDealPreview({
    config: validConfig,
    installState,
    dealId: "987",
    portalId: "123456",
    analysisTimestamp: "2026-04-12T10:00:00Z",
    env: { HUBSPOT_CLIENT_SECRET: "secret" },
    fetchImpl
  });

  const result = await createHubSpotRescueTask({
    config: validConfig,
    installState: preview.installState,
    portalId: "123456",
    analysisTimestamp: "2026-04-12T10:00:00Z",
    preview,
    analysis: {
      analysis: {
        dealId: "987",
        dealName: "Acme Expansion",
        eligibility: "ELIGIBLE",
        rescueScore: 86,
        riskLevel: "CRITICAL",
        reasons: [
          {
            label: "Deal activity is stale",
            evidence: "No logged activity for 19 days."
          }
        ],
        recommendedAction: {
          type: "CREATE_NEXT_STEP_TASK",
          priority: "HIGH",
          summary: "Define a concrete next step and create a dated task."
        }
      },
      verification: {
        validationStatus: "VALIDATED"
      }
    },
    env: { HUBSPOT_CLIENT_SECRET: "secret" },
    fetchImpl
  });

  assert.equal(result.task.taskId, "task_9001");
  assert.equal(result.task.associatedContactCount, 1);
  assert.equal(result.task.associatedCompanyCount, 1);
  assert.equal(result.task.associatedDealId, "987");
});

test("createHubSpotRescueTask blocks when live analysis is unverified", async () => {
  await assert.rejects(
    () => createHubSpotRescueTask({
      config: validConfig,
      installState: {
        installs: [
          {
            portalId: "123456",
            accessToken: "access_token",
            refreshToken: "refresh_token",
            connectedAt: "2026-04-12T08:00:00Z"
          }
        ]
      },
      portalId: "123456",
      preview: {
        source: { fetchedAt: "2026-04-12T10:00:00Z" },
        graph: { deal: { id: "987" }, companies: [], contacts: [] },
        normalizedDeal: { owner: { id: "44" } }
      },
      analysis: {
        analysis: {
          dealId: "987",
          dealName: "Acme Expansion",
          eligibility: "INSUFFICIENT_DATA",
          recommendedAction: {
            type: "CREATE_NEXT_STEP_TASK",
            priority: "HIGH",
            summary: "Define a concrete next step and create a dated task."
          }
        },
        verification: {
          validationStatus: "UNVERIFIED"
        }
      },
      env: { HUBSPOT_CLIENT_SECRET: "secret" },
      fetchImpl: async () => createJsonResponse(200, {})
    }),
    /not trusted enough/
  );
});

test("createHubSpotDraftNote writes a HubSpot note linked to the deal graph", async () => {
  const preview = {
    source: {
      fetchedAt: "2026-04-12T10:00:00Z"
    },
    graph: {
      deal: { id: "987" },
      companies: [{ id: "301", name: "Acme" }],
      contacts: [{ id: "201", name: "Maya Brooks", email: "maya@acme.example" }]
    },
    normalizedDeal: {
      owner: { id: "44" }
    }
  };

  const result = await createHubSpotDraftNote({
    config: validConfig,
    installState: {
      installs: [
        {
          portalId: "123456",
          accessToken: "access_token",
          refreshToken: "refresh_token",
          connectedAt: "2026-04-12T08:00:00Z"
        }
      ]
    },
    portalId: "123456",
    preview,
    analysis: {
      analysis: {
        dealId: "987",
        dealName: "Acme Expansion",
        rescueScore: 86
      },
      verification: {
        validationStatus: "VALIDATED"
      }
    },
    draftResult: {
      mode: "DETERMINISTIC_LOCAL",
      draft: {
        subject: "Quick follow-up on Acme Expansion",
        body: "Hi Maya, can we confirm the next step tomorrow?"
      }
    },
    env: { HUBSPOT_CLIENT_SECRET: "secret" },
    fetchImpl: async (url, options = {}) => {
      const parsedUrl = new URL(url);

      if (options.method === "POST" && parsedUrl.pathname === "/crm/v3/objects/notes") {
        const body = JSON.parse(options.body);
        assert.equal(body.associations.length, 3);
        assert.equal(body.associations[0].types[0].associationTypeId, 214);
        assert.equal(body.associations[1].types[0].associationTypeId, 190);
        assert.equal(body.associations[2].types[0].associationTypeId, 202);
        assert.match(body.properties.hs_note_body, /Pipeline Rescue follow-up draft/);
        assert.match(body.properties.hs_note_body, /Quick follow-up on Acme Expansion/);

        return createJsonResponse(201, {
          id: "note_7001",
          properties: body.properties
        });
      }

      throw new Error(`Unexpected request: ${options.method || "GET"} ${parsedUrl.pathname}`);
    }
  });

  assert.equal(result.note.noteId, "note_7001");
  assert.equal(result.note.associatedDealId, "987");
  assert.equal(result.note.associatedCompanyCount, 1);
  assert.equal(result.note.associatedContactCount, 1);
});

test("createHubSpotDraftNote blocks when no draft payload is available", async () => {
  await assert.rejects(
    () => createHubSpotDraftNote({
      config: validConfig,
      installState: {
        installs: [
          {
            portalId: "123456",
            accessToken: "access_token",
            refreshToken: "refresh_token",
            connectedAt: "2026-04-12T08:00:00Z"
          }
        ]
      },
      portalId: "123456",
      preview: {
        source: { fetchedAt: "2026-04-12T10:00:00Z" },
        graph: { deal: { id: "987" }, companies: [], contacts: [] },
        normalizedDeal: { owner: { id: "44" } }
      },
      analysis: {
        analysis: { dealId: "987" },
        verification: { validationStatus: "VALIDATED" }
      },
      draftResult: null,
      env: { HUBSPOT_CLIENT_SECRET: "secret" },
      fetchImpl: async () => createJsonResponse(200, {})
    }),
    /usable draft/
  );
});
