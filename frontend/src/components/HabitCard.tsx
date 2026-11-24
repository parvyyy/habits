import type { Log } from '../api'
import { dateKey, START, type Habit } from '../data/habits'
import { fullShade, shade } from '../styles'
import { titleCase } from '../text'
import Legend, { type Key } from './Legend'
import MiniCalendar from './MiniCalendar'

type Props = {
  habit: Habit
  log: Log // what's been done each day
  year: number
  month: number // 0 = January
  today: Date
  onChange?: (date: string, steps: number) => void // sets how much was done on a day; leave out to only look
}

// A sheet of paper with a habit's name and its calendar for one month.
// A habit with levels also gets a ⓘ showing what each shade means.
function HabitCard({ habit, log, year, month, today, onChange }: Props) {
  const goal = habit.levels ? habit.levels.length - 1 : 1
  const stepsOn = (day: number) => log[dateKey(year, month, day)] ?? 0
  const shadeFor = (steps: number) => shade(habit.color, steps, goal)

  // What a number of steps is called, e.g. 3 -> '1500mL'.
  const amount = (steps: number) => habit.levels?.[steps] ?? (steps > 0 ? 'done' : 'not done')

  const describe = (day: number) => {
    const date = new Date(year, month, day).toLocaleDateString('en-GB', { day: 'numeric', month: 'long' })
    return `${date}: ${amount(stepsOn(day))}`
  }

  // Holding a day adds a step, up to the goal; a done-or-not habit flips
  // between done and not instead. Right-clicking takes a step off.
  const next = (steps: number) => (goal === 1 ? 1 - steps : Math.min(goal, steps + 1))
  const previous = (steps: number) => Math.max(0, steps - 1)

  const keys: Key[] = Array.from({ length: goal + 1 }, (_, steps) => ({
    box: steps > 0 ? shadeFor(steps) : 'bg-white border-ink/20',
    label: amount(steps),
  }))

  return (
    <article className="relative rounded-wobbly bg-card px-4 pt-4 pb-4 shadow-card hover:z-10 focus-within:z-10">
      <div className="mb-4 flex items-start justify-between gap-4 px-0.5">
        {/* The line sits below the descenders (the tails of g, p and y). */}
        <h2 className="relative text-2xl/none">
          {titleCase(habit.name)}
          <span className={`wavy-line absolute inset-x-0 -bottom-2.5 h-1.5 ${fullShade(habit.color)}`} />
        </h2>
        {habit.levels && <Legend keys={keys} />}
      </div>

      <MiniCalendar
        year={year}
        month={month}
        today={today}
        stepsOn={stepsOn}
        next={next}
        previous={previous}
        shade={shadeFor}
        describe={describe}
        startDay={year === START.year && month === START.month ? START.day : undefined}
        onChange={onChange && ((day, steps) => onChange(dateKey(year, month, day), steps))}
      />
    </article>
  )
}

export default HabitCard
