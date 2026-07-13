import { useState } from 'react'
import { Tooltip } from './Tooltip'
import type { DiagramStatePoint } from '../../../core/types'

interface StatePointMarkerProps {
  point: DiagramStatePoint
  svgX: number
  svgY: number
  /** Welche Werte im Tooltip zeigen — 'pv' oder 'ts' */
  diagramType: 'pv' | 'ts'
}

function formatSI(value: number | null, unit: string): string {
  if (value === null) return '—'
  if (Math.abs(value) >= 1_000_000) return `${(value / 1_000_000).toFixed(2)} M${unit}`
  if (Math.abs(value) >= 1_000)     return `${(value / 1_000).toFixed(2)} k${unit}`
  return `${value.toFixed(3)} ${unit}`
}

export function StatePointMarker({ point, svgX, svgY, diagramType }: StatePointMarkerProps) {
  const [hovered, setHovered] = useState(false)

  const tooltipLines = diagramType === 'pv' ? [
    `p = ${formatSI(point.p, 'Pa')}`,
    `v = ${formatSI(point.v, 'm³/kg')}`,
    `T = ${formatSI(point.T, 'K')}`,
  ] : [
    `T = ${formatSI(point.T, 'K')}`,
    `s = ${formatSI(point.s, 'J/kgK')}`,
    `p = ${formatSI(point.p, 'Pa')}`,
  ]

  return (
    <g>
      {/* Punkt */}
      <circle
        cx={svgX} cy={svgY} r={hovered ? 6 : 4}
        fill="var(--accent)" stroke="var(--bg-primary)" strokeWidth={1.5}
        style={{ transition: 'r 0.15s ease', cursor: 'pointer' }}
        tabIndex={0}
        role="img"
        aria-label={`${point.label}: ${tooltipLines.join(', ')}`}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        onFocus={() => setHovered(true)}
        onBlur={() => setHovered(false)}
      />
      {/* Label */}
      <text x={svgX + 8} y={svgY - 6} fontSize={11}
        fill="var(--text-primary)" fontWeight={600}>
        {point.label}
      </text>
      {/* Tooltip */}
      <Tooltip x={svgX} y={svgY} lines={tooltipLines} visible={hovered} />
    </g>
  )
}
