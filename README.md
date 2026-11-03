# AgentEscrow

A client agent posts immutable task terms and a budget. A worker delivers an evidence digest. A named verifier approves payment. Unapproved work becomes refundable at its deadline.

Built by **Cachetronaut** for the NEAR Agent Economy track. MIT licensed. Private during development. No CI workflows.

## Current status

**Prototype, not submission-ready.** The interactive demo and deterministic agent loop run offline. The Rust smart contract targets NEAR testnet but has not been compiled, deployed, or exercised on chain. Model tests do not validate the Rust contract. Native test NEAR is implemented in source; stablecoins and Intents are not integrated. No mainnet funds or signing path exists in the supplied tooling.

## Run locally

No npm dependencies, install step, external fonts, or CDN assets. Inspect `package.json`, `scripts/`, `demo/`, and `tests/` before running. These commands execute only first-party JavaScript using the existing Node runtime, version 22 or later.

```sh
node --test tests/*.test.mjs
node scripts/agents.mjs
node scripts/agents.mjs --refund --fail-transfer
node scripts/serve.mjs
```

Open `http://127.0.0.1:4173` for the interactive simulation. It resets on reload. The browser uses fixed testnet role names and simulated receipt callbacks. The approve button is a human verifier attestation. The CLI demo uses a deterministic JSON verifier for its predefined task; no LLM or autonomous on-chain signer is connected.

## Contract behavior

`contract/src/lib.rs` contains the NEAR adapter. `create_task` attaches the budget plus a retained 0.1 test NEAR storage fee. The fee is not part of the budget and is not refunded. The task stores the client, worker, verifier, title, acceptance criteria, deadline in nanoseconds, budget in yoctoNEAR, and evidence SHA-256. IDs, timestamps, and amounts use JSON decimal strings.

Only the worker can deliver, once, before the deadline. Only the verifier can approve a delivered task before the deadline. All roles must be distinct named `.testnet` accounts. Anyone can call `expire` at or after the deadline for open or delivered work. There is no automatic timer; a keeper must submit that call.

Approval fixes the worker's entitlement. A private receipt callback records transfer success. Failure restores the same claim for permissionless retry with `pay`. Pending and terminal states cannot be paid twice. Refunds always target the original client. A missing or out-of-gas callback can leave a task pending; this needs sandbox testing before deployment. No unsafe manual override is provided.

Account suffix checks are guardrails, not cryptographic proof of a network. Deployment tooling must explicitly select testnet and verify the RPC chain ID. The supplied planner only emits unsigned plans with a fixed testnet RPC; it cannot deploy or broadcast.

## Unsigned testnet call plans

Use environment variables for account configuration. Never put keys in arguments, files, commits, or chat. The planner does not read keys.

```sh
NEAR_NETWORK=testnet ESCROW_CONTRACT_ID=escrow.testnet NEAR_SIGNER_ID=client.testnet \
  node scripts/plan.mjs create_task \
  '{"worker":"worker.testnet","verifier":"verifier.testnet","title":"Research brief","criteria":"Return verified JSON","budget":"1000000000000000000000000","deadline_ns":"1800003600000000000"}'
```

The timestamp above is illustrative; supply a future timestamp within 30 days at execution. Review the printed signer, receiver, method, args, gas, and deposit before using a separately inspected testnet signer. No deployment command is safe to run until the dependency gate below is resolved.

## Build and deployment gate

`contract/Cargo.toml` pins near-sdk 5.28.0, and Cargo.lock records the resolved dependency graph, but its sources and build-time execution are not yet reviewed. Do not run Cargo builds, installs, sandbox downloads, or third-party CLI binaries until the exact resolved sources, proc macros, build scripts, and invoked binaries have been inspected. Package-manager wrappers are additional controls, not a replacement for that review.

After that review, compile to NEAR-compatible Wasm with a pinned inspected toolchain, add direct Rust and sandbox receipt tests, deploy only to testnet, and record transaction hashes for create, deliver, approval/release, expiry/refund, and retry. Check the RPC `status` response has `chain_id: testnet` before any signing. The owner handles account setup and sign-in confirmations.

See [architecture](docs/architecture.md), [verification](docs/verification.md), and [owner gates](docs/owner-gates.md).

## Read-only testnet RPC

```sh
node scripts/read-task.mjs
node scripts/read-task.mjs escrow.testnet 0
```

The first command checks the fixed public RPC reports `chain_id: testnet`; the second reads an existing deployed task. Neither signs or broadcasts. The sample account is a placeholder. Local mocked-RPC tests cover refusing another chain, HTTP/RPC errors, and malformed view bytes.
