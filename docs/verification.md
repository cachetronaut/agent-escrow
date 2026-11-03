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
- Official hackathon terms and submission schema.
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
