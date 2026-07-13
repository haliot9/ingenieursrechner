import type { CurveType, DiagramGasContext } from '../core/types'

export interface Point2D { v: number; p: number }
export interface Point2D_ts { s: number; T: number }

/**
 * Exact midpoint ON the curve (t=0.5) in p-v coordinates.
 * Uses the thermodynamic law, not geometric mean of endpoints.
 */
export function curveMidpoint_pv(
  processType: CurveType,
  from: Point2D,
  to: Point2D,
  gasCtx: DiagramGasContext,
): Point2D {
  switch (processType) {
    case 'adiabatic': {
      const kappa = gasCtx.kappa ?? 1.4
      const midV = Math.sqrt(from.v * to.v)
      const C = from.p * Math.pow(from.v, kappa)
      return { v: midV, p: C / Math.pow(midV, kappa) }
    }
    case 'isothermal': {
      const midV = Math.sqrt(from.v * to.v)
      const C = from.p * from.v
      return { v: midV, p: C / midV }
    }
    case 'isobaric':
      return { v: (from.v + to.v) / 2, p: from.p }
    case 'isochoric':
      return { v: from.v, p: (from.p + to.p) / 2 }
    default:
      return { v: Math.sqrt(from.v * to.v), p: Math.sqrt(from.p * to.p) }
  }
}

/**
 * Exact midpoint ON the curve (t=0.5) in T-s coordinates.
 */
export function curveMidpoint_ts(
  processType: CurveType,
  from: Point2D_ts,
  to: Point2D_ts,
  gasCtx: DiagramGasContext,
): Point2D_ts {
  switch (processType) {
    case 'adiabatic':
      return { s: from.s, T: (from.T + to.T) / 2 }
    case 'isothermal':
      return { s: (from.s + to.s) / 2, T: from.T }
    case 'isobaric': {
      const cp = gasCtx.cp ?? 1005
      const midS = (from.s + to.s) / 2
      return { s: midS, T: from.T * Math.exp((midS - from.s) / cp) }
    }
    case 'isochoric': {
      const cv = gasCtx.cv ?? 718
      const midS = (from.s + to.s) / 2
      return { s: midS, T: from.T * Math.exp((midS - from.s) / cv) }
    }
    default:
      return { s: (from.s + to.s) / 2, T: (from.T + to.T) / 2 }
  }
}

/**
 * Berechnet N Zwischenpunkte entlang einer thermodynamischen Kurve im p-v Diagramm.
 * Logarithmisches Sampling in v fuer gleichmaessige Verteilung auf Hyperbeln.
 */
export function sampleCurve_pv(
  processType: CurveType,
  from: Point2D,
  to: Point2D,
  gasCtx: DiagramGasContext,
  numPoints = 60,
): Point2D[] {
  const pts: Point2D[] = []

  for (let i = 0; i < numPoints; i++) {
    const t = i / (numPoints - 1)

    switch (processType) {
      case 'adiabatic': {
        // p·v^kappa = C  →  log-sample v, berechne p
        // Blend C between endpoints so curve passes through BOTH exactly
        const kappa = gasCtx.kappa ?? 1.4
        const logV = Math.log(from.v) + t * (Math.log(to.v) - Math.log(from.v))
        const v = Math.exp(logV)
        const C_from = from.p * Math.pow(from.v, kappa)
        const C_to   = to.p   * Math.pow(to.v,   kappa)
        const C = C_from + t * (C_to - C_from)
        pts.push({ v, p: C / Math.pow(v, kappa) })
        break
      }
      case 'isothermal': {
        // p·v = const  →  log-sample v, berechne p
        // Blend C between endpoints for exact endpoint matching
        const logV = Math.log(from.v) + t * (Math.log(to.v) - Math.log(from.v))
        const v = Math.exp(logV)
        const C_from = from.p * from.v
        const C_to   = to.p   * to.v
        const C = C_from + t * (C_to - C_from)
        pts.push({ v, p: C / v })
        break
      }
      case 'isobaric': {
        // p = const, v linear
        const v = from.v + t * (to.v - from.v)
        pts.push({ v, p: from.p })
        break
      }
      case 'isochoric': {
        // v = const, p linear
        const p = from.p + t * (to.p - from.p)
        pts.push({ v: from.v, p })
        break
      }
      case 'polytropic': {
        // p·v^n = C  →  log-sample v, berechne p
        // n muss vom Aufrufer via opts geliefert werden — fallback auf kappa
        const n = gasCtx.kappa ?? 1.4
        const logV = Math.log(from.v) + t * (Math.log(to.v) - Math.log(from.v))
        const v = Math.exp(logV)
        const C_from = from.p * Math.pow(from.v, n)
        const C_to   = to.p   * Math.pow(to.v,   n)
        const C = C_from + t * (C_to - C_from)
        pts.push({ v, p: C / Math.pow(v, n) })
        break
      }
    }
  }
  return pts
}

/**
 * Berechnet N Zwischenpunkte entlang einer thermodynamischen Kurve im T-s Diagramm.
 */
export function sampleCurve_ts(
  processType: CurveType,
  from: Point2D_ts,
  to: Point2D_ts,
  gasCtx: DiagramGasContext,
  numPoints = 60,
): Point2D_ts[] {
  const pts: Point2D_ts[] = []

  for (let i = 0; i < numPoints; i++) {
    const t = i / (numPoints - 1)

    switch (processType) {
      case 'adiabatic': {
        // s = const (isentrop), T linear
        const T = from.T + t * (to.T - from.T)
        pts.push({ s: from.s, T })
        break
      }
      case 'isothermal': {
        // T = const, s linear
        const s = from.s + t * (to.s - from.s)
        pts.push({ s, T: from.T })
        break
      }
      case 'isobaric': {
        // T = T_ref * exp((s - s_ref) / cp)
        const cp = gasCtx.cp ?? 1005
        const s = from.s + t * (to.s - from.s)
        pts.push({ s, T: from.T * Math.exp((s - from.s) / cp) })
        break
      }
      case 'isochoric': {
        // T = T_ref * exp((s - s_ref) / cv)
        const cv = gasCtx.cv ?? 718
        const s = from.s + t * (to.s - from.s)
        pts.push({ s, T: from.T * Math.exp((s - from.s) / cv) })
        break
      }
      case 'polytropic': {
        // Linear interpolieren als Naehrung (exakter Verlauf abhaengig von n)
        const s = from.s + t * (to.s - from.s)
        const T = from.T + t * (to.T - from.T)
        pts.push({ s, T })
        break
      }
    }
  }
  return pts
}
