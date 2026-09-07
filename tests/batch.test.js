import test from 'node:test';
import assert from 'node:assert/strict';
import {parseCsv,csvResults,recoverBatches,BatchRunner} from '../extension/batch.js';
import {starter,id} from '../server/model.js';
import {entitlement,subscriptionState} from '../cloud/billing.js';
test('CSV handles quoted commas/newlines/BOM, rejects ambiguous input and neutralizes exported formulas',()=>{
 const parsed=parseCsv('\uFEFFtitle,link\r\n"Hello, world","https://example.com"\r\n"Two\nlines",x\n');assert.deepEqual(parsed.headers,['title','link']);assert.equal(parsed.rows[0][0],'Hello, world');assert.equal(parsed.rows[1][0],'Two\nlines');
 for(const input of ['a,a\nx,y','a,b\nx','a\n"oops','a\n"x"oops','a\n'+Array(102).fill('x').join('\n')])assert.throws(()=>parseCsv(input));
 assert.match(csvResults({rows:[{status:'verified',output:'=CMD()',note:'+1'}]}),/'=CMD\(\)/);
});
test('interrupted batches reconcile proof and never return an uncertain row to pending',()=>{
 const data={batches:[{id:'b',status:'running',rows:[{id:'r1',status:'running'},{id:'r2',status:'running'},{id:'r3',status:'pending'}]}],runs:[{id:'run',batchId:'b',batchRowId:'r1',status:'passed',outputs:[{text:'Saved'}]}]};recoverBatches(data);assert.equal(data.batches[0].status,'review');assert.deepEqual(data.batches[0].rows.map(r=>r.status),['verified','review','pending']);assert.equal(data.batches[0].rows[0].runId,'run');
});
test('batch validation gates Pro, requires final outcome and stops after failure without retry',async()=>{
 const command=starter('https://example.com');command.steps.push({id:id(),type:'assert',selector:'#confirmation',label:'Check',value:'Saved',checkpoint:false,secret:false});
 const store={data:{commands:[command],runs:[],batches:[]},save:async()=>{}};let calls=0;
 const engine={run:async(c,b,correlation)=>{calls++;const run={id:id(),...correlation,status:calls===1?'failed':'passed',outputs:[],error:'Unknown outcome'};store.data.runs.push(run);return run;}};
 const runner=new BatchRunner(store,engine,{account:async()=>({plan:'free'})});
 const body={commandId:command.id,csv:'title,link,shelf\na,https://example.com,Ideas\nb,https://example.com,Ideas',mapping:{title:'title',link:'link',shelf:'shelf'}};
 await assert.rejects(()=>runner.create({...body,csv:body.csv+'\nc,x,y\nd,x,y'}),/Free/);
 const batch=await runner.create(body);await runner.start(batch.id);while(runner.active)await new Promise(r=>setTimeout(r,10));assert.equal(calls,1);assert.equal(batch.rows[0].status,'review');assert.equal(batch.rows[1].status,'pending');await assert.rejects(()=>runner.start(batch.id),/Resolve/);
 await runner.resolve(batch.id,{rowId:batch.rows[0].id,decision:'confirmed',note:'I checked the record on the website.'});await runner.start(batch.id);while(runner.active)await new Promise(r=>setTimeout(r,10));assert.equal(calls,2);assert.deepEqual(batch.rows.map(r=>r.status),['confirmed','verified']);assert.equal(batch.status,'completed');
 command.steps.pop();await assert.rejects(()=>runner.create(body),/outcome/);
});
test('billing does not grant Pro from trial, past due, expired or unrelated price',()=>{
 const until=new Date(Date.now()+100000);assert.equal(entitlement({status:'active',periodEnd:until}),'pro');
 for(const status of ['trialing','past_due','unpaid','canceled','free'])assert.equal(entitlement({status,periodEnd:until}),'free');assert.equal(entitlement({status:'active',periodEnd:new Date(0)}),'free');
 const sub={id:'s',status:'active',items:{data:[{price:{id:'other'},current_period_end:9999999999}]}};assert.equal(subscriptionState(sub,'pro').status,'free');
});
