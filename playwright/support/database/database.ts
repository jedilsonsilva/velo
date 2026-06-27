import 'dotenv/config'
import pg from 'pg'
import { Kysely, PostgresDialect } from 'kysely'
import { Database } from './schema'

const connectionString = process.env.DATABASE_URL

if (!connectionString) {
  throw new Error(
    'DATABASE_URL is not set. Add a Postgres connection string to .env (Supabase: Project Settings → Database).',
  )
}

const dialect = new PostgresDialect({
  pool: new pg.Pool({
    connectionString,
    max: 10,
    connectionTimeoutMillis: 10_000,
    ssl: connectionString.includes('supabase')
      ? { rejectUnauthorized: false }
      : undefined,
  }),
})

export const db = new Kysely<Database>({
  dialect,
})

export async function destroyDb() {
  await db.destroy()
}
