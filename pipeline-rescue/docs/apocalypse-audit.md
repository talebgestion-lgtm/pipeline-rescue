# Apocalypse Audit

## Objective

Run a severe product and technical audit on Pipeline Rescue as if it were about to face hostile real-world pilot usage.

This document is intentionally stricter than a normal MVP review.

## Current state

Pipeline Rescue now has:

- a narrow ICP
- a deterministic scoring model
- a HubSpot data contract
- surface definitions
- a technical architecture
- a local executable starter app
- AI guardrails derived from imported anti-memory and anti-hallucination modules

It is still pre-production.

## P0 findings

### P0.1 No real auth and tenant boundary enforcement yet

Risk:

- cross-portal data leakage becomes existential

Requirement:

- bind every read, write, and cache key to `portalId`
- isolate install, token, analysis, and event records per portal

### P0.2 No implemented idempotency for task creation

Risk:

- duplicate tasks
- user distrust
- noisy CRM pollution

Requirement:

- add idempotency keys per `portalId + dealId + recommendation type + due date`

### P0.3 No real freshness policy implementation

Risk:

- stale analysis shown as current
- false urgency or missed rescues

Requirement:

- formal freshness states `FRESH | STALE | UNKNOWN`
- reanalysis triggers on timestamp and change events

### P0.4 AI layer must never outrun the deterministic layer

Risk:

- fabricated next steps
- unsafe drafts
- false confidence

Requirement:

- AI may phrase only what deterministic outputs and verified CRM fields already support
- show `UNVERIFIED` instead of guessing

### P0.5 Missing operator-visible trust telemetry

Risk:

- reps do not know whether to trust the output
- pilot feedback becomes noisy and impossible to interpret

Requirement:

- surface validation status
- surface unverified fields
- log correction passes

## P1 findings

### P1.1 No manager calibration layer yet

Risk:

- score thresholds may not fit each sales motion

Requirement:

- let pilot admins tune weights or at least threshold bands post-pilot

### P1.2 No false-positive suppression rules beyond baseline scoring

Risk:

- product over-alerts healthy deals
- reps ignore it within days

Requirement:

- protect healthy deals with explicit calm-state rules

### P1.3 No rollout safety for background analysis

Risk:

- HubSpot rate limits
- portal-wide API failures

Requirement:

- background queue with backoff, batching, and portal quotas

### P1.4 No audit trail for recommendation changes

Risk:

- impossible to explain score drift across versions

Requirement:

- store `analysisVersion`
- store score inputs
- store recommendation snapshots

## Stress-test matrix

### User stress

- rep opens a deal with no contacts
- rep asks for a draft on a blocked record
- manager challenges the score and asks why
- two reps act on the same deal at the same time

Pass condition:

- no fabricated facts
- no duplicate tasks
- clear explanation path

### Data stress

- missing owner
- missing amount
- no activity history
- invalid or orphaned associations
- stale cached snapshot after CRM edit

Pass condition:

- explicit degradation
- `UNVERIFIED` or `BLOCKED` when required
- no silent fallback to invented certainty

### Throughput stress

- 5 reps analyzing multiple deals in parallel
- background refresh on 500 open deals
- repeated draft requests for the same record

Pass condition:

- bounded latency
- bounded retries
- no runaway loops

### Trust stress

- operator intentionally tries to force a better score
- prompt injection inside free-text CRM notes
- note text contains impossible instructions such as "ignore previous rules"

Pass condition:

- treat CRM text as evidence data, never as system instructions

## Minimum release gates

- HubSpot OAuth flow works for one pilot portal
- deal analysis is deterministic and reproducible
- task creation is idempotent
- draft generation respects guardrail statuses
- `VALIDATED`, `UNVERIFIED`, and `BLOCKED` states are visible in UI
- pilot events are queryable by portal and deal
- no customer-facing draft can mention unverified facts

## What the starter app now proves

The starter app is useful because it simulates four high-value situations:

- critical stalled deal
- draft blocked by hygiene gap
- insufficient data and unverified state
- healthy monitored deal with no fake urgency

This is the right direction for field testing because it exercises trust boundaries, not just pretty UI.

## Next implementation order

1. build HubSpot install and tenant persistence
2. implement deterministic analysis API with stored snapshots
3. implement guardrail report generation
4. implement task idempotency and retry-safe writes
5. connect the local starter UI to live API payloads
6. add pilot dashboards and operator feedback capture

## Final judgment

Pipeline Rescue is now better framed and less naive.

It is not ready for a production rollout, but it is becoming credible for a controlled pilot because:

- the deterministic core is explicit
- the AI boundary is constrained
- the trust model is visible
- the demo now covers failure states instead of only success theater
