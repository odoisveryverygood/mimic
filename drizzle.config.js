import {defineConfig} from 'drizzle-kit';
export default defineConfig({schema:'./cloud/schema.js',out:'./cloud/migrations',dialect:'postgresql',dbCredentials:{url:process.env.DATABASE_URL}});
