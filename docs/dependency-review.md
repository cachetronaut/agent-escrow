# Dependency execution review

This is an incomplete source-inspection record, not permission to compile.

## Source identity

Reviewed lockfile SHA-256: `da77c6b74193fd8df4415c7fefa43b6c8f7f6eab9f24c3047296c6e95d73fa5e`.

The active normal/build graph contains 78 registry crates, 11 build scripts, and 9 procedural macro crates. The metadata inventory deliberately overapproximates it. All 78 active crate archives matched locked checksums; 2,611 archived files matched extracted bytes. The first-party fingerprint checker additionally records and verifies 107 dependency trees in the broader inventory.

## Coverage and remaining work

| Group | Inspection status |
| --- | --- |
| Active build scripts | All 11 read, including compiler probes and generated-file behavior. |
| NEAR, Borsh, Darling | Entry points and selected implementations inspected; remaining traversal/generation helpers under bounded review. |
| Serde derive, quote, proc-macro2, Syn | 149 source files inspected. Follow-up cleared twelve generated Syn implementations and both unicode-ident runtime files. |
| Remaining host helpers | Bounded clearance for reachable host paths; see below. |

The parser review found no network, subprocess, arbitrary file access, credential-environment access, or dynamic loading in inspected executable bodies. Serde custom function paths are emitted into generated implementations rather than invoked during expansion. Quote invokes supplied token-construction callbacks; inspected callbacks manipulate syntax and tokens. Syn models Rust calls and modules as syntax rather than executing or loading them.

This does not prove memory safety or absence of denial-of-service behavior. Token buffers and parsing helpers contain unsafe code. Generated macro tokens may be expanded later by the compiler. The twelve uninspected Syn files include active extra-trait and fold implementations, so they cannot be dismissed as inactive. Source inspection must finish before the build gate is cleared.

## Build controls prepared for later execution

Pinned installed compiler identity, exact source fingerprints, no unexpected Cargo configuration, no inherited compiler wrappers or metadata injection, offline Cargo, isolated cache bookkeeping, a minimal environment, remapped source paths, and a macOS filesystem/network sandbox. These controls supplement source inspection and do not waive it.

## Sandbox executable preparation

Official wrapper source selects sandbox version 2.14.0. The official nearcore tag resolves to commit `bc4e9e8cfb03d9e82f027883055624e18576993e`.

Downloaded archive SHA-256: `ea53448ef97540c012e5c3d967c74d78292b0465a98cf7027811a936718fe232`.

Extracted executable SHA-256: `8e0e1521372b0fce801b7464078c1e95e5a25a0f92ad4b4241451c33fe9e5a2a`.

Static inspection identified an ARM64 Mach-O executable, an ad-hoc signature without a developer team identifier, system-library imports, and an external xz/liblzma dependency. The GitHub release has no attached artifacts/checksums. These observations identify downloaded bytes; they do not establish an authenticated source-to-binary correspondence or clear execution. The sandbox has not been run.

## Generated parser follow-up: bounded clearance

The follow-up cleared all twelve generated files in both Syn versions and both unicode-ident runtime files. It structurally traversed all 40,725 generated Syn lines, enumerated 3,563 function bodies, and inspected 360 normalized segment forms while preserving operators, control flow, call structure, and nonvisitor method names. Imports, attributes, macro families, and callback boundaries were separately checked. No package code ran.

Generated visitors invoke caller-provided visitor, formatting, equality, and hashing implementations; these remain explicit callback boundaries covered by their own caller reviews. No hidden filesystem, environment, network, subprocess, FFI, or dynamic code execution was found in this scope.

Unicode-ident's numeric tables and two predicates were inspected. Its two unchecked reads were checked against the complete table sizes and scalar-index arithmetic. The follow-up reports no remaining execution-inspection gaps in these 14 files. This closes the parser gap identified above, not the full build gate.

## Host-helper review: bounded clearance

The helper review cleared the reachable host paths for ordinary offline Wasm compilation with trusted pinned Cargo/rustc and no credentials. It inspected Serde-with macros, Strum Display expansion, rustversion, proc-macro-crate, TOML parsing, JSON metadata processing, and the called collection, formatting, string-search, and lazy-initialization helpers. Unused APIs, inactive features, unrelated backends, tests, and documentation remain outside this bounded review.

`proc-macro-crate` invokes trusted Cargo workspace discovery and reads manifests. `version_check` invokes trusted rustc version reporting. NEAR metadata macros embed supplied metadata values; the build runner removes those environment inputs. `STRUM_DEBUG` can print generated source and is also removed. Reviewed helpers otherwise operate on memory; unsafe pointer/buffer code and allocation/panic risks remain. No network, shell evaluation, download, or unexpected dynamic execution was found in this scope. The NEAR/Borsh/Darling source group remains pending.

