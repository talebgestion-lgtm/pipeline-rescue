# HubSpot Data Contract

## Objective

Define the minimum HubSpot data Pipeline Rescue needs to score deals, explain risk, and create follow-up tasks.

This contract is intentionally narrow for v1.

## Core objects

### Deals

The deal is the primary object.

Minimum fields to request:

- `hs_object_id`
- `dealname`
- `dealstage`
- `pipeline`
- `amount`
- `closedate`
- `createdate`
- `hs_lastmodifieddate`
- `hubspot_owner_id`
- `hs_next_step`

Use:
- scoring
- eligibility checks
- explanation rendering
- task recommendation ownership

### Contacts

Associated contacts are required for coverage analysis.

Minimum fields to request:

- `hs_object_id`
- `firstname`
- `lastname`
- `email`
- `jobtitle`
- `hs_lastmodifieddate`

Use:
- contact coverage
- decision-maker presence
- draft personalization

### Activities

Use only the minimum activity set required for scoring.

#### Tasks

Minimum fields:

- `hs_timestamp`
- `hs_task_subject`
- `hs_task_status`
- `hubspot_owner_id`

Use:
- detect future task coverage
- avoid duplicate follow-up tasks

#### Notes

Minimum fields:

- `hs_timestamp`
- `hs_note_body`

Use:
- optional qualitative context
- timeline freshness checks

#### Meetings

Minimum fields:

- `hs_timestamp`
- meeting title when available

Use:
- timeline freshness
- meaningful activity detection

#### Emails

Minimum fields:

- `hs_timestamp`
- email subject when available

Use:
- timeline freshness
- optional context for draft tone

## Associations required

### Deal -> Contacts

Required:
- unlabeled or primary association

Optional but recommended:
- custom label for decision-maker

### Deal -> Tasks

Required for:
- next-step coverage
- duplicate prevention

### Deal -> Notes / Meetings / Emails

Required for:
- activity freshness
- qualitative evidence

## Minimum scopes for v1

These scopes must be validated against the exact endpoint references during app registration.

Required intent:
- OAuth install
- read deals
- read contacts
- read associated activities required for scoring
- create and read tasks

Target scope set for v1:
- `oauth`
- `crm.objects.deals.read`
- `crm.objects.contacts.read`
- `crm.objects.tasks.read`
- `crm.objects.tasks.write`

Conditionally required scopes:
- activity read scopes for notes, meetings, and emails used in the chosen implementation

## Field requirements by feature

| Feature | Required objects | Required fields |
| --- | --- | --- |
| Eligibility | deals | `dealstage`, `pipeline`, `hubspot_owner_id` |
| Rescue score | deals, contacts, activities | `amount`, `hs_next_step`, last activity timestamps |
| Reasons | deals, contacts, tasks | missing fields, contact count, next task presence |
| Next best action | deals, tasks | top reason, owner, next task state |
| Draft generation | deals, contacts, optional activities | deal name, contact names, recent context |
| Task creation | deals | deal ID, owner ID, next action type |

## Missing data policy

The system must never fail silently on missing CRM data.

Rules:
- missing critical fields increase risk score through `CRM_HYGIENE_GAP`
- draft generation is blocked if core deal context is insufficient
- analysis still completes when optional context is absent

Critical missing fields:
- `dealstage`
- `pipeline`
- `hubspot_owner_id`

Blocking missing fields for draft generation:
- no associated contact
- no owner
- no next-action template path

## Freshness policy

Read model freshness requirements:
- deal properties: up to `15` minutes old
- tasks: up to `15` minutes old
- activity freshness checks: up to `30` minutes old

v1 should prefer:
- targeted reads on analysis trigger
- cached analysis result storage
- recomputation on demand or on schedule

## Analysis result contract

Store a normalized analysis result in the backend:

```json
{
  "dealId": "12345",
  "portalId": "67890",
  "analyzedAt": "2026-04-10T16:00:00Z",
  "score": 68,
  "riskLevel": "HIGH",
  "topReasons": [
    {
      "code": "ACTIVITY_STALE",
      "weight": 20,
      "evidence": "No logged activity for 15 days."
    }
  ],
  "recommendedAction": {
    "type": "FOLLOW_UP_EMAIL",
    "priority": "HIGH"
  },
  "taskDraft": {
    "subject": "Follow up on stalled deal",
    "dueInDays": 1
  },
  "dataQuality": {
    "missingFields": [],
    "blockedDraft": false
  }
}
```

## Task creation contract

When the user accepts the recommendation, create one HubSpot task with:

- `hs_timestamp`
- `hs_task_subject`
- `hs_task_body`
- `hs_task_status = NOT_STARTED`
- `hubspot_owner_id`

Associate the task to:
- the deal
- optionally the primary contact when available

## v1 exclusions

Do not require in v1:
- full email body ingestion by default
- company object reads
- custom app objects
- opportunity forecasting data
- cross-portal aggregation

## Compliance and trust policy

Rules:
- only fetch fields required for the active feature
- keep raw note/email content out of permanent storage unless explicitly needed
- log analysis metadata and reason codes, not full customer narrative by default
