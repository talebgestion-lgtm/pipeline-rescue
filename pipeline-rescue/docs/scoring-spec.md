# Scoring Specification

## Objective

Produce a deterministic **deal rescue score** from `0` to `100`, where:

- `0` means low rescue urgency
- `100` means critical rescue urgency

The score must be explainable, stable, and safe to use in a pilot before any LLM drafting is added.

## Eligibility

Only analyze deals that meet all of the following:

- not archived
- not in a closed-won stage
- not in a closed-lost stage
- belong to an included pipeline
- have an owner

Deals outside this scope are marked `NOT_ELIGIBLE` and receive no rescue score.

## Output contract

```json
{
  "dealId": "12345",
  "analyzedAt": "2026-04-10T16:00:00Z",
  "rescueScore": 68,
  "riskLevel": "HIGH",
  "reasons": [
    {
      "code": "ACTIVITY_STALE",
      "weight": 20,
      "evidence": "No logged activity for 15 days."
    }
  ],
  "nextBestAction": {
    "type": "FOLLOW_UP_EMAIL",
    "priority": "HIGH",
    "summary": "Send a direct follow-up with a specific scheduling ask."
  }
}
```

## Risk levels

- `LOW`: `0` to `24`
- `MEDIUM`: `25` to `49`
- `HIGH`: `50` to `74`
- `CRITICAL`: `75` to `100`

## Scoring model

The score is the capped sum of six signal groups.

```text
rescueScore =
  activityRisk +
  nextStepRisk +
  stageAgingRisk +
  contactCoverageRisk +
  crmHygieneRisk +
  engagementWeaknessRisk

cap rescueScore at 100
```

## Signal groups and weights

### 1. Activity risk: max 30

Purpose:
- detect silence on the deal

Rules:
- `0` if activity in the last `3` days
- `8` if last activity is `4` to `7` days old
- `16` if last activity is `8` to `14` days old
- `24` if last activity is `15` to `21` days old
- `30` if last activity is `22+` days old

Primary reason code:
- `ACTIVITY_STALE`

### 2. Next step risk: max 20

Purpose:
- punish deals without a concrete next move

Rules:
- `0` if `hs_next_step` exists and is non-trivial and a future task exists
- `10` if either `hs_next_step` is missing or no open future task exists
- `20` if both are missing

Primary reason codes:
- `NEXT_STEP_MISSING`
- `NO_FUTURE_TASK`

### 3. Stage aging risk: max 20

Purpose:
- detect deals parked too long in stage

Required configuration:
- one expected maximum age per pipeline stage

Default pilot baseline:
- stage age <= expected max age: `0`
- stage age between `1.0x` and `1.5x` expected: `8`
- stage age between `1.5x` and `2.0x` expected: `14`
- stage age > `2.0x` expected: `20`

Primary reason code:
- `STAGE_AGING`

### 4. Contact coverage risk: max 10

Purpose:
- detect weak buying-group coverage

Rules:
- `0` if at least `2` associated contacts and one decision-maker label exists
- `4` if at least `2` contacts but no decision-maker label
- `7` if exactly `1` associated contact
- `10` if no associated contact

Primary reason codes:
- `CONTACT_COVERAGE_LOW`
- `DECISION_MAKER_MISSING`

### 5. CRM hygiene risk: max 10

Purpose:
- detect missing information that blocks follow-up

Pilot required fields:
- `amount`
- `close date`
- `deal owner`
- `deal stage`
- `pipeline`

Rules:
- `0` if all required fields exist
- `3` if one required field is missing
- `6` if two required fields are missing
- `10` if three or more required fields are missing

Primary reason code:
- `CRM_HYGIENE_GAP`

### 6. Engagement weakness risk: max 10

Purpose:
- penalize weak engagement on higher-value deals

Rules:
- `0` if amount is below pilot threshold
- `0` if amount is above threshold and there was meaningful activity in `7` days
- `5` if amount is above threshold and activity is weak
- `10` if amount is above threshold and there is no meaningful activity in `14` days

Pilot default threshold:
- `10000 EUR` deal amount or portal equivalent

Primary reason code:
- `HIGH_VALUE_LOW_ENGAGEMENT`

## Reason taxonomy

Only the following reason codes are valid in v1:

- `ACTIVITY_STALE`
- `NEXT_STEP_MISSING`
- `NO_FUTURE_TASK`
- `STAGE_AGING`
- `CONTACT_COVERAGE_LOW`
- `DECISION_MAKER_MISSING`
- `CRM_HYGIENE_GAP`
- `HIGH_VALUE_LOW_ENGAGEMENT`

## Reason ordering

- sort by weight descending
- break ties by business importance:
  - `ACTIVITY_STALE`
  - `STAGE_AGING`
  - `NEXT_STEP_MISSING`
  - `NO_FUTURE_TASK`
  - `DECISION_MAKER_MISSING`
  - `CONTACT_COVERAGE_LOW`
  - `HIGH_VALUE_LOW_ENGAGEMENT`
  - `CRM_HYGIENE_GAP`

Return at most `5` reasons and show at most `3` in the deal card by default.

## Next best action rules

The app must not generate an action arbitrarily. It must map from the top reason.

| Top reason | Next best action |
| --- | --- |
| `ACTIVITY_STALE` | send follow-up with explicit CTA |
| `NEXT_STEP_MISSING` | define concrete next step and create task |
| `NO_FUTURE_TASK` | create dated task owned by deal owner |
| `STAGE_AGING` | escalate or re-qualify status |
| `DECISION_MAKER_MISSING` | identify and add buying contact |
| `CONTACT_COVERAGE_LOW` | broaden stakeholder coverage |
| `CRM_HYGIENE_GAP` | fix missing fields before outreach |
| `HIGH_VALUE_LOW_ENGAGEMENT` | manager review plus tailored outreach |

## Draft generation policy

The email draft is downstream of the deterministic score.

Rules:
- never auto-send
- never fabricate facts not present in HubSpot
- always mention one explicit next step
- keep draft under `140` words in v1
- if `CRM_HYGIENE_GAP` is top reason, do not draft until missing fields are resolved

## Pilot test cases

### Case A: healthy active deal

- recent meeting 2 days ago
- next step set
- open task exists
- expected stage age normal

Expected result:
- score below `25`
- risk level `LOW`

### Case B: stale deal with no plan

- no activity for 16 days
- no next step
- no future task
- one contact only

Expected result:
- score above `55`
- risk level at least `HIGH`

### Case C: expensive but under-covered deal

- amount above threshold
- no activity for 12 days
- one contact
- no decision-maker label

Expected result:
- score above `50`
- reasons include `HIGH_VALUE_LOW_ENGAGEMENT` and `CONTACT_COVERAGE_LOW`

## Implementation notes

- v1 scoring must remain deterministic
- LLM usage is allowed only for drafting and explanation phrasing
- raw score inputs should be logged for auditability
