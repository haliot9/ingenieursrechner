import { useState } from 'react'
import type { DiagramSpec } from '../../core/types'
import { sampleCurve_pv } from '../../utils/curve-math'
import { computePVRange, makePVScales, computeLogTicks } from '../../utils/diagram-scales'
import { Axes } from './shared/Axes'
import { ProcessCurve } from './shared/ProcessCurve'
import { PROCESS_COLORS } from './process-colors'
import { ReferenceLine } from './shared/ReferenceLine'
import { StatePointMarker } from './shared/StatePointMarker'
import { EnergyArrow } from './shared/EnergyArrow'
import { DirectionMarker } from './shared/DirectionMarker'

const SVG_W = 480, SVG_H = 320
const PAD = { left: 55, right: 25, top: 30, bottom: 40 }

function formatTick(v: number): string {
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(0)}M`
  if (v >= 1_000)     return `${(v / 1_000).toFixed(0)}k`
  return v.toFixed(2)
}

interface PVDiagramProps { spec: DiagramSpec }

export function PVDiagram({ spec }: PVDiagramProps) {
  const [hoveredSeg, setHoveredSeg] = useState<string | null>(null)

  const range = computePVRange(spec.statePoints)
  if (!range) return null

  const sc = makePVScales(range, SVG_W, SVG_H, PAD)
  const pointMap = Object.fromEntries(spec.statePoints.map(pt => [pt.id, pt]))

  // ── Pre-compute segment curve data (single source for curves, markers, arrows) ──
  const segmentData = spec.segments.map(seg => {
    const from = pointMap[seg.from]
    const to   = pointMap[seg.to]
    if (!from?.p || !from?.v || !to?.p || !to?.v) return null

    const pts = sampleCurve_pv(
      seg.processType,
      { v: from.v, p: from.p },
      { v: to.v,   p: to.p   },
      spec.gasContext,
      60,
    )
    const svgPts = pts.map(pt => ({ x: sc.xToSVG(pt.v), y: sc.yToSVG(pt.p) }))
    const segKey = `${seg.from}-${seg.to}`
    const midIdx = Math.floor(pts.length / 2)

    return { seg, pts, svgPts, segKey, midIdx }
  }).filter((d): d is NonNullable<typeof d> => d !== null)

  // ── Layer 1: Referenzlinien (dezent im Hintergrund) ──
  const refLines = spec.statePoints.flatMap(pt => {
    if (pt.v === null || pt.p === null) return []
    const lines = []
    const vRange = [range.vMin, range.vMax]
    const isoThermPts = vRange.map(v => ({ x: sc.xToSVG(v), y: sc.yToSVG(pt.p! * pt.v! / v) }))
    lines.push(<ReferenceLine key={`iso-T-${pt.id}`} points={isoThermPts} />)
    if (spec.gasContext.kappa) {
      const k = spec.gasContext.kappa
      const C = pt.p * Math.pow(pt.v, k)
      const isenPts = vRange.map(v => ({ x: sc.xToSVG(v), y: sc.yToSVG(C / Math.pow(v, k)) }))
      lines.push(<ReferenceLine key={`iso-s-${pt.id}`} points={isenPts} />)
    }
    return lines
  })

  // ── Layer 2: Prozesskurven (mathematisch definiert) ──
  const curves = segmentData.map(sd => (
    <ProcessCurve
      key={sd.segKey}
      points={sd.svgPts}
      color={PROCESS_COLORS[sd.seg.processType] ?? 'var(--accent)'}
      strokeWidth={hoveredSeg === sd.segKey ? 3 : 2}
      onHover={(h) => setHoveredSeg(h ? sd.segKey : null)}
    />
  ))

  // ── Layer 3: Richtungspfeile AUF der Kurve (Tangente aus benachbarten Samples) ──
  const dirMarkers = spec.processDirection
    ? segmentData.map(sd => {
        const mid    = sd.svgPts[sd.midIdx]
        const before = sd.svgPts[Math.max(0, sd.midIdx - 1)]
        const after  = sd.svgPts[Math.min(sd.svgPts.length - 1, sd.midIdx + 1)]
        const angle = (Math.atan2(after.y - before.y, after.x - before.x) * 180) / Math.PI
          + (spec.processDirection === 'counterclockwise' ? 180 : 0)
        return (
          <DirectionMarker key={`dir-${sd.segKey}`}
            x={mid.x} y={mid.y} angleDeg={angle}
            color={PROCESS_COLORS[sd.seg.processType] ?? 'var(--accent)'} />
        )
      })
    : []

  // ── Layer 4: Energiepfeile an Segment-Mittelpunkten (CAD-Zwangsbedingung) ──
  const validPts = spec.statePoints.filter(pt => pt.p != null && pt.v != null)
  const centroidY = validPts.reduce((sum, pt) => sum + sc.yToSVG(pt.p!), 0) / validPts.length

  const energyArrows = spec.energyFlows.map((flow) => {
    if (flow.location === 'global') {
      // Work arrow: inside the cycle area (enclosed area = net work)
      const cx = validPts.reduce((sum, pt) => sum + sc.xToSVG(pt.v!), 0) / validPts.length
      return <EnergyArrow key={flow.label} flow={flow} x={cx} y={centroidY}
        direction={flow.value < 0 ? 'right' : 'left'} />
    }

    // Heat arrows: at segment midpoint, offset away from cycle interior
    const sd = segmentData.find(d => d.segKey === flow.location)
    if (!sd) return null

    const midSVG = sd.svgPts[sd.midIdx]
    const offset = 25
    const isAboveCenter = midSVG.y < centroidY

    return <EnergyArrow
      key={flow.label}
      flow={flow}
      x={midSVG.x}
      y={isAboveCenter ? midSVG.y - offset : midSVG.y + offset}
      direction="down"
    />
  }).filter(Boolean)

  // ── Achsen-Ticks ──
  const vTicks = computeLogTicks(range.vMin, range.vMax, 5).map(v => ({
    value: v, svgX: sc.xToSVG(v), label: formatTick(v),
  }))
  const pTicks = computeLogTicks(range.pMin, range.pMax, 5).map(p => ({
    value: p, svgY: sc.yToSVG(p), label: formatTick(p),
  }))

  return (
    <div>
      <p className="text-xs font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>
        p-v Diagramm
      </p>
      <svg
        viewBox={`0 0 ${SVG_W} ${SVG_H}`}
        width="100%"
        style={{ display: 'block', borderRadius: '6px', background: 'var(--bg-secondary)' }}
      >
        {refLines}
        {curves}
        {dirMarkers}
        {energyArrows}
        {/* Layer 5: Interaktive Zustandspunkte (Hover-Tooltips) — ganz oben */}
        {spec.statePoints.map(pt => {
          if (pt.v === null || pt.p === null) return null
          return (
            <StatePointMarker
              key={pt.id} point={pt}
              svgX={sc.xToSVG(pt.v)} svgY={sc.yToSVG(pt.p)}
              diagramType="pv"
            />
          )
        })}
        <Axes
          svgW={SVG_W} svgH={SVG_H} pad={PAD}
          xLabel="v  [m³/kg]" yLabel="p  [Pa]"
          xTicks={vTicks} yTicks={pTicks}
        />
      </svg>
    </div>
  )
}
