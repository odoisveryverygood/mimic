import pg from 'pg';
import {drizzle} from 'drizzle-orm/node-postgres';
import {migrate} from 'drizzle-orm/node-postgres/migrator';
const pool=new pg.Pool({connectionString:process.env.DATABASE_URL});
try{await migrate(drizzle(pool),{migrationsFolder:'./cloud/migrations'});console.log('Mimic schema migration completed.');}finally{await pool.end();}
