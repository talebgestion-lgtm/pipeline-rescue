const MANUAL_COMMERCIAL_GATES = [
  {
    code: "provider_identity",
    label: "Provider identity",
    owner: "operator",
    priority: "P0",
    detail: "Document the legal provider name, address, country, and support email before a paid pilot.",
    remediation: "Complete the provider section in the pilot agreement and privacy notice."
  },
  {
    code: "customer_scope",
    label: "Customer pilot scope",
    owner: "customer",
    priority: "P0",
    detail: "Confirm one HubSpot portal, one pipeline, pilot users, and the chosen access route.",
    remediation: "Record the HubSpot portal ID, target pipeline, and OAuth or Private App token mode before launch."
  },
  {
    code: "billing_method",
    label: "Billing method",
    owner: "operator",
    priority: "P1",
    detail: "Confirm how setup and pilot fees will be invoiced or collected.",
    remediation: "Prepare invoice details or payment link before sending the pilot agreement."
  },
  {
    code: "signed_pilot_terms",
    label: "Signed pilot terms",
    owner: "operator",
    priority: "P1",
    detail: "Do not start a paid pilot until terms, privacy notice, and human-review limits are accepted.",
    remediation: "Send the pilot agreement and privacy notice for review before enabling live customer use."
  }
];

function createPilotConfigAction(pilotConfigState) {
  if (!pilotConfigState || !pilotConfigState.error) {
    return null;
  }

  return {
    code: "pilot_config_invalid",
    label: "Pilot commercial config",
    owner: "operator",
    priority: "P0",
    status: "BLOCKED",
    detail: pilotConfigState.error,
    remediation: "Fix the local pilot config JSON before customer launch."
  };
}

function mapCheckAction(check) {
  const status = check.status === "PASS"
    ? "DONE"
    : check.status === "FAIL"
      ? "BLOCKED"
      : "HARDEN";

  return {
    code: `deployment_${check.code || "check"}`,
    label: check.label || "Deployment check",
    owner: "operator",
    priority: status === "BLOCKED" ? "P0" : status === "HARDEN" ? "P1" : "P3",
    status,
    detail: check.detail || "No detail available.",
    remediation: check.remediation || "Review deployment profile."
  };
}

function createRuntimeIntegrityActions(runtimeIntegrityReport) {
  if (!runtimeIntegrityReport) {
    return [
      {
        code: "runtime_integrity_unavailable",
        label: "Runtime integrity",
        owner: "operator",
        priority: "P1",
        status: "HARDEN",
        detail: "Runtime integrity report is unavailable.",
        remediation: "Open the system panel or call /api/runtime/integrity before pilot launch."
      }
    ];
  }

  if (runtimeIntegrityReport.status === "READY") {
    return [
      {
        code: "runtime_integrity_ready",
        label: "Runtime integrity",
        owner: "system",
        priority: "P3",
        status: "DONE",
        detail: "Runtime integrity is ready.",
        remediation: "No action required."
      }
    ];
  }

  const status = runtimeIntegrityReport.status === "ERROR" ? "BLOCKED" : "HARDEN";
  const details = [
    ...(runtimeIntegrityReport.failures || []).map((item) => `${item.label}: ${item.detail}`),
    ...(runtimeIntegrityReport.warnings || [])
  ];

  return [
    {
      code: "runtime_integrity",
      label: "Runtime integrity",
      owner: "operator",
      priority: status === "BLOCKED" ? "P0" : "P1",
      status,
      detail: details.join(" ") || `Runtime integrity status is ${runtimeIntegrityReport.status}.`,
      remediation: "Run runtime maintenance, capture a snapshot, and re-check integrity before customer use."
    }
  ];
}

function createSystemReadinessAction(systemReport) {
  if (!systemReport) {
    return {
      code: "system_report_unavailable",
      label: "System readiness",
      owner: "operator",
      priority: "P0",
      status: "BLOCKED",
      detail: "System report is unavailable.",
      remediation: "Resolve application bootstrap or diagnostics before pilot launch."
    };
  }

  return {
    code: "system_readiness",
    label: "System readiness",
    owner: "system",
    priority: systemReport.readiness ? "P3" : "P0",
    status: systemReport.readiness ? "DONE" : "BLOCKED",
    detail: systemReport.summary || (systemReport.readiness ? "System is ready." : "System is not ready."),
    remediation: systemReport.readiness
      ? "No action required."
      : "Resolve system report failures before pilot launch."
  };
}

function scoreTechnicalReadiness(actions) {
  const scoredActions = actions.filter((item) => item.status !== "MANUAL_REQUIRED");
  if (scoredActions.length === 0) {
    return 0;
  }

  const points = scoredActions.reduce((total, item) => {
    if (item.status === "DONE") {
      return total + 1;
    }

    if (item.status === "HARDEN") {
      return total + 0.5;
    }

    return total;
  }, 0);

  return Math.round((points / scoredActions.length) * 100);
}

