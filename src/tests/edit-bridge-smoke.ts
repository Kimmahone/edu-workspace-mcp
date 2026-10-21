import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

const directory=await mkdtemp(path.join(os.tmpdir(),'edu-edit-host-'));
const env={...Object.fromEntries(Object.entries(process.env).filter((entry):entry is [string,string]=>entry[1]!==undefined)),
 EDU_WORKSPACE_CREDENTIALS_PATH:path.join(directory,'must-not-be-opened.json'),
 EDU_WORKSPACE_REMOTE_DIRECTORY:directory,EDU_WORKSPACE_SCOPE_PROFILE:'workspace-edit'};
const transport=new StdioClientTransport({command:process.execPath,args:['dist/cli.js','serve','--workspace-edit'],env,stderr:'pipe'});
transport.stderr?.on('data',()=>{});
const client=new Client({name:'isolated-edit-host-smoke',version:'1'});
try {
 await client.connect(transport);
 const {tools}=await client.listTools();assert.equal(tools.length,15);
 assert.equal(tools.filter(tool=>tool.annotations?.readOnlyHint===false).length,5);
 assert.ok(tools.filter(tool=>tool.annotations?.readOnlyHint===false).every(tool=>tool.annotations?.idempotentHint===false));
 const result=await client.callTool({name:'workspace_get_auth_status',arguments:{}});
 const status=result.structuredContent as Record<string,unknown>;
 assert.equal(status.authenticated,false);
 assert.equal(status.mode,'remote');
 assert.equal(status.profile,'workspace-edit');
 console.log('Edit Agent stdio smoke passed (15 tools, separate remote profile, no credentials or network)');
} finally {await client.close();await rm(directory,{recursive:true,force:true});}
