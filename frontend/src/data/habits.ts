// The habits, shown three to a row in this order (two on smaller screens), so
// neighbours should differ in colour. Names can be written in any case:
// they're shown in title case ('go for a run' -> 'Go for a Run').
//
// What's been done each day isn't kept here: it's saved by the backend, under
// each habit's `id`. So don't change an id once there's data for it.

export type HabitColor = 'blue' | 'orange' | 'violet' | 'pink' | 'green' | 'cyan' | 'coral'

export type Habit = {
  id: string // lowercase letters, numbers and dashes
  name: string
  color: HabitColor // what a completed day is coloured in with
  // For a habit done a bit at a time: what each level is called, starting
  // from none. Each hold goes up one level, and the box gets darker. Leave
  // out for a habit that's either done or not.
  levels?: string[]
}

// The day tracking starts: marked with an S on the calendars, and its month
// is the first one you can look at. (`month` counts from 0 for January.)
export const START = { year: 2026, month: 10, day: 25 }

export const habits: Habit[] = [
  { id: 'water', name: 'drink 2L of water', color: 'blue', levels: ['0mL', '500mL', '1000mL', '1500mL', '2000mL'] },
  { id: 'eat', name: 'eat well', color: 'orange', levels: ['None', 'Breakfast', 'Lunch', 'Dinner'] },
  { id: 'skincare', name: 'skincare', color: 'violet', levels: ['None', 'Morning', 'Afternoon'] },
  { id: 'exercise', name: 'exercise', color: 'green' },
  { id: 'driving', name: 'driving', color: 'cyan' },
  { id: 'socialise', name: 'socialise', color: 'coral' },
]

// The key a day is stored under in a log: 2026, 10, 24 -> '2026-11-24'.
// `month` counts from 0 for January, like JavaScript dates.
export function dateKey(year: number, month: number, day: number) {
  return `${year}-${pad(month + 1)}-${pad(day)}`
}

function pad(n: number) {
  return String(n).padStart(2, '0')
}
