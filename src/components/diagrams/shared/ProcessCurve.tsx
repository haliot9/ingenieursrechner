interface ProcessCurveProps {
  points: Array<{ x: number; y: number }>   // Bereits in SVG-Koordinaten
  color: string
  strokeWidth?: number
  dashed?: boolean
  onHover?: (hovered: boolean) => void
  opacity?: number
}

export function ProcessCurve({ points, color, strokeWidth = 2, dashed, onHover, opacity = 1 }: ProcessCurveProps) {
  if (points.length < 2) return null
  const d = points.map((pt, i) => `${i === 0 ? 'M' : 'L'} ${pt.x.toFixed(1)} ${pt.y.toFixed(1)}`).join(' ')
  return (
    <path
      d={d}
      fill="none"
      stroke={color}
      strokeWidth={strokeWidth}
      strokeDasharray={dashed ? '6,4' : undefined}
      opacity={opacity}
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{ transition: 'all 0.3s ease', cursor: onHover ? 'pointer' : 'default' }}
      onMouseEnter={() => onHover?.(true)}
      onMouseLeave={() => onHover?.(false)}
    />
  )
}
