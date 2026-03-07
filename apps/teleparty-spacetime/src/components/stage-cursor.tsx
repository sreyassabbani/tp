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
            viewBox="0 0 24 24"
            fill="none"
          >
            <path
              d="M6.9 3.2C5.7 3.2 4.9 4 4.7 5.1L3.55 16.8C3.45 18.1 4.5 19.05 5.76 18.75L10.9 17.5C11.48 17.36 12.08 17.58 12.44 18.05L13.46 19.37C14.3 20.44 16 19.93 16.12 18.58L16.62 13.3C16.68 12.63 17.08 12.04 17.68 11.73L19.2 10.95C20.7 10.18 20.72 8.05 19.24 7.24L8.84 3.58C8.22 3.32 7.56 3.2 6.9 3.2Z"
              fill={color}
              stroke="rgba(255,255,255,0.9)"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="1.15"
            />
            <path
              d="M12.55 9.1C13.58 8.42 14.95 8.96 15.2 10.17C15.42 11.23 14.72 12.3 13.64 12.5C12.54 12.7 11.55 11.82 11.6 10.7C11.62 10.02 11.96 9.5 12.55 9.1Z"
              fill="rgba(255,255,255,0.22)"
              stroke="rgba(255,255,255,0.52)"
              strokeWidth="0.8"
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
