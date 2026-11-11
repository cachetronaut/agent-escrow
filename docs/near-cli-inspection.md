# near-cli installation and selected-command inspection

Owner: Cachetronaut. Reviewed 2026-11-11. No downloaded CLI code was executed during this inspection.

## Pinned official package

Official repository: https://github.com/near/near-cli-rs

Release: https://github.com/near/near-cli-rs/releases/tag/v0.31.1

Release target commit: `5cdedc38e09b23b84ae9d69f6abbb26568dda579`.

| Input | SHA-256 |
| --- | --- |
| `near-cli-rs-aarch64-apple-darwin.tar.gz` | `0404ad783c44dad766fe0e0097c5b45e3fbbdbc546f9c7f4e36dfff659c14625` |
| Extracted `near` executable | `6599bc06b1f864359a3289e451b828d3406d1489515aa260413fccacb3568486` |
| Release `source.tar.gz` | `aa0736fa9c23ee6866b39776ba1e9ea7422e8a999be9d2761f7d56a8eccf886a` |
| Release shell installer | `d131d9953720f15d80758031b10915001ada18242a7bb14c82490b41a5d60a06` |

All downloaded archives and the installer matched the SHA-256 digests published by the official GitHub release API. The portable archive contains only the executable, README, changelog, and two license files. Static inspection identifies the executable as ARM64 Mach-O, with an ad-hoc linker signature and only Apple system dynamic libraries. Checksums establish byte identity with the official release, not a reproducible source-to-binary proof.

## Installation method

Use the official portable release, not an npm lifecycle hook, Cargo compilation, Homebrew formula, or downloaded shell installer. The inspected installer dispatch/install sections normally choose an archive, copy the executable, write receipt/updater data, and modify shell configuration. None of that downloaded shell code needs to execute for portable installation.

The selected install operation runs only existing trusted filesystem tools: extract the checksum-verified archive after validating entry names, copy its single `near` executable into a task-local tool directory, set executable mode, and verify the copied hash. After successful isolated version/help checks, the same verified bytes were installed into the user-local bin directory with exclusive-create semantics. An existing executable cannot be overwritten. No shell-profile edit was made. The subsequent version/help checks execute only that exact pinned executable under write denial and isolated configuration.

## Bounded source inspection

Pinned source root: https://github.com/near/near-cli-rs/tree/5cdedc38e09b23b84ae9d69f6abbb26568dda579/src

Read selected production bodies in:

- `main.rs`, `lib.rs`: configuration bootstrap, argument dispatch, tracing, command reconstruction, extension fallback, release check.
- `config/mod.rs`, `config/migrations.rs`: configuration paths/schema, network lookup, RPC construction.
- `commands/account/create_account/sponsor_by_faucet_service`: provided-public-key account creation, network selection, and HTTP request/result handling.
- `transaction_signature_options/sign_with_private_key/mod.rs`, `types/secret_key.rs`, `transaction_signature_options/mod.rs`: private-key parsing, access-key nonce query, V0 transaction construction, signing, and callback dispatch.
- `transaction_signature_options/send/mod.rs`: RPC `send_tx`, finality handling, and retries of the same signed transaction.
- `network_for_transaction/mod.rs`, `network_view_at_block/mod.rs`: explicit network selection and final block views.
- `commands/contract/deploy`, `commands/contract/call_function/as_transaction`, `as_read_only`, and `call_function_args_type`: Wasm-file reading, deploy/init action construction, JSON call arguments, and view output.
- Reachable `common.rs` helpers for RPC dispatch, transaction status output, account-history files, executable-path reporting, extension fallback, and final-command persistence.

The selected command paths read explicit contract/configuration inputs, construct/sign transactions in memory, and contact configured public RPC/faucet endpoints. No keychain, seed import, generated-key persistence, dynamic extension, self-update execution, relayer, file-argument, or global-contract deployment path is selected. Transitive library implementations and inactive CLI commands are outside this bounded review; this is not an exhaustive binary security audit.

## Credential and side-effect controls

