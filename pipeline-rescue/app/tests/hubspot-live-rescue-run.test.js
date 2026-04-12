const test = require("node:test");
const assert = require("node:assert/strict");
const {
  executeLiveRescueRun,
  validateLiveRescueRunPayload
} = require("../lib/hubspot-live-rescue-run");

test("validateLiveRescueRunPayload extends live search criteria with a bounded write cap", () => {
  const payload = validateLiveRescueRunPayload({
    portalId: "123456",
    pipelineId: "default",
    minimumLastActivityAgeDays: 10,
    limit: 6,
    maxTaskWrites: 2
  });

  assert.deepEqual(payload, {
    portalId: "123456",
    pipelineId: "default",
    minimumLastActivityAgeDays: 10,
    limit: 6,
    maxTaskWrites: 2
  });
});

test("validateLiveRescueRunPayload rejects invalid write caps", () => {
  assert.throws(
    () => validateLiveRescueRunPayload({
      minimumLastActivityAgeDays: 7,
      limit: 5,
      maxTaskWrites: 0
    }),
    /between 1 and 25/
  );
});

test("executeLiveRescueRun writes only validated at-risk deals and continues on failures", async () => {
  const report = await executeLiveRescueRun({
    criteria: {
      portalId: "123456",
      pipelineId: "default",
      minimumLastActivityAgeDays: 7,
      limit: 4,
      maxTaskWrites: 1
    },
    liveQueue: {
      source: {
        portalId: "123456",
        hubDomain: "demo.hubspot.com",
        fetchedAt: "2026-04-12T10:00:00Z",
        tokenRefreshed: false
      },
      overview: {
        queue: [
          { dealId: "987" },
          { dealId: "988" },
          { dealId: "989" }
        ]
      },
      managerDigest: ["Initial digest."],
      deals: [
        {
          source: { portalId: "123456", fetchedAt: "2026-04-12T10:00:00Z" },
          normalizedDeal: { id: "987", name: "Acme Expansion" },
          graph: { deal: { id: "987" }, companies: [], contacts: [] },
          dealAnalysis: {
            analysis: {
              dealId: "987",
              dealName: "Acme Expansion",
              eligibility: "ELIGIBLE",
              rescueScore: 91,
              riskLevel: "CRITICAL"
            },
            verification: {
              validationStatus: "VALIDATED"
            }
          }
        },
        {
          source: { portalId: "123456", fetchedAt: "2026-04-12T10:00:00Z" },
          normalizedDeal: { id: "988", name: "Northwind Rollout" },
          graph: { deal: { id: "988" }, companies: [], contacts: [] },
          dealAnalysis: {
            analysis: {
              dealId: "988",
              dealName: "Northwind Rollout",
              eligibility: "ELIGIBLE",
              rescueScore: 83,
              riskLevel: "HIGH"
            },
            verification: {
              validationStatus: "VALIDATED"
            }
          }
        },
        {
          source: { portalId: "123456", fetchedAt: "2026-04-12T10:00:00Z" },
          normalizedDeal: { id: "989", name: "Beta Trial" },
          graph: { deal: { id: "989" }, companies: [], contacts: [] },
          dealAnalysis: {
            analysis: {
              dealId: "989",
              dealName: "Beta Trial",
              eligibility: "ELIGIBLE",
              rescueScore: 36,
              riskLevel: "MEDIUM"
            },
            verification: {
              validationStatus: "VALIDATED"
            }
          }
        },
        {
          source: { portalId: "123456", fetchedAt: "2026-04-12T10:00:00Z" },
          normalizedDeal: { id: "990", name: "Gamma Limited" },
          graph: { deal: { id: "990" }, companies: [], contacts: [] },
          dealAnalysis: {
            analysis: {
              dealId: "990",
              dealName: "Gamma Limited",
              eligibility: "ELIGIBLE",
              rescueScore: 79,
              riskLevel: "HIGH"
            },
            verification: {
              validationStatus: "UNVERIFIED"
            }
          }
        }
      ],
      installState: {
        installs: [{ portalId: "123456", accessToken: "token" }]
      }
    },
    taskWriter: async ({ preview }) => ({
      source: {
        tokenRefreshed: false
      },
      task: {
        taskId: `task_${preview.normalizedDeal.id}`,
        subject: `Task for ${preview.normalizedDeal.name}`,
        associatedDealId: preview.normalizedDeal.id
      },
      installState: {
        installs: [{ portalId: "123456", accessToken: "token" }]
      }
    })
  });

  assert.equal(report.metrics.writtenTasks, 1);
  assert.equal(report.metrics.skippedDeals, 2);
  assert.equal(report.metrics.blockedDeals, 1);
  assert.equal(report.writtenTasks[0].taskId, "task_987");
  assert.equal(report.decisions[0].decision, "TASK_WRITTEN");
  assert.equal(report.decisions[1].decision, "SKIPPED_LIMIT_REACHED");
  assert.equal(report.decisions[2].decision, "SKIPPED_BELOW_THRESHOLD");
  assert.equal(report.decisions[3].decision, "BLOCKED_UNVERIFIED");
});

