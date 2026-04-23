# Pipeline Rescue

Pipeline Rescue is a HubSpot-native deal rescue assistant for sales teams.

The local pilot runtime now persists through a state index, per-scenario shards, and an append-only recovery journal for safer operator testing.
It also exposes a runtime integrity audit and maintenance compaction path for field support.
The app root now includes Docker deployment artifacts and a deployment profile endpoint for pilot rollout checks.

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
- `docs/commercialization-kit.md`
- `docs/pilot-instrumentation.md`
- `docs/technical-architecture.md`
- `docs/gdpr-strict-mode.md`
- `docs/gdpr-record-template.md`
- `docs/sales-assets/one-page-offer.md`
- `docs/sales-assets/demo-deck-outline.md`
- `docs/sales-assets/prospecting-email.md`
- `docs/sales-assets/demo-script.md`
- `docs/sales-assets/pilot-agreement-template.md`
- `docs/sales-assets/privacy-notice-template.md`
- `docs/sales-assets/billing-setup.md`
- `docs/sales-assets/onboarding-email.md`
- `docs/sales-assets/first-customer-runbook.md`
- `docs/sales-assets/publish-checklist.md`
- `docs/sales-assets/outreach-target-list.md`
- `docs/sales-assets/sales-pipeline-tracker.csv`
- `docs/sales-assets/discovery-call-notes.md`
- `site/index.html`
- `site/pilot.html`
- `site/privacy.html`
- `site/terms.html`
- `site/check-site-links.js`

## Target customer

- initial ICP: B2B SaaS teams on HubSpot
- 5 to 30 quota-carrying reps
- active pipeline discipline
- enough volume to expose stalled deals clearly

## Commercial model

- Pilot: EUR500 setup + EUR299 for the first 30 days
- Starter: EUR99/month
- Pro: EUR299/month
- Team: EUR799/month

Pricing should be per HubSpot portal with clear usage caps.

The first sales motion should use the controlled pilot offer in `docs/commercialization-kit.md`.

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
- HubSpot Private App token mode for simple single-account local pilots without a website or OAuth app setup
- live HubSpot deal preview with local token refresh and deterministic normalization
- live HubSpot owner-name enrichment from the Owners API with safe fallback
- idempotent live HubSpot task writes that avoid duplicate open rescue tasks
- bounded HubSpot retry handling for transient `429` and `5xx` failures
- note-capable HubSpot OAuth defaults and idempotent rescue-note write protection
- live CRM revalidation just before HubSpot rescue task and note writes
- refreshed HubSpot install state survives duplicate-write skips and live write failures
- stored HubSpot installs are now blocked if they no longer satisfy the current required scope set
- live HubSpot stale-deal discovery by CRM criteria
- live HubSpot multi-deal queue for manager rescue review
- live HubSpot rescue batch execution for validated at-risk tasks
- live HubSpot task write-back from the deterministic rescue recommendation
- live HubSpot draft generation and note write-back for CRM-side execution traces
- imported anti-memory and anti-hallucination guardrails translated into product rules
- strict GDPR deployment gate and operational compliance template
- runtime-first storage separation so portable or deployed instances can keep mutable state outside bundled app files
- idempotent runtime bootstrap so portable packages seed their writable config area before the app starts
- runtime observability in the system report so each instance exposes its active storage mode and bootstrap status
- a support-bundle export path for pilot diagnostics, migration, and customer support without machine-by-machine inspection
- a controlled support-bundle restore path with automatic backup of mutable runtime files before import
- a runtime snapshot capture and rollback path for safer pilot recovery
- single-instance runtime locking so a pilot cannot corrupt the same writable runtime from two parallel processes
- optional shared-secret access protection so a deployed pilot instance is not left open by default
- append-only runtime journal replay so a pilot instance can recover from a stale or broken primary state file
- publishable static pilot site with overview, pilot, privacy, and terms pages
- static site link validation in the GitHub Pages publishing workflow
