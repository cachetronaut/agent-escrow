# AgentEscrow demo script

Target: under three minutes. Testnet only. The recording is a live evidence monitor, not the offline model UI. Narration below is for the owner's voiceover. No keys or plaintext signer commands go on screen.

## Preparation, before recording

From the repository root, complete the README source-review and build steps. Set `NEAR_CLI_BIN` in the shell to the inspected, fingerprint-verified near-cli 0.31.1 executable. No installation is performed by these commands.

```sh
AGENT_ESCROW_EVIDENCE_FILE=docs/recorded-run.json node scripts/testnet-lifecycle.mjs
```

In that controller's standard input, enter each command once and wait for success before the next:

```text
create
deploy
```

The controller creates four fresh faucet-funded testnet accounts and deploys the compiled Wasm. It keeps credentials only in its environment and memory. Leave it running. Never repeat a transaction after an unknown result. Use `reconcile` and review evidence first.

## Record the complete lifecycle

Start capture with all five stages still waiting. Enter this single controller command:

```text
lifecycle
```

This performs the five real contract calls in order, checking testnet chain identity before each signature and final RPC receipts after each call. Keep the evidence monitor and its explorer URLs visible throughout.

| Screen event | Exact narration |
| --- | --- |
| Opening, before post | "This is AgentEscrow, built by Cachetronaut at NEAR HACKATHON. This run uses real NEAR testnet transactions and test funds." |
| Post succeeds | "The client posts immutable task terms, names a verifier, and sets a budget ceiling of zero point zero five test NEAR. A separate storage fee reserves space for bids and evidence." |
| Bid succeeds | "The worker bids zero point zero four test NEAR. Posting and bidding do not fund the payout." |
| Escrow succeeds | "The client selects that existing bid and escrows exactly zero point zero four test NEAR." |
| Deliver succeeds | "The selected worker commits the SHA-256 digest of the delivered JSON brief. This demo uses deterministic worker output." |
| Release succeeds | "The named verifier authorizes release. This is verifier attestation, not autonomous LLM verification." |
| Paid and balance delta appear | "Final receipts show Paid. The worker balance increased by exactly zero point zero four test NEAR on release. Every stage has a testnet explorer link. The contract also supports deadline refunds and retryable failed payments, covered separately by local tests." |
| Closing | "The repository remains private for owner review. Publication, the X video post, and submission await owner approval." |

Stop capture after Paid and the balance increase are readable. The capture itself has no microphone narration; use these words for the owner's voiceover.

## Explorer links and verification

The recorded run's exact five explorer URLs and account IDs are in [demo receipt evidence](../docs/demo-testnet-lifecycle.json). Each transaction URL is `https://testnet.nearblocks.io/txns/` followed by its recorded transaction hash. See the run table below once populated.

The earlier verified deployment remains [8TVSKFvCvpC14MCCM2gNo9gnCFnH9GyboGy6z3kmryqR](https://testnet.nearblocks.io/txns/8TVSKFvCvpC14MCCM2gNo9gnCFnH9GyboGy6z3kmryqR), contract `ae-261111-ce0de7-contract.testnet`.

Read-only verification of the earlier run:

```sh
node scripts/read-task.mjs ae-261111-ce0de7-contract.testnet 0
```

For a single uninterrupted fresh run without interactive staging, use a unique evidence filename:

```sh
AGENT_ESCROW_EVIDENCE_FILE=docs/another-run.json node scripts/testnet-lifecycle.mjs --run
```

Do not reuse a filename or overwrite evidence. Enter `exit` when finished to destroy the controller's ephemeral credentials.
