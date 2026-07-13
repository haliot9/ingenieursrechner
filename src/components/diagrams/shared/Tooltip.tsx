interface TooltipProps {
  x: number
  y: number
  lines: string[]      // Zeilen im Tooltip, z.B. ["p = 400 kPa", "v = 0.43 m³/kg"]
  visible: boolean
}

export function Tooltip({ x, y, lines, visible }: TooltipProps) {
  if (!visible) return null
  const W = 140, lineH = 16, padding = 8
  const H = lines.length * lineH + padding * 2
  return (
    <g transform={`translate(${x + 8}, ${y - H / 2})`} style={{ pointerEvents: 'none' }}>
      <rect width={W} height={H} rx={4} fill="var(--bg-secondary)"
        stroke="var(--border)" strokeWidth={1} opacity={0.95} />
      {lines.map((line, i) => (
        <text key={i} x={padding} y={padding + (i + 0.75) * lineH}
          fontSize={11} fill="var(--text-primary)" fontFamily="monospace">
          {line}
        </text>
      ))}
    </g>
  )
}
