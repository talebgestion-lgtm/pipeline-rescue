# Onboarding Email

Subject: Pipeline Rescue pilot setup

Hi {{first_name}},

Here is the setup path for the Pipeline Rescue pilot.

## Pilot goal

For 30 days, we will test whether Pipeline Rescue helps your team identify stalled HubSpot deals and turn them into clear next actions.

## What we need from you

1. Confirm the HubSpot pipeline to test.
2. Confirm who should review the weekly pilot results.
3. Provide HubSpot access through one of these routes:
   - Private App token for a controlled single-account pilot
   - OAuth app install if you prefer the formal install path
4. Confirm whether live AI draft generation should be enabled.
5. Confirm that generated drafts remain human-reviewed before use.

## HubSpot scopes needed

For the Private App token route, enable:

- `crm.objects.deals.read`
- `crm.objects.contacts.read`
- `crm.objects.tasks.read`
- `crm.objects.tasks.write`
- `crm.objects.notes.read`
- `crm.objects.notes.write`

## First validation

The first test is simple:

1. Load one real HubSpot deal.
2. Review the rescue score and reasons.
3. Create one HubSpot task.
4. Generate one draft.
5. Save the draft as a HubSpot note.

If this works, we move to a small live queue.

Best,
{{sender_name}}
