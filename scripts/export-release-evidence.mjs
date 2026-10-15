import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { dirname } from 'node:path';
import { publicReleaseEvidence } from './release-conditions.mjs';
try {
 const base=new URL('../',import.meta.url);
 const manifest=JSON.parse(await readFile(new URL('package.json',base),'utf8'));
 const source=await readFile(new URL('src/remote/session.ts',base),'utf8');
 const serverUrl=source.match(/export const DEFAULT_REMOTE_URL='([^']+)'/)?.[1];
 const policy=await readFile(new URL('docs/privacy.html',base));
 const proof=JSON.parse(await readFile(new URL('.release-readiness.local.json',base),'utf8'));
 const commit=execFileSync('git',['rev-parse','HEAD'],{cwd:base,encoding:'utf8'}).trim();
 const evidence=publicReleaseEvidence(proof,{version:manifest.version,serverUrl,publicPolicySourceHash:createHash('sha256').update(policy).digest('hex')},commit);
 const output='/tmp/edu-agent-publish/agent-release-readiness.json';await mkdir(dirname(output),{recursive:true});await writeFile(output,JSON.stringify(evidence,null,2)+'\n',{mode:0o600});
 console.log(JSON.stringify({output,version:evidence.version,sourceCommit:evidence.sourceCommit,privateDetailsExported:false}));
} catch {console.error('RELEASE_EVIDENCE_EXPORT_BLOCKED');process.exitCode=1;}
