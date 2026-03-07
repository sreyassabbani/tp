type StageCursorProps = Readonly<{
  color: string
  displayName: string
  isSelf?: boolean
  x: number
  y: number
}>

export function StageCursor({
  color,
  displayName,
  isSelf = false,
  x,
  y,
}: StageCursorProps) {
  return (
    <div
      className="pointer-events-none absolute"
      style={{
        left: `${x.toFixed(3)}%`,
        top: `${y.toFixed(3)}%`,
        zIndex: isSelf ? 20 : 10,
      }}
    >
      <div className="relative -translate-x-1/2 -translate-y-1/2">
        <div
          className={isSelf ? 'scale-110' : undefined}
          style={{
            filter: 'drop-shadow(0 6px 12px rgba(15, 23, 42, 0.28))',
          }}
        >
          <svg
            aria-hidden="true"
            className="h-5 w-5"
            viewBox="0 0 20 20"
            fill="none"
          >
            <path
              d="M4 2.75V15.5L7.7 11.95L10.45 17.25L12.9 16L10.15 10.8L15.75 10.15L4 2.75Z"
              fill={color}
              stroke="rgba(255,255,255,0.92)"
              strokeWidth="1.3"
              strokeLinejoin="round"
            />
          </svg>
        </div>
        <div className="absolute left-4 top-4 flex items-center gap-1.5 rounded-full border border-white/60 bg-slate-950/78 px-2.5 py-1 text-[10px] font-semibold text-white shadow-lg shadow-slate-950/30 backdrop-blur-sm">
          <span
            aria-hidden="true"
            className="size-2 rounded-full border border-white/70"
            style={{ backgroundColor: color }}
          />
          <span className="max-w-28 truncate">{displayName}</span>
          {isSelf ? <span className="text-[9px] text-white/70">you</span> : null}
        </div>
      </div>
    </div>
  )
}
