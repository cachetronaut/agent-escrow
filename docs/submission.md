# Submission contract and release checks

Source: https://nearhackathon.com/HACKATHON.md, read on 2026-11-03. Re-read the live version before preparing the final payload. This document is a checklist, not an approved payload or authorization to submit.

Form: https://nearhackathon.com/#apply

API: `POST https://nearhackathon.com/api/applications`, JSON content type, maximum 12000 body bytes. Never call it for testing. One submission per repository; saved submissions cannot be edited. Do not bypass duplicate rejection by changing URLs or email addresses.

## Exact field set

Send only these fields after owner confirmation:

| Field | Requirement |
| --- | --- |
| `requestId` | Generate one UUID for the final submission; reuse it for permitted retries. |
| `projectName` | Owner-confirmed name, 2–80 characters. Current choice: AgentEscrow. |
| `leadName` | Owner-provided identity, 2–80 characters. Do not guess or insert a legal name. |
| `email` | Owner-provided valid contact email, at most 160 characters. Keep it out of the repo. |
| `size` | Exactly one of `1`, `2 - 4`, `4 - 6`, `6 - 8`, `8+`; owner decides. |
| `tracks` | Unique allowed IDs. Current choice: `["agents", "business"]`. No primary/secondary fields. |
| `nearAddress` | Owner-provided mainnet payout address, 2–64 lowercase characters, matching the live rules' account regex. Validate both semantic mainnet suitability and syntax. Never invent it. |
| `projectUrl` | Public repository HTTP(S) URL, at most 300 characters. Target: https://github.com/cachetronaut/agent-escrow after explicit visibility approval. |
| `demoUrl` | Public owner-posted X demo URL, at most 300 characters. Unknown until owner posts. |
| `idea` | Owner-approved description, 20–2000 characters, consistent with demonstrated behavior. |
| `consent` | Boolean true only after separate agreement to the exact contact notice in owner-gates.md. |

Do not add fields. The API's `website` field is a spam trap, not a place for a hosted demo. Store neither the full payload nor personal contact/payout data in Git. Do not generate a request ID or placeholder payload while required owner values are missing.

## Before any submission

Confirm that the project has not already been submitted. Verify the repository is public with owner approval, the owner-posted X video is accessible and includes the required tags and event mention, and the README reproduces the actual working flow. Confirm every field with the owner and show the complete JSON verbatim. Do not submit while confirmation is absent or if fields change afterward.

## Response handling after an authorized attempt

- `201`: saved; report success and stop.
- `400`: inspect field errors. Correct the payload, obtain renewed confirmation, and reuse the same request ID.
- `403`: stop and tell the owner; do not retry.
- `409`: stop and ask the owner; do not evade the repository or email limits.
- `413`: reduce the body, obtain renewed confirmation, then reuse the request ID.
- `503` or an uncertain network outcome: preserve the exact payload and request ID. Follow the live retry guidance and the owner's confirmed scope; do not create another submission identity.

Q-015 permits up to two independent disclosed projects per person. That does not change this project's one-repository, one-submission limit. If there is another entry, obtain its identity from the owner and disclose the relationship in both READMEs; do not invent another project.
