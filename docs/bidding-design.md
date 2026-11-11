# Explicit bidding lifecycle

Owner: Cachetronaut. Testnet only. This schema replaces the undeployed prototype layout; use a fresh contract account.

| Method | Caller | Attached deposit | Result |
| --- | --- | --- | --- |
| `post(verifier,title,criteria,budget,deadline_ns)` | Client | Exactly 0.1 test NEAR retained for storage | Task ID, `Posted`, immutable budget ceiling and terms |
| `bid(task_id,amount)` | Worker distinct from client, verifier and contract | Zero | One immutable bid, positive amount at or below ceiling |
| `escrow(task_id,worker)` | Original client | Exactly selected existing bid amount | Selected worker, accepted amount, `Open` |
| `deliver(task_id,evidence_sha256)` | Selected worker | Zero | Immutable lowercase SHA-256, `Delivered` |
| `release(task_id)` | Named verifier | Zero | Worker transfer and private receipt callback |
| `refund(task_id)` | Anyone, at or after deadline | Zero | Cancel unfunded post or transfer funded amount to original client |
| `pay(task_id)` | Anyone | Zero | Retry original beneficiary claim after transfer failure |

At most eight workers may bid on a task. Bids cannot be replaced. Posting reserves storage for all eight bids, the selected worker, evidence, and state growth. The storage fee is retained on both release and refund. Bid selection transfers no fee to the worker; the worker receives exactly `escrow_amount`, which can be below the immutable `budget` ceiling.

Client, worker, verifier and contract must be distinct named `.testnet` accounts. Posting, bidding, funding, delivery, and release require timestamps strictly before the deadline. The deadline must fall within 30 days after posting. Invalid calls fail atomically. Refund becomes available at the deadline, without an automatic timer.

```text
Posted --bid--> Posted --escrow--> Open --deliver--> Delivered
    |                              |                  |
    +--deadline/refund--> Cancelled +--deadline/refund--+--> Refunding --> Refunded
                                                      |
Delivered --release--> PayingWorker --> Paid           +--failure--> Refundable --pay--> Refunding
                           |
                           +--failure--> Approved --pay--> PayingWorker
```

Approval fixes the worker claim even after the deadline. No refund can override it. Pending transfer states reject duplicate payout and refund. The private callback requires one receipt result and bounds its result read to zero bytes because native transfers return empty bytes. A missing callback leaves the task locked pending; there is no unsafe manual override.

The offline UI uses a convenience adapter that automatically posts, bids and funds at creation. The deterministic CLI demo records separate stages. Neither sends transactions. The unsigned planner emits only supported contract method names and separates posting storage fees from escrow funding.

# Verification boundary

Direct Rust policy tests cover authorization and transitions. The first-party in-memory host executes the actual compiled Wasm ABI, SDK serialization and storage calls, and callback/promise construction. It uses only controlled test inputs, has no network or signing credentials, and fails on unsupported host calls. All state stays in memory. This resolves local test setup without near-sandbox initialization or private-key files.

The host approximates storage overhead and supplies gas values. It is not a nearcore node and does not prove consensus, nearcore gas charging, networking, or real balance transfers. Public testnet final receipts and account balances provide separate on-chain evidence. The previously downloaded near-sandbox binary remains unused.
