import {pgTable,text,timestamp,integer,primaryKey} from 'drizzle-orm/pg-core';
export const accounts=pgTable('mimic_accounts',{
 id:text('id').primaryKey(),email:text('email').notNull(),customerId:text('customer_id').unique(),subscriptionId:text('subscription_id'),status:text('status').notNull().default('free'),periodEnd:timestamp('period_end',{withTimezone:true}),updatedAt:timestamp('updated_at',{withTimezone:true}).defaultNow().notNull()
});
export const devices=pgTable('mimic_devices',{hash:text('hash').primaryKey(),userId:text('user_id').notNull().references(()=>accounts.id,{onDelete:'cascade'}),expiresAt:timestamp('expires_at',{withTimezone:true}).notNull()});
export const usage=pgTable('mimic_usage',{userId:text('user_id').notNull().references(()=>accounts.id,{onDelete:'cascade'}),month:text('month').notNull(),count:integer('count').notNull().default(0)},t=>[primaryKey({columns:[t.userId,t.month]})]);
export const reservations=pgTable('mimic_reservations',{userId:text('user_id').notNull().references(()=>accounts.id,{onDelete:'cascade'}),operationId:text('operation_id').notNull(),createdAt:timestamp('created_at',{withTimezone:true}).defaultNow().notNull()},t=>[primaryKey({columns:[t.userId,t.operationId]})]);
export const events=pgTable('mimic_stripe_events',{id:text('id').primaryKey(),createdAt:timestamp('created_at',{withTimezone:true}).defaultNow().notNull()});
