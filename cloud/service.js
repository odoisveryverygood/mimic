import {randomBytes,createHash} from 'node:crypto';
import {createRemoteJWKSet,jwtVerify} from 'jose';
import Stripe from 'stripe';
import {and,eq,gt,sql} from 'drizzle-orm';
import {z} from 'zod';
import {database} from './db.js';
import {accounts,devices,usage,reservations,events} from './schema.js';
import {entitlement,subscriptionState,billingReady,LIMITS} from './billing.js';
export const SITE='https://mimic-aradhya.vercel.app';
const fail=(status,message)=>Object.assign(Error(message),{status});
const hash=value=>createHash('sha256').update(value).digest('hex');
let jwks,stripeInstance,accountVerified=false;
function stripe(){if(!process.env.STRIPE_SECRET_KEY)throw fail(503,'Billing setup is pending. You have not been charged.');return stripeInstance??=new Stripe(process.env.STRIPE_SECRET_KEY,{apiVersion:'2026-08-26.dahlia',appInfo:{name:'Mimic',version:'3.0.0',url:SITE},maxNetworkRetries:2});}
async function checkStripe(){
 if(!billingReady())throw fail(503,'Pro is coming soon. Billing setup is pending; you have not been charged.');
 if(!accountVerified){const account=await stripe().accounts.retrieve();if(account.id!==process.env.STRIPE_ACCOUNT_ID)throw fail(503,'Billing account configuration needs attention.');const price=await stripe().prices.retrieve(process.env.STRIPE_PRICE_ID);if(!price.active||price.unit_amount!==1500||price.currency!=='usd'||price.recurring?.interval!=='month'||price.recurring?.interval_count!==1||price.livemode!==(process.env.STRIPE_LIVE_MODE==='true'))throw fail(503,'Subscription price configuration needs attention.');accountVerified=true;}
}
async function identity(req,jwtOnly=false){
 const token=/^Bearer ([^\s]+)$/.exec(req.headers.authorization||'')?.[1];
 if(!token||token.length>12000)throw fail(401,'Sign in to your Mimic account.');
 const db=database();
 if(token.startsWith('mimic_')&&!jwtOnly){
  const [device]=await db.select().from(devices).where(and(eq(devices.hash,hash(token)),gt(devices.expiresAt,new Date())));
  if(!device)throw fail(401,'Reconnect your account from the Mimic website.');
  const [user]=await db.select().from(accounts).where(eq(accounts.id,device.userId));if(!user)throw fail(401,'Account unavailable.');return user;
 }
 const base=process.env.NEON_AUTH_BASE_URL;if(!base)throw fail(503,'Sign-in setup is pending.');
 jwks??=createRemoteJWKSet(new URL(`${base}/.well-known/jwks.json`));
 let payload;try{({payload}=await jwtVerify(token,jwks,{issuer:new URL(base).origin,audience:new URL(base).origin,algorithms:['EdDSA'],requiredClaims:['sub','exp','iat'],maxTokenAge:'16m'}));}catch{throw fail(401,'Your session expired. Please sign in again.');}
 if(payload.banned||typeof payload.sub!=='string'||typeof payload.email!=='string')throw fail(401,'Account unavailable.');
 // Email-verified identity is required before persistent extension access or payment.
 if(payload.emailVerified!==true)throw fail(403,'Verify your email before connecting your extension or upgrading.');
 const [user]=await db.insert(accounts).values({id:payload.sub,email:payload.email}).onConflictDoUpdate({target:accounts.id,set:{email:payload.email}}).returning();return user;
}
async function snapshot(user){const month=new Date().toISOString().slice(0,7);const [meter]=await database().select().from(usage).where(and(eq(usage.userId,user.id),eq(usage.month,month)));return {email:user.email,plan:entitlement(user),status:user.status,periodEnd:user.periodEnd,used:meter?.count||0,month,limits:LIMITS,billingReady:billingReady(),hasSubscription:!!user.customerId};}
export async function reserve(db,user,operationId){
 return db.transaction(async tx=>{
  await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${user.id}))`);
  const [current]=await tx.select().from(accounts).where(eq(accounts.id,user.id));
  if(entitlement(current)!=='pro')throw fail(402,'An active Pro subscription is required for this batch.');
  const [already]=await tx.select().from(reservations).where(and(eq(reservations.userId,user.id),eq(reservations.operationId,operationId)));
  if(already)return {ok:true,reused:true};
  const month=new Date().toISOString().slice(0,7);
  await tx.insert(usage).values({userId:user.id,month,count:0}).onConflictDoNothing();
  const [meter]=await tx.select().from(usage).where(and(eq(usage.userId,user.id),eq(usage.month,month)));
  if(meter.count>=LIMITS.pro.monthlyRows)throw fail(429,'Your 1,000 batch rows for this calendar month are used. Pending rows are saved.');
  await tx.update(usage).set({count:meter.count+1}).where(and(eq(usage.userId,user.id),eq(usage.month,month)));
  await tx.insert(reservations).values({userId:user.id,operationId});return {ok:true,reused:false};
 });
}
async function refreshSubscription(tx,user){
 const list=await stripe().subscriptions.list({customer:user.customerId,status:'all',limit:100});
 const sub=list.data.find(s=>s.status==='active'&&s.items.data.some(i=>i.price.id===process.env.STRIPE_PRICE_ID))||list.data.find(s=>s.id===user.subscriptionId);
 const state=sub?subscriptionState(sub,process.env.STRIPE_PRICE_ID):{status:'free',subscriptionId:null,periodEnd:null,updatedAt:new Date()};
 await tx.update(accounts).set(state).where(eq(accounts.id,user.id));return {...user,...state};
}
export async function webhook(raw,signature){
 if(!process.env.STRIPE_WEBHOOK_SECRET)throw fail(503,'Webhook configuration pending.');
 let event;try{event=stripe().webhooks.constructEvent(raw,signature,process.env.STRIPE_WEBHOOK_SECRET);}catch{throw fail(400,'Invalid Stripe signature.');}
 if(event.livemode!==(process.env.STRIPE_LIVE_MODE==='true'))throw fail(400,'Stripe mode mismatch.');
 if(!['checkout.session.completed','customer.subscription.created','customer.subscription.updated','customer.subscription.deleted','invoice.paid','invoice.payment_failed'].includes(event.type))return {received:true};
 const obj=event.data.object,customer=typeof obj.customer==='string'?obj.customer:obj.customer?.id;
 if(!customer)return {received:true};
 await database().transaction(async tx=>{
  const [user]=await tx.select().from(accounts).where(eq(accounts.customerId,customer));
  if(!user)return;
  await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${user.id}))`);
  const [done]=await tx.select().from(events).where(eq(events.id,event.id));if(done)return;
  // Fetch current provider state inside the per-account lock; webhook order cannot resurrect an old state.
  await refreshSubscription(tx,user);await tx.insert(events).values({id:event.id}).onConflictDoNothing();
 });return {received:true};
}
export async function service(req,path,body){
 if(path==='config'&&req.method==='GET')return {billingReady:billingReady(),authReady:!!process.env.NEON_AUTH_BASE_URL,price:1500,currency:'usd',limits:LIMITS};
 const user=await identity(req,path==='pair');const db=database();
 if(path==='me'&&req.method==='GET')return snapshot(user);
 if(path==='pair'&&req.method==='POST'){
  const token=`mimic_${randomBytes(32).toString('base64url')}`;
  await db.transaction(async tx=>{await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${user.id}))`);await tx.delete(devices).where(eq(devices.userId,user.id));await tx.insert(devices).values({hash:hash(token),userId:user.id,expiresAt:new Date(Date.now()+30*86400000)});});
  return {token,account:await snapshot(user)};
 }
 if(path==='revoke'&&req.method==='POST'){await db.delete(devices).where(eq(devices.userId,user.id));return {ok:true};}
 if(path==='reserve'&&req.method==='POST'){const input=z.object({operationId:z.string().uuid()}).strict().parse(body);return reserve(db,user,input.operationId);}
 if(path==='refresh'&&req.method==='POST'){
  if(!user.customerId||!billingReady())return snapshot(user);
  const updated=await db.transaction(async tx=>{await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${user.id}))`);return refreshSubscription(tx,user);});return snapshot(updated);
 }
 if(path==='checkout'&&req.method==='POST'){
  await checkStripe();
  return db.transaction(async tx=>{
   await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${user.id}))`);
   let [current]=await tx.select().from(accounts).where(eq(accounts.id,user.id));
   if(!current.customerId){const customer=await stripe().customers.create({email:current.email,metadata:{mimic_user_id:current.id}},{idempotencyKey:`mimic-customer-${current.id}`});current.customerId=customer.id;await tx.update(accounts).set({customerId:customer.id}).where(eq(accounts.id,current.id));}
   current=await refreshSubscription(tx,current);
   if(entitlement(current)==='pro')throw fail(409,'You already have Pro. Use Manage subscription.');
   const open=await stripe().checkout.sessions.list({customer:current.customerId,status:'open',limit:10});
   const existing=open.data.find(s=>s.mode==='subscription'&&s.metadata?.mimic_user_id===current.id);if(existing)return {url:existing.url};
   const session=await stripe().checkout.sessions.create({mode:'subscription',customer:current.customerId,client_reference_id:current.id,line_items:[{price:process.env.STRIPE_PRICE_ID,quantity:1}],success_url:`${SITE}/account?checkout=success`,cancel_url:`${SITE}/account?checkout=cancelled`,metadata:{mimic_user_id:current.id},subscription_data:{metadata:{mimic_user_id:current.id}},integration_identifier:'mimic_chrome_subscription_rkvmpqsz'}, {idempotencyKey:`mimic-checkout-${current.id}-${Math.floor(Date.now()/1800000)}`});return {url:session.url};
  });
 }
 if(path==='portal'&&req.method==='POST'){await checkStripe();if(!user.customerId)throw fail(400,'No billing account exists yet.');const session=await stripe().billingPortal.sessions.create({customer:user.customerId,return_url:`${SITE}/account`});return {url:session.url};}
 throw fail(404,'Unknown account action.');
}
