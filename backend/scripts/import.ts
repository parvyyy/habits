// Turns a data.json from the old file-based backend into SQL for D1, e.g.
//
//   node scripts/import.ts data.json > import.sql
//   pnpm wrangler d1 execute habits --remote --file import.sql
//
// It replaces everything in the database with what's in the file.
import fs from 'node:fs'

const file = process.argv[2]
if (!file) throw new Error('usage: node scripts/import.ts data.json > import.sql')

type Old = { logs: Record<string, Record<string, number>>; todos: { id: string; text: string; done: boolean }[] }
const data: Old = JSON.parse(fs.readFileSync(file, 'utf8'))
const text = (value: string) => `'${value.replaceAll("'", "''")}'`

const lines = ['DELETE FROM days;', 'DELETE FROM todos;']
for (const [habit, log] of Object.entries(data.logs)) {
  for (const [date, steps] of Object.entries(log)) {
    if (steps > 0) lines.push(`INSERT INTO days (habit, date, steps) VALUES (${text(habit)}, ${text(date)}, ${Math.trunc(steps)});`)
  }
}
data.todos.forEach((todo, i) => {
  lines.push(`INSERT INTO todos (position, id, text, done) VALUES (${i}, ${text(todo.id)}, ${text(todo.text)}, ${todo.done ? 1 : 0});`)
})
console.log(lines.join('\n'))
