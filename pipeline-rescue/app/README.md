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
- `POST /api/hubspot/live/queue`
- `POST /api/hubspot/live/deals/123456/tasks?portalId=999999`
- `POST /api/hubspot/live/deals/123456/draft?portalId=999999`
- `POST /api/hubspot/live/deals/123456/notes?portalId=999999`
- `/api/compliance/report`
- `/api/compliance/config`
- `/api/system/report`
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
- a live HubSpot multi-deal queue path for manager-level rescue review
- a live HubSpot task write path tied to the deterministic rescue recommendation
- a live HubSpot draft path with provider-live or deterministic fallback
- a live HubSpot note write path to persist the follow-up draft on the CRM record
- a strict GDPR deployment gate report
- a system diagnostics panel with readiness status
- a local compliance-config editor for real legal inputs
- a guided compliance form above the raw JSON editor
- an installable PWA shell for desktop/mobile pilots

## Local state persistence

The pilot runtime now persists local state in:

- `data/runtime-state.json`

This file stores:

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
7. use `Create Live HubSpot Task` only after validating the live preview and recommendation
8. use `Generate Live HubSpot Draft` to get either a provider-live draft or a deterministic fallback
9. use `Save Draft As HubSpot Note` to persist the current rescue draft on the HubSpot record
