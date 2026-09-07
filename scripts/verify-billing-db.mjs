import pg from 'pg';
import {drizzle} from 'drizzle-orm/node-postgres';
import {eq} from 'drizzle-orm';
import {randomUUID} from 'node:crypto';
import assert from 'node:assert/strict';
import {accounts,usage} from '../cloud/schema.js';
import {reserve,service,webhook} from '../cloud/service.js';
// Run only with the isolated billing-validation branch environment.
if(!new URL(process.env.DATABASE_URL).hostname.includes('ep-'))throw Error('A validation database URL is required.');
const pool=new pg.Pool({connectionString:process.env.DATABASE_URL,max:5}),db=drizzle(pool);
try{
 const user={id:`validation-${randomUUID()}`,email:'billing-fixture@example.invalid',status:'active',periodEnd:new Date(Date.now()+3600000)};await db.insert(accounts).values(user);
 const operationId=randomUUID();await Promise.all(Array.from({length:8},()=>reserve(db,user,operationId)));
 const [meter]=await db.select().from(usage).where(eq(usage.userId,user.id));assert.equal(meter.count,1);
 await db.update(usage).set({count:999}).where(eq(usage.userId,user.id));
 const attempts=await Promise.allSettled([reserve(db,user,randomUUID()),reserve(db,user,randomUUID())]);assert.equal(attempts.filter(r=>r.status==='fulfilled').length,1);assert.equal(attempts.find(r=>r.status==='rejected').reason.status,429);
 await db.update(accounts).set({status:'canceled'}).where(eq(accounts.id,user.id));await assert.rejects(()=>reserve(db,user,randomUUID()),e=>e.status===402);
 await assert.rejects(()=>service({headers:{},method:'GET'},'me',{}),e=>e.status===401);
 await assert.rejects(()=>service({headers:{authorization:'Bearer mimic_forged'},method:'GET'},'me',{}),e=>e.status===401);
 process.env.STRIPE_SECRET_KEY='sk_test_fixture_not_a_real_key';process.env.STRIPE_WEBHOOK_SECRET='whsec_fixture_not_a_real_secret';
 await assert.rejects(()=>webhook(Buffer.from('{}'),'invalid'),e=>e.status===400);
 console.log('PASS: 8 concurrent retries consume 1 row; cap holds under concurrency; cancellation blocks usage; forged devices and signatures are rejected. Fixtures remain only in the isolated validation branch.');
}finally{await pool.end();}
