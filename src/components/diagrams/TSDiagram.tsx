import { useState } from 'react'
import type { DiagramSpec } from '../../core/types'
import { sampleCurve_ts } from '../../utils/curve-math'
import { computeTSRange, makeTSScales, computeLinearTicks } from '../../utils/diagram-scales'
import { Axes } from './shared/Axes'
import { ProcessCurve } from './shared/ProcessCurve'
import { PROCESS_COLORS } from './process-colors'
import { ReferenceLine } from './shared/ReferenceLine'
import { StatePointMarker } from './shared/StatePointMarker'
import { EnergyArrow } from './shared/EnergyArrow'
import { DirectionMarker } from './shared/DirectionMarker'

const SVG_W = 480, SVG_H = 320
const PAD = { left: 55, right: 25, top: 30, bottom: 40 }

interface TSDiagramProps { spec: DiagramSpec }

export function TSDiagram({ spec }: TSDiagramProps) {
  const [hoveredSeg, setHoveredSeg] = useState<string | null>(null)

  const range = computeTSRange(spec.statePoints)
  if (!range) return null

  const sc = makeTSScales(range, SVG_W, SVG_H, PAD)
  const pointMap = Object.fromEntries(spec.statePoints.map(pt => [pt.id, pt]))

  // ── Pre-compute segment curve data ──
  const segmentData = spec.segments.map(seg => {
    const from = pointMap[seg.from]
    const to   = pointMap[seg.to]
    if (from?.T == null || from?.s == null || to?.T == null || to?.s == null) return null

    const pts = sampleCurve_ts(
      seg.processType,
      { s: from.s, T: from.T },
      { s: to.s,   T: to.T   },
      spec.gasContext,
      60,
    )
    const svgPts = pts.map(pt => ({ x: sc.xToSVG(pt.s), y: sc.yToSVG(pt.T) }))
    const segKey = `${seg.from}-${seg.to}`
    const midIdx = Math.floor(pts.length / 2)

    return { seg, pts, svgPts, segKey, midIdx }
  }).filter((d): d is NonNullable<typeof d> => d !== null)

  // ── Layer 1: Referenzlinien (Isobaren, Isochoren) ──
  const refLines = spec.statePoints.flatMap(pt => {
    if (pt.T === null || pt.s === null) return []
    const sArr = [range.sMin, range.sMax]
    const lines = []
    if (spec.gasContext.cp) {
      const cp = spec.gasContext.cp
      const isoBarPts = sArr.map(s => ({ x: sc.xToSVG(s), y: sc.yToSVG(pt.T! * Math.exp((s - pt.s!) / cp)) }))
      lines.push(<ReferenceLine key={`isoB-${pt.id}`} points={isoBarPts} />)
    }
    if (spec.gasContext.cv) {
      const cv = spec.gasContext.cv
      const isoVolPts = sArr.map(s => ({ x: sc.xToSVG(s), y: sc.yToSVG(pt.T! * Math.exp((s - pt.s!) / cv)) }))
      lines.push(<ReferenceLine key={`isoV-${pt.id}`} points={isoVolPts} />)
    }
    return lines
  })

  // ── Layer 2: Prozesskurven ──
  const curves = segmentData.map(sd => (
    <ProcessCurve
      key={sd.segKey}
      points={sd.svgPts}
      color={PROCESS_COLORS[sd.seg.processType] ?? 'var(--accent)'}
      strokeWidth={hoveredSeg === sd.segKey ? 3 : 2}
      onHover={(h) => setHoveredSeg(h ? sd.segKey : null)}
    />
  ))

  // ── Layer 3: Richtungspfeile AUF der Kurve ──
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

  // ── Layer 4: Energiepfeile an Segment-Mittelpunkten ──
  const validPts = spec.statePoints.filter(pt => pt.T != null && pt.s != null)
  const centroidY = validPts.reduce((sum, pt) => sum + sc.yToSVG(pt.T!), 0) / validPts.length

  const energyArrows = spec.energyFlows.map((flow) => {
    if (flow.location === 'global') {
      const cx = validPts.reduce((sum, pt) => sum + sc.xToSVG(pt.s!), 0) / validPts.length
      return <EnergyArrow key={flow.label} flow={flow} x={cx} y={centroidY}
        direction={flow.value < 0 ? 'right' : 'left'} />
    }

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
  const sTicks = computeLinearTicks(range.sMin, range.sMax, 5).map(s => ({
    value: s, svgX: sc.xToSVG(s), label: s.toFixed(0),
  }))
  const TTicks = computeLinearTicks(range.TMin, range.TMax, 5).map(T => ({
    value: T, svgY: sc.yToSVG(T), label: T.toFixed(0),
  }))

  return (
    <div>
      <p className="text-xs font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>
        T-s Diagramm
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
        {/* Layer 5: Interaktive Zustandspunkte — ganz oben */}
        {spec.statePoints.map(pt => {
          if (pt.T === null || pt.s === null) return null
          return (
            <StatePointMarker
              key={pt.id} point={pt}
              svgX={sc.xToSVG(pt.s!)} svgY={sc.yToSVG(pt.T!)}
              diagramType="ts"
            />
          )
        })}
        <Axes
          svgW={SVG_W} svgH={SVG_H} pad={PAD}
          xLabel="s  [J/(kg·K)]" yLabel="T  [K]"
          xTicks={sTicks} yTicks={TTicks}
        />
      </svg>
    </div>
  )
}
