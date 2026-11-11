# Architecture

Owner: Cachetronaut. Three units: contract/ contains the NEAR escrow, demo/ contains the offline browser and reference model, and scripts/ contains local tests, unsigned plans, and the inspected near-cli controller. There are no JavaScript package dependencies.

## Contract flow

1. Client posts immutable verifier, title, criteria, budget ceiling and deadline. Exactly 0.1 test NEAR is retained for storage. The task is Posted and unfunded.
2. Eligible workers add immutable bids. A positive bid cannot exceed the budget ceiling. Client, verifier and contract cannot bid. Each worker may bid once; at most eight workers may bid.
3. The original client selects an existing bid and attaches exactly that bid amount. The task becomes Open. The accepted amount and worker cannot be replaced.
4. The selected worker delivers a lowercase SHA-256 digest of artifact bytes before the deadline. The task becomes Delivered.
5. The named verifier releases the selected amount before the deadline. The transfer callback records Paid or preserves an Approved claim after failure.
6. Anyone may refund at or after the deadline. An unfunded post becomes Cancelled with no transfer. Funded Open/Delivered tasks return only escrow_amount to the original client.

IDs, timestamps and amounts are decimal strings in JSON. Deadlines are nanoseconds within 30 days of posting. Invalid calls revert atomically. See bidding-design.md for API and storage details.

## Receipt behavior

Release records Approved, then PayingWorker in one receipt. Refund records Refundable, then Refunding in one receipt. Incoming calls cannot interleave within that receipt. The private callback requires one promise result. A successful native transfer returns empty bytes; callback reads are bounded to zero bytes. Success moves to Paid or Refunded. Failure restores Approved or Refundable for permissionless pay retry. No caller can change the payout recipient or amount. Pending and terminal states reject duplicate transfers. Missing callbacks leave a pending lock without an unsafe administrative override.

## Verification boundaries

Direct policy tests execute production Rust policy. Nineteen integration tests execute the real Wasm ABI with a first-party in-memory host. They cover storage calls, JSON/Borsh serialization, callback privacy, ordering, authorization, exact deposits, bid selection, refunds, retry and isolation. The host approximates storage overhead and supplies gas values; it does not emulate nearcore gas charging or consensus.

The local host requires no node initialization or signing keys. The previously downloaded near-sandbox binary is unused. Actual testnet deployment, five lifecycle transactions, successful final receipts, code-hash match, final Paid state and exact worker payout are recorded separately in testnet-lifecycle.json and testnet-independent-check.json.

The near-cli controller generates signing credentials in its own process environment. It uses only the inspected CLI for account creation, signing and sending. The adapter fixes configuration to testnet, verifies chain ID before signing, verifies the binary fingerprint, captures CLI output in memory, and denies filesystem writes except the null device. CLI reconstructed-command logging is redirected to the null device. Unknown outcomes block resends; reconciliation reads account/access-key and transaction state. No credential values enter evidence files.

## Product limits

The named verifier is a trusted adjudicator. A digest commits to bytes, not correctness, availability, or confidentiality. Artifacts must be shared separately. The browser is an offline convenience demo that automatically performs post/bid/escrow at creation. The CLI demo records each stage and uses a deterministic verifier for its predefined JSON task. No general LLM verification or autonomous signing agent is claimed.

Only native test NEAR is implemented. No stablecoin or Intents execution is integrated. Full-access deployment keys remain an upgrade trust boundary even though the contract exposes no upgrade or admin-withdrawal method. Storage fees remain in the contract, without cleanup or withdrawal methods. Account credentials have no file backup and disappear when the controller ends. No publication, submission, X post or mainnet account is authorized.