## Sandbox launch review: execution not cleared

The pinned sandbox source review did not clear the proposed init/run sequence. Fresh initialization writes generated node and validator private keys into plaintext JSON files. No supported environment-only injection path was found. Public sandbox fixture keys exist, but using private-key values in files would require an explicit exception to the current rule. No such exception has been assumed.

Default node networking also enables public listeners, STUN, and peer reconnection. Empty command-line bootnode or telemetry strings do not clear configured lists. A future attempt needs validated OS confinement and explicit configuration disabling those paths. The archive and executable hashes identify the downloaded bytes but do not attest to correspondence with the reviewed source. Linked native implementations and the whole node runtime were not inspected. The binary remains unexecuted.

Reviewed source is pinned to nearcore commit `bc4e9e8cfb03d9e82f027883055624e18576993e`, particularly startup, CLI dispatch, initialization, key-file loading, network configuration, telemetry, and cache setup. The source review also identified store-directory deletion and self-reexecution paths that must remain confined to disposable storage. These findings block sandbox testing under the present requirements; they do not clear or invalidate the separately reviewed Wasm build graph.

## Re-do source identity and NEAR generator inspection, 2026-11-11

All 107 recorded dependency source trees matched their fingerprints again. The lockfile SHA-256 remains `da77c6b74193fd8df4415c7fefa43b6c8f7f6eab9f24c3047296c6e95d73fa5e`.

The re-do inspected near-sdk-macros 5.28.3 `core_impl/info_extractor`, `core_impl/code_generator`, `core_impl/utils/mod.rs`, and `core_impl/contract_metadata`, excluding tests and inactive ABI/event paths. The inspected bodies parse attributes and signatures, transform tokens, and generate contract wrappers and external-call helpers. Private callback and nonpayable checks are emitted into Wasm wrappers, not executed during macro expansion. Contract metadata reads only named Cargo/NEP-330 environment inputs, which the build runner limits. No host filesystem, network, or subprocess calls were found in these inspected generator bodies. The inactive ABI embedding path emits include_bytes and remains disabled.

The Borsh cfg_aliases 0.2.2 helper was read in full. It reads Cargo feature/target environment values and emits Cargo cfg directives. Active build scripts previously reviewed were spot-checked again, including compiler probes and Serde OUT_DIR code generation. Source inspection is bounded to the actual offline build configuration; it is not a security audit of unused APIs or a runtime correctness proof.

## Offline Wasm execution gate closed

The bounded follow-up completed Borsh derive 1.8.1 and the reachable production parsing, traversal, generation, utility, and error-handling paths in Darling/darling_core/darling_macro 0.20.11 and 0.24.1. It also covered NEAR macro entry points, including near, near_bindgen, PanicOnDefault, and build.rs. Together with the NEAR generator inspection and earlier parser/helper reviews, no identified inspection gaps remain for this exact pinned offline Wasm build. This clearance does not include near-cli or sandbox executables, inactive ABI/schema features, or future dependency changes.

The prepared deny-default OS profile aborted trusted /bin/echo before Cargo startup. The build runner was corrected to permit normal OS startup, deny network and all filesystem writes by default, allow writes only under contract/target and /dev/null, and deny home-directory reads except explicit source/toolchain paths. It still strips the inherited environment, rejects unreviewed Cargo configuration, verifies source fingerprints, and builds offline and locked. The earlier launcher failures were not compiler errors.

## Controlled Wasm runtime inspection, bidding follow-up

The dependency lockfile and 107 source fingerprints remain unchanged. The controlled in-memory execution review read SDK LookupMap and ContractState, relevant environment register/context/storage/promise/panic adapters, Promise construction/serialization/drop, Borsh primitive/String/Option/Vec/Box/PhantomData helpers, account-ID validation and serialization adapters, SDK U64/U128 JSON wrappers, serde_json input/output paths, and the wee_alloc Wasm backend. It cleared bounded execution with controlled test JSON and contract-generated storage bytes. This is not an exhaustive memory-safety audit.

The first-party host supplies no filesystem, network, or signing capability. Unexpected imported host calls throw. Its state stays in memory, so tests require no near-sandbox initialization and create no node or validator credentials. Nineteen tests execute the actual rebuilt Wasm. The downloaded near-sandbox executable remains unused; nearcore gas charging and consensus are outside the host's coverage.

The separate near-cli portable-package and selected-command review is recorded in near-cli-inspection.md. Signing commands run under filesystem write denial. The CLI's unconditional saved-command log is redirected to the null device, preventing private-key argument persistence.
