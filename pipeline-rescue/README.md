# Pipeline Rescue

Pipeline Rescue is a HubSpot-native deal rescue assistant for sales teams.

## Core promise

Every morning, reps and managers know:

- which deals are stalling
- why they are stalling
- what to do next
- what to send next

## Product wedge

The wedge is **stalled deal recovery**, not generic AI prospecting.

That matters because:

- HubSpot already offers broad AI and prospecting capabilities
- the market is crowded with AI SDR and follow-up assistants
- a narrow ROI story is easier to sell, demo, and price

## MVP

The first version should include:

- HubSpot deal app card
- risk score for stalled deals
- plain-language risk reasons
- next best action suggestion
- follow-up email draft
- task creation inside HubSpot
- workflow action to analyze a deal

Supporting specs:

- `docs/scoring-spec.md`
- `docs/hubspot-data-contract.md`
- `docs/analysis-result-schema.md`
- `docs/ai-guardrails.md`
- `docs/apocalypse-audit.md`
- `docs/hubspot-surface-spec.md`
- `docs/icp.md`
- `docs/pilot-instrumentation.md`
- `docs/technical-architecture.md`
- `docs/gdpr-strict-mode.md`
- `docs/gdpr-record-template.md`

## Target customer

- initial ICP: B2B SaaS teams on HubSpot
- 5 to 30 quota-carrying reps
- active pipeline discipline
- enough volume to expose stalled deals clearly

## Commercial model

- Starter: EUR99/month
- Pro: EUR299/month
- Team: EUR799/month

Pricing should be per HubSpot portal with clear usage caps.

## Current stage

The project is no longer only a positioning deck.

It now has:

- market wedge
- MVP boundary
- deterministic scoring spec
- HubSpot data contract
- pilot instrumentation model
- technical architecture
- starter executable demo with stress scenarios and a deterministic local engine
- installable PWA shell for desktop/mobile pilots
- portable Windows release packaging for field testing
- local AI operations policy and autonomy control center
- executable AI cycle with policy-gated actions
- persisted live-provider configuration and readiness checks
- live provider probe and focused-deal live draft path
- HubSpot OAuth config, install URL, and local install persistence
- live HubSpot deal preview with local token refresh and deterministic normalization
- live HubSpot task write-back from the deterministic rescue recommendation
- imported anti-memory and anti-hallucination guardrails translated into product rules
- strict GDPR deployment gate and operational compliance template
