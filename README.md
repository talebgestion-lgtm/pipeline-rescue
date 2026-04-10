# Pipeline Rescue

This repository contains the initial product foundation for **Pipeline Rescue**, a HubSpot app focused on rescuing stalled deals.

## Scope

- `pipeline-rescue/README.md`: product overview
- `pipeline-rescue/docs/market-audit.md`: market and wedge analysis
- `pipeline-rescue/docs/mvp-spec.md`: MVP functional specification
- `pipeline-rescue/docs/scoring-spec.md`: deterministic rescue score logic
- `pipeline-rescue/docs/hubspot-data-contract.md`: build-time data contract
- `pipeline-rescue/docs/analysis-result-schema.md`: normalized analysis payloads
- `pipeline-rescue/docs/ai-guardrails.md`: anti-hallucination and cycle-isolation rules
- `pipeline-rescue/docs/apocalypse-audit.md`: severe release-risk audit
- `pipeline-rescue/docs/hubspot-surface-spec.md`: HubSpot UI and workflow surfaces
- `pipeline-rescue/docs/icp.md`: initial customer profile
- `pipeline-rescue/docs/pilot-instrumentation.md`: pilot metrics and events
- `pipeline-rescue/docs/technical-architecture.md`: system architecture
- `pipeline-rescue/docs/roadmap.md`: build and go-to-market roadmap
- `pipeline-rescue/app/`: starter executable demo
- `pipeline-rescue/site/`: static presentation page

## Positioning

Pipeline Rescue is not a generic AI sales assistant. It is a focused deal rescue product for sales teams using HubSpot:

- detect stalled deals
- explain why they are at risk
- suggest the next best action
- draft a follow-up
- create the right task in HubSpot

## Current stage

This repository is the factory-mode product foundation:

- positioning locked
- MVP scope locked
- scoring framework specified
- HubSpot data contract specified
- pilot instrumentation specified
