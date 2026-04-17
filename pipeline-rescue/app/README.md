# Pipeline Rescue Starter App

This is a minimal executable starter for Pipeline Rescue.

## Purpose

- provide a working local shell
- compute deterministic analysis results from scenario inputs
- demonstrate score, reasons, next action, and queue behavior

## Run

```powershell
cd "C:\Users\ec\Documents\New project\pipeline-rescue\app"
npm start
```

Open:

```text
http://localhost:4179
```

Install as an app in Chromium browsers:

- open `http://localhost:4179`
- wait for the install card to report `Install ready` or `Shell ready`
- use `Install App` or the browser menu `Install app` / `Add to home screen`

Run regression checks:

```powershell
npm test
```

Build a portable Windows release folder:

```powershell
npm run build:release
```

Use an external runtime directory when mutable state must live outside the bundled app tree:

```powershell
$env:PIPELINE_RESCUE_RUNTIME_DIR = "C:\PipelineRescueData"
npm start
```

Protect a deployed instance with a shared secret:

```powershell
$env:PIPELINE_RESCUE_ACCESS_MODE = "SHARED_SECRET"
$env:PIPELINE_RESCUE_ACCESS_TOKEN = "change-this-before-deploying"
npm start
```

Bootstrap that runtime directory explicitly when needed:

```powershell
npm run bootstrap:runtime
```

## Scope

It is intentionally:

- dependency-light
- deterministic
- local-first
- cross-platform friendly for low-cost pilots

The scenario inputs come from:

- `data/scenario-inputs.json`

The deterministic engine lives in:

- `lib/analysis-engine.js`

## Stress scenarios

The starter now simulates multiple trust and failure states:

- `critical-stalled`
- `draft-blocked`
- `insufficient-data`
- `healthy-monitored`

You can switch scenarios from the UI or use the query string:

```text
http://localhost:4179/?scenario=draft-blocked
```

## Local API

- `/api/scenarios`
- `/api/overview?scenario=critical-stalled`
- `/api/deals/DL-1001/analysis?scenario=critical-stalled`
- `POST /api/deals/DL-1001/analyze?scenario=critical-stalled`
- `POST /api/deals/DL-1001/tasks?scenario=critical-stalled`
- `POST /api/deals/DL-1001/draft?scenario=critical-stalled`
- `/api/events?scenario=critical-stalled`
- `/api/feedback/report?scenario=critical-stalled`
- `/api/feedback/export?scenario=critical-stalled&format=json`
- `/api/feedback/export?scenario=critical-stalled&format=csv`
- `/api/ai/policy`
- `/api/ai/control-center?scenario=critical-stalled`
- `POST /api/ai/run-cycle?scenario=critical-stalled`
- `/api/ai/provider-config`
- `/api/ai/provider-status`
- `POST /api/ai/provider-probe`
- `POST /api/deals/DL-1001/live-draft?scenario=critical-stalled`
- `/api/hubspot/config`
- `/api/hubspot/status`
- `/api/hubspot/install-url`
- `POST /api/hubspot/oauth/exchange`
- `/api/hubspot/oauth/callback`
- `/api/hubspot/live/deals/123456?portalId=999999`
- `POST /api/hubspot/live/search`
- `POST /api/hubspot/live/rescue-run`
- `POST /api/hubspot/live/queue`
- `POST /api/hubspot/live/deals/123456/tasks?portalId=999999`
- `POST /api/hubspot/live/deals/123456/draft?portalId=999999`
- `POST /api/hubspot/live/deals/123456/notes?portalId=999999`
- `/api/compliance/report`
- `/api/compliance/config`
- `/api/access/status`
- `POST /api/access/verify`
- `/api/system/report`
- `/api/runtime/support-bundle`
- `POST /api/runtime/support-bundle/restore`
- `/api/runtime/snapshots`
- `POST /api/runtime/snapshots`
- `POST /api/runtime/snapshots/:snapshotId/restore`
- `/health/live`
- `/health/ready`

## Interactive demo behavior

The UI now supports:

- manual analysis refresh
- task creation with idempotent local state
- draft generation checks
- operator feedback capture (`useful` / `dismiss`)
- structured operator dismissal reason
- free-text operator note
- GDPR-safe note entry guardrails
- calibrated recommendation trust based on operator signal
- deterministic note-to-theme classification for product friction analysis
- recent feedback history per deal
- corrupt state recovery with archived backup
- queue-to-focus navigation
- recent pilot event log
- scenario reset
- manager digest with coverage and owner breakdown
- top friction patterns from dismissed field feedback
- an AI control center with local autonomy policy management
- an executable AI cycle that analyzes the queue and automates only what policy allows
- a live-provider readiness panel with persisted provider config
- a live provider probe and live-draft endpoint for the focused deal
- a HubSpot OAuth config panel, install URL generator, and manual code exchange path
- a live HubSpot deal preview path with token refresh and deterministic normalization
- live HubSpot owner resolution so previews and queue items use real owner names when the Owners API is accessible
- idempotent live HubSpot task writes that block duplicate open rescue tasks on the same deal
- bounded HubSpot retry handling for transient `429` and `5xx` API failures
- note-capable HubSpot OAuth defaults and duplicate rescue-note blocking on the same deal
- live CRM revalidation immediately before HubSpot rescue task and note writes
- refreshed HubSpot install state now survives duplicate-write skips and failed live writes
- stored HubSpot installs are blocked until reinstalled if they miss newly required OAuth scopes
- a live HubSpot criteria-discovery path to find stale deals without manually collecting IDs
- a live HubSpot multi-deal queue path for manager-level rescue review
- a live HubSpot rescue batch path that writes only validated at-risk tasks from the discovered queue
- a live HubSpot task write path tied to the deterministic rescue recommendation
- a live HubSpot draft path with provider-live or deterministic fallback
- a live HubSpot note write path to persist the follow-up draft on the CRM record
- a strict GDPR deployment gate report
- a system diagnostics panel with readiness status
- runtime diagnostics that expose the active storage mode, runtime directory, and bootstrap-report status
- a downloadable support bundle that captures runtime state, system diagnostics, configs, and sanitized HubSpot install metadata
- a controlled support-bundle restore flow with runtime backup before import
- a runtime snapshot catalog with manual capture and rollback
- single-instance runtime locking so two processes cannot mutate the same runtime directory at once
- optional shared-secret access protection for deployed API routes
- append-only runtime journal replay when the main state file is missing, stale, or corrupt
- structured per-scenario runtime shards behind the state index for safer persistence and recovery
- a local compliance-config editor for real legal inputs
- a guided compliance form above the raw JSON editor
- an installable PWA shell for desktop/mobile pilots
- runtime-first storage separation for portable and deployed environments

