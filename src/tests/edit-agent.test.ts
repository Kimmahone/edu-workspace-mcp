import assert from 'node:assert/strict';
import { test } from 'node:test';
import { parseCliOptions } from '../cli-options.js';
import { registration } from '../install/configure-client.js';
import { sessionPath, remoteScope, validateRemoteTokens } from '../remote/session.js';

test('write access is explicit and cannot reuse local OAuth overrides or read sessions',()=>{
 const original=process.env.EDU_WORKSPACE_SCOPE_PROFILE;
 try {
  delete process.env.EDU_WORKSPACE_SCOPE_PROFILE;
  const readFile=sessionPath();
  const good={access_token:'fixture-access',refresh_token:'fixture-refresh',expires_in:300,token_type:'Bearer',scope:'workspace.readonly offline_access'};
  assert.ok(validateRemoteTokens(good));
  assert.throws(()=>validateRemoteTokens({...good,scope:'workspace.readonly workspace.edit offline_access'}));
  process.env.EDU_WORKSPACE_SCOPE_PROFILE='workspace-edit';
  assert.notEqual(sessionPath(),readFile);
  assert.match(sessionPath(),/remote-edit/);
  assert.equal(remoteScope(),'workspace.readonly workspace.edit offline_access');
  assert.throws(()=>validateRemoteTokens(good));
  assert.ok(validateRemoteTokens({...good,scope:remoteScope()}));
  const config=registration({workspaceEdit:true},{command:'node',args:['edu-workspace-mcp'],env:{EDU_WORKSPACE_CREDENTIALS_PATH:'fixture-old-json',EDU_WORKSPACE_TOKEN_PATH:'fixture-old-token',OTHER_SETTING:'preserve'}});
  assert.ok(config.args.includes('--workspace-edit'));
  const env=config.env;assert.ok(env);
  assert.equal(env.EDU_WORKSPACE_CREDENTIALS_PATH,undefined);
  assert.equal(env.EDU_WORKSPACE_TOKEN_PATH,undefined);
  assert.equal(env.OTHER_SETTING,'preserve');
  assert.equal(env.EDU_WORKSPACE_SCOPE_PROFILE,'workspace-edit');
  assert.equal(parseCliOptions(['login','--workspace-edit']).workspaceEdit,true);
  for(const other of ['--workspace-readonly','--legacy','--read']) assert.throws(()=>parseCliOptions(['login','--workspace-edit',other]));
 } finally {if(original===undefined) delete process.env.EDU_WORKSPACE_SCOPE_PROFILE;else process.env.EDU_WORKSPACE_SCOPE_PROFILE=original;}
});