test("executeLiveRescueRun records a failed write without aborting the batch", async () => {
  const report = await executeLiveRescueRun({
    criteria: {
      portalId: "123456",
      minimumLastActivityAgeDays: 7,
      limit: 2,
      maxTaskWrites: 2
    },
    liveQueue: {
      source: {
        portalId: "123456",
        hubDomain: "demo.hubspot.com",
        fetchedAt: "2026-04-12T10:00:00Z",
        tokenRefreshed: false
      },
      overview: {
        queue: [{ dealId: "987" }]
      },
      managerDigest: [],
      deals: [
        {
          source: { portalId: "123456", fetchedAt: "2026-04-12T10:00:00Z" },
          normalizedDeal: { id: "987", name: "Acme Expansion" },
          graph: { deal: { id: "987" }, companies: [], contacts: [] },
          dealAnalysis: {
            analysis: {
              dealId: "987",
              dealName: "Acme Expansion",
              eligibility: "ELIGIBLE",
              rescueScore: 91,
              riskLevel: "CRITICAL"
            },
            verification: {
              validationStatus: "VALIDATED"
            }
          }
        }
      ],
      installState: {
        installs: [{ portalId: "123456", accessToken: "token" }]
      }
    },
    taskWriter: async () => {
      const error = new Error("Remote write failed.");
      error.detail = "429 rate limited";
      throw error;
    }
  });

  assert.equal(report.metrics.failedWrites, 1);
  assert.equal(report.decisions[0].decision, "FAILED_WRITE");
  assert.match(report.decisions[0].detail, /429 rate limited/);
});

test("executeLiveRescueRun classifies duplicate rescue tasks as skipped, not failed", async () => {
  const report = await executeLiveRescueRun({
    criteria: {
      portalId: "123456",
      minimumLastActivityAgeDays: 7,
      limit: 1,
      maxTaskWrites: 1
    },
    liveQueue: {
      source: {
        portalId: "123456",
        hubDomain: "demo.hubspot.com",
        fetchedAt: "2026-04-12T10:00:00Z",
        tokenRefreshed: false
      },
      overview: {
        queue: [{ dealId: "987" }]
      },
      managerDigest: [],
      deals: [
        {
          source: { portalId: "123456", fetchedAt: "2026-04-12T10:00:00Z" },
          normalizedDeal: { id: "987", name: "Acme Expansion" },
          graph: { deal: { id: "987" }, companies: [], contacts: [] },
          dealAnalysis: {
            analysis: {
              dealId: "987",
              dealName: "Acme Expansion",
              eligibility: "ELIGIBLE",
              rescueScore: 91,
              riskLevel: "CRITICAL"
            },
            verification: {
              validationStatus: "VALIDATED"
            }
          }
        }
      ],
      installState: {
        installs: [{ portalId: "123456", accessToken: "token" }]
      }
    },
    taskWriter: async () => {
      const error = new Error("duplicate");
      error.statusCode = 409;
      error.detail = "Existing rescue task task_100: Pipeline Rescue | Acme Expansion already exists";
      throw error;
    }
  });

  assert.equal(report.metrics.failedWrites, 0);
  assert.equal(report.metrics.skippedDeals, 1);
  assert.equal(report.decisions[0].decision, "SKIPPED_EXISTING_RESCUE_TASK");
});

test("executeLiveRescueRun preserves refreshed install state after a skipped duplicate write", async () => {
  const report = await executeLiveRescueRun({
    criteria: {
      portalId: "123456",
      minimumLastActivityAgeDays: 7,
      limit: 1,
      maxTaskWrites: 1
    },
    liveQueue: {
      source: {
        portalId: "123456",
        hubDomain: "demo.hubspot.com",
        fetchedAt: "2026-04-12T10:00:00Z",
        tokenRefreshed: false
      },
      overview: {
        queue: [{ dealId: "987" }]
      },
      managerDigest: [],
      deals: [
        {
          source: { portalId: "123456", fetchedAt: "2026-04-12T10:00:00Z" },
          normalizedDeal: { id: "987", name: "Acme Expansion" },
          graph: { deal: { id: "987" }, companies: [], contacts: [] },
          dealAnalysis: {
            analysis: {
              dealId: "987",
              dealName: "Acme Expansion",
              eligibility: "ELIGIBLE",
              rescueScore: 91,
              riskLevel: "CRITICAL"
            },
            verification: {
              validationStatus: "VALIDATED"
            }
          }
        }
      ],
      installState: {
        installs: [{ portalId: "123456", accessToken: "expired_token" }]
      }
    },
    taskWriter: async () => {
      const error = new Error("duplicate");
      error.statusCode = 409;
      error.detail = "Existing rescue task task_100: Pipeline Rescue | Acme Expansion already exists";
      error.hubspotTokenRefreshed = true;
      error.hubspotInstallState = {
        installs: [{ portalId: "123456", accessToken: "fresh_token" }]
      };
      throw error;
    }
  });

  assert.equal(report.source.tokenRefreshed, true);
  assert.equal(report.installState.installs[0].accessToken, "fresh_token");
  assert.equal(report.decisions[0].decision, "SKIPPED_EXISTING_RESCUE_TASK");
});
