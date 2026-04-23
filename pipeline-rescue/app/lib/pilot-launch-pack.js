function valueOrPending(value) {
  return value === undefined || value === null || String(value).trim() === ""
    ? "Not configured"
    : String(value).trim();
}

function boolLabel(value) {
  return value ? "yes" : "no";
}

function listLines(items, formatter) {
  if (!Array.isArray(items) || items.length === 0) {
    return "- None reported";
  }

  return items.map(formatter).join("\n");
}

function createPilotLaunchPack(options = {}) {
  const pilotConfigState = options.pilotConfigState || {};
  const pilotConfig = pilotConfigState.pilotConfig || {};
  const provider = pilotConfig.provider || {};
  const customer = pilotConfig.customer || {};
  const scope = pilotConfig.scope || {};
  const billing = pilotConfig.billing || {};
  const approvals = pilotConfig.approvals || {};
  const readiness = pilotConfigState.readiness || {};
  const launchPlan = options.pilotLaunchPlan || {};
  const deploymentProfile = options.deploymentProfile || {};
  const systemReport = options.systemReport || {};
  const generatedAt = new Date().toISOString();
  const status = launchPlan.status || "UNKNOWN";
  const fileName = `pipeline-rescue-pilot-launch-pack-${generatedAt.replace(/[:.]/g, "-")}.md`;
  const actions = Array.isArray(launchPlan.actions) ? launchPlan.actions : [];
  const gates = Array.isArray(readiness.gates) ? readiness.gates : [];
  const checks = Array.isArray(deploymentProfile.checks) ? deploymentProfile.checks : [];

  const markdown = `# Pipeline Rescue Pilot Launch Pack

Generated at: ${generatedAt}

## Launch Status

- Launch status: ${status}
- Technical readiness: ${launchPlan.metrics ? `${launchPlan.metrics.technicalReadinessPercent}%` : "unknown"}
- Blockers: ${launchPlan.metrics ? launchPlan.metrics.blockedCount : "unknown"}
- Hardening gaps: ${launchPlan.metrics ? launchPlan.metrics.hardeningCount : "unknown"}
- Manual gates remaining: ${launchPlan.metrics ? launchPlan.metrics.manualGateCount : "unknown"}
- System readiness: ${systemReport.readiness ? "ready" : "not ready"}

${launchPlan.summary || "No launch summary available."}

Next milestone: ${launchPlan.nextMilestone || "Not available."}

## Provider

- Legal name: ${valueOrPending(provider.legalName)}
- Trading name: ${valueOrPending(provider.tradingName)}
- Country: ${valueOrPending(provider.country)}
- Support email: ${valueOrPending(provider.supportEmail)}

## Customer

- Customer name: ${valueOrPending(customer.name)}
- Contact email: ${valueOrPending(customer.contactEmail)}
- Country: ${valueOrPending(customer.country)}

## Pilot Scope

- HubSpot portal ID: ${valueOrPending(scope.hubspotPortalId)}
- HubSpot pipeline ID: ${valueOrPending(scope.hubspotPipelineId)}
- Access route: ${valueOrPending(scope.accessRoute)}
- Pilot start date: ${valueOrPending(scope.pilotStartDate)}
- Duration days: ${valueOrPending(scope.pilotDurationDays)}
- Max users: ${valueOrPending(scope.maxUsers)}

## Billing

- Method: ${valueOrPending(billing.method)}
- Setup fee EUR: ${valueOrPending(billing.setupFeeEur)}
- Pilot fee EUR: ${valueOrPending(billing.pilotFeeEur)}
- Continuation monthly fee EUR: ${valueOrPending(billing.continuationMonthlyFeeEur)}
- Invoice reference: ${valueOrPending(billing.invoiceReference)}

## Approvals

- Pilot terms reviewed: ${boolLabel(approvals.pilotTermsReviewed)}
- Privacy notice reviewed: ${boolLabel(approvals.privacyNoticeReviewed)}
- Human review accepted: ${boolLabel(approvals.humanReviewAccepted)}
- Sensitive-data exclusion accepted: ${boolLabel(approvals.noSensitiveDataAccepted)}

## Commercial Gates

${listLines(gates, (gate) => `- ${gate.status} | ${gate.label}: ${gate.detail}`)}

## Launch Action Queue

${listLines(actions, (action) => `- ${action.priority} | ${action.status} | ${action.label}: ${action.remediation}`)}

## Technical Checks

${listLines(checks, (check) => `- ${check.status} | ${check.label}: ${check.detail}`)}

## Pilot Runbook

1. Confirm provider identity, customer identity, billing method, privacy notice, and signed pilot terms.
2. Configure the runtime with an external writable directory and shared-secret access.
3. Configure HubSpot using the selected access route.
4. Complete GDPR config until the compliance gate is ready for formal review.
5. Load one real HubSpot deal preview and verify normalized fields.
6. Generate one reviewed draft and save it as a HubSpot note only after human approval.
7. Create one rescue task, then verify no duplicate open rescue task is created.
8. Export a support bundle after setup and keep it with the pilot record.
9. Review adoption weekly: analyzed deals, at-risk deals, tasks created, drafts saved, useful/dismissed feedback.
10. Stop or reset the pilot if CRM data is unusable, compliance scope is unclear, or recommendations are not credible.

## Hard Limits

- No autonomous sending.
- No guaranteed recovered revenue.
- No sensitive or regulated personal data.
- No production SLA unless separately contracted.
- No broad SaaS or marketplace certification claim for this pilot.
`;

  return {
    generatedAt,
    fileName,
    contentType: "text/markdown; charset=utf-8",
    status,
    markdown
  };
}

module.exports = {
  createPilotLaunchPack
};
