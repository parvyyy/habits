export type Key = { box: string; label: string }

// A small ⓘ that, while hovered (or focused), shows what each shade of box
// means.
function Legend({ keys }: { keys: Key[] }) {
  return (
    <div className="group/legend relative">
      <button
        type="button"
        aria-label="What the colours mean"
        className="flex size-5 cursor-help items-center justify-center rounded-full border-2 border-pencil/60 pt-px text-sm/none text-pencil transition-colors group-hover/legend:border-ink group-hover/legend:text-ink"
      >
        i
      </button>

      <ul
        role="tooltip"
        className="invisible absolute top-full right-0 z-20 mt-2 flex gap-3 rounded-wobbly border-3 border-ink bg-card px-4 pt-3 pb-3.5 opacity-0 shadow-card transition group-focus-within/legend:visible group-focus-within/legend:opacity-100 group-hover/legend:visible group-hover/legend:opacity-100"
      >
        {keys.map((key) => (
          <li key={key.label} className="flex flex-col items-center gap-1.5">
            <span className={`size-5 rounded-wobbly-sm border-2 ${key.box}`} />
            <span className="text-sm/none whitespace-nowrap text-pencil">{key.label}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}

export default Legend
