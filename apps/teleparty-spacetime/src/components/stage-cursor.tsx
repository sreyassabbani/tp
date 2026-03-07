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
          <div
            className="relative h-5 w-5 rounded-full border border-white/80"
            style={{
              background: `radial-gradient(circle at 35% 35%, rgba(255,255,255,0.92) 0%, ${color} 45%, color-mix(in srgb, ${color} 68%, black) 100%)`,
            }}
          >
            <div className="absolute left-1/2 top-1/2 h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/70 bg-white/30" />
          </div>
        </div>
        <div className="absolute left-4 top-4 flex items-center gap-1.5 rounded-full border border-white/55 bg-slate-950/72 px-2.5 py-1 text-[10px] font-semibold text-white shadow-lg shadow-slate-950/25 backdrop-blur-md">
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
