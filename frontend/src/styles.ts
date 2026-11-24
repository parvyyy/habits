import type { HabitColor } from './data/habits'

// Each colour from light to full. A habit with levels darkens through these
// as the day fills up; a done-or-not habit only uses the last one.
// Written out in full so Tailwind can find the class names.
const SHADES: Record<HabitColor, string[]> = {
  blue: ['bg-blue/18', 'bg-blue/30', 'bg-blue/42', 'bg-blue/55'],
  orange: ['bg-orange/18', 'bg-orange/30', 'bg-orange/42', 'bg-orange/55'],
  violet: ['bg-violet/18', 'bg-violet/30', 'bg-violet/42', 'bg-violet/55'],
  pink: ['bg-pink/18', 'bg-pink/30', 'bg-pink/42', 'bg-pink/55'],
  green: ['bg-green/18', 'bg-green/30', 'bg-green/42', 'bg-green/55'],
  cyan: ['bg-cyan/18', 'bg-cyan/30', 'bg-cyan/42', 'bg-cyan/55'],
  coral: ['bg-coral/18', 'bg-coral/30', 'bg-coral/42', 'bg-coral/55'],
}

// The full colour on its own, e.g. for the line under a habit's name.
export const fullShade = (color: HabitColor) => SHADES[color][SHADES[color].length - 1]

// Classes for a box with `steps` out of `goal` done. A finished day gets a
// darker outline than one that's only partly done.
export function shade(color: HabitColor, steps: number, goal: number) {
  if (steps <= 0) return ''
  const shades = SHADES[color]
  const i = Math.min(shades.length, Math.ceil((steps / goal) * shades.length)) - 1
  return `${shades[i]} ${steps >= goal ? 'border-ink/70' : 'border-ink/35'}`
}
