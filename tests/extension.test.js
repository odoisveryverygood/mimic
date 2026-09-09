import test from 'node:test';
import {verifyExperience} from './experience-browser.js';
import {verifyBatchPanel} from './batch-browser.js';
import {verifyWorkbench} from './workbench-browser.js';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import http from 'node:http';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {chromium} from 'playwright';
import {practiceHtml} from '../server/practice.js';
import {createLibrary,libraryRequest} from '../extension/library.js';
import {id} from '../server/model.js';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const identity=JSON.parse(fs.readFileSync(path.join(root,'extension/identity.json'),'utf8'));
async function until(fn,timeout=30000){const start=Date.now();while(true){const result=await fn();if(result)return result;if(Date.now()-start>timeout)throw new Error('Timed out waiting for browser state.');await new Promise(r=>setTimeout(r,100));}}

test('extension storage recovers interrupted work and validates imports',async()=>{
  let snapshot;const storage={get:async()=>({library:snapshot}),set:async v=>{snapshot=structuredClone(v.library)}};
  const store=await createLibrary(storage,identity.dashboardOrigin);const first=store.data.commands[0];
  const engine={};const exported=await libraryRequest(store,engine,`/commands/${first.id}/export`,'GET');
  const imported=await libraryRequest(store,engine,'/import','POST',exported);assert.notEqual(first.id,imported.id);
  await assert.rejects(()=>libraryRequest(store,engine,'/import','POST',{...exported,command:{...exported.command,steps:[{type:'exec',value:'arbitrary code'}]}}));
  store.data.runs.push({id:id(),status:'running'});await store.save();
  const restarted=await createLibrary(storage,identity.dashboardOrigin);assert.equal(restarted.data.runs[0].status,'interrupted');assert.equal(restarted.data.commands.length,2);
});

