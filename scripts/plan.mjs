// Emits unsigned testnet-only call plans, never reads credentials or broadcasts.
import { account, amount, FEE } from '../demo/escrow.mjs';
export function plan(action,args,env,nowNs=BigInt(Date.now())*1000000n){
  if(env.NEAR_NETWORK!=='testnet')throw Error('NEAR_NETWORK must be testnet');
  const receiver_id=account(env.ESCROW_CONTRACT_ID),signer_id=account(env.NEAR_SIGNER_ID);
  if(!['post','bid','escrow','deliver','release','refund','pay'].includes(action))throw Error('Unsupported action');
  let deposit='0';const callArgs={...args};
  if(action==='post'){
    account(args.verifier);if(signer_id===args.verifier)throw Error('Distinct roles required');
    if(typeof args.title!=='string'||!args.title.trim()||Buffer.byteLength(args.title)>160||typeof args.criteria!=='string'||!args.criteria.trim()||Buffer.byteLength(args.criteria)>2048)throw Error('Invalid task text');
    amount(args.budget);const deadline=amount(args.deadline_ns);
    if(deadline>(1n<<64n)-1n||deadline<=nowNs||deadline>nowNs+30n*86400n*10n**9n)throw Error('Invalid deadline');
    deposit=String(FEE);delete callArgs.client;delete callArgs.worker;
  }else{
    if(typeof args.task_id!=='string'||!/^(0|[1-9][0-9]*)$/.test(args.task_id)||BigInt(args.task_id)>(1n<<64n)-1n)throw Error('Invalid task ID');
    if(action==='bid')amount(args.amount);
    if(action==='escrow'){account(args.worker);deposit=String(amount(args.deposit));delete callArgs.deposit;}
    if(action==='deliver'&&(typeof args.evidence_sha256!=='string'||!/^[a-f0-9]{64}$/.test(args.evidence_sha256)))throw Error('Invalid SHA-256');
  }
  return{network:'testnet',rpc:'https://rpc.testnet.near.org',signer_id,receiver_id,actions:[{type:'FunctionCall',method_name:action,args:callArgs,gas:'100000000000000',deposit}],signed:false,broadcast:false};
}
if(process.argv[1]?.endsWith('/plan.mjs')){try{console.log(JSON.stringify(plan(process.argv[2],JSON.parse(process.argv[3]||'{}'),process.env),null,2));}catch(e){console.error(e.message);process.exitCode=1;}}
