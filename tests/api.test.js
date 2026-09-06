import test from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import net from 'node:net';
import {fileURLToPath} from 'node:url';

test('HTTP API rejects foreign origins and unauthenticated writes; validates import, edits, export and persistence',{timeout:30000},async()=>{
  const probe=net.createServer();await new Promise(r=>probe.listen(0,'127.0.0.1',r));const port=probe.address().port;await new Promise(r=>probe.close(r));
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'mimic-api-'));
  const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
  const child=spawn(process.execPath,['server/index.js'],{cwd:root,env:{...process.env,MIMIC_PORT:String(port),MIMIC_DATA_DIR:dir,MIMIC_HEADLESS:'1'},stdio:['ignore','pipe','pipe']});
  let output='';child.stdout.on('data',b=>output+=b);child.stderr.on('data',b=>output+=b);
  try {
    for(let i=0;!output.includes('Mimic is ready');i++){if(i>200||child.exitCode!==null)throw new Error(`Test server failed: ${output}`);await new Promise(r=>setTimeout(r,40));}
    const base=`http://127.0.0.1:${port}`;
    const state=await (await fetch(`${base}/api/state`)).json();
    const c=state.commands[0];const headers={'Content-Type':'application/json','X-Mimic-Token':state.token};
    assert.equal((await fetch(`${base}/api/commands/${c.id}`,{method:'DELETE'})).status,403);
    assert.equal((await fetch(`${base}/api/commands/${c.id}`,{method:'DELETE',headers:{...headers,Origin:'https://attacker.example'}})).status,403);
    assert.equal((await fetch(`${base}/api/state`,{headers:{Origin:'https://attacker.example'}})).status,403);
    const exported=await (await fetch(`${base}/api/commands/${c.id}/export`)).json();
    assert.equal(exported.format,'mimic-command');assert.equal(exported.command.steps.length,6);
    const imported=await (await fetch(`${base}/api/import`,{method:'POST',headers,body:JSON.stringify(exported)})).json();
    assert.notEqual(imported.id,c.id);
    assert.equal((await fetch(`${base}/api/import`,{method:'POST',headers,body:JSON.stringify({format:'mimic-command',version:1,command:{...exported.command,steps:[{type:'exec',value:'rm -rf /'}]}})})).status,400);
    assert.equal((await fetch(`${base}/api/commands/${imported.id}`,{method:'PUT',headers,body:JSON.stringify({...exported.command,name:'Updated command'})})).status,200);
    assert.equal(JSON.parse(fs.readFileSync(path.join(dir,'library.json'),'utf8')).commands[0].name,'Updated command');
    assert.equal((await fetch(`${base}/api/commands/${imported.id}`,{method:'DELETE',headers})).status,200);
    const after=await (await fetch(`${base}/api/state`)).json();assert.equal(after.commands.length,1);
    assert.equal((await fetch(`${base}/api/commands/not-an-id/export`)).status,404);
  } finally {
    if(child.exitCode===null){child.kill('SIGTERM');await new Promise(r=>child.once('exit',r));}
    fs.rmSync(dir,{recursive:true,force:true});
  }
});
