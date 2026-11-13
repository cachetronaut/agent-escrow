// First-party preflight check only; does not verify contract execution or make RPC calls.
import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {existsSync} from 'node:fs';
test('one-command lifecycle requires owner account approval before any evidence or RPC work',()=>{
  const env={...process.env};delete env.AGENT_ESCROW_CREATE_ACCOUNTS_APPROVED;delete env.NEAR_CLI_BIN;
  env.AGENT_ESCROW_EVIDENCE_FILE='docs/preflight-must-not-exist.json';
  assert.equal(existsSync(env.AGENT_ESCROW_EVIDENCE_FILE),false);
  const run=spawnSync(process.execPath,['scripts/testnet-lifecycle.mjs','--run'],{env,encoding:'utf8',timeout:5000});
  assert.equal(run.status,1);assert.match(run.stderr,/Owner approval required/);
  assert.equal(existsSync(env.AGENT_ESCROW_EVIDENCE_FILE),false);
});
