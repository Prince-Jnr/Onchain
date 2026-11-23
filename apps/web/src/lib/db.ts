import { neon } from '@neondatabase/serverless'
import { drizzle } from 'drizzle-orm/neon-http'
import * as schema from './schema'

export type Database = ReturnType<typeof drizzle<typeof schema>>

let database: Database | undefined

function getDatabase(): Database {
  if (database) return database

  const url = process.env.DATABASE_URL
  if (!url) throw new Error('DATABASE_URL is not configured')

  database = drizzle(neon(url), { schema })
  return database
}

// Keep route modules importable during static build analysis. The database
// client is created only when a route actually performs a database operation.
export const db = new Proxy({} as Database, {
  get(_target, property) {
    const client = getDatabase()
    const value = Reflect.get(client, property, client)
    return typeof value === 'function' ? value.bind(client) : value
  },
})
