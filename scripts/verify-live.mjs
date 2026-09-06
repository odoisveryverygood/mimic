import {chromium} from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
import {unzipSync,strFromU8} from 'fflate';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const identity=JSON.parse(fs.readFileSync(path.join(root,'extension/identity.json'),'utf8'));
const base=identity.dashboardOrigin;
for(const route of ['/','/practice','/downloads/mimic-browser-companion.zip']){
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
  const requests=await page.evaluate(()=>[...new Set(performance.getEntriesByType('resource').map(r=>r.name))]);
  assert.ok(!requests.some(url=>url.includes('127.0.0.1')||url.includes('localhost')||new URL(url).pathname.startsWith('/api/')));
  assert.deepEqual(errors,[]);
  console.log(JSON.stringify({url:base,publicRoutes:'HTTP 200',extensionDownload:'matches production source; only production origin permitted',browserRun:'6 of 6 steps passed',result:'Saved “Mimic live deployment verification” to Research.',localServerRequests:0,pageErrors:0},null,2));
}finally{await context.close();fs.rmSync(profile,{recursive:true,force:true});}
