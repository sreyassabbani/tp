type PointerCoordinates = Readonly<{
  clientX: number
  clientY: number
}>

type StageBounds = Readonly<{
  left: number
  top: number
  width: number
  height: number
}>

function clampUnitInterval(value: number): number {
  return Math.min(1, Math.max(0, value))
}

export function getRelativeCursorPosition(
  bounds: StageBounds,
  pointer: PointerCoordinates,
): Readonly<{ x: number; y: number }> | null {
  if (bounds.width <= 0 || bounds.height <= 0) {
    return null
  }

  return {
    x: clampUnitInterval((pointer.clientX - bounds.left) / bounds.width),
    y: clampUnitInterval((pointer.clientY - bounds.top) / bounds.height),
  }
}
