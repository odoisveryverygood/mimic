import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';
import { Engine } from '../server/engine.js';
import { createStore } from '../server/store.js';
import { learn,id,now } from '../server/model.js';
import { practiceHtml } from '../server/practice.js';

const until=async(fn,timeout=20000)=>{const start=Date.now();while(!fn()){if(Date.now()-start>timeout)throw new Error('Condition did not become true.');await new Promise(r=>setTimeout(r,40))}};
test('real browser: record twice, infer changing inputs, replay a third value, extract result, cancel, fail safely', {timeout:120000}, async()=>{
  const server=http.createServer((req,res)=>{res.setHeader('Content-Type','text/html');res.end(practiceHtml)});
  await new Promise(r=>server.listen(0,'127.0.0.1',r));const base=`http://127.0.0.1:${server.address().port}`;
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'mimic-engine-'));const store=createStore(dir,base);const engine=new Engine(store,{headless:true});
  try {
    const recorded=[];
    for(const title of ['First experiment','Second experiment']) {
      await engine.startRecording({name:'Capture reading',url:`${base}/practice`});
      const page=engine.page;
      await page.locator('#reading-title').fill(title);
      await page.locator('#reading-url').fill('https://example.com/source');
      await page.locator('#save-reading').click();
      await page.locator('#confirmation').click({modifiers:['Alt']});
      // Real clicks and focus changes trigger the actual injected recorder.
      const demo=await engine.finishRecording();recorded.push(demo);
      assert.deepEqual(demo.steps.map(s=>s.type),['navigate','fill','fill','click','extract']);
      assert.equal(demo.steps[1].value,title);assert.equal(demo.steps[3].checkpoint,true);
    }
    const learned={...learn(recorded,'Capture reading'),id:id(),createdAt:now(),updatedAt:now(),demonstrationIds:recorded.map(d=>d.id)};
    assert.equal(learned.parameters.length,1);assert.equal(learned.parameters[0].key,'reading_title');
    const run=await engine.run(learned,{values:{reading_title:'Third, automated reading'},mode:'test'});
    await until(()=>run.status==='paused');
    assert.equal(run.currentStep,3);
    assert.equal(await engine.page.locator('#reading-title').inputValue(),'Third, automated reading');
    assert.equal(await engine.page.locator('#confirmation').isVisible(),false,'no submit before checkpoint approval');
    engine.continueRun(run.id);await until(()=>!engine.activeRun);
    assert.equal(run.status,'passed',run.error);
    assert.equal(run.outputs[0].text,'Saved “Third, automated reading” to Research.');
    const entries=await engine.page.evaluate(()=>JSON.parse(localStorage.getItem('mimic-readings')));
    assert.equal(entries.length,3);assert.equal(entries[0].title,'Third, automated reading');
    const cancelled=await engine.run(learned,{values:{reading_title:'Must not save'},mode:'test'});
    await until(()=>cancelled.status==='paused');await engine.cancelRun(cancelled.id);await until(()=>!engine.activeRun);
    assert.equal(cancelled.status,'cancelled');
    const broken=structuredClone(learned);broken.steps[1].selector='#element-no-longer-exists';broken.steps[1].alternatives=[];
    const failed=await engine.run(broken,{values:{},mode:'run'});await until(()=>!engine.activeRun);
    assert.equal(failed.status,'failed');assert.match(failed.error,/uniquely find/);assert.equal(failed.steps[2].status,'pending');
    // Never persist private input values, even while stopping with that field focused.
    await engine.startRecording({name:'Private field',url:`${base}/practice`});
    await engine.page.evaluate(()=>{const input=document.createElement('input');input.type='password';input.id='password';document.body.prepend(input)});
    await engine.page.locator('#password').fill('PRIVATE_TEST_SENTINEL');
    const secretDemo=await engine.finishRecording();
    assert.ok(secretDemo.steps.some(s=>s.type==='manual'&&s.secret));
    assert.equal(fs.readFileSync(path.join(dir,'library.json'),'utf8').includes('PRIVATE_TEST_SENTINEL'),false);
    // Implicit Enter submission must not turn into both a key press and a click.
    await engine.startRecording({name:'Keyboard save',url:`${base}/practice`});
    await engine.page.locator('#reading-title').fill('Keyboard example');
    await engine.page.locator('#reading-url').fill('https://example.com/keyboard');
    await engine.page.locator('#reading-url').press('Enter');
    await engine.page.locator('#confirmation').waitFor({state:'visible'});
    const keyboardDemo=await engine.finishRecording();
    assert.equal(keyboardDemo.steps.filter(s=>s.type==='press').length,1);
    assert.equal(keyboardDemo.steps.filter(s=>s.type==='click').length,0);
    // Native select changes are captured, as are checkbox toggles.
    await engine.startRecording({name:'Native controls',url:`${base}/practice`});
    await engine.page.locator('#shelf').focus();
    await engine.page.locator('#shelf').selectOption('School');
    await engine.page.keyboard.press('Tab');
    await engine.page.evaluate(()=>{const input=document.createElement('input');input.type='checkbox';input.id='notify';document.body.prepend(input)});
    await engine.page.locator('#notify').click();
    const controlsDemo=await engine.finishRecording();
    assert.ok(controlsDemo.steps.some(s=>s.type==='select'&&s.value==='School'),JSON.stringify(controlsDemo.steps));
    assert.ok(controlsDemo.steps.some(s=>s.type==='check'&&s.value==='true'));
    await engine.startRecording({name:'Pause around setup',url:`${base}/practice`});
    await engine.pauseRecording();
    await engine.page.locator('#reading-title').fill('UNRECORDED_SETUP');
    await engine.page.locator('#reading-url').click();
    await engine.pauseRecording();
    await engine.page.locator('#reading-title').fill('Recorded after resume');
    const resumed=await engine.finishRecording();
    assert.equal(JSON.stringify(resumed).includes('UNRECORDED_SETUP'),false);
    assert.ok(resumed.steps.some(s=>s.value==='Recorded after resume'));
  } finally {await engine.shutdown();await new Promise(r=>server.close(r));fs.rmSync(dir,{recursive:true,force:true});}
});
