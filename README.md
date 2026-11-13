# AgentEscrow

Warranty-backed escrow for agent work on NEAR testnet. Clients post acceptance checklists, workers bid and deliver, and three AI judges provide quorum evidence to a named verifier. Payment retains a configurable warranty hold for claims, fixes, or refunds. The warranty lifecycle is verified on NEAR testnet, including claim resolution, fixes, and deadline refunds.

Built by **Cachetronaut**. MIT licensed. Public through judging on November 18, 2026. Testnet only. No CI workflows.

## Verified original testnet deployment, 2026-11-11

The Rust contract compiled, deployed, and completed **post → bid → escrow → deliver → release** on NEAR testnet. Task `0` is **Paid**. Release increased the worker balance by exactly **0.04 test NEAR**, matching the selected bid rather than the 0.05 test NEAR budget ceiling. Final receipts and the deployed code hash were checked through the public testnet RPC.

| Role | Testnet account ID |
| --- | --- |
| contract | `ae-261111-ce0de7-contract.testnet` |
| client | `ae-261111-ce0de7-client.testnet` |
| worker | `ae-261111-ce0de7-worker.testnet` |
| verifier | `ae-261111-ce0de7-verifier.testnet` |

Contract account: `ae-261111-ce0de7-contract.testnet`.

