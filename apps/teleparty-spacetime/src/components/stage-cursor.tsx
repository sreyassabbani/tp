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
          className={`size-3 rounded-full border-2 border-white/90 shadow-md shadow-black/30 ${isSelf ? 'scale-110' : ''}`}
          style={{ backgroundColor: color }}
        />
        <div
          className="absolute left-3 top-3 rounded-full px-2 py-1 text-[10px] font-semibold text-white shadow-md shadow-black/30"
          style={{ backgroundColor: color }}
        >
          {displayName}
        </div>
      </div>
    </div>
  )
}
