interface ReferenceLineProps {
  points: Array<{ x: number; y: number }>
  opacity?: number
}

export function ReferenceLine({ points, opacity = 0.15 }: ReferenceLineProps) {
  if (points.length < 2) return null
  const d = points.map((pt, i) => `${i === 0 ? 'M' : 'L'} ${pt.x.toFixed(1)} ${pt.y.toFixed(1)}`).join(' ')
  return (
    <path d={d} fill="none" stroke="currentColor"
      strokeWidth={1} strokeDasharray="4,4" opacity={opacity} />
  )
}
