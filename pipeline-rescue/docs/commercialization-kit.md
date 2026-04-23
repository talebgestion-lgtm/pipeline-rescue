# Commercialization Kit

## Objective

Turn Pipeline Rescue into a sellable pilot offer without overstating the product.

This kit is for the first direct sales conversations, not broad marketplace distribution.

## Sellable promise

Pipeline Rescue helps HubSpot sales teams find stalled deals, understand why they are at risk, and turn that diagnosis into a concrete next action.

## Do not promise

- autonomous email sending
- guaranteed recovered revenue
- replacement of sales managers
- full CRM cleanup
- legal or GDPR compliance by default
- marketplace-ready multi-tenant SaaS maturity

## Initial offer

### Pilot name

Pipeline Rescue: 30-day stalled deal recovery pilot.

### Target buyer

- Head of Sales
- VP Sales
- Founder-led sales team
- Revenue Operations lead

### Target account

- B2B SaaS or B2B service company
- HubSpot is the active sales CRM
- `5` to `30` sales users
- at least `50` open deals
- sales cycle of `30` to `120` days
- team already logs tasks, notes, or meetings with reasonable consistency

### Pilot price

- EUR500 setup fee
- EUR299 for the first 30-day pilot
- EUR299/month after pilot if the customer continues

Use a lower price only for the first reference customer, and only in exchange for written feedback and permission to use anonymized results.

## Pilot scope

### Included

- local or controlled pilot setup
- HubSpot connection with OAuth or Private App token
- review of stale deals
- rescue score and reason explanation
- next best action recommendation
- task creation in HubSpot
- draft generation with human review
- weekly pilot readout
- support bundle review if needed

### Excluded

- autonomous outbound sending
- custom CRM migration
- complex multi-pipeline consulting
- custom sales process redesign
- guaranteed win-rate improvement
- production SLA

## Qualification checklist

A prospect is qualified when all are true:

- HubSpot is used daily for sales pipeline work.
- The team has enough open deals to analyze.
- Deal owners are assigned.
- Recent activity data exists.
- The buyer cares about stalled opportunities.
- The buyer accepts a human-reviewed workflow.
- The buyer can give access to a test HubSpot portal or Private App token.

Disqualify or delay when:

- HubSpot is not the sales source of truth.
- CRM hygiene is extremely poor.
- The buyer wants a fully autonomous AI SDR.
- The buyer demands enterprise procurement before a pilot.
- The use case involves sensitive personal data or regulated advice.

## Sales script

### Opening

Most HubSpot teams already know some deals are silently dying. The hard part is seeing which ones matter first, why they are at risk, and what action should happen today.

Pipeline Rescue is a focused tool for stalled deal recovery. It is not a generic AI sales copilot.

### Problem questions

- How do you currently spot deals that have gone quiet?
- How often do managers review stale deals?
- Do reps consistently create next-step tasks?
- Do you know which stalled deals are still worth rescuing?
- What happens when a deal has no activity for two or three weeks?

### Demo narrative

1. Load the HubSpot live queue.
2. Show the at-risk deals ranked by rescue score.
3. Open one deal.
4. Explain the top risk reasons.
5. Show the recommended action.
6. Create the HubSpot task.
7. Generate a follow-up draft.
8. Save the draft as a HubSpot note.
9. Show the manager report and feedback loop.

### Close

The pilot is simple: we connect a limited HubSpot scope, analyze stalled deals for 30 days, measure task adoption and rescue engagement, then decide if the workflow is worth keeping.

## Objection handling

### "HubSpot already has AI."

HubSpot AI is broad. Pipeline Rescue is deliberately narrow: stalled deal recovery, risk explanation, next action, and task write-back.

### "Our reps already know their deals."

Good reps know many of their deals. The problem is consistency across the pipeline and early detection before manager reviews.

### "We do not want AI sending emails."

Pipeline Rescue does not auto-send. Drafts stay human-reviewed and editable.

### "Our CRM data is messy."

The pilot can reveal whether the data is good enough. If the app cannot trust the data, it reports that instead of inventing certainty.

### "We are not ready for a SaaS rollout."

The first offer is a controlled pilot, not a full enterprise rollout.

## Pilot success metrics

Track these during the pilot:

- number of analyzed deals
- number of at-risk deals
- recommendation-to-task creation rate
- draft generation rate
- operator useful/dismissed feedback
- top dismissal reasons
- at-risk deals with renewed activity within `7` days
- at-risk deals with stage movement within `30` days

## Pilot go/no-go

### Continue when

- the customer loads real HubSpot deals successfully
- risk reasons are considered credible
- task creation is used at least weekly
- feedback is more useful than dismissed
- at least some at-risk deals receive renewed activity

### Stop or reset when

- HubSpot data quality is too poor
- the buyer expects autonomous sending
- recommendations are regularly disputed
- no one uses the queue after onboarding
- compliance or data access cannot be resolved

## Onboarding checklist

### Before setup

- confirm ICP fit
- confirm HubSpot access route: OAuth or Private App token
- confirm OpenAI API key route if live generation is enabled
- confirm no sensitive data should be entered in operator notes
- confirm the pilot success metrics

### Setup

- create `.env`
- set `PIPELINE_RESCUE_ACCESS_MODE=SHARED_SECRET`
- set `PIPELINE_RESCUE_ACCESS_TOKEN`
- set `OPENAI_API_KEY` if live drafts are enabled
- set `HUBSPOT_PRIVATE_APP_TOKEN` for simple local pilots
- set HubSpot auth mode to `PRIVATE_APP`
- save HubSpot config
- run `/api/hubspot/status`
- run `/api/ai/provider-status`
- run `/api/deployment/profile`

### First live test

- load one real HubSpot deal
- review normalized fields and warnings
- create one HubSpot rescue task
- generate one draft
- save one HubSpot note
- export a support bundle after setup

## Commercial assets to prepare next

- one-page offer: `docs/sales-assets/one-page-offer.md`
- 5-slide deck outline: `docs/sales-assets/demo-deck-outline.md`
- product walkthrough script: `docs/sales-assets/demo-script.md`
- pilot agreement template: `docs/sales-assets/pilot-agreement-template.md`
- privacy notice template: `docs/sales-assets/privacy-notice-template.md`
- billing setup: `docs/sales-assets/billing-setup.md`
- prospecting email sequence: `docs/sales-assets/prospecting-email.md`
- onboarding email: `docs/sales-assets/onboarding-email.md`
- public publish checklist: `docs/sales-assets/publish-checklist.md`
- first customer runbook: `docs/sales-assets/first-customer-runbook.md`
- outreach target list: `docs/sales-assets/outreach-target-list.md`
- sales pipeline tracker: `docs/sales-assets/sales-pipeline-tracker.csv`
- discovery call notes: `docs/sales-assets/discovery-call-notes.md`

Still needed before taking paid customers:

- legal review of the pilot agreement
- invoicing and payment method
- support contact email

## Current commercial cutline

Sell as:

- controlled paid pilot
- HubSpot stalled-deal recovery workflow
- human-reviewed AI assist

Do not sell yet as:

- broad SaaS platform
- marketplace-certified HubSpot app
- autonomous sales agent
- fully managed CRM operations product
