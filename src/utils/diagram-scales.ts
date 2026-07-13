import type { DiagramStatePoint } from '../core/types'

export interface Range2D {
  vMin: number; vMax: number
  pMin: number; pMax: number
}

export interface Range2D_ts {
  sMin: number; sMax: number
  TMin: number; TMax: number
}

export interface SVGPadding {
  left: number; right: number; top: number; bottom: number
}

export interface PVScales {
  xToSVG: (v: number) => number    // v → SVG-x (logarithmisch)
  yToSVG: (p: number) => number    // p → SVG-y (logarithmisch, invertiert)
}

export interface TSScales {
  xToSVG: (s: number) => number    // s → SVG-x (linear)
  yToSVG: (T: number) => number    // T → SVG-y (linear, invertiert)
}

/** Faktor um den der Bereich in jede Richtung erweitert wird (log-Skala) */
const PADDING_FACTOR = 0.15

export function computePVRange(points: DiagramStatePoint[]): Range2D | null {
  const valid = points.filter(pt => pt.p !== null && pt.v !== null)
  if (valid.length < 2) return null
  const ps = valid.map(pt => pt.p as number)
  const vs = valid.map(pt => pt.v as number)
  const [pMin, pMax] = [Math.min(...ps), Math.max(...ps)]
  const [vMin, vMax] = [Math.min(...vs), Math.max(...vs)]
  // Logarithmischen Padding hinzufuegen
  const logPad = (min: number, max: number, f: number) => ({
    min: min * Math.pow(min / max, f),
    max: max * Math.pow(max / min, f),
  })
  const pp = logPad(pMin, pMax, PADDING_FACTOR)
  const vp = logPad(vMin, vMax, PADDING_FACTOR)
  return { pMin: pp.min, pMax: pp.max, vMin: vp.min, vMax: vp.max }
}

export function computeTSRange(points: DiagramStatePoint[]): Range2D_ts | null {
  const valid = points.filter(pt => pt.T !== null && pt.s !== null)
  if (valid.length < 2) return null
  const Ts = valid.map(pt => pt.T as number)
  const ss = valid.map(pt => pt.s as number)
  const [TMin, TMax] = [Math.min(...Ts), Math.max(...Ts)]
  const [sMin, sMax] = [Math.min(...ss), Math.max(...ss)]
  const pad = (min: number, max: number) => {
    const d = (max - min) * PADDING_FACTOR || Math.abs(min) * 0.1 || 1
    return { min: min - d, max: max + d }
  }
  const tp = pad(TMin, TMax)
  const sp = pad(sMin, sMax)
  return { TMin: tp.min, TMax: tp.max, sMin: sp.min, sMax: sp.max }
}

export function makePVScales(
  range: Range2D,
  svgW: number,
  svgH: number,
  pad: SVGPadding,
): PVScales {
  const plotW = svgW - pad.left - pad.right
  const plotH = svgH - pad.top - pad.bottom
  const logMap = (val: number, min: number, max: number) =>
    (Math.log(val) - Math.log(min)) / (Math.log(max) - Math.log(min))
  return {
    xToSVG: (v) => pad.left + logMap(v, range.vMin, range.vMax) * plotW,
    yToSVG: (p) => pad.top + (1 - logMap(p, range.pMin, range.pMax)) * plotH,
  }
}

export function makeTSScales(
  range: Range2D_ts,
  svgW: number,
  svgH: number,
  pad: SVGPadding,
): TSScales {
  const plotW = svgW - pad.left - pad.right
  const plotH = svgH - pad.top - pad.bottom
  const linMap = (val: number, min: number, max: number) => (val - min) / (max - min)
  return {
    xToSVG: (s) => pad.left + linMap(s, range.sMin, range.sMax) * plotW,
    yToSVG: (T) => pad.top + (1 - linMap(T, range.TMin, range.TMax)) * plotH,
  }
}

/** Berechnet N gleichmaessig verteilte Ticks fuer eine logarithmische Achse */
export function computeLogTicks(min: number, max: number, maxTicks = 5): number[] {
  const logMin = Math.ceil(Math.log10(min))
  const logMax = Math.floor(Math.log10(max))
  const ticks: number[] = []
  for (let i = logMin; i <= logMax; i++) {
    ticks.push(Math.pow(10, i))
    if (ticks.length >= maxTicks) break
  }
  return ticks.length >= 2 ? ticks : [min, max]
}

/** Berechnet N gleichmaessig verteilte Ticks fuer eine lineare Achse */
export function computeLinearTicks(min: number, max: number, maxTicks = 5): number[] {
  const step = (max - min) / (maxTicks - 1)
  return Array.from({ length: maxTicks }, (_, i) => min + i * step)
}
