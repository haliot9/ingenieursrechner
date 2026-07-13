import { describe, it, expect } from 'vitest'
import { sampleCurve_pv, sampleCurve_ts } from '../../src/utils/curve-math'

describe('sampleCurve_pv', () => {
  const gasCtx = { kappa: 1.4, Rs: 287, cp: 1005, cv: 718 }

  it('adiabat: alle Punkte erfuellen p·v^kappa = const', () => {
    const from = { v: 0.5, p: 200_000 }
    const to   = { v: 1.5, p: 200_000 * Math.pow(0.5 / 1.5, 1.4) }
    const pts = sampleCurve_pv('adiabatic', from, to, gasCtx, 20)
    const C = from.p * Math.pow(from.v, 1.4)
    for (const pt of pts) {
      expect(pt.p * Math.pow(pt.v, 1.4)).toBeCloseTo(C, 0)
    }
  })

  it('isotherm: alle Punkte erfuellen p·v = const', () => {
    const from = { v: 0.5, p: 200_000 }
    const to   = { v: 1.5, p: 200_000 * 0.5 / 1.5 }
    const pts = sampleCurve_pv('isothermal', from, to, gasCtx, 20)
    const C = from.p * from.v
    for (const pt of pts) {
      expect(pt.p * pt.v).toBeCloseTo(C, 0)
    }
  })

  it('isobar: alle Punkte haben denselben Druck', () => {
    const from = { v: 0.5, p: 200_000 }
    const to   = { v: 1.5, p: 200_000 }
    const pts = sampleCurve_pv('isobaric', from, to, gasCtx, 20)
    for (const pt of pts) {
      expect(pt.p).toBeCloseTo(200_000, 0)
    }
  })

  it('isochor: alle Punkte haben dasselbe Volumen', () => {
    const from = { v: 0.5, p: 100_000 }
    const to   = { v: 0.5, p: 300_000 }
    const pts = sampleCurve_pv('isochoric', from, to, gasCtx, 20)
    for (const pt of pts) {
      expect(pt.v).toBeCloseTo(0.5, 6)
    }
  })

  it('gibt immer from als ersten und to als letzten Punkt zurueck', () => {
    const from = { v: 0.5, p: 200_000 }
    const to   = { v: 1.5, p: 200_000 * Math.pow(0.5 / 1.5, 1.4) }
    const pts = sampleCurve_pv('adiabatic', from, to, gasCtx, 10)
    expect(pts[0].v).toBeCloseTo(from.v, 6)
    expect(pts[pts.length - 1].v).toBeCloseTo(to.v, 6)
  })
})

describe('sampleCurve_ts', () => {
  const gasCtx = { kappa: 1.4, Rs: 287, cp: 1005, cv: 718 }

  it('isentrop: alle Punkte haben dasselbe s', () => {
    const from = { s: 1000, T: 300 }
    const to   = { s: 1000, T: 600 }
    const pts = sampleCurve_ts('adiabatic', from, to, gasCtx, 20)
    for (const pt of pts) {
      expect(pt.s).toBeCloseTo(1000, 6)
    }
  })

  it('isotherm: alle Punkte haben dasselbe T', () => {
    const from = { s: 500, T: 400 }
    const to   = { s: 1500, T: 400 }
    const pts = sampleCurve_ts('isothermal', from, to, gasCtx, 20)
    for (const pt of pts) {
      expect(pt.T).toBeCloseTo(400, 6)
    }
  })

  it('isobar: T = T_ref * exp((s - s_ref) / cp)', () => {
    const from = { s: 500, T: 300 }
    const to   = { s: 1500, T: 300 * Math.exp((1500 - 500) / 1005) }
    const pts = sampleCurve_ts('isobaric', from, to, gasCtx, 20)
    for (const pt of pts) {
      const expected = from.T * Math.exp((pt.s - from.s) / 1005)
      expect(pt.T).toBeCloseTo(expected, 3)
    }
  })
})
