import { useEffect, useRef, useState } from 'react'

const WEEKDAYS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'] // weeks start on Monday

// How long a day has to be held down to change it.
const HOLD_MS = 550

type Props = {
  year: number
  month: number // 0 = January
  today: Date
  stepsOn: (day: number) => number // how much was done that day (0 = nothing)
  next: (steps: number) => number // what holding a day changes it to (the same number if nothing)
  previous: (steps: number) => number // what right-clicking a day changes it to
  shade: (steps: number) => string // the colour classes for a box with that many steps
  describe: (day: number) => string // read out for the box, e.g. '18 November: 1500mL'
  startDay?: number // the day tracking started, if it's in this month: marked with an S
  onChange?: (day: number, steps: number) => void // leave out to only look, not change
}

// A small month grid with one box per day. Every box starts white and is
// coloured in as the habit is done. Hovering a box shows its date. The day
// tracking started always shows an S.
//
// Holding a day down (mouse, finger, or Space/Enter) changes it to `next`:
// its new colour rises up the box while it's held, and it pops when done.
// Letting go early cancels. Right-click, or Backspace, changes it straight
// to `previous`, to undo. Days still to come can't be changed, and without
// `onChange` no day can.
function MiniCalendar({ year, month, today, stepsOn, next, previous, shade, describe, startDay, onChange }: Props) {
  const [held, setHeld] = useState<number | null>(null) // the day being held down
  const [changed, setChanged] = useState({ day: 0, times: 0 }) // the last day changed, to replay its pop
  const timer = useRef<number>(undefined)
  const heldDay = useRef<number | null>(null) // `held`, but up to date inside event handlers
  const pointer = useRef('mouse') // what the last press was made with
  useEffect(() => () => clearTimeout(timer.current), [])

  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const blanks = (new Date(year, month, 1).getDay() + 6) % 7 // days before the 1st, Monday first

  const monthName = new Date(year, month).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })
  const isFuture = (day: number) => new Date(year, month, day) > today
  const lookOf = (steps: number) => (steps > 0 ? shade(steps) : 'bg-white border-ink/20')

  function change(day: number, steps: number) {
    if (!onChange || steps === stepsOn(day)) return
    onChange(day, steps)
    setChanged(({ times }) => ({ day, times: times + 1 }))
  }

  function startHold(day: number) {
    const target = next(stepsOn(day))
    if (target === stepsOn(day)) return // already as full as it goes
    clearTimeout(timer.current)
    heldDay.current = day
    setHeld(day)
    timer.current = window.setTimeout(() => {
      heldDay.current = null
      setHeld(null)
      change(day, target)
    }, HOLD_MS)
  }

  // Lets go of `day`, if it's the one being held (other boxes can report
  // the pointer leaving them while a new hold starts).
  function stopHold(day: number) {
    if (heldDay.current !== day) return
    clearTimeout(timer.current)
    heldDay.current = null
    setHeld(null)
  }

  return (
    <div className="grid grid-cols-7 gap-1" role="group" aria-label={monthName}>
      {WEEKDAYS.map((weekday, i) => (
        <span key={i} aria-hidden="true" className="text-center text-sm/5 text-pencil">
          {weekday}
        </span>
      ))}

      {Array.from({ length: blanks }, (_, i) => (
        <span key={`blank-${i}`} aria-hidden="true" />
      ))}

      {Array.from({ length: daysInMonth }, (_, i) => {
        const day = i + 1
        const steps = stepsOn(day)
        const box = 'absolute inset-0 flex items-center justify-center rounded-wobbly-sm border-2 pt-px'
        const isStart = day === startDay
        const label = isStart ? 'S' : day

        if (isFuture(day) || !onChange) {
          return (
            <span
              key={day}
              aria-hidden="true"
              className={`relative size-6 text-sm/none ${isStart ? 'text-ink' : 'text-transparent hover:text-pencil'}`}
            >
              <span className={`${box} ${isFuture(day) ? 'border-dashed border-ink/15' : lookOf(steps)}`}>{label}</span>
            </span>
          )
        }

        const isHeld = held === day
        const justChanged = changed.day === day && changed.times > 0

        return (
          <button
            key={day}
            type="button"
            aria-label={`${describe(day)}${isStart ? ' (start)' : ''}`}
            onPointerDown={(event) => {
              pointer.current = event.pointerType
              if (event.button === 0) startHold(day)
            }}
            onPointerUp={() => stopHold(day)}
            onPointerLeave={(event) => {
              // The browser also reports a leave when the box redraws under
              // a still pointer (its pop), so check it really moved off.
              const box = event.currentTarget.getBoundingClientRect()
              const inside =
                event.clientX >= box.left && event.clientX <= box.right && event.clientY >= box.top && event.clientY <= box.bottom
              if (!inside) stopHold(day)
            }}
            onPointerCancel={() => stopHold(day)}
            onContextMenu={(event) => {
              event.preventDefault() // no browser menu
              // A long press on a touch screen also opens this menu; that's
              // a hold, not an undo.
              if (pointer.current !== 'touch') change(day, previous(steps))
            }}
            onKeyDown={(event) => {
              if (event.key === ' ' || event.key === 'Enter') {
                event.preventDefault()
                if (!event.repeat) startHold(day)
              }
              if (event.key === 'Backspace' || event.key === 'Delete') change(day, previous(steps))
            }}
            onKeyUp={(event) => {
              if (event.key === ' ' || event.key === 'Enter') stopHold(day)
            }}
            onBlur={() => stopHold(day)}
            // While held it slowly squashes down, as if being pressed in. It
            // sits in front of its neighbours while it's held, popping or
            // hovered, so they never cover the animation.
            style={isHeld ? { transitionDuration: `${HOLD_MS}ms` } : undefined}
            className={`relative size-6 cursor-pointer touch-manipulation text-sm/none outline-none select-none transition-transform ease-out [-webkit-touch-callout:none] hover:z-10 focus-visible:z-10 ${isStart ? 'text-ink' : 'text-transparent hover:text-ink focus-visible:text-ink'} ${isHeld || justChanged ? 'z-10' : ''} ${isHeld ? 'scale-85' : 'duration-150 hover:scale-115 focus-visible:scale-115'}`}
          >
            {/* Keyed so the pop replays each time this day changes. */}
            <span
              key={`box-${justChanged ? changed.times : 0}`}
              className={`${box} ${lookOf(steps)} ${justChanged ? 'animate-pop motion-reduce:animate-none' : ''}`}
            >
              {isHeld && (
                <>
                  <span
                    style={{ animationDuration: `${HOLD_MS}ms` }}
                    className="absolute -inset-0.5 animate-hold-fill overflow-hidden rounded-wobbly-sm bg-white"
                  >
                    <span className={`block size-full rounded-wobbly-sm border-2 ${lookOf(next(steps))}`} />
                  </span>
                  <span
                    style={{ animationDuration: `${HOLD_MS}ms` }}
                    className="absolute inset-x-0 h-0.5 animate-hold-line rounded-full bg-ink/60"
                  />
                </>
              )}
              <span className="relative">{label}</span>
            </span>

            {justChanged && (
              <span
                key={`ripple-${changed.times}`}
                aria-hidden="true"
                className="pointer-events-none absolute inset-0 animate-ripple rounded-wobbly-sm border-2 border-ink/50 motion-reduce:hidden"
              />
            )}
          </button>
        )
      })}
    </div>
  )
}

export default MiniCalendar
