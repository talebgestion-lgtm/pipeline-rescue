# First Customer Runbook

## Objective

Move from demo to first paid pilot without improvising.

## Day 0: qualify

Confirm:

- HubSpot is used for sales execution
- at least `50` open deals exist
- sales team has `5` to `30` users
- buyer cares about stalled deals
- customer accepts human-reviewed workflow
- customer can provide HubSpot access

If these are false, do not sell the pilot yet.

## Day 1: commercial setup

Send:

- one-page offer
- pilot agreement
- privacy notice
- onboarding email

Decide:

- pilot start date
- HubSpot pipeline in scope
- weekly review time
- primary customer contact
- payment method

## Day 2: technical setup

Prepare environment:

- create `.env`
- set `PIPELINE_RESCUE_ACCESS_MODE=SHARED_SECRET`
- set `PIPELINE_RESCUE_ACCESS_TOKEN`
- set `HUBSPOT_PRIVATE_APP_TOKEN`
- set `OPENAI_API_KEY` only if live draft generation is enabled
- start app
- unlock app

In the app:

- set HubSpot auth mode to `PRIVATE_APP`
- save HubSpot config
- verify HubSpot status is `READY`
- verify AI provider status if enabled
- export support bundle after setup

## Day 3: first live proof

Run:

- load one real deal
- inspect normalization warnings
- create one task
- generate one draft
- save one note
- verify the task and note exist in HubSpot

Stop if:

- HubSpot token fails
- deal data is not readable
- recommendations are obviously not grounded
- customer data includes sensitive content outside scope

## Week 1: controlled use

Use on a small queue:

- max `5` deals per review
- no batch write until single-deal flow is trusted
- collect useful/dismissed feedback
- note top objection from users

## Weekly review

Review:

- analyzed deals
- at-risk deals
- tasks created
- drafts generated
- dismissed recommendations
- renewed activity
- user objections

## End of pilot

Prepare a simple readout:

- what worked
- what failed
- examples of credible recommendations
- examples of disputed recommendations
- adoption metrics
- recommendation for continue / pause / reset

## Continue criteria

Continue if:

- customer trusts the risk reasons
- task creation is used
- workflow saves manager or rep time
- at-risk deals receive renewed attention

## Stop criteria

Stop if:

- CRM hygiene is too poor
- customer wants autonomous sending
- recommendations are regularly disputed
- data access cannot be stabilized
