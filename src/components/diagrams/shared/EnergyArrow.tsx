import type { DiagramEnergyFlow } from '../../../core/types'

interface EnergyArrowProps {
  flow: DiagramEnergyFlow
  /** Arrow center position in SVG coordinates */
  x: number
  y: number
  /** Direction the arrow points (energy flow direction) */
  direction: 'up' | 'down' | 'left' | 'right'
}

function formatValue(value: number): string {
  const abs = Math.abs(value)
  if (abs >= 1_000_000) return `${(value / 1_000_000).toFixed(1)} MJ/kg`
  if (abs >= 1_000) return `${(value / 1_000).toFixed(1)} kJ/kg`
  return `${value.toFixed(1)} J/kg`
}

export function EnergyArrow({ flow, x, y, direction }: EnergyArrowProps) {
  const color = flow.type === 'heat' ? '#f59e0b' : 'var(--accent)'
  const arrowLen = 24

  // Line endpoints: arrow tip points in `direction`
  let x1: number, y1: number, x2: number, y2: number
  switch (direction) {
    case 'down':  x1 = x; y1 = y - arrowLen / 2; x2 = x; y2 = y + arrowLen / 2; break
    case 'up':    x1 = x; y1 = y + arrowLen / 2; x2 = x; y2 = y - arrowLen / 2; break
    case 'right': x1 = x - arrowLen / 2; y1 = y; x2 = x + arrowLen / 2; y2 = y; break
    case 'left':  x1 = x + arrowLen / 2; y1 = y; x2 = x - arrowLen / 2; y2 = y; break
  }

  // Label positioned at the tail end of the arrow
  const labelGap = 8
  let lx: number, ly: number, anchor: 'middle' | 'start' | 'end'
  switch (direction) {
    case 'down':  lx = x; ly = y1 - labelGap;     anchor = 'middle'; break
    case 'up':    lx = x; ly = y1 + labelGap + 4;  anchor = 'middle'; break
    case 'right': lx = x2 + labelGap; ly = y + 3;  anchor = 'start';  break
    case 'left':  lx = x2 - labelGap; ly = y + 3;  anchor = 'end';    break
  }

  const markerId = `ea-${flow.label.replace(/[^a-z0-9]/gi, '')}`
  const valueStr = formatValue(flow.value)

  // Parse "x_{sub}" LaTeX pattern for SVG subscript rendering
  const m = flow.label.match(/^([^_]+)_\{([^}]+)\}$/)

  return (
    <g style={{ transition: 'all 0.3s ease' }}>
      <defs>
        <marker id={markerId} markerWidth="6" markerHeight="6"
          refX="3" refY="3" orient="auto" markerUnits="strokeWidth">
          <path d="M0,0 L6,3 L0,6 Z" fill={color} />
        </marker>
      </defs>
      <line x1={x1} y1={y1} x2={x2} y2={y2}
        stroke={color} strokeWidth={2}
        markerEnd={`url(#${markerId})`}
      />
      <text x={lx} y={ly} textAnchor={anchor} dominantBaseline="auto"
        fontSize={8} fill={color} fontWeight={600}>
        {m ? (
          <>
            <tspan>{m[1]}</tspan>
            <tspan dy="3" fontSize="6">{m[2]}</tspan>
            <tspan dy="-3">{` = ${valueStr}`}</tspan>
          </>
        ) : (
          <tspan>{flow.label} = {valueStr}</tspan>
        )}
      </text>
    </g>
  )
}
