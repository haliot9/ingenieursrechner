interface AxesProps {
  svgW: number; svgH: number
  pad: { left: number; right: number; top: number; bottom: number }
  xLabel: string; yLabel: string
  xTicks: Array<{ value: number; svgX: number; label: string }>
  yTicks: Array<{ value: number; svgY: number; label: string }>
}

export function Axes({ svgW, svgH, pad, xLabel, yLabel, xTicks, yTicks }: AxesProps) {
  const color = 'var(--text-secondary)'
  return (
    <g>
      {/* Achsenlinien */}
      <line x1={pad.left} y1={pad.top} x2={pad.left} y2={svgH - pad.bottom}
        stroke={color} strokeWidth={1.5} />
      <line x1={pad.left} y1={svgH - pad.bottom} x2={svgW - pad.right} y2={svgH - pad.bottom}
        stroke={color} strokeWidth={1.5} />

      {/* X-Achse Ticks + Labels */}
      {xTicks.map((t, i) => (
        <g key={i}>
          <line x1={t.svgX} y1={svgH - pad.bottom} x2={t.svgX} y2={svgH - pad.bottom + 4}
            stroke={color} strokeWidth={1} />
          <text x={t.svgX} y={svgH - pad.bottom + 14} textAnchor="middle"
            fontSize={9} fill={color}>{t.label}</text>
          {/* Gitternetz */}
          <line x1={t.svgX} y1={pad.top} x2={t.svgX} y2={svgH - pad.bottom}
            stroke={color} strokeWidth={0.3} strokeDasharray="3,3" opacity={0.4} />
        </g>
      ))}

      {/* Y-Achse Ticks + Labels */}
      {yTicks.map((t, i) => (
        <g key={i}>
          <line x1={pad.left - 4} y1={t.svgY} x2={pad.left} y2={t.svgY}
            stroke={color} strokeWidth={1} />
          <text x={pad.left - 6} y={t.svgY + 3} textAnchor="end"
            fontSize={9} fill={color}>{t.label}</text>
          <line x1={pad.left} y1={t.svgY} x2={svgW - pad.right} y2={t.svgY}
            stroke={color} strokeWidth={0.3} strokeDasharray="3,3" opacity={0.4} />
        </g>
      ))}

      {/* Achsenbeschriftungen */}
      <text x={(pad.left + svgW - pad.right) / 2} y={svgH - 2}
        textAnchor="middle" fontSize={11} fill={color} fontStyle="italic">
        {xLabel}
      </text>
      <text x={12} y={(pad.top + svgH - pad.bottom) / 2}
        textAnchor="middle" fontSize={11} fill={color} fontStyle="italic"
        transform={`rotate(-90, 12, ${(pad.top + svgH - pad.bottom) / 2})`}>
        {yLabel}
      </text>
    </g>
  )
}
