# GDPR Strict Mode

This project cannot honestly claim "100% GDPR compliant" in the abstract.

It can, however, enforce a strict production gate:

- if mandatory GDPR controls are undocumented, deployment stays blocked
- if the product scope drifts into Article 9 special-category data, deployment stays blocked
- if profiling becomes solely automated with legal or similarly significant effect, deployment stays blocked

## Hard rules

1. No special-category personal data

- Pipeline Rescue is a B2B sales-assist product.
- It must not intentionally ingest health, biometric, genetic, religious, political, union, sexuality, or similar Article 9 data.
- Free-text operator notes must stay free of direct identifiers and sensitive content.

2. One lawful basis per activity

- Every processing activity must map to one Article 6 lawful basis.
- If legitimate interest is used, a legitimate-interest assessment must be completed and documented.

3. Human review is mandatory

- Deal scoring and draft suggestions are advisory only.
- No workflow may produce a solely automated decision with legal or similarly significant effect on a person.

4. Processor discipline is mandatory

- Every active processor must be covered by an Article 28 contract.
- Any third-country transfer must be documented with adequacy or another valid safeguard and, where needed, a transfer-impact assessment.

5. Article 30 records are mandatory

- Keep controller and/or processor records depending on the real role model.
- Update them when the product scope, processors, or retention change.

6. Data-subject rights and incident response are operational controls

- A DSAR contact channel must exist.
- Internal workflows must support access, erasure, objection, and portability where applicable.
- Breach response must be ready for the 72-hour notification rule.

7. DPIA is a gate, not an afterthought

- Reassess whether a DPIA is required before production.
- If high-risk criteria are met, production stays blocked until the DPIA is completed.

## Current product implementation

The local starter now includes:

- a strict GDPR compliance report endpoint
- a deployment status that stays blocked until mandatory controls are documented
- input guardrails on operator notes to reduce direct identifier and sensitive-data leakage

## Source anchors

- GDPR Articles 5, 6, 25, 28, 30, 32, 33, 35 and 44: EUR-Lex Regulation (EU) 2016/679
- European Commission lawful-basis guidance
- CNIL guidance on processor contracts, breach response, DPO designation, and risk management
