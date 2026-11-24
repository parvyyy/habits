import { useCallback, useEffect, useRef, useState } from 'react'
import { blankTodo, loadData, LockedError, saveSteps, saveTodos, unlock, type Data, type Todo } from './api'
import HabitCard from './components/HabitCard'
import Lock from './components/Lock'
import TodoList from './components/TodoList'
import { habits, START } from './data/habits'

const SAVE_TODOS_MS = 400 // typing in the list saves once it's paused this long

// The list always has a line to type in.
const withALine = (data: Data): Data => ({ ...data, todos: data.todos.length ? data.todos : [blankTodo()] })

function App() {
  const today = new Date()
  // The month every calendar shows. Starts on this month.
  const [shown, setShown] = useState({ year: today.getFullYear(), month: today.getMonth() })

  // Nothing is shown (and nothing can be changed) until this browser's been
  // unlocked with the key, once. Everything then comes from, and saves to,
  // the backend.
  const [data, setData] = useState<Data | null>(null)
  const [problem, setProblem] = useState<string | null>(null) // shown by the lock

  const relock = useCallback(() => setData(null), [])
  const failed = useCallback(
    (error: unknown) => (error instanceof LockedError ? relock() : setProblem('not saved')),
    [relock],
  )

  // If this browser's already unlocked, load straight away.
  useEffect(() => {
    localStorage.removeItem('key') // where the key used to be kept, before the cookie
    loadData()
      .then((loaded) => setData(withALine(loaded)))
      .catch((error) => {
        if (!(error instanceof LockedError)) setProblem("can't reach the server")
      })
  }, [])

  async function tryKey(key: string) {
    try {
      await unlock(key)
      setData(withALine(await loadData()))
      setProblem(null)
      return true
    } catch (error) {
      if (!(error instanceof LockedError)) setProblem("can't reach the server")
      return false
    }
  }

  function setSteps(habit: string, date: string, steps: number) {
    setData((data) => data && { ...data, logs: { ...data.logs, [habit]: { ...data.logs[habit], [date]: steps } } })
    saveSteps(habit, date, steps).then(() => setProblem(null), failed)
  }

  // The list is saved a moment after typing stops, rather than on every
  // key. Lines with nothing in them aren't saved.
  const unsavedTodos = useRef<Todo[] | null>(null)
  const todoTimer = useRef<number>(undefined)
  const flushTodos = useCallback(
    (closing = false) => {
      clearTimeout(todoTimer.current)
      if (!unsavedTodos.current) return
      const todos = unsavedTodos.current.filter((todo) => todo.text.trim())
      unsavedTodos.current = null
      saveTodos(todos, closing).then(() => setProblem(null), failed)
    },
    [failed],
  )

  function setTodos(todos: Todo[]) {
    setData((data) => data && { ...data, todos })
    unsavedTodos.current = todos
    clearTimeout(todoTimer.current)
    todoTimer.current = window.setTimeout(flushTodos, SAVE_TODOS_MS)
  }

  // Don't lose the last few keys typed if the page is closed or reloaded.
  useEffect(() => {
    const onHide = () => flushTodos(true)
    window.addEventListener('pagehide', onHide)
    return () => window.removeEventListener('pagehide', onHide)
  }, [flushTodos])

  const isMonth = (m: { year: number; month: number }) => shown.year === m.year && shown.month === m.month
  const step = (by: number) => {
    const date = new Date(shown.year, shown.month + by)
    setShown({ year: date.getFullYear(), month: date.getMonth() })
  }
  const monthName = new Date(shown.year, shown.month).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })

  return (
    <main className="px-6 pt-12 pb-16">
      {/* As wide as the grid, so the lock lines up with its right edge. */}
      <div className="mx-auto w-fit">
        <div className="relative mb-10 flex items-center justify-center gap-4">
          {/* Nothing before the start, and nothing done in the future yet. */}
          <MonthButton label="Previous month" onClick={() => step(-1)} hidden={isMonth(START)}>
            ‹
          </MonthButton>
          {/* Keyed by month so it's jotted in again on each change. */}
          <h1 key={monthName} className="w-44 animate-scribble-in text-center text-2xl">
            {monthName}
          </h1>
          <MonthButton
            label="Next month"
            onClick={() => step(1)}
            hidden={isMonth({ year: today.getFullYear(), month: today.getMonth() })}
          >
            ›
          </MonthButton>

          <div className="absolute right-0 flex items-center gap-3">
            {problem && <p className="text-base text-coral">{problem}</p>}
            <Lock unlocked={data !== null} onUnlock={tryKey} />
          </div>
        </div>

        {/* Habits fill the first three columns; the to-do list takes the
            whole fourth one. On smaller screens it goes below them. */}
        <div className="grid gap-10 sm:grid-cols-2 xl:grid-cols-4">
          {habits.map((habit) => (
            <HabitCard
              key={habit.id}
              habit={habit}
              log={data?.logs[habit.id] ?? {}}
              year={shown.year}
              month={shown.month}
              today={today}
              onChange={data ? (date, steps) => setSteps(habit.id, date, steps) : undefined}
            />
          ))}
          {/* w-0 + min-w-full: the list takes its column's width but never
              widens it, so the calendars don't move when it appears. */}
          <div className="w-0 min-w-full sm:col-span-2 xl:col-span-1 xl:col-start-4 xl:row-span-2 xl:row-start-1">
            {data && <TodoList todos={data.todos} onChange={setTodos} />}
          </div>
        </div>
      </div>
    </main>
  )
}

type MonthButtonProps = {
  label: string
  onClick: () => void
  hidden?: boolean // still takes up its space, so the month name doesn't move
  children: React.ReactNode
}

function MonthButton({ label, onClick, hidden = false, children }: MonthButtonProps) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      className={`size-9 cursor-pointer rounded-wobbly-sm border-2 border-ink bg-card text-2xl/none transition hover:scale-110 ${hidden ? 'invisible' : ''}`}
    >
      {children}
    </button>
  )
}

export default App
