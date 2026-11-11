# Owner gates

Nothing in this file is authorization to publish or submit.

## Confirmed project choices

Owner confirmed the project name AgentEscrow. Use `agents` (Agent Economy) as primary and `business` (Autonomous Business) as secondary in one submission, represented as `tracks: ["agents", "business"]`. The API has no separate priority fields. The exact description and final payload still need approval.

The current run explicitly authorizes the agent to create the contract, client, worker, and verifier accounts on testnet using free faucet funds after compilation and contract testing. The four created account IDs and verified testnet receipts are now recorded in README.md. Offline demo placeholder names remain separate. Mainnet payout account creation remains the owner's job and is excluded from this run.

## Engineering work independent of owner accounts

Dependency execution review, trusted Wasm setup, direct Rust tests, and sandbox receipt/gas/storage tests do not require owner account IDs. These remain engineering work, not owner approval gates. The follow-up uses direct Rust policy tests and actual Wasm tests with an in-memory host that needs no credential files. It does not claim nearcore gas or consensus coverage. Testnet deployment and lifecycle receipt evidence require real testnet accounts and an inspected signing path.

## Required before release

- Agent may create the four testnet accounts under the current authorization. Owner handles any required sign-in confirmations; do not bypass them. Report confirmed account IDs only, never signing material. Keep any signer secrets in environment variables after inspecting the signing code.
- Owner supplies a mainnet NEAR account address for prize payout only. Never create or guess it. It is not an escrow account or application signer. Keep payout details outside the repository.
- Owner approves the exact project description, lead name, contact email, and team size. Use Cachetronaut as the project identity; do not assume the submission accepts a legal name or disclose one.
- Owner explicitly approves making the private repository public. Only then change visibility. The live rules currently require public visibility by `2026-11-14T23:59:00Z` and through judging.
- Owner records and posts the public X demo himself. It must say the project was built at NEAR HACKATHON and include `@NEARProtocol` and `#NEARHackathon`. The browser demo remains offline; the verified testnet transaction links may be used as separate evidence. Use video, not screenshots alone.
- Read the contact notice to the owner verbatim and obtain agreement: "I agree that the organizers may use these details to review our submission and contact us about this hackathon."
- Re-read the live official rules before submitting. Show the complete final JSON payload verbatim and receive explicit confirmation of that exact payload. Changed fields require renewed confirmation. No payload is currently approved.

## Proposed description for approval

AgentEscrow coordinates paid tasks between agents on NEAR testnet. A client posts immutable acceptance criteria and a budget ceiling, workers bid, the client selects and escrows an existing bid, the worker commits delivery evidence, and a named verifier authorizes release. Unapproved tasks can be refunded at their deadline. Receipt-aware settlement preserves the beneficiary's claim when a transfer fails.

This remains an unapproved submission description. The browser demo is offline; the compiled contract has separately completed a verified testnet release lifecycle. No submission payload or publication is authorized.

## Official source

Live rules and submission contract: https://nearhackathon.com/HACKATHON.md

Read on 2026-11-03. Submission window: `2026-11-01T00:00:00Z` to `2026-11-14T23:59:00Z`. Results by `2026-11-18T23:59:00Z`. The pool is USD 250,000; prizes are fixed USD values paid in NEAR within 30 days of results. Testnet-only work is eligible in every track, and no integration is mandatory. Dates and rules may change; re-read the live source immediately before submission.

See [submission contract](submission.md) for the verified endpoint and field requirements. No form or API submission has been attempted.

## Demo recording plan

Show the offline label while demonstrating create, worker artifact digest, verifier approval, failed-transfer retry, and expiry/refund. For the final video, use verified testnet receipts or clearly label simulated segments. Show role accounts and transaction hashes, never keys, personal payout details, or local absolute paths.
