# AgentEscrow development rules

- Owner label and Git author/committer name: Cachetronaut. Use the verified GitHub noreply identity only. Never commit legal names, personal email, credentials, keys, or absolute local filesystem paths.
- Repository is public. It stays public through judging (Nov 18, 2026). No CI workflows or remote CI runs.
- Testnet only. No mainnet funds, signatures, transfers, deployment, or Intents execution. Future Intents integration may use dry-run quotes only.
- Inspect the exact third-party code that will run before any installs, builds, sandbox binaries, proc macros, build scripts, or fetched CLIs. Do not execute when uncertain. Existing package safety wrappers do not waive this requirement.
- Secrets only through environment variables. Never ask for seeds or keys in chat, or write them into files.
- Owner handles sign-in confirmations. No new NEAR accounts without owner approval. Mainnet account creation stays excluded. Do not work around sign-in confirmations.
- Owner approves project name, tracks, and description. One submission total. Owner records and posts the video on X himself.
- No submission form/API call until owner has seen and explicitly confirmed the exact final payload verbatim.
- Code work uses Sol at high reasoning. Review work may use xhigh with a findings, fixes, re-review loop.
- Clearly label offline models, unsigned plans, uncompiled code, and missing on-chain verification. Do not present model tests as contract tests.

## Verification

- Every code change must pass a live end-to-end run on NEAR testnet before commit or push.
- The gate is `scripts/testnet-lifecycle.mjs`: the full post/bid/escrow/deliver/release lifecycle must end with the task Paid and the worker paid, with receipts on-chain.
- Unit tests in `tests/` are a development aid only and are never proof of done. A green test run with a failed live E2E is a fail.

## Workflow

- Make small focused commits straight to main, each landing working.
- Commit subjects must be single-sentence imperative and include `[skip ci]`.
- Get an independent Sol review at xhigh reasoning with a findings/fixes/re-review loop, re-run the live E2E after rebasing onto `origin/main`, then push. Never force-push.

## Simplicity

- Prefer the simplest correct solution, keep changes scoped, and prefer deletion and reuse over new code.

## Failure handling

- When verification fails, name the concrete failure, form one hypothesis, make the smallest fix, and re-verify. No repeated speculative changes.
- Escalate when information is unavailable, requirements conflict, or destructive approval is needed.

## Reporting

- Report work in three short plain sentences: what you did, why, how it works.
