import {spawnSync} from 'node:child_process';
import {readFile,writeFile,access} from 'node:fs/promises';
import {randomBytes} from 'node:crypto';
import {createInterface} from 'node:readline/promises';
const setup=process.argv.includes('--setup'),configPath='cloud/wrangler.personal.jsonc';
const rl=process.stdin.isTTY?createInterface({input:process.stdin,output:process.stdout}):null;
const ask=async question=>{if(!rl)throw new Error('터미널에서 직접 실행하거나 필요한 개인 설정을 먼저 만들어 주세요.');return (await rl.question(question)).trim();};
const run=(args,options={})=>{const r=spawnSync(process.execPath,args,{stdio:options.capture?'pipe':'inherit',encoding:'utf8',...options});if(r.status!==0)throw new Error('명령을 완료하지 못했습니다. 요금제를 변경하거나 재시도하지 않았습니다.');return r.stdout??'';};
const wrangler=(args,options={})=>run(['node_modules/wrangler/bin/wrangler.js',...args,'--config',configPath],options);
try{
 console.log('Workers Free 전용 설치/배포입니다. Cloud Run, Containers, R2, 유료 요금제를 신청하지 않습니다.');
 const confirmed=process.argv.includes('--free-plan-confirmed')||await ask('Cloudflare → Workers & Pages → Plans에서 Workers Free를 확인했나요? 확인한 경우 FREE 입력: ')==='FREE';
 if(!confirmed)throw new Error('무료 플랜 확인 전에는 원격 리소스를 만들거나 배포하지 않습니다.');
 let exists=true;try{await access(configPath);}catch{exists=false;}
 if(!setup&&!exists)throw new Error('먼저 npm run cloud:setup을 실행해 주세요.');
 if(setup&&!exists){
  const account=await ask('Cloudflare 계정 ID (32자리): '),email=await ask('로그인할 본인 Google 이메일: ');
  if(!/^[a-f0-9]{32}$/.test(account)||!/^\S+@\S+\.\S+$/.test(email))throw new Error('계정 ID 또는 이메일 형식을 확인해 주세요.');
  const config=JSON.parse(await readFile('cloud/wrangler.jsonc','utf8'));config.account_id=account;config.vars.OWNER_EMAIL=email.toLowerCase();
  await writeFile(configPath,JSON.stringify(config,null,2)+'\n',{mode:0o600});
  // This account-specific file is ignored by Git. There is no API key in it.
 }
 if(setup){
  const config=JSON.parse(await readFile(configPath,'utf8'));
  let output=wrangler(['d1','list','--json'],{capture:true});let list;try{list=JSON.parse(output.slice(output.indexOf('['),output.lastIndexOf(']')+1));}catch{throw new Error('D1 ID 조회에 실패했습니다. Cloudflare D1에서 ID를 확인해 개인 설정에 입력해 주세요.');}
  let database=list.find(x=>x.name===config.d1_databases[0].database_name);
  if(!database){wrangler(['d1','create',config.d1_databases[0].database_name]);output=wrangler(['d1','list','--json'],{capture:true});list=JSON.parse(output.slice(output.indexOf('['),output.lastIndexOf(']')+1));database=list.find(x=>x.name===config.d1_databases[0].database_name);}
  if(!database?.uuid)throw new Error('D1 데이터베이스를 찾지 못했습니다.');config.d1_databases[0].database_id=database.uuid;await writeFile(configPath,JSON.stringify(config,null,2)+'\n',{mode:0o600});
 }
 run(['scripts/build-cloud.mjs']);
 wrangler(['d1','migrations','apply','workspace-lab-personal','--remote']);
 wrangler(['deploy']);
 if(setup){
  // Pipe a new random secret directly to Wrangler; never print it or write it to disk.
  const listed=wrangler(['secret','list'],{capture:true});
  const names=JSON.parse(listed.slice(listed.indexOf('['),listed.lastIndexOf(']')+1));
  if(!names.some(x=>x.name==='APP_SECRET'))wrangler(['secret','put','APP_SECRET'],{input:randomBytes(32).toString('hex'),stdio:['pipe','inherit','inherit']});
 }
 console.log('배포 명령을 완료했습니다. 표시된 HTTPS 주소의 /setup에서 Google 웹 로그인과 선택한 AI 키를 연결하세요.');
}catch(e){console.error(e.message);process.exitCode=1;}finally{rl?.close();}
