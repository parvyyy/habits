import { useState } from 'react'

type Props = {
  unlocked: boolean
  onUnlock: (key: string) => Promise<boolean> // whether the key was right
}

// A padlock. While locked, clicking it opens a box for the key; Enter tries
// it, and a wrong one gives the box a shake. Once unlocked it stays open for
// good, and is just a picture.
function Lock({ unlocked, onUnlock }: Props) {
  const [open, setOpen] = useState(false) // whether the key box is showing
  const [key, setKey] = useState('')
  const [misses, setMisses] = useState(0) // wrong tries, to replay the shake
  const [trying, setTrying] = useState(false)

  async function tryKey() {
    if (!key.trim() || trying) return
    setTrying(true)
    const right = await onUnlock(key.trim())
    setTrying(false)
    setKey('')
    if (right) setOpen(false)
    else setMisses((n) => n + 1)
  }

  if (unlocked) {
    return (
      <span role="img" aria-label="Unlocked" className="text-pencil">
        <Padlock open />
      </span>
    )
  }

  return (
    <div className="flex items-center gap-3">
      {open && (
        // Keyed by misses so a wrong key remounts it, which replays the
        // shake (and autoFocus puts the cursor back).
        <input
          key={misses}
          autoFocus
          value={key}
          readOnly={trying} // a wrong key takes a moment to be refused, and then clears the box
          onChange={(event) => setKey(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') tryKey()
            if (event.key === 'Escape') setOpen(false)
          }}
          aria-label="Key"
          autoComplete="off"
          spellCheck={false}
          className={`w-28 border-b-3 border-ink bg-transparent text-xl outline-none ${misses ? 'animate-shake' : 'animate-scribble-in'}`}
        />
      )}
      <button
        type="button"
        aria-label="Unlock"
        aria-expanded={open}
        onClick={() => setOpen(!open)}
        className="cursor-pointer text-pencil transition hover:scale-110 hover:-rotate-6 hover:text-ink"
      >
        <Padlock open={false} />
      </button>
    </div>
  )
}

function Padlock({ open }: { open: boolean }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="size-7 fill-none stroke-current stroke-2" strokeLinecap="round" strokeLinejoin="round">
      {/* The shackle swings up and off to one side when open. */}
      <path d={open ? 'M7.5 11V7.5a4.5 4.5 0 0 1 8.7-1.6' : 'M7.5 11V7.5a4.5 4.5 0 0 1 9 0V11'} />
      <rect x="4" y="11" width="16" height="10" rx="2.5" className="fill-card" />
      <path d="M12 15v2" />
    </svg>
  )
}

export default Lock
