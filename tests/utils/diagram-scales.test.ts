import { describe, it, expect } from 'vitest'
import { computePVRange, computeTSRange, makePVScales, makeTSScales } from '../../src/utils/diagram-scales'
import type { DiagramStatePoint } from '../../src/core/types'

const pts: DiagramStatePoint[] = [
  { id: '1', label: 'Z1', p: 100_000, v: 0.5, T: 300, s: 500 },
  { id: '2', label: 'Z2', p: 400_000, v: 0.2, T: 600, s: 500 },
  { id: '3', label: 'Z3', p: 400_000, v: 0.8, T: 600, s: 1500 },
  { id: '4', label: 'Z4', p: 100_000, v: 2.0, T: 300, s: 1500 },
]

describe('computePVRange', () => {
  it('gibt den Bereich aller gueltigen p und v Werte zurueck', () => {
    const r = computePVRange(pts)
    expect(r).not.toBeNull()
    expect(r!.pMin).toBeLessThanOrEqual(100_000)
    expect(r!.pMax).toBeGreaterThanOrEqual(400_000)
    expect(r!.vMin).toBeLessThanOrEqual(0.2)
    expect(r!.vMax).toBeGreaterThanOrEqual(2.0)
  })

  it('gibt null zurueck wenn keine gueltigen Punkte vorhanden', () => {
    const empty: DiagramStatePoint[] = [
      { id: '1', label: 'Z1', p: null, v: null, T: null, s: null }
    ]
    expect(computePVRange(empty)).toBeNull()
  })
})

describe('computeTSRange', () => {
  it('gibt den Bereich aller gueltigen T und s Werte zurueck', () => {
    const r = computeTSRange(pts)
    expect(r).not.toBeNull()
    expect(r!.TMin).toBeLessThanOrEqual(300)
    expect(r!.TMax).toBeGreaterThanOrEqual(600)
    expect(r!.sMin).toBeLessThanOrEqual(500)
    expect(r!.sMax).toBeGreaterThanOrEqual(1500)
  })

  it('gibt null zurueck wenn weniger als 2 gueltige Punkte', () => {
    const single: DiagramStatePoint[] = [
      { id: '1', label: 'Z1', p: 100_000, v: 0.5, T: 300, s: 500 }
    ]
    expect(computeTSRange(single)).toBeNull()
  })
})

describe('makePVScales', () => {
  it('mappt vMin auf linken Rand und vMax auf rechten Rand', () => {
    const range = computePVRange(pts)!
    const scales = makePVScales(range, 400, 280, { left: 50, right: 20, top: 15, bottom: 40 })
    expect(scales.xToSVG(range.vMin)).toBeCloseTo(50, 0)
    expect(scales.xToSVG(range.vMax)).toBeCloseTo(380, 0)
  })
})

describe('makeTSScales', () => {
  it('mappt sMin auf linken Rand und sMax auf rechten Rand', () => {
    const range = computeTSRange(pts)!
    const scales = makeTSScales(range, 400, 280, { left: 50, right: 20, top: 15, bottom: 40 })
    expect(scales.xToSVG(range.sMin)).toBeCloseTo(50, 0)
    expect(scales.xToSVG(range.sMax)).toBeCloseTo(380, 0)
  })
})
