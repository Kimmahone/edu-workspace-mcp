import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdtemp, readFile, rm, lstat } from 'node:fs/promises';
import os from 'node:os';import path from 'node:path';
import { remoteSession, saveSession, withSessionLock, validateRemoteTokens } from '../remote/session.js';
test('concurrent hosts rotate the MCP credential once and re-read the private session',async()=>{
 const directory=await mkdtemp(path.join(os.tmpdir(),'edu-remote-session-test-'));const file=path.join(directory,'fixture.json');let requests=0;
 try {
  await withSessionLock(file,()=>saveSession(file,{serverUrl:'https://auth.example.invalid/mcp',clientId:'fixture-client',redirectUri:'http://127.0.0.1:40000/oauth2callback',accessToken:'fixture-expired',refreshToken:'fixture-first-refresh',expiresAt:0}));
  const send:typeof fetch=async(input,init)=>{
   requests++;assert.equal(String(input),'https://auth.example.invalid/oauth/token');const body=new URLSearchParams(String(init?.body));assert.equal(body.get('refresh_token'),'fixture-first-refresh');assert.equal(body.get('resource'),'https://auth.example.invalid/mcp');assert.equal(body.get('client_secret'),null);
   await new Promise(resolve=>setTimeout(resolve,50));
   return Response.json({access_token:'fixture-fresh',refresh_token:'fixture-rotated',token_type:'Bearer',scope:'workspace.readonly offline_access',expires_in:300});
  };
  const values=await Promise.all([remoteSession(file,'https://auth.example.invalid/mcp',send),remoteSession(file,'https://auth.example.invalid/mcp',send)]);
  assert.equal(requests,1);assert.ok(values.every(value=>value.refreshToken==='fixture-rotated'));
  assert.equal(JSON.parse(await readFile(file,'utf8')).refreshToken,'fixture-rotated');
  if(process.platform!=='win32')assert.equal((await lstat(file)).mode&0o777,0o600);
  await assert.rejects(remoteSession(file,'https://other.example.invalid/mcp',send),/안전하게/);assert.equal(requests,1);
 }finally{await rm(directory,{recursive:true,force:true});}
});
test('wrong MCP scopes or an excessive access token lifetime fail closed',()=>{
 const good={access_token:'fixture-access',refresh_token:'fixture-refresh',token_type:'Bearer',scope:'workspace.readonly offline_access',expires_in:300};
 for(const token_type of ['Bearer','bearer','BEARER','bEaReR'])assert.ok(validateRemoteTokens({...good,token_type}));
 for(const bad of [{...good,token_type:'Basic'},{...good,token_type:undefined},{...good,token_type:' bearer'},{...good,scope:'workspace.write'},{...good,scope:'workspace.readonly google-token'},{...good,expires_in:3600},{...good,refresh_token:undefined}])assert.throws(()=>validateRemoteTokens(bad));
});
test('explicit refresh verifies rotation even while the cached MCP access token is fresh',async()=>{
 const directory=await mkdtemp(path.join(os.tmpdir(),'edu-force-refresh-test-'));const file=path.join(directory,'fixture.json');let requests=0;
 try {
  await withSessionLock(file,()=>saveSession(file,{serverUrl:'https://auth.example.invalid/mcp',clientId:'fixture-client',redirectUri:'http://127.0.0.1:40000/oauth2callback',accessToken:'fixture-cached-access',refreshToken:'fixture-before-refresh',expiresAt:Date.now()+300000}));
  const send:typeof fetch=async(_input,init)=>{requests++;const body=new URLSearchParams(String(init?.body));assert.equal(body.get('refresh_token'),'fixture-before-refresh');return Response.json({access_token:'fixture-new-access',refresh_token:'fixture-after-refresh',token_type:'Bearer',scope:'workspace.readonly offline_access',expires_in:300});};
  const cached=await remoteSession(file,'https://auth.example.invalid/mcp',send);assert.equal(requests,0);assert.equal(cached.accessToken,'fixture-cached-access');
  const renewed=await remoteSession(file,'https://auth.example.invalid/mcp',send,{forceRefresh:true});assert.equal(requests,1);assert.notEqual(renewed.refreshToken,cached.refreshToken);assert.equal(renewed.accessToken,'fixture-new-access');
 }finally{await rm(directory,{recursive:true,force:true});}
});
