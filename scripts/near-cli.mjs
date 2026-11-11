// Inspected near-cli adapter. Credentials originate in environment variables only.
// CLI argv and captured output stay in memory; OS policy prevents credential files.
import {spawnSync} from 'node:child_process';
import {mkdtemp,mkdir,writeFile,symlink,readlink,readFile} from 'node:fs/promises';
import {tmpdir,homedir} from 'node:os';
import {resolve,join} from 'node:path';
import {createHash} from 'node:crypto';
const expected='6599bc06b1f864359a3289e451b828d3406d1489515aa260413fccacb3568486';
export async function cliContext(){
  const binary=process.env.NEAR_CLI_BIN;if(!binary)throw Error('Set NEAR_CLI_BIN to the inspected portable executable');
  if(createHash('sha256').update(await readFile(binary)).digest('hex')!==expected)throw Error('CLI fingerprint mismatch');
  const home=await mkdtemp(join(tmpdir(),'agent-escrow-cli-'));
  const temp=join(home,'tmp');await mkdir(temp);await symlink('/dev/null',join(temp,'near-cli-rs-final-command.log'));
  const credentials=join(home,'disabled-credentials');await mkdir(credentials);
  const config=`version = "5"\ncredentials_home_dir = ${JSON.stringify(credentials)}\n[network_connection.testnet]\nnetwork_name = "testnet"\nrpc_url = "https://rpc.testnet.near.org/"\nwallet_url = "https://testnet.mynearwallet.com/"\nexplorer_transaction_url = "https://testnet.nearblocks.io/txns/"\nfaucet_url = "https://helper.nearprotocol.com/account"\n`;
  for(const dir of [join(home,'Library','Application Support','near-cli'),join(home,'.config','near-cli')]){await mkdir(dir,{recursive:true});await writeFile(join(dir,'config.toml'),config);}
  await writeFile(join(credentials,'accounts.json'),'[]');
  const quote=JSON.stringify;
  const wasm=resolve('contract/target/wasm32-unknown-unknown/release/agent_escrow.wasm');
  const profile=`(version 1)(allow default)(deny file-write*)(allow file-write* (literal "/dev/null"))(deny file-read* (subpath ${quote(homedir())}))(allow file-read-metadata)(allow file-read* (literal ${quote(resolve(binary))}) (literal ${quote(wasm)}) (subpath ${quote(home)}))`;
  const env={PATH:'/usr/bin:/bin',HOME:home,TMPDIR:temp,XDG_CONFIG_HOME:join(home,'.config'),NO_COLOR:'1',RUST_BACKTRACE:'0',HTTPS_PROXY:'http://127.0.0.1:9',HTTP_PROXY:'http://127.0.0.1:9',NO_PROXY:'rpc.testnet.near.org,helper.nearprotocol.com'};
  const context={binary,home,temp,profile,env};
  context.run=async(args,{credentialEnv}={})=>{
    if(await readlink(join(temp,'near-cli-rs-final-command.log'))!=='/dev/null')throw Error('CLI log sink changed');
    // The selected CLI requires a positional key. Read it here, never from a file.
    const expanded=args.map(arg=>arg==='$SIGNING_KEY'?process.env[credentialEnv]:arg);
    if(expanded.some(arg=>typeof arg!=='string'))throw Error('Missing environment signing credential');
    return spawnSync('/usr/bin/sandbox-exec',['-p',profile,binary,...expanded],{env,encoding:'utf8',timeout:180000,maxBuffer:4*1024*1024});
  };
  return context;
}
