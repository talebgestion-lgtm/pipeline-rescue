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

## Interactive demo behavior

The UI now supports:

- manual analysis refresh
- task creation with idempotent local state
- draft generation checks
- operator feedback capture (`useful` / `dismiss`)
- queue-to-focus navigation
- recent pilot event log
- scenario reset
- manager digest with coverage and owner breakdown

## Local state persistence

The pilot runtime now persists local state in:

- `data/runtime-state.json`

This file stores:

- created task state
- recent pilot events

It is safe for demo use and can be reset from the UI or via:

- `POST /api/runtime/reset?scenario=critical-stalled`
- `GET /api/runtime/export`

Manager reporting endpoint:

- `GET /api/manager/report?scenario=critical-stalled`

Feedback endpoints:

- `POST /api/deals/DL-1001/feedback/useful?scenario=critical-stalled`
- `POST /api/deals/DL-1001/feedback/dismiss?scenario=critical-stalled`
