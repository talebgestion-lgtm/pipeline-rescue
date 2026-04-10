# MVP Specification

## Objective

Help HubSpot users recover stalled deals with a clear, actionable workflow.

## Primary user roles

- Account executive
- Sales manager
- Revenue operations lead

## Core workflow

1. A deal is analyzed on a schedule or by manual trigger.
2. The app computes a rescue score.
3. The user sees the top reasons the deal is at risk.
4. The app suggests the next best action.
5. The app drafts a follow-up message.
6. The app creates a HubSpot task.

## Inputs

- deal stage
- last activity date
- next activity date
- amount
- owner
- associated contacts
- recent notes
- recent emails and meetings when available
- missing required properties

## Outputs

- rescue score from 0 to 100
- risk level: low, medium, high, critical
- top 3 to 5 risk reasons
- next best action
- message draft
- task payload

## Core rules

- No auto-send in v1.
- No hidden scoring.
- Every recommendation must show reasons.
- Every generated draft must remain editable by the user.

## Deal risk signals

- no logged activity for too long
- next step missing
- deal amount high but engagement low
- repeated push in stage without progress
- missing critical fields
- no decision-maker contact linked

## HubSpot surfaces

- deal record app card
- optional pipeline summary view
- custom workflow action: Analyze deal

## Technical shape

- OAuth HubSpot app
- backend service for scoring and generation
- cached analysis results
- event-driven refresh when possible
- API use constrained to HubSpot limits

## Non-goals for v1

- autonomous outbound
- voice agent
- forecasting
- lead qualification
- multichannel sequencing
