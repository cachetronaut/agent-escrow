# Testnet build progress

## Dependency inspection

The locked manifest and package source graph were inspected as metadata without running package build code. `build-inventory.json` records the 108-package Wasm target graph and identifies build scripts and procedural macro entry points. The lockfile contains 141 packages across all targets. Additional locked sources were fetched without executing them. Execution review is in progress; inventory alone is not approval to build.

## Trusted Wasm target input

Installed host compiler: Rust 1.95.0, compiler commit 59807616e, release date 2026-04-14. Wasm standard library selected from the official Rust 1.95.0 distribution dated 2026-04-16.

Archive: `rust-std-1.95.0-wasm32-unknown-unknown.tar.xz`.

Official distribution: https://static.rust-lang.org/dist/channel-rust-1.95.0.toml

Verified SHA-256: `5587b89ff69623d09e476439d44a24453b4e4ea3d5e0b53a5c0a935151ff3fd1`.

Archive contents were inspected without executing its shell installer. The official target was installed through the existing trusted rustup; installed-target verification now includes `wasm32-unknown-unknown`. The pinned archive checksum and all 107 dependency source fingerprints were rechecked successfully. Contract compilation remains pending completion of build-time source review.

## Account handling

The owner now authorizes creating four faucet-funded testnet accounts for this run, superseding the earlier owner-created-account restriction. Account creation is scheduled after compilation and contract tests. Mainnet payout account creation is excluded. No account has been created in this run yet. No private signing material may be written to files or reports.

## First execution review result

The normal/build feature tree narrows the metadata inventory to 78 active registry packages, 11 active build scripts, and 9 active procedural macro crates. A read-only xhigh review verified the 78 crate archive checksums against the lockfile and all 2,611 archived files against extracted source. All 11 active build scripts were read. Observed behavior includes compiler version/capability probes, writes under Cargo OUT_DIR, Cargo workspace-manifest discovery during Borsh crate-name resolution, and optional NEP-330 metadata embedding. No network calls were found in inspected paths. This is not an exhaustive safety claim.

The first review did not clear execution because transitive host-source inspection was incomplete. Remaining NEAR/Borsh/Darling, Serde/token parsing, and helper-library code is under separate bounded reviews. No build has been authorized by the inventory, fingerprints, or archive checks alone.

## Prepared implementation changes

The Rust adapter now calls shared production policy functions in `contract/src/policy.rs`. That module has direct Rust tests for delivery/approval authorization and deadlines, expiry eligibility, callback success/failure transitions, terminal-state rejection, and payout gas boundaries. These tests have not been run yet; compiling the contract remains before test execution in this run. They will not establish storage or NEAR receipt behavior on their own.

`scripts/build-contract.mjs` is prepared to require explicit completion of source inspection, check the exact installed compiler identity, build offline with remapped source paths, and restrict the child build using the existing macOS sandbox. It does not install dependencies. Environment stripping and OS isolation do not waive the source-review gate.

A first-party transaction encoder and offline tests are prepared for later inspected testnet signing. No funded-account credential has been generated and no transaction sent. This module alone is not a deployment tool or proof of protocol compatibility.

## Parser inspection update

The Serde and token-parser review read 149 Rust source files, including serde_derive execution templates, proc-macro2 token handling, quote token construction, and both Syn versions' parser/printer implementations. It found no prohibited host effects in inspected bodies. Coverage remains incomplete for twelve generated Syn implementation files and unicode-ident; a bounded follow-up is inspecting those sources. The review is not blanket approval for compilation.

Three offline first-party transaction-encoder tests passed. They check base58 round trips, integer ranges/byte order, environment-only key handling, signature self-verification, and rejection of a mainnet receiver. The test generated and deleted one ephemeral process-only signing credential; it created no funded account and sent no transaction. Self-verification is not independent NEAR protocol compatibility evidence.

The build runner now refuses unexpected Cargo configuration and verifies all 107 recorded dependency source-tree fingerprints before invoking Cargo. The native Rust test runner is prepared, but its tests remain unrun pending compilation in the requested sequence.

