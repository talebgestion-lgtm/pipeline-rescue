# Pipeline Rescue Starter App

This is a minimal executable starter for Pipeline Rescue.

## Purpose

- provide a working local shell
- render mocked analysis results
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

## Scope

This starter does not connect to HubSpot yet.

It is intentionally:

- dependency-light
- deterministic
- local-first

The data comes from:

- `data/mock-overview.json`

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
