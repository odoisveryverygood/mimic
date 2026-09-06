import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { id,learn,materialize,normalizeSteps,commandSchema,webUrl } from '../server/model.js';
import {createStore} from '../server/store.js';

function demo(title,shelf='Research') {return {steps:[
  {id:id(),type:'navigate',label:'Open library',url:'https://example.com/library'},
  {id:id(),type:'fill',label:'Fill Reading title',selector:'#title',value:title},
  {id:id(),type:'select',label:'Select Shelf',selector:'#shelf',value:shelf},
  {id:id(),type:'click',label:'Save reading',selector:'#save',checkpoint:true},
]};}
test('multiple demonstrations distinguish variables from constants and replay fresh values',()=>{
  const command=learn([demo('First'),demo('Second')],'Save reading');
  assert.deepEqual(command.parameters.map(p=>p.key),['reading_title']);
  assert.deepEqual(command.parameters[0].examples,['First','Second']);
  const steps=materialize(command,{reading_title:'Third'});
  assert.equal(steps[1].value,'Third');assert.equal(steps[2].value,'Research');assert.equal(steps[3].checkpoint,true);
  assert.equal(command.steps[1].value,'First','materializing a run cannot mutate the command');
});
test('different routes cannot silently become one command',()=>{
  const other=demo('Second');other.steps[3].selector='#delete';
  assert.throws(()=>learn([demo('First'),other],'Bad combination'),/different paths/);
});
test('typing events coalesce without removing meaningful later edits',()=>{
  const d=demo('first');const s=d.steps[1];
  const normalized=normalizeSteps([d.steps[0],{...s,value:'f'},s,d.steps[3],{...s,id:id(),value:'final'}]);
  assert.equal(normalized.length,4);assert.equal(normalized[1].value,'first');assert.equal(normalized[3].value,'final');
});
test('invalid imported commands, secret values, duplicate keys, and unsafe URLs are rejected',()=>{
  const c=learn([demo('Test')],'Test');
  assert.equal(commandSchema.safeParse({...c,parameters:[...c.parameters,c.parameters[0]]}).success,false);
  assert.equal(commandSchema.safeParse({...c,steps:[...c.steps,{id:id(),type:'fill',label:'Password',selector:'#password',secret:true,value:'should-not-be-stored'}]}).success,false);
  assert.equal(commandSchema.safeParse({...c,steps:[{...c.steps[0],type:'click',selector:'#x'},...c.steps.slice(1)]}).success,false);
  for(const url of ['javascript:alert(1)','file:///etc/passwd','https://user:pass@example.com','https://example.com?api_key=secret'])assert.throws(()=>webUrl(url));
});
test('library persists and marks unfinished runs interrupted after restart',()=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'mimic-store-'));
  try{const a=createStore(dir,'http://127.0.0.1:4318');a.data.runs.push({id:id(),status:'paused'});a.save();const b=createStore(dir,'http://127.0.0.1:4318');assert.equal(b.data.commands.length,1);assert.equal(b.data.runs[0].status,'interrupted');assert.equal(fs.statSync(path.join(dir,'library.json')).mode&0o777,0o600);}finally{fs.rmSync(dir,{recursive:true,force:true})}
});
test('damaged libraries are not overwritten',()=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'mimic-corrupt-'));const file=path.join(dir,'library.json');
  try{fs.writeFileSync(file,'broken');assert.throws(()=>createStore(dir,'http://localhost'),/left untouched/);assert.equal(fs.readFileSync(file,'utf8'),'broken');}finally{fs.rmSync(dir,{recursive:true,force:true})}
});