## Deployment runner preparation

The first-party RPC adapter fixes its endpoint to testnet, checks the reported chain before signing, refuses mainnet account names, and treats a broadcast timeout as an unknown outcome requiring reconciliation. Receipt evidence excludes remote error text, signed transaction bytes, keys, and unconstrained log content. Six signing/adapter tests pass using offline fixtures; they are not contract execution or on-chain verification.

The transaction field order, untagged V0 encoding, action discriminants, and FullAccess access-key encoding were checked against the pinned nearcore source. The official near-cli faucet request uses `newAccountId` and `newAccountPublicKey`; current official configuration points testnet creation to `https://helper.nearprotocol.com/account`. These were source reads only. No faucet request or transaction has been sent.

The sandbox review found a conflict with the environment-only signing-material rule and did not clear the downloaded executable. Sandbox tests and the subsequent ordered deployment remain blocked. No accounts have been created. Source review for the Wasm compilation graph remains separate and pending for NEAR/Borsh/Darling.

## Verified re-do, 2026-11-11

This section supersedes earlier pending compilation and test statements. Exact offline build-time source review completed for the pinned graph; all 107 dependency fingerprints matched again. The first-party runner needed a macOS sandbox-profile correction because the original profile aborted even a trusted system echo. The corrected profile retained offline operation, environment stripping, source verification, home-read restrictions, and writes limited to contract/target.

The real release Wasm build passed. Artifact size: 203,802 bytes. SHA-256: `9d0b87209e5244652d8fd4f4523ce2c62a5944336ecc1aa248b2e2c23f1ca27a`. Node accepted the module and recorded imports/exports in wasm-build.json. One deprecation warning remains for env::promise_result. Post-build JavaScript tests: 28 passed, 0 failed, 0 skipped. Post-build direct production Rust policy tests: 5 passed, 0 failed, 0 ignored. These are not NEAR runtime tests.

The public RPC reported chain_id testnet. GitHub metadata confirmed PRIVATE visibility. No CI ran. No accounts were created or transactions sent. The required near-cli is absent and not cleared for execution; no agreement to replace it with the prepared first-party signer was received. The existing contract has no bid API, and posting and funding are combined in create_task. Sandbox execution remains uncleared. README and redo-verification.json record these blockers without fabricated account IDs or transaction links.

## Owner-approved bidding and near-cli follow-up, 2026-11-11

The follow-up supersedes the earlier near-cli/bidding blockers. The official pinned portable near-cli-rs 0.31.1 was inspected, installed, and used for all account creation/signing/sending. Its command-log persistence was mitigated with a null-device symlink and enforced filesystem write denial. Private signing material remained in process environment/argv memory; it was never saved in files or reports.

The contract now implements separate post, bid, escrow, deliver, release, and refund methods. Up to eight immutable eligible-worker bids are retained under the posting storage fee. Client funding selects an existing bid and attaches exactly its amount. Retry, callback privacy and original beneficiaries are preserved. Deprecated unbounded callback-result reading was removed.

The release Wasm build passed with zero warnings, 216,747 bytes, SHA-256 `527d5ba554624e32e7dfbc7becf77a71088b4856c205537ed827b1c249f7faec`. All 55 Node tests passed, including 8 new bidding and 19 actual Wasm integration tests. All 12 production Rust policy tests passed. Combined: 67 passed, 0 failed, 0 skipped.

The local credential/init conflict was resolved by running actual Wasm with a first-party in-memory host, without nearcore init or node/validator keys. This does not measure nearcore gas costs or consensus. Four accounts were created through near-cli and the free faucet. Deployment and the five-stage lifecycle completed successfully on testnet. Final task status is Paid and the worker received exactly 0.04 test NEAR. README.md and the followup-verification, testnet-lifecycle and independent-check evidence files hold the exact accounts, transaction links and verification results. No CI, commit, push, publication, submission, X or mainnet action occurred.