function sortActions(actions) {
  const statusRank = {
    BLOCKED: 0,
    HARDEN: 1,
    MANUAL_REQUIRED: 2,
    DONE: 3
  };
  const priorityRank = {
    P0: 0,
    P1: 1,
    P2: 2,
    P3: 3
  };

  return [...actions].sort((left, right) => {
    const statusDelta = (statusRank[left.status] ?? 9) - (statusRank[right.status] ?? 9);
    if (statusDelta !== 0) {
      return statusDelta;
    }

    return (priorityRank[left.priority] ?? 9) - (priorityRank[right.priority] ?? 9);
  });
}

function createManualCommercialActions(pilotConfigState) {
  const readinessGates = pilotConfigState && pilotConfigState.readiness && Array.isArray(pilotConfigState.readiness.gates)
    ? pilotConfigState.readiness.gates
    : [];

  return MANUAL_COMMERCIAL_GATES.map((item) => {
    const gate = readinessGates.find((candidate) => candidate.code === item.code);
    const done = gate && gate.status === "DONE";

    return {
      ...item,
      status: done ? "DONE" : "MANUAL_REQUIRED",
      detail: gate ? gate.detail : item.detail,
      remediation: done ? "No action required." : (gate ? gate.remediation : item.remediation)
    };
  });
}

function createPilotLaunchPlan(options = {}) {
  const deploymentProfile = options.deploymentProfile || null;
  const systemReport = options.systemReport || null;
  const runtimeIntegrityReport = options.runtimeIntegrityReport || null;
  const pilotConfigState = options.pilotConfigState || null;

  const deploymentActions = deploymentProfile && Array.isArray(deploymentProfile.checks)
    ? deploymentProfile.checks.map(mapCheckAction)
    : [
      {
        code: "deployment_profile_unavailable",
        label: "Deployment profile",
        owner: "operator",
        priority: "P0",
        status: "BLOCKED",
        detail: "Deployment profile is unavailable.",
        remediation: "Resolve /api/deployment/profile before pilot launch."
      }
    ];
  const technicalActions = [
    createSystemReadinessAction(systemReport),
    ...createRuntimeIntegrityActions(runtimeIntegrityReport),
    ...deploymentActions
  ];
  const pilotConfigAction = createPilotConfigAction(pilotConfigState);
  if (pilotConfigAction) {
    technicalActions.push(pilotConfigAction);
  }

  const manualActions = createManualCommercialActions(pilotConfigState);
  const allActions = [...technicalActions, ...manualActions];
  const sortedActions = sortActions(allActions);
  const blockedCount = allActions.filter((item) => item.status === "BLOCKED").length;
  const hardeningCount = allActions.filter((item) => item.status === "HARDEN").length;
  const manualCount = allActions.filter((item) => item.status === "MANUAL_REQUIRED").length;
  const technicalReadinessPercent = scoreTechnicalReadiness(technicalActions);
  const status = blockedCount > 0
    ? "BLOCKED_BY_TECHNICAL_GATES"
    : hardeningCount > 0
      ? "READY_FOR_INTERNAL_DRY_RUN"
      : manualCount > 0
        ? "READY_FOR_SIGNED_PILOT"
        : "READY_FOR_CUSTOMER_LAUNCH";
  const nextAction = sortedActions.find((item) => item.status !== "DONE") || null;

  return {
    status,
    generatedAt: new Date().toISOString(),
    summary: status === "READY_FOR_CUSTOMER_LAUNCH"
      ? "Technical and commercial gates are complete. The pilot can be launched with the configured customer scope."
      : status === "READY_FOR_SIGNED_PILOT"
      ? "Technical launch gates are clear. Complete manual commercial gates before paid customer use."
      : status === "READY_FOR_INTERNAL_DRY_RUN"
        ? "No technical blocker remains, but hardening gaps should be closed before a paid pilot."
        : "Pilot launch is blocked by mandatory technical gates.",
    nextMilestone: status === "READY_FOR_CUSTOMER_LAUNCH"
      ? "Start the 30-day pilot, monitor adoption, and export a support bundle after setup."
      : status === "READY_FOR_SIGNED_PILOT"
      ? "Prepare signed pilot package and first customer onboarding."
      : status === "READY_FOR_INTERNAL_DRY_RUN"
        ? "Run an internal dry run, close hardening items, then repeat readiness checks."
        : "Resolve blocking technical gates, then re-run the launch plan.",
    metrics: {
      technicalReadinessPercent,
      blockedCount,
      hardeningCount,
      manualGateCount: manualCount,
      doneCount: allActions.filter((item) => item.status === "DONE").length,
      totalActionCount: allActions.length
    },
    nextAction,
    actions: sortedActions,
    manualCommercialGates: manualActions,
    technicalActions: sortActions(technicalActions)
  };
}

module.exports = {
  createPilotLaunchPlan
};
