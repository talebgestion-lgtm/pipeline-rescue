# AI Guardrails

## Objective

Translate the imported `ANTI PERTE MEMOIRE` and `ANTI-HALLU` modules into production-safe rules for Pipeline Rescue.

The goal is not to copy prompt folklore. The goal is to extract the useful mechanics and make them implementable.

## Imported intent

The desktop modules consistently ask for four things:

1. cycle isolation
2. hallucination detection
3. explicit quality control
4. correction before output release

Those intents are valid, but they need to be expressed as system behavior we can actually build and verify.

## Production interpretation

### 1. Memory reset becomes cycle isolation

Pipeline Rescue must not claim literal model memory erasure.

Instead, for every deal analysis or draft request:

- build a fresh request envelope
- include only deal-scoped verified CRM fields
- exclude previous deal context
- exclude prior draft text unless the user explicitly requests regeneration for the same deal

### 2. Anti-hallucination becomes evidence gating

The AI layer may only phrase content that is supported by:

- HubSpot fields
- associated contact data
- deterministic score outputs
- controlled product templates

If a required fact is missing:

- label it `UNVERIFIED`
- block the draft if customer-facing text would become speculative
- return deterministic remediation instead of invented certainty

### 3. Quality control becomes a visible verification report

Every AI-assisted response should produce a small guardrail report:

- `validationStatus`
- `stabilityScore`
- `hallucinationRisk`
- `unverifiedFields`
- `correctionsApplied`

This report is for trust, debugging, and pilot analytics.

### 4. Self-correction becomes one bounded correction pass

The system may run one correction pass when:

- unsupported claims are detected
- tone overstates certainty
- customer-facing output references missing contacts or dates

After one correction pass:

- if the output is still unsafe, block it
- do not loop indefinitely

## Hard rules

- Deterministic scoring stays upstream from the AI layer.
- AI never invents meetings, stakeholders, approvals, or next steps.
- Missing evidence is shown as missing evidence.
- Drafts are editable suggestions only.
- No auto-send behavior in v1.

## Guardrail statuses

### `VALIDATED`

Use when the minimum evidence set exists and the final output passed one audit pass.

### `UNVERIFIED`

Use when the output can still be displayed, but one or more critical facts are absent or weak.

### `BLOCKED`

Use when any customer-facing draft would require fabricated details or unsafe assumptions.

## Minimum evidence set for draft eligibility

Require all of the following:

- verified deal owner
- at least one usable contact channel
- deterministic reason set
- recommended action type
- no blocking CRM hygiene gap

## Telemetry

Track these events:

- `guardrail_validation_passed`
- `guardrail_validation_failed`
- `guardrail_output_blocked`
- `guardrail_correction_applied`
- `guardrail_unverified_fields_present`

## What not to implement

- fake promises of zero hallucination
- claims of literal context deletion
- self-learning logic without reviewable feedback controls
- hidden quality scores with no operator visibility

## v1 decision

Inject the modules as:

- cycle isolation
- evidence gating
- explicit verification metadata
- one-pass correction logic

Do not inject them as:

- mystical memory wipe claims
- autonomous rewriting loops
- unbounded scoring rituals
