import assert from 'node:assert/strict'
import { test } from 'node:test'
import worker, { type Env } from '../src/worker.ts'
import { testDatabase } from './database.ts'

const KEY = 'test-key'
const env: Env = { DB: testDatabase(), HABITS_KEY: KEY }
let cookie = '' // set by the unlock test, as a browser would keep it

const call = (route: string, { method = 'GET', body, withCookie = true, on = env, https = false }: { method?: string; body?: unknown; withCookie?: boolean; on?: Env; https?: boolean } = {}) =>
  worker.fetch(
    new Request(`${https ? 'https' : 'http'}://localhost/api${route}`, {
      method,
      headers: { 'Content-Type': 'application/json', ...(withCookie && cookie ? { Cookie: cookie } : {}) },
      body: body === undefined ? undefined : JSON.stringify(body),
    }),
    on,
  )

test('is locked without the cookie', async () => {
  assert.equal((await call('/data', { withCookie: false })).status, 401)
  assert.equal((await call('/todos', { withCookie: false, method: 'PUT', body: [] })).status, 401)
})

test('a wrong key sets no cookie', async () => {
  const res = await call('/unlock', { method: 'POST', body: { key: 'nope' } })
  assert.equal(res.status, 401)
  assert.equal(res.headers.get('Set-Cookie'), null)
})

test('the right key sets a long-lived, script-proof cookie without the key in it', async () => {
  const res = await call('/unlock', { method: 'POST', body: { key: KEY } })
  assert.equal(res.status, 200)
  const setCookie = res.headers.get('Set-Cookie') ?? ''
  assert.match(setCookie, /HttpOnly/)
  assert.match(setCookie, /SameSite=Strict/)
  assert.match(setCookie, /Max-Age=\d{8}/)
  assert.doesNotMatch(setCookie, /Secure/) // plain http, locally
  assert.doesNotMatch(setCookie, new RegExp(KEY))
  cookie = setCookie.split(';')[0]
})

test('over HTTPS the cookie is also Secure', async () => {
  const res = await call('/unlock', { method: 'POST', body: { key: KEY }, https: true })
  assert.match(res.headers.get('Set-Cookie') ?? '', /; Secure/)
})

test('a made-up cookie is refused', async () => {
  const res = await worker.fetch(new Request('http://localhost/api/data', { headers: { Cookie: 'habits_session=made-up' } }), env)
  assert.equal(res.status, 401)
})

test('starts empty', async () => {
  assert.deepEqual(await (await call('/data')).json(), { logs: {}, todos: [] })
})

test('sets, changes and clears a day of a habit', async () => {
  assert.equal((await call('/habits/water/2026-11-25', { method: 'PUT', body: { steps: 3 } })).status, 200)
  await call('/habits/water/2026-11-26', { method: 'PUT', body: { steps: 1 } })
  await call('/habits/water/2026-11-25', { method: 'PUT', body: { steps: 4 } })
  assert.deepEqual((await (await call('/data')).json()).logs, { water: { '2026-11-25': 4, '2026-11-26': 1 } })
  await call('/habits/water/2026-11-25', { method: 'PUT', body: { steps: 0 } })
  assert.deepEqual((await (await call('/data')).json()).logs, { water: { '2026-11-26': 1 } })
})

test('rejects bad days and steps', async () => {
  assert.equal((await call('/habits/water/25-11-2026', { method: 'PUT', body: { steps: 1 } })).status, 404)
  assert.equal((await call('/habits/water/2026-11-25', { method: 'PUT', body: { steps: -1 } })).status, 400)
  assert.equal((await call('/habits/water/2026-11-25', { method: 'PUT', body: { steps: 1.5 } })).status, 400)
})

test('replaces the to-do list in order, keeping only known fields', async () => {
  const todos = [
    { id: 'b', text: "it's second", done: false, extra: 'dropped' },
    { id: 'a', text: 'buy milk', done: true },
  ]
  assert.equal((await call('/todos', { method: 'PUT', body: todos })).status, 200)
  assert.deepEqual((await (await call('/data')).json()).todos, [
    { id: 'b', text: "it's second", done: false },
    { id: 'a', text: 'buy milk', done: true },
  ])
})

test('a bad list changes nothing', async () => {
  assert.equal((await call('/todos', { method: 'PUT', body: [{ id: 'c', text: 'fine', done: false }, { text: 'no id' }] })).status, 400)
  assert.equal((await (await call('/data')).json()).todos.length, 2)
})

test('changing the key locks old cookies out', async () => {
  const res = await call('/data', { on: { ...env, HABITS_KEY: 'a-new-key' } })
  assert.equal(res.status, 401)
})

test('with no key set, nothing works', async () => {
  const res = await call('/unlock', { method: 'POST', body: { key: '' }, on: { DB: env.DB } })
  assert.equal(res.status, 500)
})
