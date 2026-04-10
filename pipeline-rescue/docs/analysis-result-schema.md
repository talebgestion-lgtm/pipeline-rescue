# Analysis Result Schema

## Objective

Define the normalized payloads Pipeline Rescue stores and returns.

This is the canonical schema for:

- UI rendering
- task creation
- pilot analytics

## Core entity: DealAnalysisSnapshot

```json
{
  "id": "das_001",
  "portalId": "67890",
  "dealId": "12345",
  "pipelineId": "default",
  "dealStageId": "appointmentscheduled",
  "analyzedAt": "2026-04-10T16:00:00Z",
  "analysisVersion": "v1",
  "eligibility": "ELIGIBLE",
  "rescueScore": 68,
  "riskLevel": "HIGH",
  "reasonCount": 3,
  "topReasonCode": "ACTIVITY_STALE",
  "freshUntil": "2026-04-10T16:15:00Z",
  "scoreInputs": {
    "daysSinceLastActivity": 15,
    "stageAgeDays": 28,
    "contactCount": 1,
    "hasDecisionMaker": false,
    "missingFieldCount": 1,
    "hasNextStep": false,
    "hasFutureTask": false,
    "amount": 18000
  }
}
```

## Eligibility values

- `ELIGIBLE`
- `NOT_ELIGIBLE`
- `INSUFFICIENT_DATA`

## Risk level values

- `LOW`
- `MEDIUM`
- `HIGH`
- `CRITICAL`

## AnalysisReason

```json
{
  "code": "ACTIVITY_STALE",
  "label": "Deal activity is stale",
  "weight": 24,
  "rank": 1,
  "evidence": "No logged meeting, note, email, or task activity for 15 days.",
  "sourceFields": [
    "hs_lastactivitydate"
  ]
}
```

## Allowed reason codes

- `ACTIVITY_STALE`
- `NEXT_STEP_MISSING`
- `NO_FUTURE_TASK`
- `STAGE_AGING`
- `CONTACT_COVERAGE_LOW`
- `DECISION_MAKER_MISSING`
- `CRM_HYGIENE_GAP`
- `HIGH_VALUE_LOW_ENGAGEMENT`

## Recommendation

```json
{
  "type": "FOLLOW_UP_EMAIL",
  "priority": "HIGH",
  "summary": "Send a direct follow-up with a concrete scheduling ask.",
  "ownerId": "90210",
  "dueInDays": 1,
  "blocked": false,
  "blockedReason": null
}
```

## Recommendation types

- `FOLLOW_UP_EMAIL`
- `CREATE_NEXT_STEP_TASK`
- `ESCALATE_MANAGER_REVIEW`
- `FILL_CRM_GAP`
- `EXPAND_CONTACT_COVERAGE`

## DraftResult

```json
{
  "eligible": true,
  "blockedReason": null,
  "channel": "EMAIL",
  "subject": "Quick follow-up on next steps",
  "body": "Hi Sarah, following up on next steps for the proposal. Are you available Thursday or Friday for a 20-minute review?",
  "generatedAt": "2026-04-10T16:01:30Z",
  "generationMode": "LLM_ASSISTED"
}
```

## GuardrailReport

```json
{
  "memoryProtocol": "CYCLE_ISOLATED",
  "validationStatus": "VALIDATED",
  "stabilityScore": 9.34,
  "hallucinationRisk": "LOW",
  "unverifiedFields": [],
  "correctionsApplied": [
    "Clamped evidence to CRM-backed fields only."
  ],
  "notes": "Draft allowed because the minimum verified signal set is present."
}
```

## Validation status values

- `VALIDATED`
- `UNVERIFIED`
- `BLOCKED`

## Draft blocked contract

```json
{
  "eligible": false,
  "blockedReason": "CRM_HYGIENE_GAP",
  "channel": "EMAIL",
  "subject": null,
  "body": null,
  "generatedAt": null,
  "generationMode": null
}
```

## TaskDraft

```json
{
  "subject": "Follow up with customer on next steps",
  "body": "Pipeline Rescue flagged this deal as HIGH risk because activity is stale and no next step is set.",
  "dueInDays": 1,
  "ownerId": "90210",
  "associationTargets": {
    "dealId": "12345",
    "contactId": "555"
  }
}
```

## UI payload

The deal card should not require multiple backend joins.

```json
{
  "dealId": "12345",
  "dealName": "Acme Expansion",
  "rescueScore": 68,
  "riskLevel": "HIGH",
  "topReasons": [
    {
      "code": "ACTIVITY_STALE",
      "label": "Deal activity is stale",
      "weight": 24,
      "evidence": "No logged activity for 15 days."
    }
  ],
  "recommendedAction": {
    "type": "FOLLOW_UP_EMAIL",
    "priority": "HIGH",
    "summary": "Send a direct follow-up with a concrete scheduling ask."
  },
  "verification": {
    "memoryProtocol": "CYCLE_ISOLATED",
    "validationStatus": "VALIDATED",
    "stabilityScore": 9.34,
    "hallucinationRisk": "LOW",
    "unverifiedFields": [],
    "correctionsApplied": [],
    "notes": "No missing data blocks the draft."
  },
  "draftStatus": {
    "eligible": true,
    "blockedReason": null
  },
  "analysisFreshness": {
    "analyzedAt": "2026-04-10T16:00:00Z",
    "freshUntil": "2026-04-10T16:15:00Z",
    "state": "FRESH"
  }
}
```

## Freshness state values

- `FRESH`
- `STALE`
- `UNKNOWN`

## Pilot event schema

```json
{
  "eventId": "evt_001",
  "eventName": "deal_analysis_completed",
  "portalId": "67890",
  "dealId": "12345",
  "userId": "90210",
  "occurredAt": "2026-04-10T16:00:01Z",
  "appVersion": "0.1.0",
  "properties": {
    "rescueScore": 68,
    "riskLevel": "HIGH",
    "topReasonCodes": [
      "ACTIVITY_STALE",
      "NO_FUTURE_TASK"
    ],
    "latencyMs": 841
  }
}
```

## Storage recommendation

Recommended relational shape:

- `deal_analysis_snapshots`
- `deal_analysis_reasons`
- `deal_recommendation_drafts`
- `analysis_guardrail_reports`
- `pilot_events`

## Schema rules

- store one score snapshot per analysis run
- store reason rows separately for analytics and ranking
- keep event payloads append-only
- never mutate historical scores in place
