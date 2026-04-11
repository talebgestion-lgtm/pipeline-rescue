const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const { createComplianceReport } = require("../lib/gdpr-compliance");

const baseConfig = JSON.parse(
  fs.readFileSync(path.join(__dirname, "..", "data", "gdpr-config.json"), "utf8")
);

test("default GDPR config blocks deployment until mandatory controls are documented", () => {
  const report = createComplianceReport(baseConfig);

  assert.equal(report.status, "BLOCKED_FOR_DEPLOYMENT");
  assert.ok(report.blockers.length > 0);
  assert.ok(report.checks.some((check) => check.code === "lawful_basis" && check.status === "FAIL"));
});

test("fully documented GDPR config becomes ready for formal review", () => {
  const config = JSON.parse(JSON.stringify(baseConfig));

  config.controller.name = "Example Controller SAS";
  config.controller.contactEmail = "privacy@example-controller.test";
  config.controller.euEstablishmentCountry = "FR";
  config.records.controllerRegisterMaintained = true;
  config.records.processorRegisterMaintained = true;
  config.processingActivities.forEach((activity) => {
    activity.lawfulBasis = "LEGITIMATE_INTEREST";
    activity.legitimateInterestAssessmentCompleted = true;
  });
  config.processors.forEach((processor) => {
    if (processor.enabled !== false) {
      processor.dpaSigned = true;
    }
  });
  config.security.encryptionAtRest = true;
  config.security.rbac = true;
  config.security.mfa = true;
  config.security.backupRestoreTested = true;
  config.dataSubjectRights.requestChannelEmail = "privacy@example-controller.test";
  config.dataSubjectRights.identityVerificationProcedure = true;
  config.dataSubjectRights.erasureWorkflow = true;
  config.dataSubjectRights.portabilityWorkflow = true;
  config.dataSubjectRights.objectionWorkflow = true;
  config.breachResponse.owner = "Security Lead";
  config.breachResponse.runbookLinked = true;

  const report = createComplianceReport(config);

  assert.equal(report.status, "READY_FOR_FORMAL_REVIEW");
  assert.equal(report.blockers.length, 0);
  assert.ok(report.checks.every((check) => check.status === "PASS"));
});
