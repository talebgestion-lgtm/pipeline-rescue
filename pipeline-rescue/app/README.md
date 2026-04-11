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

Run regression checks:

```powershell
npm test
```

## Scope

This starter does not connect to HubSpot yet.

It is intentionally:

- dependency-light
- deterministic
- local-first

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
- `/api/compliance/report`
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
- a strict GDPR deployment gate report
- a system diagnostics panel with readiness status

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

Compliance endpoint:

- `GET /api/compliance/report`

Operator notes are now intentionally constrained:

- max 280 characters
- no direct email addresses
- no direct phone numbers
- no obvious special-category data keywords

Runtime resilience:

- atomic writes for the local runtime state file
- automatic archive of corrupt state files before clean recovery
