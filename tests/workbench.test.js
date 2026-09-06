import test from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {repairTestSchema,isolatedHtml,digest} from '../server/repair-model.js';
import {commandSchema,starter,id} from '../server/model.js';
const bundle=await build({entryPoints:['src/workbench-model.ts'],bundle:true,write:false,format:'esm',platform:'node'});
const m=await import('data:text/javascript;base64,'+Buffer.from(bundle.outputFiles[0].text).toString('base64'));
test('forecast reconciles churn, revenue, costs and cash against hand calculation',()=>{
 const a={customers:100,price:10,variableCost:2,fixedCost:500,newCustomers:10,churn:10,cash:1000,hireCost:100};
 const [one,two]=m.forecast(a,2);assert.equal(one.customers,100);assert.equal(one.revenue,1000);assert.equal(one.cost,800);assert.equal(one.profit,200);assert.equal(one.cash,1200);assert.equal(two.cash,1400);
 const compared=m.compareForecast(a,{...a,price:12});assert.equal(compared.cashDelta,2400);assert.equal(compared.breakevenCustomers,60);
 assert.equal(m.compareForecast(a,{...a,price:1}).breakevenCustomers,null);
 for(const value of [-1,NaN,Infinity])assert.throws(()=>m.forecast({...a,price:value}));assert.throws(()=>m.forecast({...a,churn:101}));
});
test('CSV imports preserve quoted source rows and reject missing, malformed or negative data',()=>{
 assert.deepEqual(m.parseCsv('a,b\n"first, item","line\n2"').rows,[['first, item','line\n2']]);
 const csv='customers,price,variableCost,fixedCost,newCustomers,churn,cash,hireCost\n100,10,2,500,10,10,1000,100';assert.equal(m.importBaseline(csv).values.cash,1000);assert.equal(m.importBaseline(csv).row,2);
 assert.throws(()=>m.importBaseline(csv.replace(',1000,',',,')));assert.throws(()=>m.importBaseline(csv.replace(',1000,',',-20,')));assert.throws(()=>m.parseCsv('a,b\n"broken'));assert.throws(()=>m.parseCsv('a,a\n1,2'));
});
test('obligation closure requires completed checklist and independently identified evidence',()=>{
 const item={id:m.uid(),...m.intake('Expense reimbursement $125.50\nDeadline: 2026-10-15'),commandId:'',status:'open',checks:[{id:'receipt',text:'Receipt',done:false}],evidence:[],createdAt:m.stamp()};
 assert.equal(item.due,'2026-10-15');assert.equal(item.amount,125.5);
 assert.throws(()=>m.closeLoop(item,'Receipt received'));
 const ready={...item,checks:item.checks.map(c=>({...c,done:true}))};assert.throws(()=>m.closeLoop(ready,''));
 assert.throws(()=>m.closeLoop(ready,'Browser ran',{id:'a',status:'passed',steps:[{type:'click',status:'passed'}]}));
 const closed=m.closeLoop(ready,'Confirmation R-123');assert.equal(closed.status,'done');assert.equal(closed.evidence[0].kind,'manual-confirmation');
 const verified=m.closeLoop(ready,'Recorded confirmation',{id:'a',status:'passed',steps:[{type:'assert',status:'passed'}]});assert.equal(verified.evidence[0].runId,'a');
});
test('durable workbench round-trip and invalid/corrupt backups fail without overwriting',()=>{
 let raw=null;const storage={getItem:()=>raw,setItem:(_,v)=>{raw=v}};const work=m.emptyWork();m.saveWork(work,storage);assert.deepEqual(m.loadWork(storage),work);
 const previous=raw;assert.throws(()=>m.saveWork({...work,version:99},storage));assert.equal(raw,previous);
 raw='{invalid';assert.throws(()=>m.loadWork(storage));assert.equal(raw,'{invalid');
});
test('outcome and regression schemas reject empty checks, arbitrary action code, and oversized files',async()=>{
 const c=starter('https://example.com');assert.equal(commandSchema.safeParse({...c,id:undefined}).success,false);
 const command={name:c.name,description:c.description,steps:[...c.steps,{id:id(),type:'assert',label:'Confirm',selector:'#result',value:'Done'}],parameters:c.parameters};assert.equal(commandSchema.safeParse(command).success,true);
 command.steps.at(-1).value=' ';assert.equal(commandSchema.safeParse(command).success,false);
 const testCase={caseId:id(),name:'Case',html:'<h1>Test</h1>',selector:'h1',expected:'Test',click:'',phase:'before'};assert.equal(repairTestSchema.safeParse(testCase).success,true);assert.equal(repairTestSchema.safeParse({...testCase,html:'x'.repeat(200001)}).success,false);assert.equal(repairTestSchema.safeParse({...testCase,eval:'code'}).success,false);
 assert.match(isolatedHtml('<p>hello</p>'),/default-src 'none'/);assert.notEqual(await digest('first'),await digest('second'));
});
