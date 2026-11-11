# Verification evidence

## Execution boundary

Inspected first-party source before local execution. Cargo generate-lockfile resolved 141 packages without package compilation or execution. No fetched package code, package installation, Cargo build, proc macro, external sandbox binary, or external wallet CLI was executed. Existing Node is the local runtime. JavaScript uses Node built-ins only. No CI is configured or run.

## Coverage

`node --test tests/*.test.mjs` covers the JavaScript reference model and unsigned planner: roles, immutable evidence, deadline boundaries, invalid creation, repeat settlement, failed transfer retry, beneficiary preservation, testnet guards, and release/refund agent demos.

These tests do not exercise the Rust contract, Wasm ABI, NEAR storage accounting, gas, receipt callbacks, or network deployment. Passing model tests are not evidence that contract compilation or testnet settlement works.

## Pending evidence

- Review exact resolved near-sdk dependency sources and build-time execution; review the generated lockfile.
- Compile and test Rust contract directly with inspected tools.
- Sandbox tests of callback access, promise success/failure, storage reservation and gas, including maximum-size tasks and independent escrow balances.
- Testnet deployment and transaction hashes for all lifecycle paths.
- Browser layout and keyboard interaction verification.
- Re-read the official live hackathon terms immediately before submitting; initial rules and schema verification completed on 2026-11-03, see submission.md.
- Owner approvals in owner-gates.md.

## Latest local evidence

- JavaScript syntax checks passed for demo and scripts.
- Model and planner tests passed; added adversarial deadline, evidence-type, callback-loss, task-isolation, and exact byte-limit cases.
- Actual app module passes a deferred-digest/reset regression test with a first-party DOM stub. This is not browser visual QA.
- Loopback HTTP smoke test passed after granting the socket permission required by the local sandbox. Asset allowlist, CSP, secret/repository path denials, and request method restriction were checked. An initial test cleanup bug on server startup failure was corrected before rerunning.
- Read-only public RPC status returned `chain_id: testnet`. No transactions were sent.
- Locked Wasm dependency sources were downloaded for inspection using Cargo fetch, with no build or package code execution. Their full execution review remains incomplete.
- Installed Rust toolchain has no wasm32 standard-library target. No interpreter, toolchain, Wasm target, or sandbox binary was downloaded or executed.
- Source privacy scan found no absolute local filesystem paths or keys. Commit author and committer must be verified separately before push.

Final local suite run: **22 tests passed, 0 failed, 0 skipped** using `node --test tests/*.test.mjs`. A full-suite attempt initially timed out starting the server under local load; the startup allowance was increased from 5 to 30 seconds and the complete suite then passed. The server still binds loopback only and is stopped by the test.

`rustfmt --edition 2021 --check contract/src/lib.rs` passed after formatting. This confirms Rust parsing/formatting only; no macro expansion, type checking, linking, or Wasm execution occurred.

## Rules verification update

Read the live https://nearhackathon.com/HACKATHON.md on 2026-11-03. Confirmed submission dates, testnet eligibility, optional integrations, track IDs, repository and X-demo requirements, the exact API field set, and response/retry rules. The web reader could not handle the Markdown content type; a read-only HTTPS fetch retrieved the source. No submission endpoint was called. Owner confirmed tracks agents and business in one entry. Testnet account IDs are still pending. Account setup blocks deployment, not dependency inspection or local contract verification.

## Re-do, 2026-11-11

The real offline release Wasm build now passes; see wasm-build.json and the latest build-progress.md section. The complete available JavaScript suite passes 28/28 and the direct production Rust policy suite passes 5/5 after compilation. No NEAR runtime/sandbox tests ran. No accounts, deployment, or lifecycle transactions exist for this run. The requested near-cli is absent and execution is uncleared under the inspect-before-execution rule. The public RPC chain ID and private repository visibility were verified live. See README and redo-verification.json for the current status; earlier uncompiled/pending test statements above are historical.

## Bidding and deployment follow-up, 2026-11-11

Current evidence supersedes earlier compile/deployment blockers. The exact locked source fingerprints remain unchanged. The bidding contract compiled with zero warnings. All 55 Node tests and 12 production Rust policy tests passed, with zero failures or skips. Of the Node tests, 19 execute actual Wasm through the inspected in-memory host and 8 specifically exercise the new model/planner bidding lifecycle. The host creates no credentials and does not claim nearcore gas/consensus coverage.

The official inspected near-cli created four free faucet-funded testnet accounts, deployed and initialized the contract, and sent separate post, bid, escrow, deliver and release transactions. Every final transaction succeeded; code hash, final Paid state and exact 0.04 test NEAR worker payout were verified. A separate credential-free process re-read all six transactions and final contract state. See README.md, followup-verification.json, testnet-lifecycle.json and testnet-independent-check.json. Refund and transfer-failure paths have local Wasm coverage; they were not separately exercised on public testnet in this run. No remaining deployment/lifecycle blocker is recorded.
