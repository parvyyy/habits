// Talks to the backend (habits/backend). Deployed, the same Cloudflare Worker
// serves this page and /api; in development Vite passes /api on to it (see
// vite.config.ts). Typing the key into the lock makes the backend
// set a cookie, and the browser sends that with every call after.

// 'YYYY-MM-DD' -> steps done that day. A day that's missing had none.
export type Log = Record<string, number>
export type Todo = { id: string; text: string; done: boolean }
export type Data = {
  logs: Record<string, Log> // by habit id
  todos: Todo[]
}

// The key was wrong, or this browser hasn't been unlocked yet.
export class LockedError extends Error {}

export const blankTodo = (): Todo => ({ id: crypto.randomUUID(), text: '', done: false })

async function call(path: string, init: RequestInit = {}) {
  const res = await fetch(`/api${path}`, { ...init, headers: { 'Content-Type': 'application/json' } })
  if (res.status === 401) throw new LockedError()
  if (!res.ok) throw new Error(`${init.method ?? 'GET'} ${path} failed: ${res.status}`)
  return res
}

// Resolves if the key was right (and this browser is now unlocked for good).
export const unlock = (key: string) => call('/unlock', { method: 'POST', body: JSON.stringify({ key }) })

export const loadData = async (): Promise<Data> => (await call('/data')).json()

export const saveSteps = (habit: string, date: string, steps: number) =>
  call(`/habits/${habit}/${date}`, { method: 'PUT', body: JSON.stringify({ steps }) })

// `keepalive` lets the request finish even if the page is closing.
export const saveTodos = (todos: Todo[], keepalive = false) =>
  call('/todos', { method: 'PUT', body: JSON.stringify(todos), keepalive })
