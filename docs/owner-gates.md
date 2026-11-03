# Owner gates

Nothing in this file is authorization to publish or submit.

## Required before release

- Owner confirms project name AgentEscrow, Agent Economy track, and the exact description. Autonomous Business remains optional and unapproved. One submission total.
- Owner sets up testnet role accounts and contract account, handles all sign-ins, and supplies account IDs only. Never request seed phrases. Signer secrets may only be injected through environment variables after a signer is inspected.
- Resolve the contract dependency review, compile, sandbox tests, and testnet transaction evidence before calling the project ready.
- Owner supplies a mainnet NEAR account address only for prize eligibility/payment. It is not an application signer, escrow address, or place to send test funds. Do not store personal payout details in the repo.
- Owner approves making this private repository public. Only then change visibility, by Nov 14 at 23:59 UTC under the supplied brief.
- Owner records and posts the video demo on X himself. Do not automate posting or work around a sign-in confirmation.
- Prepare the complete final submission payload, show it verbatim, and receive explicit owner confirmation of that exact payload before any form or API submission.

## Proposed description for approval

AgentEscrow coordinates paid tasks between agents on NEAR testnet. A client escrows a native NEAR budget with immutable acceptance criteria, a worker commits delivery evidence, and a named verifier authorizes release. Unapproved tasks can be refunded at their deadline. Receipt-aware settlement preserves the beneficiary's claim when a transfer fails.

This description is a target behavior summary. Do not submit it until deployment and verification support the claims. The current demo is offline and the contract is uncompiled.

## Hackathon information supplied by owner

Submission window Nov 1–14, 2026. Results Nov 18. Prize pool USD 250,000, fixed USD prize values paid in NEAR within 30 days. Testnet-only entries are eligible in all tracks. These terms have not been independently verified against an official rules page. Confirm the official event URL and final submission schema before preparing the exact payload. No payload is approved or submitted.

## Demo recording plan

Show the offline label while demonstrating create, worker artifact digest, verifier approval, failed-transfer retry, and expiry/refund. For the final video, replace simulation footage with verified testnet receipts or clearly label each simulated segment. Show role accounts and transaction hashes, never keys, personal account details, or local absolute paths.
