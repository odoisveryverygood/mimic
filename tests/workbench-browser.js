import assert from 'node:assert/strict';
export async function verifyWorkbench(page,context,rpc,base,screenshotPath){
 const until=async(fn,timeout=40000)=>{const start=Date.now();while(Date.now()-start<timeout){const r=await fn();if(r)return r;await new Promise(r=>setTimeout(r,100));}throw Error('Workbench verification timed out');};
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.getByRole('button',{name:'Control room',exact:true}).click();await page.getByRole('heading',{name:'A little less to carry.'}).waitFor();
 const initial=await rpc('/state',undefined,'GET');const sample=initial.commands.find(c=>c.sample);assert.ok(sample);
 await rpc(`/commands/${sample.id}`,{name:sample.name,description:sample.description,parameters:sample.parameters,steps:sample.steps.map(s=>s.type==='navigate'?{...s,url:base+'/practice'}:s)},'PUT');
 await page.getByRole('button',{name:'Workflows',exact:true}).click();await page.getByLabel('Command',{exact:true}).selectOption(sample.id);await page.getByLabel('Result selector',{exact:true}).fill('#confirmation');await page.getByLabel('Expected text',{exact:true}).fill('Saved');await page.getByRole('button',{name:'Add outcome check',exact:true}).click();
 await until(async()=>{const s=await rpc('/state',undefined,'GET');return s.commands.find(c=>c.id===sample.id).steps.some(s=>s.type==='assert')});
 const checked=await rpc(`/commands/${sample.id}/run`,{values:{title:'Verified workflow outcome'},mode:'test'});await until(async()=>{const s=await rpc('/state',undefined,'GET');return s.activeRun?.status==='paused'});await rpc(`/runs/${checked.id}/continue`);
 const checkedResult=await until(async()=>{const s=await rpc('/state',undefined,'GET');return !s.activeRun?s.runs.find(r=>r.id===checked.id):null});assert.equal(checkedResult.status,'passed',checkedResult.error);assert.equal(checkedResult.steps.at(-1).type,'assert');assert.match(checkedResult.outputs.at(-1).text,/Verified workflow outcome/);

 await page.getByRole('button',{name:'What if?',exact:true}).click();await page.getByRole('button',{name:'Load example',exact:true}).click();
 const cash=await page.locator('.wb-metric strong').innerText();assert.notEqual(cash,'$0');
 await page.getByRole('textbox',{name:'Scenario name',exact:true}).fill('E2E pricing decision');await page.getByRole('button',{name:'Save scenario',exact:true}).click();
 await page.getByRole('spinbutton',{name:'Actual cash after month 12 ($)',exact:true}).fill('40000');await page.getByRole('button',{name:'Record actual result',exact:true}).click();
 await page.getByRole('button',{name:'Open loops',exact:true}).click();await page.getByRole('textbox',{name:'Paste an email, receipt note, or request'}).fill('Reimburse test conference $120\nDeadline: 2026-10-01');await page.getByRole('button',{name:'Capture request',exact:true}).click();
 await page.getByRole('textbox',{name:'New checklist item',exact:true}).fill('Receipt attached');await page.getByRole('button',{name:'Add',exact:true}).click();
 await page.getByRole('textbox',{name:'Completion evidence or progress note'}).fill('Test confirmation ABC-1');await page.getByRole('button',{name:'Verify & close',exact:true}).click();await page.getByRole('alert').getByText('Finish the checklist before closing this item.').waitFor();
 await page.getByRole('checkbox',{name:'Receipt attached',exact:true}).check();await page.getByRole('button',{name:'Verify & close',exact:true}).click();await page.getByText('Closed with evidence',{exact:true}).waitFor();
 await page.getByRole('button',{name:'Repair lab',exact:true}).click();await page.getByRole('button',{name:'Try a repair example',exact:true}).click();
 await page.getByRole('button',{name:'Test original',exact:true}).click();
 await until(async()=>{const s=await rpc('/state',undefined,'GET');return s.runs.find(r=>r.kind==='repair'&&r.phase==='before'&&r.status==='failed')});
 await page.getByRole('button',{name:'Load authored example fix',exact:true}).click();await page.getByRole('button',{name:'Test candidate',exact:true}).click();
 const candidateResult=await until(async()=>{const s=await rpc('/state',undefined,'GET');return s.runs.find(r=>r.kind==='repair'&&r.phase==='after'&&['passed','failed','cancelled'].includes(r.status))});assert.equal(candidateResult.status,'passed',JSON.stringify(candidateResult));
 await page.getByText('Regression demonstrated: original failed; candidate passed the same saved test.',{exact:true}).waitFor({timeout:40000});
 const state=await rpc('/state',undefined,'GET');const before=state.runs.find(r=>r.kind==='repair'&&r.phase==='before'),after=state.runs.find(r=>r.kind==='repair'&&r.phase==='after');assert.equal(before.testHash,after.testHash);assert.notEqual(before.sourceHash,after.sourceHash);assert.equal(after.outputs[0].text,'Saved successfully');
 await page.getByRole('button',{name:'Download tested candidate',exact:true}).isEnabled().then(v=>assert.equal(v,true));
 // Editing the candidate must revoke prior proof rather than carrying forward a stale pass.
 const code=page.getByRole('textbox',{name:'Candidate HTML source',exact:true});await code.fill((await code.inputValue())+'\n<!-- modified -->');assert.equal(await page.getByRole('button',{name:'Download tested candidate',exact:true}).isEnabled(),false);
 await page.getByRole('button',{name:'Control room',exact:true}).click();await page.reload();await page.getByRole('heading',{name:'A little less to carry.'}).waitFor();
 const saved=await page.evaluate(()=>JSON.parse(localStorage.getItem('mimic-workbench-v2')));assert.equal(saved.scenarios[0].name,'E2E pricing decision');assert.equal(saved.loops[0].status,'done');assert.equal(saved.repairs.length,1);
 if(screenshotPath)await page.screenshot({path:screenshotPath,fullPage:true});
 await page.setViewportSize({width:390,height:844});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,'No horizontal overflow on mobile');await page.setViewportSize({width:1440,height:1000});assert.deepEqual(errors,[]);
 return {workflow:'added outcome assertion through UI; replayed and verified result',scenarios:'saved, compared, and actual result recorded',admin:'checklist required; completion evidence saved',repair:'original failed; corrected HTML passed; changed candidate invalidates proof',durability:'reload preserved all three workspaces',browserErrors:errors.length};
}
