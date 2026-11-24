// A stand-in for Cloudflare's D1 in tests: SQLite (built into Node), in
// memory, set up from the same migrations the real database uses.
import fs from 'node:fs'
import path from 'node:path'
import { DatabaseSync, type SQLInputValue } from 'node:sqlite'
import type { Database, Statement } from '../src/worker.ts'

export function testDatabase(): Database {
  const db = new DatabaseSync(':memory:')
  const migrations = path.join(import.meta.dirname, '..', 'migrations')
  for (const file of fs.readdirSync(migrations).sort()) db.exec(fs.readFileSync(path.join(migrations, file), 'utf8'))

  const statement = (sql: string, values: SQLInputValue[] = []): Statement & { runNow(): void } => ({
    bind: (...more) => statement(sql, more as SQLInputValue[]),
    all: async <T>() => ({ results: db.prepare(sql).all(...values) as T[] }),
    run: async () => db.prepare(sql).run(...values),
    runNow: () => db.prepare(sql).run(...values),
  })

  return {
    prepare: (sql) => statement(sql),
    // Like D1: all of them, or (if one fails) none.
    async batch(statements) {
      db.exec('BEGIN')
      try {
        for (const s of statements) (s as ReturnType<typeof statement>).runNow()
        db.exec('COMMIT')
      } catch (error) {
        db.exec('ROLLBACK')
        throw error
      }
      return []
    },
  }
}
