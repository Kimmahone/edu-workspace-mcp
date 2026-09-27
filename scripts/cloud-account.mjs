import {spawnSync} from 'node:child_process';
// Credentials stay inside this process. Never log child stdout/stderr or response headers.
const login=spawnSync(process.execPath,['node_modules/wrangler/bin/wrangler.js','auth','token','--json'],{encoding:'utf8',env:{...process.env,WRANGLER_SEND_METRICS:'false'}});
if(login.status!==0)throw new Error('Cloudflare 로그인이 필요합니다. npx wrangler login');
let credentials;try{credentials=JSON.parse(login.stdout.slice(login.stdout.indexOf("{"),login.stdout.lastIndexOf("}")+1));}catch{throw new Error('Cloudflare 인증 응답을 읽지 못했습니다.');}
if(!credentials.token)throw new Error('OAuth 또는 API token 인증이 필요합니다.');
const account=process.argv[2];if(!/^[a-f0-9]{32}$/.test(account??''))throw new Error('계정 ID가 필요합니다.');
const endpoint=process.argv[3]??'workers/account-settings';
if(!['workers/account-settings','subscriptions','workers/scripts','d1/database','workers/subdomain'].includes(endpoint))throw new Error('읽기 전용 확인 경로가 아닙니다.');
const response=await fetch(`https://api.cloudflare.com/client/v4/accounts/${account}/${endpoint}`,{headers:{Authorization:`Bearer ${credentials.token}`}});
const body=await response.json();if(!body.success){console.log(JSON.stringify({ok:false,status:response.status,codes:body.errors?.map(e=>e.code)}));process.exit(1);}
if(endpoint==='subscriptions')console.log(JSON.stringify(body.result.map(x=>({plan:x.rate_plan?.id,name:x.rate_plan?.public_name,price:x.price,state:x.state})),null,2));
else if(endpoint==='workers/scripts')console.log(JSON.stringify(body.result.map(x=>({id:x.id,usage_model:x.usage_model})),null,2));
else console.log(JSON.stringify(body.result,null,2));