## Local state persistence

The pilot runtime now persists local state in:

- `data/runtime-state.json`
- `data/scenario-state/*.json`
- `data/runtime-journal.jsonl`

If `PIPELINE_RESCUE_RUNTIME_DIR` is set, mutable files are written there instead of `app/data`.

The bootstrap script seeds missing runtime files:

- `gdpr-config.json`
- `ai-policy.json`
- `ai-provider-config.json`
- `hubspot-config.json`
- `hubspot-install-state.json`
- `bootstrap-report.json`

The state index and scenario shards store:

- created task state
- feedback status and feedback history
- recent pilot events

It is safe for demo use and can be reset from the UI or via:

- `POST /api/runtime/reset?scenario=critical-stalled`
- `GET /api/runtime/export`

Manager reporting endpoint:

- `GET /api/manager/report?scenario=critical-stalled`

Feedback endpoints:

- `POST /api/deals/DL-1001/feedback/useful?scenario=critical-stalled`
- `POST /api/deals/DL-1001/feedback/dismiss?scenario=critical-stalled`
- `GET /api/feedback/report?scenario=critical-stalled`
- `GET /api/feedback/export?scenario=critical-stalled&format=json`
- `GET /api/feedback/export?scenario=critical-stalled&format=csv`

Feedback POST bodies can now include:

- `reasonCode`
- `note`

Feedback reporting now also exposes:

- classified operator themes
- top friction patterns
- enriched JSON and CSV exports with theme labels

AI policy endpoints:

- `GET /api/ai/policy`
- `POST /api/ai/policy`
- `GET /api/ai/control-center?scenario=critical-stalled`
- `POST /api/ai/run-cycle?scenario=critical-stalled`

AI provider endpoints:

- `GET /api/ai/provider-config`
- `POST /api/ai/provider-config`
- `GET /api/ai/provider-status`
- `POST /api/ai/provider-probe`
- `POST /api/deals/DL-1001/live-draft?scenario=critical-stalled`

HubSpot endpoints:

- `GET /api/hubspot/config`
- `POST /api/hubspot/config`
- `GET /api/hubspot/status`
- `GET /api/hubspot/install-url`
- `POST /api/hubspot/oauth/exchange`
- `GET /api/hubspot/oauth/callback`
- `POST /api/hubspot/live/search`
- `POST /api/hubspot/live/rescue-run`
- `POST /api/hubspot/live/queue`
- `GET /api/hubspot/live/deals/:dealId?portalId=...`
- `POST /api/hubspot/live/deals/:dealId/tasks?portalId=...`
- `POST /api/hubspot/live/deals/:dealId/draft?portalId=...`
- `POST /api/hubspot/live/deals/:dealId/notes?portalId=...`

Compliance endpoint:

- `GET /api/compliance/report`
- `GET /api/compliance/config`
- `POST /api/compliance/config`

Operator notes are now intentionally constrained:

- max 280 characters
- no direct email addresses
- no direct phone numbers
- no obvious special-category data keywords

Runtime resilience:

- atomic writes for the local runtime state file
- automatic archive of corrupt state files before clean recovery

## Portable release output

`npm run build:release` creates:

- `release/pipeline-rescue-portable/app/`
- `release/pipeline-rescue-portable/launch-pipeline-rescue.cmd`
- `release/pipeline-rescue-portable/README.txt`

This gives you a Windows-portable delivery folder without introducing Electron or a paid packaging stack.

`release/pipeline-rescue-portable/app/.env.example` is included so a live AI provider can be configured without editing source files first.

If you want live OpenAI calls in the portable package:

1. copy `.env.example` to `.env`
2. set `OPENAI_API_KEY`
3. switch the provider from `NONE` to `OPENAI` in the app
4. enable `Provider enabled` and `Allow live generation`

For HubSpot OAuth:

1. set `HUBSPOT_CLIENT_SECRET` in `.env`
2. save the HubSpot config in the app
3. generate the install URL
4. complete the install flow or paste the returned code for manual exchange
5. use `Load Live Deal Preview` with a real HubSpot deal ID to validate the live normalization path
6. use `Load Live HubSpot Queue` with several deal IDs to inspect a real at-risk queue
7. use `Discover Live Queue By Criteria` to pull stale live deals directly from HubSpot
8. use `Run Live Rescue Tasks` to create only validated at-risk HubSpot tasks from the discovered queue
9. use `Create Live HubSpot Task` only after validating the live preview and recommendation
10. use `Generate Live HubSpot Draft` to get either a provider-live draft or a deterministic fallback
11. use `Save Draft As HubSpot Note` to persist the current rescue draft on the HubSpot record
