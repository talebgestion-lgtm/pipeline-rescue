# Pilot Privacy Notice Template

This is a working template, not legal advice. Review it before sending to a paying customer.

## Short version

Pipeline Rescue is used during a controlled pilot to analyze HubSpot deal records, identify stalled opportunities, recommend next actions, and help users create tasks or notes in HubSpot.

The pilot does not auto-send messages. Users remain responsible for reviewing recommendations and drafts before use.

## Controller / provider identity

Provider:

- name:
- contact email:
- country:

Customer:

- name:
- contact email:

Role model for the pilot:

- Customer is usually the controller for its HubSpot CRM data.
- Provider may act as processor when operating Pipeline Rescue for the customer.
- Provider may act as controller for its own commercial, billing, and support records.

Confirm this role model for each customer before pilot launch.

## Purposes

Pipeline Rescue processes data for:

- stalled deal analysis
- rescue score and reason generation
- recommended task creation
- draft generation with human review
- HubSpot note write-back
- pilot support and troubleshooting
- pilot adoption measurement

## Data categories

The pilot may process:

- HubSpot deal IDs
- deal names
- deal stage
- deal amount
- close date
- owner ID or owner name
- activity timestamps
- next step fields
- associated company names
- associated contact names and business emails
- HubSpot tasks and notes linked to the deal
- operator feedback on recommendations

The pilot must not intentionally process:

- health data
- legal case data
- sensitive employee data
- payment card data
- special-category personal data
- private personal notes unrelated to sales activity

## Legal basis

To be confirmed by the customer and provider before paid use.

Common candidates:

- legitimate interest for B2B pipeline management
- contract performance for providing the pilot service

Do not mark the deployment as compliant until the chosen legal basis is documented.

## Recipients and processors

Potential recipients / processors:

- HubSpot, as the CRM platform
- OpenAI, if live AI draft generation is enabled
- hosting/runtime provider, if deployed outside the customer machine
- provider support personnel

Document the actual processors used for each pilot.

## International transfers

To be confirmed before paid deployment.

If HubSpot, OpenAI, or hosting involves transfers outside the EEA, document the relevant safeguards before production use.

## Retention

Suggested pilot retention:

- runtime support bundles: delete or archive after the pilot review
- score snapshots and feedback: keep for the pilot duration plus `90` days unless agreed otherwise
- raw CRM bodies: avoid storing unless required for debugging and explicitly approved

## Rights

Individuals may have rights under GDPR, including:

- access
- rectification
- erasure
- restriction
- portability
- objection

The customer should remain the first contact for rights requests involving its HubSpot CRM records.

Provider contact for pilot privacy questions:

- email:

## Security controls

Minimum pilot controls:

- shared-secret access gate enabled
- runtime directory separated from source code
- HubSpot token stored in environment, not committed
- support bundles sanitized before sharing
- no auto-send
- human review for all drafts
- runtime snapshots and maintenance available for recovery

## Customer instructions

Customer must:

- avoid entering sensitive data in operator notes
- review generated drafts before use
- limit pilot access to authorized users
- report suspected incidents promptly
- confirm data retention expectations before pilot launch

## Sources to review

- CNIL: registre des activités de traitement
- CNIL: sous-traitants
- European Commission: GDPR individual rights
