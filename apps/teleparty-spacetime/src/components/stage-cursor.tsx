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
            className="h-6 w-6"
            viewBox="0 0 18 18"
            fill="none"
          >
            <path
              d="M4.8 2.35Q4 2.35 3.65 3.1L2.2 13.15Q2.05 14.15 3.05 14.5L7.2 13.1Q7.95 12.8 8.5 13.35L9.5 14.35Q10.3 15.2 10.75 14L11.4 11.1Q11.55 10.25 12.35 9.95L14.45 9.15Q15.55 8.7 14.95 7.75L6.2 2.8Q5.55 2.35 4.8 2.35Z"
              fill={color}
              stroke="rgba(255,255,255,0.9)"
              strokeLinejoin="round"
              strokeWidth="1.1"
            />
            <path
              d="M9.25 8.15Q10.1 7.55 11 8.05Q11.9 8.6 11.7 9.55Q11.5 10.45 10.6 10.65Q9.7 10.9 8.95 10.25Q8.2 9.55 8.45 8.75Q8.65 8.4 9.25 8.15Z"
              fill="rgba(255,255,255,0.26)"
              stroke="rgba(255,255,255,0.52)"
              strokeWidth="0.7"
            />
          </svg>
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
