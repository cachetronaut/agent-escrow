# AgentEscrow development rules

- Owner label and Git author/committer name: Cachetronaut. Use the verified GitHub noreply identity only. Never commit legal names, personal email, credentials, keys, or absolute local filesystem paths.
- Repository stays PRIVATE while building. Owner must explicitly approve changing visibility. No CI workflows or remote CI runs.
- Testnet only. No mainnet funds, signatures, transfers, deployment, or Intents execution. Future Intents integration may use dry-run quotes only.
- Inspect the exact third-party code that will run before any installs, builds, sandbox binaries, proc macros, build scripts, or fetched CLIs. Do not execute when uncertain. Existing package safety wrappers do not waive this requirement.
- Secrets only through environment variables. Never ask for seeds or keys in chat, or write them into files.
- Owner handles sign-in confirmations. The current run explicitly authorizes agents to create four faucet-funded testnet accounts after compilation and testing. Mainnet account creation remains excluded. Do not work around sign-in confirmations.
- Owner approves project name, tracks, and description. One submission total. Owner records and posts the video on X himself.
- No submission form/API call until owner has seen and explicitly confirmed the exact final payload verbatim.
- Code work uses Sol at high reasoning. Review work may use xhigh with a findings, fixes, re-review loop.
- Clearly label offline models, unsigned plans, uncompiled code, and missing on-chain verification. Do not present model tests as contract tests.
