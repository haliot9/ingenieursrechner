interface DirectionMarkerProps {
  /** Mittelpunkt der Kurve in SVG-Koordinaten */
  x: number
  y: number
  /** Tangenten-Winkel an diesem Punkt in Grad */
  angleDeg: number
  color: string
}

export function DirectionMarker({ x, y, angleDeg, color }: DirectionMarkerProps) {
  return (
    <g transform={`translate(${x}, ${y}) rotate(${angleDeg})`}>
      <path d="M-5,-4 L5,0 L-5,4 Z" fill={color} opacity={0.8} />
    </g>
  )
}
