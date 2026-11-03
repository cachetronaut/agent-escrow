# Review loop

Reviewer: Sol, xhigh reasoning. Implementation: Sol, high reasoning. No CI.

## Round 1

Requested changes for three P2 correctness findings:

1. Planner accepted expired, too-distant, and out-of-u64 deadlines. Fix: inject a clock and enforce the contract's exact time window and u64 bound. Regression tests cover both boundaries and overflow.
2. Model and planner coerced non-string evidence into a valid hash. Fix: require a string before regex validation. Regression tests reject arrays, objects, numbers, and null and assert unchanged task state.
3. Async browser hashing could deliver into a replacement task after Reset. Fix: capture model, ID, generation, and time before awaiting; discard stale completion before any model or artifact mutation. A test imports the actual app with deferred digest completion and verifies the replacement task stays Open.

The reviewer requested explicit tests for callback loss. Added tests confirming PayingWorker and Refunding remain locked with no unsafe retry if the callback never arrives. This is a known operational limitation, not a recovery mechanism.

Contract release objections remain: no compiled ABI, no sandbox storage/gas/receipt evidence, and no testnet lifecycle receipts. Model correctness does not clear these gates. The owner controls deployment account keys and therefore can replace code; role separation does not prove independent ownership.

## Round 2

The xhigh reviewer independently closed all three R1 P2 findings and accepted the read-only RPC reader. It found a P3: rejected hashing from an old task could display an error after Reset. Parent fixed act() error handling to check generation and added both resolved and rejected digest regressions; both pass. This last small fix was verified locally, not independently re-reviewed.

Reviewer ran 20 non-server tests successfully, but its full run timed out starting the server. Parent subsequently ran the complete 21-test suite successfully with a 30-second startup allowance. The extra rejected-digest regression increases the suite to 22 tests. Server timing remains environment-sensitive. Contract deployment remains blocked; this review is acceptance of corrected prototype behavior only.
