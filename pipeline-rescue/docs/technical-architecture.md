# Technical Architecture

## Objective

Define the minimum production architecture for Pipeline Rescue v1.

The architecture must support:

- HubSpot OAuth install
- deterministic deal scoring
- explainable recommendations
- task creation in HubSpot
- optional draft generation
- pilot analytics

## System overview

Pipeline Rescue should be built as four bounded layers:

1. HubSpot integration layer
2. Analysis API layer
3. Scoring and recommendation engine
4. Pilot analytics and operations layer

## Core components

### 1. HubSpot app shell

Responsibilities:

- OAuth install flow
- app configuration
- HubSpot UI extension delivery
- custom workflow action registration

### 2. Analysis API

Responsibilities:

- receive analyze requests
- fetch or hydrate required HubSpot data
- call deterministic scoring engine
- store normalized analysis snapshot
- return renderable result for UI

Key endpoints for v1:

- `POST /api/install/hubspot/callback`
- `POST /api/deals/:dealId/analyze`
- `GET /api/deals/:dealId/analysis`
- `POST /api/deals/:dealId/tasks`
- `POST /api/deals/:dealId/draft`

### 3. Scoring engine

Responsibilities:

- evaluate eligibility
- compute signal weights
- assign rescue score
- assign risk level
- generate canonical reason codes
- map reason to next best action

Important constraint:

- v1 scoring remains deterministic

### 4. Draft service

Responsibilities:

- generate short editable drafts
- never auto-send
- remain downstream of deterministic scoring
- run cycle-scoped guardrails before returning output

Guardrails:

- no draft if core data is missing
- no draft if hygiene gap blocks credible outreach
- no fabrication outside known CRM context

### 5. AI guardrail layer

Responsibilities:

- isolate one deal-analysis cycle from another
- enforce evidence-only prompting
- mark missing facts as `UNVERIFIED`
- compute a lightweight quality and stability report
- perform one correction pass before returning draft text

Implementation note:

- do not claim literal memory deletion
- implement cycle isolation with explicit request envelopes, immutable constraints, and no cross-deal draft context reuse

### 6. Persistence layer

Minimum persisted models:

- portal install
- token metadata
- analysis snapshot
- task recommendation snapshot
- pilot event log

Storage choice for v1:

- relational database

Recommended tables:

- `portal_installs`
- `deal_analysis_snapshots`
- `deal_recommendations`
- `pilot_events`
- `analysis_guardrail_reports`

### 7. UI delivery layer

Minimum UI surfaces:

- deal record app card
- optional queue view
- custom workflow action results
- verification state for draft trust

## Request flow

### Manual analysis flow

1. User opens a deal in HubSpot.
2. The app card loads current analysis.
3. If stale or absent, the UI requests analysis refresh.
4. Analysis API fetches minimum deal graph.
5. Scoring engine computes score, reasons, next action.
6. Result is persisted and returned.
7. UI renders score, reasons, and action.

### Task creation flow

1. User accepts recommended action.
2. API checks whether a duplicate open task exists.
3. API creates one HubSpot task.
4. Recommendation acceptance event is logged.

### Draft flow

1. User requests a draft.
2. API validates draft eligibility.
3. AI guardrail layer creates a cycle envelope with only verified CRM fields.
4. Draft service creates short editable copy.
5. Guardrail report is attached to the result.
6. Draft metadata is logged.

## Trust boundaries

### Deterministic boundary

The following must remain non-LLM in v1:

- eligibility
- score calculation
- reason codes
- next-action type
- task due-date logic

### LLM boundary

The following may be LLM-assisted:

- explanation phrasing
- short follow-up draft wording
- correction phrasing after a failed first draft pass

### Data minimization boundary

Do not persist raw customer narrative by default when not required:

- full email bodies
- long note bodies
- meeting transcripts

Persist instead:

- reason codes
- timestamps
- score inputs
- limited evidence strings
- guardrail outcomes and unverified field lists

## Deployment shape

Recommended v1 deployment:

- frontend UI bundle
- backend API service
- relational database
- background worker for scheduled analysis

Minimum environment variables:

- `HUBSPOT_CLIENT_ID`
- `HUBSPOT_CLIENT_SECRET`
- `HUBSPOT_REDIRECT_URI`
- `APP_BASE_URL`
- `DATABASE_URL`
- `LLM_API_KEY` if drafting is enabled

## Operational model

### Synchronous work

- manual deal analysis
- fetch latest analysis
- create follow-up task
- generate draft

### Asynchronous work

- scheduled stale-deal reanalysis
- manager digest preparation
- pilot metrics aggregation

## Performance rules

- cache deal analysis snapshots
- avoid full-portal rescans on every page view
- use targeted reads per deal
- batch background refreshes
- keep HubSpot API error rate low

## Failure handling

If HubSpot data fetch fails:

- return last valid analysis if available
- mark analysis freshness state
- log `deal_analysis_failed`

If draft generation fails:

- keep score and reasons visible
- return deterministic next action only

If task creation fails:

- preserve recommendation
- show clear retry state

## v1 architecture decision

Build the app as:

- HubSpot-native UI
- server-backed deterministic engine
- LLM-assisted draft service
- pilot analytics first-class from day one

Do not build v1 as:

- browser-only widget
- LLM-only copilot
- autonomous outbound platform
