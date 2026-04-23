function buildStep(code, label, status, instruction, evidence) {
  return {
    code,
    label,
    status,
    instruction,
    evidence
  };
}

function firstPendingStep(steps) {
  return steps.find((step) => step.status === "BLOCKED" || step.status === "NEXT") || null;
}

function createPilotDryRunAssistant(options = {}) {
  const accessState = options.accessState || {};
  const gdprState = options.gdprState || {};
  const hubspotState = options.hubspotState || {};
  const aiProviderState = options.aiProviderState || {};
  const pilotConfigState = options.pilotConfigState || {};

  const accessStatus = accessState.status ? accessState.status.status : "unknown";
  const gdprStatus = gdprState.complianceReport ? gdprState.complianceReport.status : "unknown";
  const hubspotStatus = hubspotState.hubspotStatus ? hubspotState.hubspotStatus.status : "unknown";
  const aiStatus = aiProviderState.aiProviderStatus ? aiProviderState.aiProviderStatus.status : "unknown";
  const commercialReady = pilotConfigState.readiness && pilotConfigState.readiness.status === "READY";
  const accessReady = accessStatus === "PROTECTED";
  const gdprReady = gdprStatus === "READY_FOR_FORMAL_REVIEW";
  const hubspotReady = hubspotStatus === "READY";
  const dryRunReady = commercialReady && accessReady && gdprReady && hubspotReady;

  const steps = [];
  steps.push(buildStep(
    "commercial_scope",
    "Pilot commercial scope is complete",
    commercialReady ? "DONE" : "BLOCKED",
    "Finish provider identity, customer scope, billing method, and launch approvals in the Pilot Config form.",
    commercialReady
      ? "Pilot commercial gates are complete."
      : pilotConfigState.readiness && Array.isArray(pilotConfigState.readiness.gates)
        ? pilotConfigState.readiness.gates
          .filter((gate) => gate.status !== "DONE")
          .map((gate) => gate.detail)
          .join(" ")
        : "Pilot commercial config is incomplete."
  ));
  steps.push(buildStep(
    "access_protection",
    "Instance access protection is enabled",
    accessReady ? "DONE" : "BLOCKED",
    "Set PIPELINE_RESCUE_ACCESS_MODE=SHARED_SECRET and provide PIPELINE_RESCUE_ACCESS_TOKEN before customer use.",
    accessReady
      ? "Shared-secret protection is enabled."
      : accessState.status
        ? accessState.status.summary
        : "Access protection state is unavailable."
  ));
  steps.push(buildStep(
    "gdpr_gate",
    "GDPR gate is ready for formal review",
    gdprReady ? "DONE" : "BLOCKED",
    "Complete the compliance form until the deployment gate reports READY_FOR_FORMAL_REVIEW.",
    gdprState.complianceReport
      ? gdprState.complianceReport.summary
      : gdprState.error || "GDPR report is unavailable."
  ));
  steps.push(buildStep(
    "hubspot_connection",
    "HubSpot is connected and ready",
    hubspotReady ? "DONE" : "BLOCKED",
    "Use the HubSpot section to complete PRIVATE_APP or OAUTH setup until HubSpot status becomes READY.",
    hubspotState.hubspotStatus
      ? hubspotState.hubspotStatus.summary
      : hubspotState.error || "HubSpot readiness is unavailable."
  ));
  steps.push(buildStep(
    "live_preview",
    "Load one real HubSpot deal preview",
    dryRunReady ? "NEXT" : "WAITING",
    "In the HubSpot live section, enter one real HubSpot deal ID and click Load Live Deal Preview.",
    dryRunReady
      ? "Technical prerequisites are clear for the first live preview."
      : "This step is waiting for blocked prerequisites to be resolved."
  ));
  steps.push(buildStep(
    "live_task",
    "Create one real rescue task",
    dryRunReady ? "WAITING" : "WAITING",
    "After the live preview looks correct, click Create Live HubSpot Task and confirm no duplicate open rescue task is created.",
    dryRunReady
      ? "Ready after the first successful live preview."
      : "This step is waiting for blocked prerequisites to be resolved."
  ));
  steps.push(buildStep(
    "live_draft_note",
    "Generate one draft and save one HubSpot note",
    dryRunReady ? "WAITING" : "WAITING",
    "Generate a live draft, review it manually, then save it as a HubSpot note only if the wording is acceptable.",
    aiStatus === "READY"
      ? "Live AI provider is ready for draft generation."
      : "Deterministic fallback remains available if no live AI provider is configured."
  ));
  steps.push(buildStep(
    "operator_exports",
    "Export the launch pack and support bundle",
    dryRunReady ? "WAITING" : "WAITING",
    "After setup, download the Pilot Launch Pack and the Support Bundle and keep them with the pilot record.",
    "Operator export step remains manual by design."
  ));
  steps.push(buildStep(
    "live_ai_provider",
    "Optional live AI provider",
    aiStatus === "READY" ? "DONE" : "OPTIONAL",
    "Configure OpenAI only if you need live draft generation instead of deterministic fallback.",
    aiProviderState.aiProviderStatus
      ? aiProviderState.aiProviderStatus.summary
      : aiProviderState.error || "AI provider status is unavailable."
  ));

  const nextStep = firstPendingStep(steps);
  const blockedCount = steps.filter((step) => step.status === "BLOCKED").length;
  const doneCount = steps.filter((step) => step.status === "DONE").length;
  const status = blockedCount > 0 ? "BLOCKED" : "READY_FOR_OPERATOR_DRY_RUN";

  return {
    status,
    generatedAt: new Date().toISOString(),
    summary: status === "BLOCKED"
      ? "Resolve the blocked prerequisites before attempting the first live HubSpot dry run."
      : "The technical and commercial prerequisites are ready. Run the first live HubSpot dry run in order.",
    metrics: {
      blockedCount,
      doneCount,
      totalStepCount: steps.length
    },
    nextStep,
    steps
  };
}

module.exports = {
  createPilotDryRunAssistant
};
