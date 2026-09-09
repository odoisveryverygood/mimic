import assert from 'node:assert/strict';
import {id} from '../server/model.js';
const wait=async(fn,timeout=30000)=>{const start=Date.now();while(Date.now()-start<timeout){const value=await fn();if(value)return value;await new Promise(r=>setTimeout(r,100));}throw Error('Batch browser verification timed out.');};
export async function verifyBatchPanel(context,rpc,extensionId,base){
 const state=await rpc('/state',undefined,'GET'),sample=state.commands.find(c=>c.sample);
 const steps=sample.steps.map(s=>s.type==='navigate'?{...s,url:`${base}/practice`}:{...s,checkpoint:false});steps.push({id:id(),type:'assert',selector:'#confirmation',value:'Saved',label:'Verify save',checkpoint:false,secret:false});
 await rpc(`/commands/${sample.id}`,{name:sample.name,description:sample.description,parameters:sample.parameters,steps},'PUT');
 const page=await context.newPage();await page.setViewportSize({width:420,height:920});await page.goto(`chrome-extension://${extensionId}/panel.html`);
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.getByRole('button',{name:/Save a reading/}).click();
 await page.getByRole('button',{name:'Run a list',exact:true}).click();
 await page.getByLabel('Upload batch CSV').setInputFiles({name:'readings.csv',mimeType:'text/csv',buffer:Buffer.from('title,link,shelf\nFirst batch row,https://example.com/one,Ideas\nSecond batch row,https://example.com/two,Research')});
 await page.getByRole('button',{name:'Review batch',exact:true}).click();await page.getByRole('button',{name:'Start batch',exact:true}).click();
 const done=await wait(async()=>{const s=await rpc('/state',undefined,'GET');return s.batches[0]?.status==='completed'?s.batches[0]:null;});
 assert.deepEqual(done.rows.map(r=>r.status),['verified','verified']);assert.match(done.rows[0].output,/First batch row/);assert.match(done.rows[1].output,/Second batch row/);
 assert.equal(new Set(done.rows.map(r=>r.runId)).size,2);
 await page.getByText('Completed',{exact:true}).waitFor();await page.locator('.row-result summary').first().click();await page.screenshot({path:'screenshots/extension-batch-results.png',fullPage:true});
 await page.getByRole('button',{name:'My tasks',exact:true}).click();await page.screenshot({path:'screenshots/extension-side-panel.png',fullPage:true});
 // A failed check must stop before the second row, and a forged client plan must not enable a bigger batch.
 const badSteps=steps.map(s=>s.type==='assert'?{...s,value:'this outcome does not exist'}:s);
 await rpc(`/commands/${sample.id}`,{name:sample.name,description:sample.description,parameters:sample.parameters,steps:badSteps},'PUT');
 const data={commandId:sample.id,csv:'title,link,shelf\nUncertain first row,https://example.com,Ideas\nMust remain pending,https://example.com,Ideas',mapping:{title:'title',link:'link',shelf:'shelf'}};
 const batch=await rpc('/batches',data);await rpc(`/batches/${batch.id}/start`,{});
 await assert.rejects(()=>rpc(`/commands/${sample.id}/run`,{values:{},mode:'run'}),/batch/);
 const review=await wait(async()=>{const s=await rpc('/state',undefined,'GET');const b=s.batches.find(b=>b.id===batch.id);return !s.batchActive&&b.status==='review'?b:null;});
 assert.equal(review.rows[0].status,'review');assert.equal(review.rows[1].status,'pending');
 await assert.rejects(()=>rpc(`/batches/${batch.id}/start`,{}),/Resolve/);
 await assert.rejects(()=>rpc('/batches',{...data,csv:data.csv+'\nthird,x,Ideas\nfourth,x,Ideas',plan:'pro'}));
 await rpc(`/commands/${sample.id}`,{name:sample.name,description:sample.description,parameters:sample.parameters,steps},'PUT');
 assert.deepEqual(errors,[]);await page.close();
}
