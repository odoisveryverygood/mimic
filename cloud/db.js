import pg from 'pg';
import {drizzle} from 'drizzle-orm/node-postgres';
import {attachDatabasePool} from '@vercel/functions';
let connection;
export function database(){
 if(!process.env.DATABASE_URL)throw Object.assign(Error('Accounts are being configured. Please try again later.'),{status:503});
 if(!connection){const pool=new pg.Pool({connectionString:process.env.DATABASE_URL,max:3,idleTimeoutMillis:10000,connectionTimeoutMillis:10000});attachDatabasePool(pool);connection=drizzle(pool);}
 return connection;
}
