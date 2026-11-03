# Architecture

Three deployment units: `contract/` holds the escrow, `demo/` is a static offline UI and reference model, `scripts/` holds first-party demo agents, unsigned plans, and the loopback static server. There are no runtime JavaScript dependencies.

## Contract-first agent flow

Preflight requires testnet named accounts, distinct roles, positive decimal-string budget, bounded task text, deadline within 30 days, and exactly budget plus the storage fee. Invalid input stops before creating a task.

1. Client input: worker, verifier, title, criteria, budget, deadline. Output: task ID and immutable escrow terms.
2. Worker input: immutable criteria. Output: artifact bytes and lowercase SHA-256 of those exact bytes. Deliver records the digest, not the artifact.
3. Verifier input: artifact bytes, on-chain digest, and original criteria. Output: approve or reject. Only the preassigned verifier account can approve. A rejection does not release funds; expiry refunds later.
4. Settlement input: approved or expired task. Output: transfer receipt and terminal status, or a retryable claim on transfer failure.

The CLI demonstration emits a versioned JSON envelope with component, request and run IDs, status, result, errors and an ordered trace. It is deterministic simulation. Signed agents and production artifact retrieval are pending. The browser accepts arbitrary criteria for human review; the CLI verifier supports only its predefined JSON criteria. Neither is represented as general AI verification.

## State transitions

```text
Open -> Delivered -> PayingWorker -> Paid
                         | failure
                         v
                      Approved -> PayingWorker

Open / Delivered -- at deadline --> Refunding -> Refunded
                                       | failure
                                       v
                                   Refundable -> Refunding
```

Approval records Approved before starting PayingWorker in the same atomic receipt. Expiry similarly records Refundable before Refunding. Incoming calls cannot interleave during one receipt. Pending states block duplicate transfers. Callback is private, expects one promise result, and has fixed reserved gas. Approval and delivery require time strictly before deadline; expiry requires time at or after it.

## Trust and operational limits

The verifier is a trusted named adjudicator, not an oracle proof system. The digest commits to bytes, not correctness, availability, or confidentiality. Store and share artifacts separately. The worker cannot replace evidence, and verifier rejection has no early refund method. Use deadlines that allow review time.

Only native test NEAR is supported. NEP-141 stablecoins require authenticated token receiver handling, registration accounting, transfer-call refund safety, and separate integration tests. Intents is mainnet-only under the project brief; this repository makes no Intents requests or deposits. Any future quote support must set dry-run and never sign or submit an intent.

The contract has no admin withdrawal or upgrade entry point. An account full-access key can still replace code; owner account/key custody remains a trust boundary. Do not claim immutable deployment without removing that capability through a separately reviewed process. Storage fees remain in the contract to fund retained records. There is no cleanup or fee withdrawal method.
