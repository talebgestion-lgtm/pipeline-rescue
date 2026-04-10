# HubSpot Surface Specification

## Objective

Define exactly where Pipeline Rescue appears inside HubSpot and what each surface must do.

v1 must stay narrow.

## Surface 1: Deal record app card

### Priority

Required in v1.

### User

- account executive
- sales manager

### Purpose

Show the rescue score and translate it into one clear next move.

### Must display

- rescue score
- risk level
- top 3 reasons
- analysis freshness
- next best action
- validation status if AI draft or explanation is shown
- buttons:
  - `Analyze now`
  - `Create task`
  - `Generate draft`

### Must not do

- auto-send email
- hide reasons behind a score only

## Surface 2: Custom workflow action

### Priority

Required in v1.

### Purpose

Allow RevOps or sales leaders to trigger deal analysis inside HubSpot workflows.

### Action name

- `Analyze deal with Pipeline Rescue`

### Inputs

- deal ID from workflow context

### Outputs

- score
- risk level
- top reason code
- draft eligibility boolean

## Surface 3: Rescue queue view

### Priority

Optional but recommended for pilot.

### Purpose

Give managers and reps a prioritized list of at-risk deals.

### Must display

- deal name
- owner
- score
- risk level
- top reason
- last activity age
- next step state

### Sorting

Default sort:
- highest score first
- then oldest activity

## Surface 4: Task confirmation state

### Priority

Required in v1.

### Purpose

Show whether a recommended task was created, dismissed, or already existed.

### States

- `CREATED`
- `ALREADY_EXISTS`
- `DISMISSED`
- `FAILED`

## Surface 5: Draft panel

### Priority

Required in v1 if drafting is enabled.

### Purpose

Display a short editable email draft driven by the top recommendation.

### Must display

- subject
- body
- blocked state if draft is not allowed
- unverified-field warning if present
- validation badge:
  - `VALIDATED`
  - `UNVERIFIED`
  - `BLOCKED`
- copy action
- regenerate action only if allowed

### Must not do

- send
- sync directly to email provider in v1

## Surface 6: Manager digest

### Priority

Not required in v1 MVP.

### Purpose

Summarize the highest-risk deals across a team or portal.

### Phase

Post-pilot expansion.

## Navigation model

v1 should keep the product mostly inside HubSpot.

Primary navigation:

- deal record card
- workflow action

Secondary navigation:

- optional queue screen

## Rendering priorities

### Fast path

On first paint, show:

- last known score
- freshness state
- loading state for refresh

### Slow path

When analysis refresh completes, update:

- score
- reasons
- action
- draft eligibility

## Empty states

### No analysis yet

Show:

- `Analyze this deal to see rescue risk and next best action.`

### Not eligible

Show:

- `This deal is not eligible for rescue analysis.`

### Insufficient data

Show:

- `More CRM data is needed before a reliable rescue score can be produced.`

## Error states

### HubSpot fetch failed

Show:

- last valid result if available
- clear retry option

### Task creation failed

Show:

- failure state with retry

### Draft blocked

Show:

- blocking reason
- fields or conditions to fix

## UI hierarchy

The deal card should follow this order:

1. score and risk level
2. top reasons
3. next best action
4. analysis freshness
5. action buttons

## Analytics hooks per surface

### Deal card

- `next_action_viewed`
- `deal_analysis_requested`

### Draft panel

- `draft_generated`
- `draft_copied`
- `draft_edited_before_use`

### Task action

- `task_created_from_recommendation`
- `task_dismissed`

### Queue

- `queue_view_opened`
- `queue_item_opened`