Deployment transaction: [`8TVSKFvCvpC14MCCM2gNo9gnCFnH9GyboGy6z3kmryqR`](https://testnet.nearblocks.io/txns/8TVSKFvCvpC14MCCM2gNo9gnCFnH9GyboGy6z3kmryqR).

| Step | Explorer transaction | Result |
| --- | --- | --- |
| deploy | [`8TVSKFvCvpC14MCCM2gNo9gnCFnH9GyboGy6z3kmryqR`](https://testnet.nearblocks.io/txns/8TVSKFvCvpC14MCCM2gNo9gnCFnH9GyboGy6z3kmryqR) | success |
| post | [`5RSBrsw91ZR56DdapHAphvNAeziM552JdWzosEZMt3YW`](https://testnet.nearblocks.io/txns/5RSBrsw91ZR56DdapHAphvNAeziM552JdWzosEZMt3YW) | success |
| bid | [`EErSVTApkdp7R65CaVvugb6vEH6dbayBPcbyqgQSdkRU`](https://testnet.nearblocks.io/txns/EErSVTApkdp7R65CaVvugb6vEH6dbayBPcbyqgQSdkRU) | success |
| escrow | [`AK3KPixMTGevSPuGjYniLUgpVn8od7JKZGfbSdMkuCqB`](https://testnet.nearblocks.io/txns/AK3KPixMTGevSPuGjYniLUgpVn8od7JKZGfbSdMkuCqB) | success |
| deliver | [`GnMYCdzFBE6PwFugjFbfLPQgGRmfwWhMZh3EsjqK5XRX`](https://testnet.nearblocks.io/txns/GnMYCdzFBE6PwFugjFbfLPQgGRmfwWhMZh3EsjqK5XRX) | success |
| release | [`CzpXUMRsBjSA9mqxyWWa9ypZeCtoABB7BXK7YuEE5fgd`](https://testnet.nearblocks.io/txns/CzpXUMRsBjSA9mqxyWWa9ypZeCtoABB7BXK7YuEE5fgd) | success |

Each account was created through near-cli and the free testnet faucet, which supplied 10 test NEAR per account. No mainnet account, funds, signature, transfer, or Intents execution was used. The repository is public and must stay public through judging on November 18, 2026. No submission, X post, or CI run occurred.

## Historical build and test evidence

- Release Wasm build: **passed**, Rust 1.95.0, near-sdk 5.28.0, locked dependencies, offline build. **Zero compiler warnings.**
- Artifact: `contract/target/wasm32-unknown-unknown/release/agent_escrow.wasm`, **216,747 bytes**.
- SHA-256: `527d5ba554624e32e7dfbc7becf77a71088b4856c205537ed827b1c249f7faec`.
- Complete Node suite: **55 passed, 0 failed, 0 skipped**, comprising 28 existing/updated tests, 8 new bidding tests, and 19 actual Wasm integration tests.
- Direct production Rust policy suite: **12 passed, 0 failed, 0 ignored**.
- Combined local result: **67 passed, 0 failed, 0 skipped**.

The Wasm tests execute the real compiled ABI and SDK serialization/storage calls with a first-party in-memory host. They cover bidding, exact funding, deadlines, role checks, release, refunds, callback privacy, failed-transfer retry, duplicate-settlement prevention, maximum-sized storage, and independent tasks. They require no node initialization, network, keys, or credential files. They are not nearcore gas, consensus, or networking tests. Public testnet receipts separately prove the successful release lifecycle and actual payout. Refund and failed-transfer paths were tested locally, not exercised on public testnet in this run.

Evidence: [build and test summary](docs/followup-verification.json), [Wasm imports/exports](docs/wasm-build.json), [Rust policy results](docs/policy-tests.json), [testnet receipts](docs/testnet-lifecycle.json), and [independent read-only verification](docs/testnet-independent-check.json).

## Warranty and AI verifier implementation

The corrected-source live run passed on November 13 after rebasing onto origin/main. The full post, bid, escrow, delivery, release, claim, fix, and acceptance flow ended Paid, with exact worker and client balance deltas and successful receipts. Claim refund resolution was verified after the claimed warranty expired; a short-deadline task refunded its full escrow. Previously confirmed unclaimed warranty expiry payout and unsigned Intents dry-run quote were reused without repeating them. Three real NEAR AI judges approved live deliveries, and the prior adversarial injection check returned zero scores from all three. Model votes remain off-chain evidence; TEE attestation is not verified. See [current verification evidence](docs/warranty-verification.json) and [final live receipts](docs/warranty-live-morning-rpc-final-20261113.json). Local tests remain development aids.

Release pays the selected worker 90% by default and retains 10%. `post` accepts optional `retention_percent` from 0 to 100 and `warranty_window_ns` as a positive decimal-string duration up to 30 days, default seven days. The warranty clock starts only after a successful initial payment callback. Zero retention preserves the original direct Paid lifecycle; integer rounding leaves any fractional yoctoNEAR in the initial payout. This Task storage layout requires a fresh deployment, never a redeploy over existing tasks.

During the window, only the client can `claim(task_id,evidence_sha256)`. The named verifier calls `resolve_claim(task_id,decision)` with `fix` or `refund`. A fix requires the selected worker to call `deliver_fix` before the verifier can `accept` it and pay the hold. A refund returns only the hold to the original client. Claims stay locked pending the trusted verifier; there is no automatic claim-resolution timeout. With no claim, anyone calls `settle_warranty` at or after expiry to pay the worker and end Paid. Each transfer uses receipt callbacks and immutable-recipient retries. Blockchain time does not automatically invoke settlement.

Structured acceptance criteria use the existing immutable `criteria` string containing validated JSON:

```json
{"checks":[{"id":"summary","description":"Explains the accepted bid and verifier approval","threshold":80}]}
```

The client supports 1 to 12 unique checks and integer thresholds 1 to 100, within the contract's 2048-byte criteria limit. Legacy text criteria remain accepted by the contract; the AI client requires the checklist schema. Three distinct NEAR-hosted LLMs score every check. Two approving votes win, provided all three responses are valid; unavailable or malformed judges fail closed. The report binds delivery bytes and checklist by SHA-256. The named attester remains trusted and can invoke contract release directly; the contract does not enforce off-chain model consensus or verify TEE attestations. The adversarial E2E sends an actual injection delivery to all three models and requires actual zero scores. It never substitutes mocked LLM calls.

NEAR AI uses only `NEAR_AI_API_KEY` from the environment and the fixed public OpenAI-compatible endpoint. Model IDs and source references are in [the verifier](scripts/ai-verifier.mjs). The public [Intents quote helper](scripts/intents-quote.mjs) always sets `dry: true`, uses documentation example addresses, and has no signing or execution path. Its production-market price is indicative only, separate from testnet funds. [Live quote evidence](docs/intents-dry-run.json) records a public API response, not a transfer.

After source review and explicit owner approval for fresh testnet accounts:

```sh
# Build using the existing reviewed pinned offline build runner first.
# Set NEAR_CLI_BIN to the reviewed executable in your environment.
# Set NEAR_AI_API_KEY through the environment to include real model verification.
AGENT_ESCROW_CREATE_ACCOUNTS_APPROVED=yes AGENT_ESCROW_EVIDENCE_FILE="docs/warranty-$(date -u +%Y%m%d%H%M%S).json" npm run e2e
```

The one-command runner creates four approved testnet accounts, deploys the built Wasm, proves an expired unclaimed hold ends Paid, proves a short-deadline full refund, proves claim-hold refund, and proves fix/redelivery/acceptance. It verifies exact beneficiary balance increases and final receipts for all transactions, then records real quorum/injection and a public dry quote. Missing AI credentials preserve a partial report while other scenarios run with named attestation. Exit 0 means all requested checks passed, exit 2 means contract lifecycle passed but an external verification remains incomplete, and exit 1 means the contract run failed. Evidence filenames cannot be reused. In faucet/CLI mode, keys remain only in controller memory/environment and disappear on exit; `--interactive` retains the controller for read-only reconciliation. Funded mode requires `AGENT_ESCROW_FUNDER_ID`, `AGENT_ESCROW_FUNDER_KEY`, and `NEAR_AI_API_KEY` through the environment. It creates random immediate testnet subaccounts using 4.5 test NEAR plus fees, saves their keys with mode 0600 under `~/.near-credentials/testnet/`, and records only their paths. It reuses the passed expiry and quote evidence from `docs/warranty-verification.json`, then verifies refund, claim resolution after expiry, and fix acceptance ending Paid.

The offline browser and `npm run demo` retain their original deterministic pre-warranty model; they do not demonstrate these new contract features. Use the live E2E runner for the new scenarios.

## Contract API

All account roles must be distinct named `.testnet` accounts, including distinction from the contract. Account suffix validation is a guardrail; tooling also verifies RPC `chain_id: testnet` before signing.

| Method | Authorized caller and effect | Deposit |
| --- | --- | --- |
| `post(verifier,title,criteria,budget,deadline_ns,retention_percent?,warranty_window_ns?)` | Client publishes immutable terms; returns decimal-string task ID | Exactly 0.1 test NEAR storage fee |
| `bid(task_id,amount)` | Eligible worker adds one immutable positive bid at or below budget ceiling; maximum eight bids | Zero |
| `escrow(task_id,worker)` | Original client selects an existing bid and funds it exactly once | Exactly selected bid amount |
| `deliver(task_id,evidence_sha256)` | Selected worker records one lowercase SHA-256 digest | Zero |
| `release(task_id)` | Named verifier approves delivery and pays the initial share, retaining warranty funds | Zero |
| `claim(task_id,evidence_sha256)` | Original client locks hold with evidence before warranty expiry | Zero |
| `resolve_claim(task_id,decision)` | Named verifier requests fix, refunds hold, or accepts delivered fix | Zero |
| `deliver_fix(task_id,evidence_sha256)` | Selected worker delivers requested fix | Zero |
| `settle_warranty(task_id)` | Anyone pays unclaimed hold to worker after expiry | Zero |
| `refund(task_id)` | Anyone cancels an expired unfunded post or refunds funded unapproved work to original client | Zero |
| `pay(task_id)` | Anyone retries the original beneficiary claim after transfer failure | Zero |

IDs, timestamps, and amounts use JSON decimal strings. Deadline timestamps are nanoseconds and must fall within 30 days after posting. Posting, bidding, funding, delivery and release require time strictly before the deadline. Refund requires time at or after it. The retained 0.1 test NEAR fee reserves storage for eight bids and later evidence; it is excluded from payouts and refunds.

Release fixes the worker claim. A private receipt callback records success or preserves that claim on transfer failure. Pending and terminal states reject duplicate payment. A missing callback can leave a task pending; no unsafe manual override exists. The contract exposes no admin withdrawal or upgrade method. Account full-access keys can still replace code, so this deployment is not claimed immutable.

The state layout changed from the undeployed prototype. Legacy `create_task`, `approve`, and `expire` contract exports were removed. Use a fresh account for this layout. See [bidding semantics](docs/bidding-design.md).

## Run locally

The application has no npm dependencies, install step, external fonts, or CDN assets. Use Node 22 or later. Inspect the first-party scripts and exact dependency sources before execution. The recorded build review applies only to the pinned graph; changing dependencies requires another review.

```sh
# Only after completing the source-review gate described below:
AGENT_ESCROW_BUILD_REVIEWED=yes node scripts/build-contract.mjs
node scripts/test-policy.mjs
node --test tests/*.test.mjs
node scripts/agents.mjs
node scripts/agents.mjs --refund --fail-transfer
node scripts/serve.mjs
```

The build runner currently requires macOS with sandbox-exec, the already-installed Rust 1.95.0 stable toolchain and wasm32-unknown-unknown target, and the exact cached Cargo sources listed in docs/build-inventory.json. It does not install missing tooling or fetch missing sources. A fresh clone on an unprovisioned machine needs a separate source-review and toolchain setup step.

The Wasm artifact must exist before the full Node suite runs. The build runner pins the installed compiler, rejects unexpected Cargo configuration, checks 107 dependency fingerprints, strips inherited environment inputs, and builds offline under OS network/write restrictions. See [dependency review](docs/dependency-review.md).

Open `http://127.0.0.1:4173` for the offline interactive demo. Its creation adapter automatically posts, bids, and escrows; the deterministic CLI demo records all stages separately. Both use local models and simulated receipt callbacks. The displayed verifier approval is a human attestation. The offline CLI verifier accepts only its predefined JSON task. The new live runner adds off-chain AI verification and indicative Intents dry-run pricing as described above; stablecoin settlement is not implemented.

## near-cli and credentials

The owner approved installing near-cli after inspection. Official **near-cli-rs 0.31.1** was inspected as a pinned portable package and installed into the user-local bin directory without running a downloaded installer or changing shell profiles. Package hashes, source scope, command shapes and side-effect controls are in [CLI inspection](docs/near-cli-inspection.md).

The CLI requires a positional private-key argument. The controller constructs that argv only in memory from process environment variables and captures all CLI output. Its OS profile denies filesystem writes except the null device. The CLI's unconditional reconstructed-command log is a verified symlink to the null device. No signing key, seed, credential file, or raw CLI output is saved to this repository or reports. Funded mode uses the first-party transaction signer directly through the fixed testnet RPC instead of near-cli.

In faucet/CLI mode, controller credentials are ephemeral and disappear on exit without a credential backup. In owner-approved funded mode, subaccount keys are saved outside the repository with mode 0600 before account creation; the funder key is supplied through the environment. Do not run ordinary plaintext-key CLI commands outside the inspected wrapper, because the CLI normally logs reconstructed commands.

To reproduce with new accounts, inspect the sources, set `NEAR_CLI_BIN` to the fingerprint-verified executable path, set `AGENT_ESCROW_EVIDENCE_FILE` to a new `docs/run-name.json` path, and run `node scripts/testnet-lifecycle.mjs --run`. This creates four new faucet accounts and refuses to overwrite an existing evidence file. It does not recover this run's ephemeral credentials. Unknown transaction outcomes block resends until read-only reconciliation. Do not add a wallet, mainnet network, or payout account.

## Read-only testnet verification

```sh
node scripts/read-task.mjs
node scripts/read-task.mjs ae-261111-ce0de7-contract.testnet 0
```

These commands verify the fixed public RPC reports testnet and read task state. They never sign or broadcast. The earlier lifecycle passed. The warranty/refund testnet run passed; new signing keys were saved outside the repository with mode 0600. Nearcore sandbox coverage remains outside the recorded evidence. Publication, hackathon submission and X posting remain owner-controlled and unauthorized.

## Owner review package

See [demo narration and commands](demo/script.md) and [X post draft](x-post-draft.txt). The contact-bearing `submission-payload-draft.json` is saved locally and ignored by Git to preserve the no-personal-information rule. It is an incomplete review draft, with demo URL and mainnet payout address left TBD. No consent or submission request ID has been asserted.

Fresh-clone verification on the provisioned macOS host passed the offline build, all 67 local checks, both CLI model demos, the local server, and public read-only testnet verification. The clean rebuild produced 215,659 bytes with SHA-256 `f002abe5cbe064d7a4caf790e070dbd0fe8f11d98f63583d14d244cd4aec87e5`, differing from the historical deployed artifact above. This establishes functional reproduction, not byte-identical reproduction or a deployment of the fresh build. The cause of that artifact difference has not been established.

The [recorded testnet run](demo/testnet-lifecycle.mp4) is a silent 131.74-second MP4 showing all five real transactions, explorer URLs, final Paid state, and the exact 0.04 test NEAR release balance increase. [Recorded-run receipts](docs/demo-testnet-lifecycle.json), [recording metadata](demo/recording.json), and [fresh-clone results](docs/reproducibility.json) are included. The original deployment above remains unchanged.
