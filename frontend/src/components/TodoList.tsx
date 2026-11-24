import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { blankTodo, type Todo } from '../api'

const SLIDE_MS = 150 // how long lines take to slide to a new place

// The same list with item `from` moved to position `to`.
function move<T>(list: T[], from: number, to: number) {
  const moved = [...list]
  moved.splice(to, 0, ...moved.splice(from, 1))
  return moved
}

type Props = {
  todos: Todo[]
  onChange: (todos: Todo[]) => void
}

// A to-do list written straight onto the page. Enter on a line with
// something in it adds a new line below; Backspace on an empty line removes
// it. Ticking a line's circle strikes it through (and makes it read-only
// until it's unticked); right-clicking a ticked line removes it.
//
// Lines can be dragged into a new order by the grip that shows on their left
// when hovered, or moved with Alt+Up / Alt+Down while typing in one.
function TodoList({ todos, onChange }: Props) {
  const [added, setAdded] = useState<string | null>(null) // the line just added, to focus it
  const [dragging, setDragging] = useState<string | null>(null) // the line being dragged
  const list = useRef<HTMLUListElement>(null)
  const rows = useRef(new Map<string, HTMLLIElement>())
  const inputs = useRef(new Map<string, HTMLInputElement>())
  const tops = useRef(new Map<string, number>()) // where each line was last drawn

  // When lines change places, slide each from where it was to where it is
  // now, rather than jumping.
  useLayoutEffect(() => {
    const still = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    for (const [id, row] of rows.current) {
      const was = tops.current.get(id)
      const now = row.offsetTop
      if (!still && was !== undefined && was !== now) {
        row.animate([{ translate: `0 ${was - now}px` }, { translate: '0 0' }], { duration: SLIDE_MS, easing: 'ease-out' })
      }
      tops.current.set(id, now)
    }
  })

  const update = (id: string, change: Partial<Todo>) =>
    onChange(todos.map((todo) => (todo.id === id ? { ...todo, ...change } : todo)))

  // Takes a line off the list, leaving a blank one if it was the last.
  function remove(id: string) {
    const rest = todos.filter((todo) => todo.id !== id)
    onChange(rest.length ? rest : [blankTodo()])
  }

  // While dragging, the line takes whichever place is nearest the pointer.
  // This listens on the whole window: the line is moved around the page as
  // it changes place, and the browser stops sending its grip pointer events
  // when that happens.
  useEffect(() => {
    if (!dragging) return
    const onMove = (event: PointerEvent) => {
      const from = todos.findIndex((todo) => todo.id === dragging)
      if (from === -1 || !list.current) return
      const y = event.clientY - list.current.getBoundingClientRect().top
      const middles = todos.map((todo) => {
        const row = rows.current.get(todo.id)!
        return row.offsetTop + row.offsetHeight / 2
      })
      const to = middles.reduce((best, middle, i) => (Math.abs(middle - y) < Math.abs(middles[best] - y) ? i : best), 0)
      if (to !== from) onChange(move(todos, from, to))
    }
    const onUp = () => setDragging(null)
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
    window.addEventListener('pointercancel', onUp)
    return () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      window.removeEventListener('pointercancel', onUp)
    }
  }, [dragging, todos, onChange])

  function onKeyDown(event: React.KeyboardEvent<HTMLInputElement>, todo: Todo, i: number) {
    if (event.key === 'Enter' && todo.text.trim()) {
      event.preventDefault()
      const line = blankTodo()
      onChange([...todos.slice(0, i + 1), line, ...todos.slice(i + 1)])
      setAdded(line.id)
    }
    if (event.key === 'Backspace' && todo.text === '' && todos.length > 1) {
      event.preventDefault() // don't delete a character from the line we move to
      onChange(todos.filter((t) => t.id !== todo.id))
      inputs.current.get((todos[i - 1] ?? todos[i + 1]).id)?.focus()
    }
    if (event.altKey && (event.key === 'ArrowUp' || event.key === 'ArrowDown')) {
      event.preventDefault()
      const to = i + (event.key === 'ArrowUp' ? -1 : 1)
      if (to >= 0 && to < todos.length) onChange(move(todos, i, to)) // the input keeps focus as it moves
    }
  }

  return (
    <ul ref={list} aria-label="To do" className="relative flex flex-col gap-2 px-1 pt-3.5">
      {todos.map((todo, i) => (
        <li
          key={todo.id}
          ref={(el) => {
            if (el) rows.current.set(todo.id, el)
            else rows.current.delete(todo.id)
          }}
          onContextMenu={(event) => {
            if (!todo.done) return // an unticked line keeps the usual menu, for editing its text
            event.preventDefault()
            remove(todo.id)
          }}
          // The line being dragged is lifted off the page, like a slip of
          // paper (drawn behind it, a little bigger, so nothing inside moves).
          className={`group relative isolate flex items-center gap-2.5 transition-[rotate,scale] ${dragging === todo.id ? 'z-10 -rotate-1 scale-105 before:absolute before:-inset-x-2.5 before:-inset-y-1 before:-z-10 before:rounded-wobbly-sm before:bg-card before:shadow-card' : ''}`}
        >
          <button
            type="button"
            aria-label={`Move ${todo.text || 'this line'} (or Alt+Up and Alt+Down while typing)`}
            onPointerDown={(event) => {
              event.preventDefault() // no text selection while dragging
              if (event.button === 0) setDragging(todo.id)
            }}
            className={`absolute -left-6 flex h-7 w-5 touch-none items-center justify-center text-pencil transition-opacity group-hover:opacity-60 hover:opacity-100! focus-visible:opacity-100 [@media(hover:none)]:opacity-40 ${dragging === todo.id ? 'cursor-grabbing opacity-100' : 'cursor-grab opacity-0'}`}
          >
            <svg viewBox="0 0 10 16" aria-hidden="true" className="h-4 fill-current">
              {[3, 8, 13].flatMap((y) => [2.5, 7.5].map((x) => <circle key={`${x}-${y}`} cx={x} cy={y} r="1.3" />))}
            </svg>
          </button>

          <button
            type="button"
            role="checkbox"
            aria-checked={todo.done}
            aria-label={todo.text ? `Done: ${todo.text}` : 'Done'}
            disabled={!todo.text.trim()}
            onClick={() => update(todo.id, { done: !todo.done })}
            className="relative size-5 shrink-0 cursor-pointer rounded-full border-2 border-ink/30 bg-white transition hover:scale-115 hover:border-ink/70 disabled:cursor-default disabled:hover:scale-100 disabled:hover:border-ink/30"
          >
            {/* A tick drawn in pen, overshooting the circle a little. */}
            {todo.done && (
              <svg viewBox="0 0 20 20" aria-hidden="true" className="absolute -top-1.5 -left-0.5 size-6 overflow-visible">
                <path
                  d="M3.5 10.5 L8 15.5 L18 2.5"
                  pathLength={1}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="animate-draw fill-none stroke-ink stroke-[2.5] [stroke-dasharray:1] [stroke-dashoffset:1] motion-reduce:animate-none motion-reduce:[stroke-dashoffset:0]"
                />
              </svg>
            )}
          </button>

          {todo.done ? (
            <span title={todo.text} className="relative min-w-0 truncate pt-0.5 text-xl/7 text-pencil">
              {todo.text}
              <span className="wavy-line absolute inset-x-0 top-1/2 h-1.5 animate-strike bg-ink/70 motion-reduce:animate-none" />
            </span>
          ) : (
            <input
              ref={(el) => {
                if (el) inputs.current.set(todo.id, el)
                else inputs.current.delete(todo.id)
              }}
              value={todo.text}
              onChange={(event) => update(todo.id, { text: event.target.value })}
              onKeyDown={(event) => onKeyDown(event, todo, i)}
              autoFocus={todo.id === added}
              placeholder={todos.length === 1 ? 'add a task…' : undefined}
              aria-label="Task"
              spellCheck={false}
              className="min-w-0 flex-1 bg-transparent pt-0.5 text-xl/7 outline-none placeholder:text-pencil/50"
            />
          )}
        </li>
      ))}
    </ul>
  )
}

export default TodoList
