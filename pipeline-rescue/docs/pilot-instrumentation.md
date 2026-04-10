# Pilot Instrumentation

## Objective

Define exactly how pilot success is measured and what events the product must log.

## Principles

- measure behavior, not just opinions
- separate leading signals from outcome signals
- define every success metric before pilot launch

## Event taxonomy

Each event must include:

- `portalId`
- `dealId` when relevant
- `userId` when relevant
- `occurredAt`
- `appVersion`

### Analysis events

- `deal_analysis_requested`
- `deal_analysis_completed`
- `deal_analysis_failed`

Required properties:
- score
- risk level
- top reason codes
- latency in ms

### Recommendation events

- `next_action_viewed`
- `draft_generated`
- `draft_regenerated`
- `task_recommendation_viewed`

Required properties:
- action type
- top reason code
- score bucket

### Adoption events

- `task_created_from_recommendation`
- `task_dismissed`
- `draft_copied`
- `draft_edited_before_use`

Required properties:
- task type
- due date offset
- owner match boolean

### Outcome events

- `deal_stage_advanced_after_analysis`
- `new_activity_logged_after_analysis`
- `deal_closed_won_after_analysis`
- `deal_closed_lost_after_analysis`

Required properties:
- days since latest analysis
- starting score bucket

## Definitions

### At-risk deal

A deal is counted as at-risk when:

- it is eligible for scoring
- and its rescue score is `50+`

### Engaged rescue

A deal becomes an engaged rescue when, within `7` days of analysis:

- a recommended task is created
- or a new activity is logged
- or the deal owner updates the next step

### Rescued deal

A deal counts as rescued when all are true:

- it was at-risk
- it became an engaged rescue
- and within `30` days it either:
  - advances stage
  - or remains open with renewed activity and a future next step

### Recovered revenue candidate

Sum of `amount` for deals that meet rescued-deal criteria.

This is a pilot metric, not audited revenue recognition.

## Pilot KPI set

### Leading KPIs

- at-risk deals analyzed per week
- percentage of at-risk deals with an engaged rescue
- recommendation-to-task creation rate
- draft generation rate
- median time from analysis to next logged activity

### Outcome KPIs

- rescued deal rate
- stage advancement rate for at-risk deals
- closed-won rate delta on at-risk deals
- recovery value candidate

### Quality KPIs

- false positive review rate
- draft acceptance rate
- recommendation dismissal rate
- analysis latency

## Baseline method

Before pilot launch, collect at least `4` weeks of baseline where possible:

- stage aging by pipeline stage
- average days between activities
- percentage of deals with next step present
- win rate on deals older than stage norm

## Pilot review cadence

- weekly operator review
- biweekly buyer review
- end-of-month pilot readout

## Minimum pilot dashboard

The pilot dashboard must show:

- count of analyzed deals
- count of at-risk deals
- top reason distribution
- recommendation adoption
- outcome trend over time

## Data retention for pilot analytics

- keep event logs for the full pilot
- keep score snapshots for at least `90` days
- do not keep raw email and note bodies unless explicitly enabled

## Exit criteria for pilot success

A pilot is healthy enough to proceed if all are true:

- users open recommendations weekly
- at least `30%` of at-risk deals become engaged rescues
- draft or task adoption is visibly non-zero and rising
- buyers confirm the reason codes are credible

## Failure criteria

Pause or reset the pilot if:

- score explanations are regularly disputed
- the product cannot distinguish healthy from stalled deals
- adoption is near zero after enablement
- CRM hygiene is too poor to produce trustworthy outputs