The plaintext signer has a positional private-key argument and no native environment-variable binding. The supported automation pattern reads the credential from a process environment variable and constructs the child argv in memory. Never put a key value in a tool request, shell command literal, committed file, or report. This interpretation uses environment variables as the credential source; argv and process memory temporarily contain the value.

The CLI unconditionally attempts to save the complete reconstructed command to `TMPDIR/near-cli-rs-final-command.log`, including under `--quiet`. Before any signing execution, use an isolated temporary directory, make that log path a symlink to the system null device, and enforce OS denial of filesystem writes except the null device. Verify the symlink and profile before supplying any credential. This prevents both command-log persistence and accidental key-file writes. The account-history update helpers ignore denied writes.

Use an isolated HOME with a pre-created version-5 configuration containing only one `testnet` network. Set the RPC to `https://rpc.testnet.near.org/`, faucet to `https://helper.nearprotocol.com/account`, and explorer transaction prefix to `https://testnet.nearblocks.io/txns/`. Leave relayer, price, wallet integrations, MPC, and unrelated optional URLs absent. Pre-create empty nonsecret account-history files, or deny their writes. Deny reads of the real home except explicitly needed project/tool paths. Do not inherit unrelated credentials, tracing overrides, shell history hooks, or debug backtraces.

The release-check thread calls only GitHub release metadata; it never installs an update by itself. If disabling that request is desired, a failing local HTTPS proxy with NO_PROXY limited to the testnet RPC/faucet hosts makes that check fail without redirecting testnet requests. Do not invoke the self-update command.

Capture all stdout/stderr in memory. `--quiet` suppresses the command echo but also suppresses successful final transaction hashes. For transaction evidence, capture nonquiet output and emit only validated transaction hashes and constrained result fields. Do not print raw output, even on errors. Never use teach-me mode, which can emit/save RPC payloads. The parent must independently verify chain ID before signing, because CLI network labels are not cryptographic proof of a chain.

## Selected command shapes

These are shapes, not commands containing credentials. Expand placeholders only inside a process that reads keys from its environment and captures output. The signer key is positional in this pinned version.

```text
near account create-account sponsor-by-faucet-service ACCOUNT_ID use-manually-provided-public-key PUBLIC_KEY network-config testnet create

near contract deploy CONTRACT_ID use-file WASM_PATH with-init-call new json-args '{}' prepaid-gas '100 Tgas' attached-deposit '0 NEAR' network-config testnet sign-with-plaintext-private-key ENV_DERIVED_PRIVATE_KEY send --wait-until final

near contract call-function as-transaction CONTRACT_ID METHOD json-args JSON_ARGS prepaid-gas '100 Tgas' attached-deposit DEPOSIT sign-as SIGNER_ID network-config testnet sign-with-plaintext-private-key ENV_DERIVED_PRIVATE_KEY send --wait-until final

near --quiet contract call-function as-read-only CONTRACT_ID get_task json-args '{"task_id":"0"}' network-config testnet now
```

The sender retries the same signed transaction up to five times after certain transient RPC errors. Never rerun an entire signing command after an unknown outcome without reconciling the reported transaction hash and account nonce.

## Clearance

Portable installation and initial version/help checks are cleared for the exact checksum-verified package and isolated write-denial setup above. The selected faucet/deploy/call/view/sign/send application paths have completed bounded source inspection, with credential-log persistence mitigated as specified. Before funded execution, validate the actual CLI grammar using help and verify the effective configuration and write-denial controls. No install or runtime claim is made by this inspection record alone.

## Execution verification

Installed version: near-cli-rs 0.31.1. Version/help and the effective configuration were checked under the isolated OS profile. The loaded configuration had only testnet. A system-shell write probe failed and created no file. Reading the command-log sink returned zero bytes. Funded commands capture output in memory, persist an attempted marker before invoking the CLI, and record a parsed transaction hash before RPC verification. Unknown outcomes block resends until read-only reconciliation. The controller checks the generated account access key, transaction signer/receiver, final receipts, deployed code hash, task state, and payout balance delta.
