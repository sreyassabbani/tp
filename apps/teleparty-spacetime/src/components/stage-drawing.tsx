type StagePoint = Readonly<{
  x: number
  y: number
}>

type StageStroke = Readonly<{
  color: string
  points: readonly StagePoint[]
  strokeId: string
}>

type StageDrawingProps = Readonly<{
  previewStroke?: Omit<StageStroke, 'strokeId'> | null
  strokes: readonly StageStroke[]
}>

function toPath(points: readonly StagePoint[]) {
  if (points.length === 0) {
    return ''
  }

  const [firstPoint, ...restPoints] = points
  if (!firstPoint) {
    return ''
  }

  return [
    `M ${firstPoint.x * 100} ${firstPoint.y * 100}`,
    ...restPoints.map((point) => `L ${point.x * 100} ${point.y * 100}`),
  ].join(' ')
}

export function StageDrawing({ previewStroke = null, strokes }: StageDrawingProps) {
  return (
    <svg
      aria-hidden="true"
      className="pointer-events-none absolute inset-2 h-[calc(100%-1rem)] w-[calc(100%-1rem)]"
      preserveAspectRatio="none"
      viewBox="0 0 100 100"
    >
      {strokes.map((stroke) => (
        <path
          key={stroke.strokeId}
          d={toPath(stroke.points)}
          fill="none"
          stroke={stroke.color}
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeOpacity="0.92"
          strokeWidth="0.85"
        />
      ))}
      {previewStroke ? (
        <path
          d={toPath(previewStroke.points)}
          fill="none"
          stroke={previewStroke.color}
          strokeDasharray="1.8 1.2"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeOpacity="0.9"
          strokeWidth="0.9"
        />
      ) : null}
    </svg>
  )
}
