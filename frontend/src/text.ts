// Short words left in lowercase in a title, unless they come first.
const SMALL_WORDS = new Set([
  'a', 'an', 'the', 'and', 'but', 'or', 'nor', 'so', 'yet',
  'as', 'at', 'by', 'for', 'from', 'in', 'into', 'of', 'off', 'on', 'per', 'to', 'up', 'via', 'vs', 'with',
])

// Capitalises each word of a title, except short common ones:
// 'go for a run' -> 'Go for a Run'.
export function titleCase(text: string) {
  return text
    .split(' ')
    .map((word, i) =>
      i > 0 && SMALL_WORDS.has(word.toLowerCase()) ? word.toLowerCase() : word.charAt(0).toUpperCase() + word.slice(1),
    )
    .join(' ')
}
