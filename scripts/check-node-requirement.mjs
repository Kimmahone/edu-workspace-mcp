import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
assert.ok(Number(process.versions.node.split('.')[0])<22,'Run this compatibility gate only on unsupported Node versions.');
for(const args of [['serve'],['serve','--workspace-readonly'],['serve','--legacy']]) {
 const result=spawnSync(process.execPath,['dist/cli.js',...args],{encoding:'utf8',input:'',timeout:5000,shell:false});
 assert.equal(result.status,1,'Unsupported Node must stop before starting an MCP server.');
 assert.match(result.stderr,/Node\.js 22/,'Show the required supported runtime.');
 assert.equal(result.stdout,'','No MCP protocol output before the version gate.');
}
console.log('Unsupported Node rejected before MCP startup; upgrade guidance verified.');
