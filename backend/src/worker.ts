// The habits page's API, as a Cloudflare Worker. There are no accounts, it's
// just for me: sending the key to /api/unlock sets a cookie, and every other
// request needs that cookie. Everything is kept in a D1 database (see
// migrations/ for its tables).
//
//   POST /api/unlock                { key }  sets the cookie if the key is right
//   GET  /api/data                  -> { logs, todos }
//   PUT  /api/habits/:habit/:date   { steps }  sets one day of one habit
//   PUT  /api/todos                 [{ id, text, done }]  replaces the list

export type Log = Record<string, number> // 'YYYY-MM-DD' -> steps
export type Todo = { id: string; text: string; done: boolean }

// The parts of Cloudflare's D1 database used here.
export interface Database {
  prepare(sql: string): Statement
  batch(statements: Statement[]): Promise<unknown[]> // all or nothing
}
export interface Statement {
  bind(...values: unknown[]): Statement
  all<T>(): Promise<{ results: T[] }>
  run(): Promise<unknown>
}

export type Env = {
  DB: Database
  HABITS_KEY?: string // a secret: `wrangler secret put HABITS_KEY` (or .dev.vars locally)
}

const COOKIE = 'habits_session'
const COOKIE_AGE = 60 * 60 * 24 * 400 // seconds: browsers cap cookies at 400 days
const WRONG_KEY_DELAY = 500 // ms, to make guessing the key slow
const MAX_BODY = 1_000_000 // bytes
const MAX_TODOS = 500
const MAX_TEXT = 500

class HttpError extends Error {
  status: number
  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    try {
      return await handle(request, env)
    } catch (error) {
      if (error instanceof HttpError) return json(error.status, { error: error.message })
      console.error(error)
      return json(500, { error: 'something went wrong' })
    }
  },
}

async function handle(request: Request, env: Env) {
  const url = new URL(request.url)
  const route = `${request.method} ${url.pathname}`
  if (!env.HABITS_KEY) throw new Error('HABITS_KEY is not set') // refuse everything rather than run unlocked
  const session = await sessionFor(env.HABITS_KEY)

  if (route === 'POST /api/unlock') {
    const { key } = await readJson(request)
    if (typeof key !== 'string' || !same(key, env.HABITS_KEY)) {
      await new Promise((resolve) => setTimeout(resolve, WRONG_KEY_DELAY))
      throw new HttpError(401, 'wrong key')
    }
    // HttpOnly: the page's own scripts can't read it. Secure (HTTPS only)
    // wherever the site is served over HTTPS, which is everywhere but locally.
    const secure = url.protocol === 'https:' ? '; Secure' : ''
    const cookie = `${COOKIE}=${session}; Path=/api; Max-Age=${COOKIE_AGE}; HttpOnly; SameSite=Strict${secure}`
    return json(200, { ok: true }, { 'Set-Cookie': cookie })
  }

  if (!same(readCookie(request, COOKIE) ?? '', session)) throw new HttpError(401, 'locked')

  if (route === 'GET /api/data') {
    const [days, todos] = await Promise.all([
      env.DB.prepare('SELECT habit, date, steps FROM days').all<{ habit: string; date: string; steps: number }>(),
      env.DB.prepare('SELECT id, text, done FROM todos ORDER BY position').all<{ id: string; text: string; done: number }>(),
    ])
    const logs: Record<string, Log> = {}
    for (const { habit, date, steps } of days.results) (logs[habit] ??= {})[date] = steps
    return json(200, { logs, todos: todos.results.map((todo) => ({ ...todo, done: todo.done === 1 })) })
  }

  const day = url.pathname.match(/^\/api\/habits\/([a-z0-9-]{1,40})\/(\d{4}-\d{2}-\d{2})$/)
  if (request.method === 'PUT' && day) {
    const [, habit, date] = day
    const { steps } = await readJson(request)
    if (!Number.isInteger(steps) || steps < 0 || steps > 100) throw new HttpError(400, 'steps must be 0 to 100')
    await (steps > 0
      ? env.DB.prepare(
          'INSERT INTO days (habit, date, steps) VALUES (?, ?, ?) ON CONFLICT (habit, date) DO UPDATE SET steps = excluded.steps',
        ).bind(habit, date, steps)
      : env.DB.prepare('DELETE FROM days WHERE habit = ? AND date = ?').bind(habit, date)
    ).run()
    return json(200, { ok: true })
  }

  if (route === 'PUT /api/todos') {
    const todos = parseTodos(await readJson(request))
    // In one go, so the list is never left half-replaced.
    await env.DB.batch([
      env.DB.prepare('DELETE FROM todos'),
      ...todos.map((todo, i) =>
        env.DB.prepare('INSERT INTO todos (position, id, text, done) VALUES (?, ?, ?, ?)').bind(i, todo.id, todo.text, todo.done ? 1 : 0),
      ),
    ])
    return json(200, { ok: true })
  }

  throw new HttpError(404, 'not found')
}

const json = (status: number, body: unknown, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', ...headers } })

// What the cookie holds: made from the key, so it never contains the key
// itself, and changing the key locks every browser out again.
async function sessionFor(key: string) {
  const encode = (text: string) => new TextEncoder().encode(text)
  const hmac = await crypto.subtle.importKey('raw', encode(key), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
  const signature = new Uint8Array(await crypto.subtle.sign('HMAC', hmac, encode('habits session')))
  return btoa(String.fromCharCode(...signature)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

// Compares in constant time, so a secret can't be guessed by timing replies.
function same(a: string, b: string) {
  const x = new TextEncoder().encode(a)
  const y = new TextEncoder().encode(b)
  if (x.length !== y.length) return false
  let difference = 0
  for (let i = 0; i < x.length; i++) difference |= x[i] ^ y[i]
  return difference === 0
}

function readCookie(request: Request, name: string) {
  for (const part of request.headers.get('Cookie')?.split(';') ?? []) {
    const [key, ...value] = part.trim().split('=')
    if (key === name) return value.join('=')
  }
}

async function readJson(request: Request) {
  const body = await request.text()
  if (body.length > MAX_BODY) throw new HttpError(413, 'too big')
  try {
    return JSON.parse(body) ?? {}
  } catch {
    throw new HttpError(400, 'not JSON')
  }
}

// Keeps only the fields a to-do has, and refuses anything malformed.
function parseTodos(body: unknown): Todo[] {
  if (!Array.isArray(body) || body.length > MAX_TODOS) throw new HttpError(400, 'expected a list of to-dos')
  return body.map((todo) => {
    const { id, text, done } = todo ?? {}
    if (typeof id !== 'string' || id.length > 100 || typeof text !== 'string' || text.length > MAX_TEXT || typeof done !== 'boolean') {
      throw new HttpError(400, 'each to-do needs an id, text and done')
    }
    return { id, text, done }
  })
}