test('real Chrome: recorder, workspaces, verified lists, visual teaching, and current-tab capture',{timeout:240000},async()=>{
  execFileSync(process.execPath,['scripts/build-extension.mjs'],{cwd:root,env:{...process.env,MIMIC_EXTENSION_DEV:'1'},stdio:'pipe'});
  let blockedTestRequests=0;
  const server=http.createServer((req,res)=>{
    if(req.url.startsWith('/sandbox-probe')){blockedTestRequests++;res.end('unexpected network request');return;}
    if(req.url==='/practice'){res.setHeader('Content-Type','text/html');res.end(practiceHtml);return;}
    let file=path.join(root,'dist-cloud',req.url.split('?')[0]);if(req.url==='/'||req.url==='/extension')file=path.join(root,'dist-cloud/extension.html');else if(req.url==='/studio'||req.url==='/account')file=path.join(root,'dist-cloud/studio.html');else if(!fs.existsSync(file)||fs.statSync(file).isDirectory())file=path.join(root,'dist-cloud/index.html');
    const types={'.html':'text/html','.js':'text/javascript','.css':'text/css','.ttf':'font/ttf','.svg':'image/svg+xml','.json':'application/json'};
    res.setHeader('Content-Type',types[path.extname(file)]||'application/octet-stream');res.end(fs.readFileSync(file));
  });
  await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(4319,'127.0.0.1',resolve);});
  const profile=fs.mkdtempSync(path.join(os.tmpdir(),'mimic-extension-'));let context;
  const launch=()=>chromium.launchPersistentContext(profile,{channel:'chromium',headless:true,args:[`--disable-extensions-except=${path.join(root,'extension/build')}`,`--load-extension=${path.join(root,'extension/build')}`]});
  try{
    context=await launch();const page=await context.newPage();await page.goto('http://127.0.0.1:4319/studio');
    const rpc=(route,body,method='POST')=>page.evaluate(({extensionId,path,body,method})=>new Promise((resolve,reject)=>chrome.runtime.sendMessage(extensionId,{channel:'mimic-v1',path,method,body},r=>{const error=chrome.runtime.lastError;if(error)reject(new Error(error.message));else if(!r?.ok)reject(new Error(r?.error||'No response'));else resolve(r.data)})),{extensionId:identity.extensionId,path:route,body,method});
    await until(async()=>{try{return(await rpc('/state',undefined,'GET')).connected}catch{return false}});
    await page.getByText('Connected to your Chrome companion',{exact:true}).waitFor();
    const demos=[];
    for(const title of ['First extension example','Second extension example']){
      await rpc('/recordings',{name:'Save from the web',url:'http://127.0.0.1:4319/practice'});
      const target=await until(()=>context.pages().find(p=>p.url()==='http://127.0.0.1:4319/practice'&&!p.isClosed()));
      await target.locator('#reading-title').fill(title);await target.locator('#reading-url').fill('https://example.com/extension-source');await target.locator('#save-reading').click();await target.locator('#confirmation').click({modifiers:['Alt']});
      const demo=await rpc('/recordings/stop');
      assert.deepEqual(demo.steps.map(s=>s.type),['navigate','fill','fill','click','extract'],JSON.stringify(demo.steps));assert.equal(demo.steps[1].value,title);
      demos.push(demo);await target.close();
    }
    const command=await rpc('/learn',{demonstrationIds:demos.map(d=>d.id),name:'Save from the web'});
    assert.equal(command.parameters.length,1);assert.equal(command.parameters[0].key,'reading_title');
    const started=await rpc(`/commands/${command.id}/run`,{values:{reading_title:'Replayed from Vercel architecture'},mode:'test'});
    const paused=await until(async()=>{const s=await rpc('/state',undefined,'GET');return s.activeRun?.status==='paused'?s.activeRun:null});assert.equal(paused.currentStep,3);
    const target=await until(()=>context.pages().find(p=>p.url()==='http://127.0.0.1:4319/practice'&&!p.isClosed()));
    assert.equal(await target.locator('#reading-title').inputValue(),'Replayed from Vercel architecture');assert.equal(await target.locator('#confirmation').isVisible(),false);
    await rpc(`/runs/${started.id}/continue`);
    const result=await until(async()=>{const s=await rpc('/state',undefined,'GET');return !s.activeRun?s.runs.find(r=>r.id===started.id):null});
    assert.equal(result.status,'passed',result.error);assert.equal(result.outputs[0].text,'Saved “Replayed from Vercel architecture” to Research.');
    // No API server handled any of these operations: HTTP served only static assets.
    const resources=await page.evaluate(()=>[...new Set(performance.getEntriesByType('resource').map(r=>new URL(r.name).pathname))]);assert.ok(!resources.some(p=>p.startsWith('/api/')));
    await context.close();context=await launch();const restored=await context.newPage();await restored.goto('http://127.0.0.1:4319/studio');
    const state=await until(async()=>{try{return await restored.evaluate(extensionId=>new Promise(resolve=>chrome.runtime.sendMessage(extensionId,{channel:'mimic-v1',path:'/state',method:'GET'},r=>resolve(r?.data))),identity.extensionId)}catch{return false}});
    assert.equal(state.commands.find(c=>c.id===command.id).name,'Save from the web');assert.equal(state.runs.find(r=>r.id===started.id).status,'passed');
    const restoredRpc=(route,body,method='POST')=>restored.evaluate(({extensionId,path,body,method})=>new Promise((resolve,reject)=>chrome.runtime.sendMessage(extensionId,{channel:'mimic-v1',path,method,body},r=>r?.ok?resolve(r.data):reject(Error(r?.error||'No response')))),{extensionId:identity.extensionId,path:route,body,method});
    await verifyWorkbench(restored,context,restoredRpc,'http://127.0.0.1:4319');
    const pagesBefore=context.pages().length;
    const sandbox=await restoredRpc('/repairs/test',{caseId:id(),name:'Sandbox boundary',phase:'after',click:'#probe',selector:'#result',expected:'isolated',html:`<button id="probe" onclick="try{top.location='http://127.0.0.1:4319/sandbox-probe-top'}catch{};window.open('http://127.0.0.1:4319/sandbox-probe-popup');fetch('http://127.0.0.1:4319/sandbox-probe-fetch').catch(()=>{});document.querySelector('#result').textContent='isolated'">Probe</button><p id="result"></p><img src="http://127.0.0.1:4319/sandbox-probe-image">`});
    const isolated=await until(async()=>{const s=await restoredRpc('/state',undefined,'GET');return !s.activeRun?s.runs.find(r=>r.id===sandbox.id):null});
    assert.equal(isolated.status,'passed',isolated.error);assert.equal(blockedTestRequests,0,'Sandbox must block network, popups, and top navigation');assert.equal(context.pages().length,pagesBefore,'Repair test tab is closed');
    await verifyBatchPanel(context,restoredRpc,identity.extensionId,'http://127.0.0.1:4319');
    await verifyExperience(context,restoredRpc,identity.extensionId,'http://127.0.0.1:4319');

  }finally{
    await context?.close();await new Promise(r=>server.close(r));fs.rmSync(profile,{recursive:true,force:true});
    execFileSync(process.execPath,['scripts/build-extension.mjs'],{cwd:root,stdio:'pipe'});
  }
});
