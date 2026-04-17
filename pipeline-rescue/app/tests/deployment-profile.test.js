const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const { createDeploymentProfile } = require("../lib/deployment-profile");

function createArtifactRoot() {
  const appRoot = fs.mkdtempSync(path.join(os.tmpdir(), "pipeline-rescue-deployment-"));
  fs.writeFileSync(path.join(appRoot, "Dockerfile"), "FROM node:20-bookworm-slim\n");
  fs.writeFileSync(path.join(appRoot, ".dockerignore"), "release/\n");
  fs.writeFileSync(path.join(appRoot, "docker-compose.pilot.yml"), "services:\n");
  return appRoot;
}

test("createDeploymentProfile reports READY_FOR_PILOT when rollout prerequisites are met", () => {
  const appRoot = createArtifactRoot();

  const report = createDeploymentProfile({
    appPaths: {
      appRoot,
      runtimeStorageMode: "EXTERNAL_RUNTIME_DIR",
      runtimeDir: "/var/lib/pipeline-rescue/runtime"
    },
    accessState: {
      status: {
        status: "PROTECTED",
        summary: "Access control is enabled."
      }
    },
    gdprState: {
      complianceReport: {
        status: "READY_FOR_FORMAL_REVIEW"
      }
    },
    hubspotState: {
      hubspotStatus: {
        status: "READY"
      }
    },
    aiProviderState: {
      aiProviderStatus: {
        status: "READY"
      }
    }
  });

  assert.equal(report.status, "READY_FOR_PILOT");
  assert.equal(report.metrics.failureCount, 0);
  assert.equal(report.metrics.warningCount, 0);
  assert.equal(report.artifacts.dockerfilePresent, true);
});

test("createDeploymentProfile blocks when mandatory rollout controls are missing", () => {
  const appRoot = fs.mkdtempSync(path.join(os.tmpdir(), "pipeline-rescue-deployment-"));

  const report = createDeploymentProfile({
    appPaths: {
      appRoot,
      runtimeStorageMode: "IN_PLACE",
      runtimeDir: path.join(appRoot, "data")
    },
    accessState: {
      status: {
        status: "DISABLED",
        summary: "Access control is disabled."
      }
    },
    gdprState: {
      complianceReport: {
        status: "BLOCKED_FOR_DEPLOYMENT"
      }
    },
    hubspotState: {
      hubspotStatus: {
        status: "READY_FOR_INSTALL"
      }
    },
    aiProviderState: {
      aiProviderStatus: {
        status: "DISABLED"
      }
    }
  });

  assert.equal(report.status, "BLOCKED");
  assert.ok(report.blockers.some((item) => item.label === "Deployment artifacts"));
  assert.ok(report.blockers.some((item) => item.label === "Access protection"));
  assert.ok(report.blockers.some((item) => item.label === "GDPR deployment gate"));
  assert.ok(report.hardening.some((item) => item.label === "External runtime storage"));
});
