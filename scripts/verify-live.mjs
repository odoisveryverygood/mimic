import {chromium} from 'playwright';
import {verifyWorkbench} from '../tests/workbench-browser.js';
import {verifyBatchPanel} from '../tests/batch-browser.js';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
import {unzipSync,strFromU8} from 'fflate';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const identity=JSON.parse(fs.readFileSync(path.join(root,'extension/identity.json'),'utf8'));
const base=identity.dashboardOrigin;
for(const route of ['/','/practice','/extension','/privacy','/account','/downloads/mimic-browser-companion.zip','/api/cloud/config']){
  const response=await fetch(`${base}${route}`);assert.equal(response.status,200,route);
  if(route.endsWith('.zip')){
    const zip=unzipSync(new Uint8Array(await response.arrayBuffer()));
    const manifest=JSON.parse(strFromU8(zip['mimic-browser-companion/manifest.json']));
    assert.deepEqual(manifest.externally_connectable.matches,[`${base}/*`]);
    assert.equal(manifest.key,identity.key);
    for(const name of ['manifest.json','background.js'])assert.equal(strFromU8(zip[`mimic-browser-companion/${name}`]),fs.readFileSync(path.join(root,'extension/build',name),'utf8'),`${name} matches deployed download`);
  }
}
const profile=fs.mkdtempSync(path.join(os.tmpdir(),'mimic-live-'));
const extension=path.join(root,'extension/build');
const context=await chromium.launchPersistentContext(profile,{channel:'chromium',headless:true,viewport:{width:1440,height:1000},args:[`--disable-extensions-except=${extension}`,`--load-extension=${extension}`]});
try{
  const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(base);await page.getByText('Connected to your Chrome companion',{exact:true}).waitFor({timeout:30000});
  await page.getByRole('button',{name:'My commands',exact:true}).click();
  await page.getByRole('button',{name:'Try command',exact:true}).click();
  await page.getByRole('textbox',{name:'Reading title',exact:true}).fill('Mimic live deployment verification');
  await page.getByRole('button',{name:'Start test',exact:true}).click();
  await page.getByText('Ready for your review',{exact:true}).waitFor({timeout:45000});
  const target=context.pages().find(p=>p.url()===`${base}/practice`);
  assert.ok(target);assert.equal(await target.locator('#confirmation').isVisible(),false);
  await page.getByRole('button',{name:'Continue this step',exact:true}).click();
  await page.getByText('All steps completed',{exact:true}).waitFor({timeout:30000});
  assert.equal(await target.locator('#confirmation').innerText(),'Saved “Mimic live deployment verification” to Research.');
  const screenshots=path.join(root,'screenshots');fs.mkdirSync(screenshots,{recursive:true});
  await page.screenshot({path:path.join(screenshots,'cloud-run.png')});
  await page.getByRole('button',{name:'Close',exact:true}).click();await page.screenshot({path:path.join(screenshots,'cloud-dashboard.png')});
  const rpc=(route,body,method='POST')=>page.evaluate(({extensionId,path,body,method})=>new Promise((resolve,reject)=>chrome.runtime.sendMessage(extensionId,{channel:'mimic-v1',path,method,body},r=>r?.ok?resolve(r.data):reject(Error(r?.error||'No response')))),{extensionId:identity.extensionId,path:route,body,method});
  await verifyBatchPanel(context,rpc,identity.extensionId,base);
  const account=await context.newPage();await account.goto(base+'/account');await account.getByText('Welcome back.',{exact:true}).waitFor();await account.screenshot({path:path.join(screenshots,'mimic-account.png')});
  assert.equal((await fetch(base+'/api/cloud/me')).status,401);assert.equal((await fetch(base+'/api/cloud/me',{headers:{Authorization:'Bearer mimic_forged'}})).status,401);assert.equal((await fetch(base+'/api/cloud/config',{headers:{Origin:'https://untrusted.example'}})).status,403);
  const config=await (await fetch(base+'/api/cloud/config')).json();assert.equal(config.billingReady,false);assert.equal(config.authReady,true);
  const workbench=await verifyWorkbench(page,context,rpc,base,path.join(screenshots,'mimic-v2-control-room.png'));
  const requests=await page.evaluate(()=>[...new Set(performance.getEntriesByType('resource').map(r=>r.name))]);
  assert.ok(!requests.some(url=>url.includes('127.0.0.1')||url.includes('localhost')||new URL(url).pathname.startsWith('/api/')));
  assert.deepEqual(errors,[]);
  console.log(JSON.stringify({url:base,workbench,publicRoutes:'HTTP 200',extensionDownload:'matches production source; only production origin permitted',browserRun:'6 of 6 steps passed',batches:'2 verified rows; failed outcome leaves next row pending',account:'sign-in page renders; unauthenticated and forged tokens rejected',billing:'disabled pending provider setup',result:'Saved “Mimic live deployment verification” to Research.',localServerRequests:0,pageErrors:0},null,2));
}finally{await context.close();fs.rmSync(profile,{recursive:true,force:true});}
