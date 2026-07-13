# Plan: Diagram-Engine (p-v und T-s Diagramme)

Date: 2026-03-04
Goal: Moduluebergreifende SVG-Diagramme die p-v und T-s Kreisprozesse in Echtzeit rendern
Architecture: src/core/types.ts, src/utils/, src/modules/carnot/diagram.ts, src/components/diagrams/, src/App.tsx
Tech: React 19 + TypeScript, Custom SVG (keine externe Charting-Lib), Zustand Store
Status: DONE
Design-Referenz: docs/plans/2026-03-04-diagram-engine-design.md

---

## Uebersicht

Die Engine besteht aus 5 Schichten:
1. **Types** — DiagramSpec Interface in types.ts (Single Source of Truth)
2. **Pure Utils** — curve-math.ts (Kurvenberechnung) + diagram-scales.ts (SVG-Koordinaten)
3. **Modul-Adapter** — getDiagramSpec() pro Modul (carnot/diagram.ts)
4. **SVG-Komponenten** — Wiederverwendbare Primitive (Axes, Curve, Point, Arrow...)
5. **Komposition** — PVDiagram, TSDiagram, DiagramPanel → in App.tsx integriert

---

## Task 1: DiagramSpec Interfaces zu types.ts hinzufuegen

File: `src/core/types.ts`
Action: MODIFY

Steps:
1. Kein Test noetig — reine Typdefinition, kein Laufzeit-Verhalten
2. Folgende Interfaces am Ende der Datei hinzufuegen:

```typescript
// ─── Diagram Engine Types ────────────────────────────────────────────────────

export type CurveType =
  | 'adiabatic'   // p·v^kappa = const  (p-v: steile Hyperbel)
  | 'isothermal'  // p·v = const        (p-v: flache Hyperbel)
  | 'isobaric'    // p = const          (p-v: Horizontale)
  | 'isochoric'   // v = const          (p-v: Vertikale)
  | 'polytropic'  // p·v^n = const      (p-v: zwischen adiabat und isotherm)

export interface DiagramStatePoint {
  id: string           // "1", "2", "2a" — frei waehlbar
  label: string        // Anzeige-Label, z.B. "Z\u2081"
  p: number | null     // Druck [Pa]
  v: number | null     // Spez. Volumen [m\u00b3/kg]
  T: number | null     // Temperatur [K]
  s: number | null     // Spez. Entropie [J/(kg\u00b7K)]
}

export interface DiagramSegment {
  from: string         // DiagramStatePoint.id
  to: string           // DiagramStatePoint.id
  processType: CurveType
  n?: number           // Polytropenexponent (nur bei 'polytropic')
  label?: string       // z.B. "1\u21922 isentrop"
}

export interface DiagramEnergyFlow {
  type: 'heat' | 'work'
  value: number        // > 0 = rein (Zufuhr), < 0 = raus (Abfuhr)
  label: string        // LaTeX-Label z.B. "q_{zu}"
  location: string     // Segment-Ref "1-2" oder "global"
}

export interface DiagramGasContext {
  kappa: number | null
  Rs: number | null
  cp: number | null
  cv: number | null
}

export interface DiagramSpec {
  statePoints: DiagramStatePoint[]
  segments: DiagramSegment[]
  energyFlows: DiagramEnergyFlow[]
  gasContext: DiagramGasContext
  processDirection: 'clockwise' | 'counterclockwise' | null
}
```

3. `CalculatorModule` Interface um optionales Feld erweitern:

```typescript
// In der bestehenden CalculatorModule-Definition ergaenzen:
export interface CalculatorModule {
  id: string
  name: string
  description: string
  icon?: string
  variables: Variable[]
  formulas: Formula[]
  processes?: ProcessType[]
  groups: string[]
  /** Optional: liefert Diagramm-Daten fuer p-v und T-s Darstellung */
  getDiagramSpec?: (values: Record<string, VariableState>) => DiagramSpec | null
}
```

4. TypeScript-Fehler pruefen: `npm run build` — muss 0 Fehler haben

---

## Task 2: curve-math.ts — p-v Kurvenberechnung

File: `src/utils/curve-math.ts`
Action: CREATE

Steps:
1. Test-Datei erstellen `tests/utils/curve-math.test.ts` mit folgendem Inhalt:

```typescript
import { describe, it, expect } from 'vitest'
import { sampleCurve_pv } from '../../src/utils/curve-math'

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
```

2. `npm test -- curve-math` ausfuehren — muss fehlschlagen (Datei existiert nicht)
3. Implementierung erstellen:

```typescript
import type { CurveType, DiagramGasContext } from '../core/types'

export interface Point2D { v: number; p: number }
export interface Point2D_ts { s: number; T: number }

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
        const kappa = gasCtx.kappa ?? 1.4
        const logV = Math.log(from.v) + t * (Math.log(to.v) - Math.log(from.v))
        const v = Math.exp(logV)
        const C = from.p * Math.pow(from.v, kappa)
        pts.push({ v, p: C / Math.pow(v, kappa) })
        break
      }
      case 'isothermal': {
        // p·v = const  →  log-sample v, berechne p
        const logV = Math.log(from.v) + t * (Math.log(to.v) - Math.log(from.v))
        const v = Math.exp(logV)
        const C = from.p * from.v
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
        const C = from.p * Math.pow(from.v, n)
        pts.push({ v, p: C / Math.pow(v, n) })
        break
      }
    }
  }
  return pts
}
```

4. `npm test -- curve-math` — alle 5 Tests gruen

---

## Task 3: curve-math.ts — T-s Kurvenberechnung ergaenzen

File: `src/utils/curve-math.ts`
Action: MODIFY

Steps:
1. Zur Test-Datei `tests/utils/curve-math.test.ts` hinzufuegen:

```typescript
import { sampleCurve_ts } from '../../src/utils/curve-math'

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
```

2. Test fehlschlaegt — Funktion noch nicht vorhanden
3. Zur `curve-math.ts` hinzufuegen:

```typescript
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
```

4. `npm test -- curve-math` — alle 8 Tests gruen

---

## Task 4: diagram-scales.ts — Range-Berechnung und SVG-Koordinatentransformation

File: `src/utils/diagram-scales.ts`
Action: CREATE

Steps:
1. Test-Datei `tests/utils/diagram-scales.test.ts`:

```typescript
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
    expect(r.pMin).toBeLessThanOrEqual(100_000)
    expect(r.pMax).toBeGreaterThanOrEqual(400_000)
    expect(r.vMin).toBeLessThanOrEqual(0.2)
    expect(r.vMax).toBeGreaterThanOrEqual(2.0)
  })

  it('gibt null zurueck wenn keine gueltigen Punkte vorhanden', () => {
    const empty: DiagramStatePoint[] = [
      { id: '1', label: 'Z1', p: null, v: null, T: null, s: null }
    ]
    expect(computePVRange(empty)).toBeNull()
  })
})

describe('makePVScales', () => {
  it('mappt vMin auf linken Rand und vMax auf rechten Rand', () => {
    const range = computePVRange(pts)!
    const scales = makePVScales(range, 400, 280, { left: 50, right: 20, top: 15, bottom: 40 })
    // v_min → x = PAD.left, v_max → x = W - PAD.right
    expect(scales.xToSVG(range.vMin)).toBeCloseTo(50, 0)
    expect(scales.xToSVG(range.vMax)).toBeCloseTo(380, 0)
  })
})
```

2. Test fehlschlaegt
3. Implementierung:

```typescript
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
  // Finde Zehnerpotenz-Ticks im Bereich
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
```

4. `npm test -- diagram-scales` — alle Tests gruen

---

## Task 5: Carnot Diagram-Adapter erstellen + in index.ts registrieren

Files:
- `src/modules/carnot/diagram.ts` — CREATE
- `src/modules/carnot/index.ts` — MODIFY

Steps:
1. Test-Datei `tests/modules/carnot/diagram.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import { getCarnotDiagramSpec } from '../../../src/modules/carnot/diagram'
import type { VariableState } from '../../../src/core/types'

function makeVal(value: number): VariableState {
  return { value, unit: '', isUserInput: false, isComputed: true }
}

// Realistischer Carnot-Zustand (Luft, T1=300K, T3=600K)
const values: Record<string, VariableState> = {
  p1: makeVal(100_000), v1: makeVal(0.861), T1: makeVal(300), s1: makeVal(1000),
  p2: makeVal(400_000), v2: makeVal(0.430), T2: makeVal(600), s2: makeVal(1000),
  p3: makeVal(400_000), v3: makeVal(1.721), T3: makeVal(600), s3: makeVal(1500),
  p4: makeVal(100_000), v4: makeVal(3.443), T4: makeVal(300), s4: makeVal(1500),
  q_in:    makeVal(300_000),
  q_out:   makeVal(-150_000),
  w_netto: makeVal(-150_000),
  kappa:   makeVal(1.4),
  Rs:      makeVal(287),
  cp:      makeVal(1005),
  cv:      makeVal(718),
}

describe('getCarnotDiagramSpec', () => {
  const spec = getCarnotDiagramSpec(values)!

  it('gibt nicht null zurueck wenn alle 4 Zustandspunkte vorhanden', () => {
    expect(spec).not.toBeNull()
  })

  it('hat genau 4 StatePoints', () => {
    expect(spec.statePoints).toHaveLength(4)
  })

  it('hat genau 4 Segments', () => {
    expect(spec.segments).toHaveLength(4)
  })

  it('Segments haben korrekten processType', () => {
    expect(spec.segments[0].processType).toBe('adiabatic')  // 1→2
    expect(spec.segments[1].processType).toBe('isothermal') // 2→3
    expect(spec.segments[2].processType).toBe('adiabatic')  // 3→4
    expect(spec.segments[3].processType).toBe('isothermal') // 4→1
  })

  it('processDirection ist clockwise (w_netto < 0)', () => {
    expect(spec.processDirection).toBe('clockwise')
  })

  it('EnergyFlows enthalten q_in, q_out und w_netto', () => {
    const labels = spec.energyFlows.map(f => f.label)
    expect(labels).toContain('q_{zu}')
    expect(labels).toContain('q_{ab}')
    expect(labels).toContain('w_{netto}')
  })

  it('gibt null zurueck wenn weniger als 2 Zustandspunkte vollstaendig', () => {
    const sparse = { p1: makeVal(100_000) }
    expect(getCarnotDiagramSpec(sparse)).toBeNull()
  })
})
```

2. Test fehlschlaegt (Datei nicht vorhanden)
3. `src/modules/carnot/diagram.ts` erstellen:

```typescript
import type { VariableState, DiagramSpec, DiagramStatePoint } from '../../core/types'

function get(values: Record<string, VariableState>, id: string): number | null {
  return values[id]?.value ?? null
}

export function getCarnotDiagramSpec(
  values: Record<string, VariableState>,
): DiagramSpec | null {
  const statePoints: DiagramStatePoint[] = [
    { id: '1', label: 'Z\u2081', p: get(values, 'p1'), v: get(values, 'v1'), T: get(values, 'T1'), s: get(values, 's1') },
    { id: '2', label: 'Z\u2082', p: get(values, 'p2'), v: get(values, 'v2'), T: get(values, 'T2'), s: get(values, 's2') },
    { id: '3', label: 'Z\u2083', p: get(values, 'p3'), v: get(values, 'v3'), T: get(values, 'T3'), s: get(values, 's3') },
    { id: '4', label: 'Z\u2084', p: get(values, 'p4'), v: get(values, 'v4'), T: get(values, 'T4'), s: get(values, 's4') },
  ]

  // Mindestens 2 Punkte mit v und p fuer p-v Diagramm oder T und s fuer T-s
  const pvReady = statePoints.filter(pt => pt.p !== null && pt.v !== null).length >= 2
  const tsReady = statePoints.filter(pt => pt.T !== null && pt.s !== null).length >= 2
  if (!pvReady && !tsReady) return null

  const segments = [
    { from: '1', to: '2', processType: 'adiabatic'  as const, label: '1\u21922 isentrop' },
    { from: '2', to: '3', processType: 'isothermal' as const, label: '2\u21923 isotherm' },
    { from: '3', to: '4', processType: 'adiabatic'  as const, label: '3\u21924 isentrop' },
    { from: '4', to: '1', processType: 'isothermal' as const, label: '4\u21921 isotherm' },
  ]

  const qIn    = get(values, 'q_in')
  const qOut   = get(values, 'q_out')
  const wNetto = get(values, 'w_netto')

  const energyFlows = [
    ...(qIn    !== null ? [{ type: 'heat' as const, value: qIn,    label: 'q_{zu}',    location: '2-3' }] : []),
    ...(qOut   !== null ? [{ type: 'heat' as const, value: qOut,   label: 'q_{ab}',    location: '4-1' }] : []),
    ...(wNetto !== null ? [{ type: 'work' as const, value: wNetto, label: 'w_{netto}', location: 'global' }] : []),
  ]

  const processDirection =
    wNetto === null ? null :
    wNetto < 0      ? 'clockwise' :
                      'counterclockwise'

  return {
    statePoints,
    segments,
    energyFlows,
    gasContext: {
      kappa: get(values, 'kappa'),
      Rs:    get(values, 'Rs'),
      cp:    get(values, 'cp'),
      cv:    get(values, 'cv'),
    },
    processDirection,
  }
}
```

4. `src/modules/carnot/index.ts` aktualisieren:

```typescript
import type { CalculatorModule } from '../../core/types'
import { ALL_VARIABLES, VARIABLE_GROUPS, PROCESSES } from './config'
import { CARNOT_FORMULAS } from './formulas'
import { getCarnotDiagramSpec } from './diagram'

export const carnotModule: CalculatorModule = {
  id: 'carnot',
  name: 'Carnot-Prozess',
  description: 'Berechnung thermodynamischer Zustandsgrößen für den idealen Carnot-Kreisprozess mit 4 Zuständen und verschiedenen Prozesstypen.',
  variables: ALL_VARIABLES,
  formulas: CARNOT_FORMULAS,
  processes: PROCESSES,
  groups: VARIABLE_GROUPS,
  getDiagramSpec: getCarnotDiagramSpec,
}
```

5. `npm test` — alle Tests gruen (mind. 69 + neue)

---

## Task 6: Shared SVG-Primitive — Tooltip und Axes

Files:
- `src/components/diagrams/shared/Tooltip.tsx` — CREATE
- `src/components/diagrams/shared/Axes.tsx` — CREATE

Kein Unit-Test fuer UI-Komponenten — Verifikation via `npm run dev`.

**Tooltip.tsx:**
```tsx
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
  // Position korrigieren damit Tooltip nicht aus SVG rausragt:
  // Wird vom Parent mit viewBox-Koordinaten aufgerufen
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
```

**Axes.tsx:**
```tsx
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
```

Steps:
1. Beide Dateien erstellen
2. `npm run build` — 0 TypeScript-Fehler
3. Mit `npm run dev` pruefen ob Imports funktionieren (werden in Task 10/11 eingebaut)

---

## Task 7: Shared SVG-Primitive — ProcessCurve und ReferenceLine

Files:
- `src/components/diagrams/shared/ProcessCurve.tsx` — CREATE
- `src/components/diagrams/shared/ReferenceLine.tsx` — CREATE

**ProcessCurve.tsx** — rendert ein Kurvensegment als SVG path:
```tsx
interface ProcessCurveProps {
  points: Array<{ x: number; y: number }>   // Bereits in SVG-Koordinaten
  color: string
  strokeWidth?: number
  dashed?: boolean
  onHover?: (hovered: boolean) => void
  opacity?: number
}

// Kurvenfarben nach Prozesstyp — als Konstante exportieren
export const PROCESS_COLORS: Record<string, string> = {
  adiabatic:  'var(--accent)',        // Blau
  isothermal: '#f59e0b',             // Amber
  isobaric:   '#10b981',             // Gruen
  isochoric:  '#8b5cf6',             // Lila
  polytropic: '#ec4899',             // Pink
}

export function ProcessCurve({ points, color, strokeWidth = 2, dashed, onHover, opacity = 1 }: ProcessCurveProps) {
  if (points.length < 2) return null
  const d = points.map((pt, i) => `${i === 0 ? 'M' : 'L'} ${pt.x.toFixed(1)} ${pt.y.toFixed(1)}`).join(' ')
  return (
    <path
      d={d}
      fill="none"
      stroke={color}
      strokeWidth={strokeWidth}
      strokeDasharray={dashed ? '6,4' : undefined}
      opacity={opacity}
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{ transition: 'all 0.3s ease', cursor: onHover ? 'pointer' : 'default' }}
      onMouseEnter={() => onHover?.(true)}
      onMouseLeave={() => onHover?.(false)}
    />
  )
}
```

**ReferenceLine.tsx** — gestrichelte Hintergrundlinie:
```tsx
interface ReferenceLineProps {
  points: Array<{ x: number; y: number }>
  opacity?: number
}

export function ReferenceLine({ points, opacity = 0.15 }: ReferenceLineProps) {
  if (points.length < 2) return null
  const d = points.map((pt, i) => `${i === 0 ? 'M' : 'L'} ${pt.x.toFixed(1)} ${pt.y.toFixed(1)}`).join(' ')
  return (
    <path d={d} fill="none" stroke="currentColor"
      strokeWidth={1} strokeDasharray="4,4" opacity={opacity} />
  )
}
```

Steps:
1. Beide Dateien erstellen
2. `npm run build` — 0 TypeScript-Fehler

---

## Task 8: Shared SVG-Primitive — StatePointMarker mit Hover-Tooltip

File: `src/components/diagrams/shared/StatePointMarker.tsx`
Action: CREATE

```tsx
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
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
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
```

Steps:
1. Datei erstellen
2. `npm run build` — 0 TypeScript-Fehler

---

## Task 9: Shared SVG-Primitive — EnergyArrow und DirectionMarker

Files:
- `src/components/diagrams/shared/EnergyArrow.tsx` — CREATE
- `src/components/diagrams/shared/DirectionMarker.tsx` — CREATE

**EnergyArrow.tsx** — Pfeil fuer Waerme-/Arbeitsfluesse:
```tsx
import type { DiagramEnergyFlow } from '../../../core/types'

interface EnergyArrowProps {
  flow: DiagramEnergyFlow
  /** Ankerpunkt (Mitte der Kurve oder Diagramm-Zentrum) */
  anchorX: number
  anchorY: number
}

export function EnergyArrow({ flow, anchorX, anchorY }: EnergyArrowProps) {
  // Waerme=orange, Arbeit=blau
  const color = flow.type === 'heat' ? '#f59e0b' : 'var(--accent)'
  // Positive value = rein = Pfeil NACH INNEN (von aussen zum Anchor)
  // Negative value = raus = Pfeil NACH AUSSEN (vom Anchor nach aussen)
  const isIn = flow.value > 0
  const arrowLen = 24
  // Standardmaessig nach oben (heat in) oder unten (heat out)
  // Arbeit zeigt seitlich
  const angle = flow.type === 'work' ? (isIn ? 180 : 0) : (isIn ? 270 : 90)
  const rad = (angle * Math.PI) / 180
  const dx = Math.cos(rad) * arrowLen
  const dy = Math.sin(rad) * arrowLen
  const x1 = isIn ? anchorX - dx : anchorX
  const y1 = isIn ? anchorY - dy : anchorY
  const x2 = isIn ? anchorX : anchorX + dx
  const y2 = isIn ? anchorY : anchorY + dy

  return (
    <g>
      <defs>
        <marker id={`arrow-${flow.label}`} markerWidth="6" markerHeight="6"
          refX="3" refY="3" orient="auto">
          <path d="M0,0 L6,3 L0,6 Z" fill={color} />
        </marker>
      </defs>
      <line x1={x1} y1={y1} x2={x2} y2={y2}
        stroke={color} strokeWidth={2}
        markerEnd={`url(#arrow-${flow.label})`}
        style={{ transition: 'all 0.3s ease' }}
      />
    </g>
  )
}
```

**DirectionMarker.tsx** — Kleiner Pfeil an Kurve der Umlaufrichtung anzeigt:
```tsx
interface DirectionMarkerProps {
  /** Mittelpunkt der Kurve in SVG-Koordinaten */
  x: number
  y: number
  /** Tangenten-Winkel an diesem Punkt in Grad */
  angleDeg: number
  color: string
}

export function DirectionMarker({ x, y, angleDeg, color }: DirectionMarkerProps) {
  return (
    <g transform={`translate(${x}, ${y}) rotate(${angleDeg})`}>
      <path d="M-5,-4 L5,0 L-5,4 Z" fill={color} opacity={0.8} />
    </g>
  )
}
```

Steps:
1. Beide Dateien erstellen
2. `npm run build` — 0 TypeScript-Fehler

---

## Task 10: PVDiagram.tsx zusammensetzen

File: `src/components/diagrams/PVDiagram.tsx`
Action: CREATE

```tsx
import { useState } from 'react'
import type { DiagramSpec } from '../../core/types'
import { sampleCurve_pv } from '../../utils/curve-math'
import { computePVRange, makePVScales, computeLogTicks } from '../../utils/diagram-scales'
import { Axes } from './shared/Axes'
import { ProcessCurve, PROCESS_COLORS } from './shared/ProcessCurve'
import { ReferenceLine } from './shared/ReferenceLine'
import { StatePointMarker } from './shared/StatePointMarker'
import { EnergyArrow } from './shared/EnergyArrow'
import { DirectionMarker } from './shared/DirectionMarker'

const SVG_W = 480, SVG_H = 300
const PAD = { left: 55, right: 20, top: 15, bottom: 40 }

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

  // Kurven-Segmente rendern
  const curves = spec.segments
    .map(seg => {
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
      return (
        <ProcessCurve
          key={segKey}
          points={svgPts}
          color={PROCESS_COLORS[seg.processType] ?? 'var(--accent)'}
          strokeWidth={hoveredSeg === segKey ? 3 : 2}
          onHover={(h) => setHoveredSeg(h ? segKey : null)}
        />
      )
    })
    .filter(Boolean)

  // Richtungspfeile: Mitte jedes Segments
  const dirMarkers = spec.processDirection
    ? spec.segments.map(seg => {
        const from = pointMap[seg.from]
        const to   = pointMap[seg.to]
        if (!from?.p || !from?.v || !to?.p || !to?.v) return null
        const midV = Math.sqrt(from.v * to.v)  // logarithmischer Mittelpunkt
        const midP = Math.pow(10, (Math.log10(from.p) + Math.log10(to.p)) / 2)
        const mx = sc.xToSVG(midV)
        const my = sc.yToSVG(midP)
        // Tangenten-Winkel: Richtung der Kurve an diesem Punkt
        // Einfache Naherung: Winkel from→to in SVG-Koords
        const ax = sc.xToSVG(to.v) - sc.xToSVG(from.v)
        const ay = sc.yToSVG(to.p) - sc.yToSVG(from.p)
        const angle = (Math.atan2(ay, ax) * 180) / Math.PI + (spec.processDirection === 'counterclockwise' ? 180 : 0)
        return (
          <DirectionMarker key={`dir-${seg.from}-${seg.to}`}
            x={mx} y={my} angleDeg={angle}
            color={PROCESS_COLORS[seg.processType] ?? 'var(--accent)'} />
        )
      }).filter(Boolean)
    : []

  // Referenzlinien durch jeden Zustandspunkt (dezent)
  const refLines = spec.statePoints.flatMap(pt => {
    if (pt.v === null || pt.p === null) return []
    const lines = []
    // Isotherme durch diesen Punkt (isotherm: p·v = const)
    const vRange = [range.vMin, range.vMax]
    const isoThermPts = vRange.map(v => ({ x: sc.xToSVG(v), y: sc.yToSVG(pt.p! * pt.v! / v) }))
    lines.push(<ReferenceLine key={`iso-T-${pt.id}`} points={isoThermPts} />)
    // Isentrope durch diesen Punkt (adiabat: p·v^k = const)
    if (spec.gasContext.kappa) {
      const k = spec.gasContext.kappa
      const C = pt.p * Math.pow(pt.v, k)
      const isenPts = vRange.map(v => ({ x: sc.xToSVG(v), y: sc.yToSVG(C / Math.pow(v, k)) }))
      lines.push(<ReferenceLine key={`iso-s-${pt.id}`} points={isenPts} />)
    }
    return lines
  })

  // Ticks fuer Achsen
  const vTicks = computeLogTicks(range.vMin, range.vMax, 5).map(v => ({
    value: v, svgX: sc.xToSVG(v), label: formatTick(v),
  }))
  const pTicks = computeLogTicks(range.pMin, range.pMax, 5).map(p => ({
    value: p, svgY: sc.yToSVG(p), label: formatTick(p),
  }))

  // Energie-Pfeile: nur am Diagramm-Zentrum wenn location='global', sonst Segment-Mitte
  const plotCx = (PAD.left + SVG_W - PAD.right) / 2
  const plotCy = (PAD.top + SVG_H - PAD.bottom) / 2
  const energyArrows = spec.energyFlows.map((flow, i) => (
    <EnergyArrow key={i} flow={flow} anchorX={plotCx} anchorY={plotCy - i * 30} />
  ))

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
```

Steps:
1. Datei erstellen
2. `npm run build` — 0 TypeScript-Fehler
3. `npm run dev` — Seite laden, Carnot-Werte eingeben → p-v Diagramm erscheint

---

## Task 11: TSDiagram.tsx zusammensetzen

File: `src/components/diagrams/TSDiagram.tsx`
Action: CREATE

Analog zu PVDiagram, aber mit T-s Koordinaten:

```tsx
import { useState } from 'react'
import type { DiagramSpec } from '../../core/types'
import { sampleCurve_ts } from '../../utils/curve-math'
import { computeTSRange, makeTSScales, computeLinearTicks } from '../../utils/diagram-scales'
import { Axes } from './shared/Axes'
import { ProcessCurve, PROCESS_COLORS } from './shared/ProcessCurve'
import { ReferenceLine } from './shared/ReferenceLine'
import { StatePointMarker } from './shared/StatePointMarker'
import { EnergyArrow } from './shared/EnergyArrow'
import { DirectionMarker } from './shared/DirectionMarker'

const SVG_W = 480, SVG_H = 300
const PAD = { left: 55, right: 20, top: 15, bottom: 40 }

interface TSDiagramProps { spec: DiagramSpec }

export function TSDiagram({ spec }: TSDiagramProps) {
  const [hoveredSeg, setHoveredSeg] = useState<string | null>(null)

  const range = computeTSRange(spec.statePoints)
  if (!range) return null

  const sc = makeTSScales(range, SVG_W, SVG_H, PAD)
  const pointMap = Object.fromEntries(spec.statePoints.map(pt => [pt.id, pt]))

  const curves = spec.segments
    .map(seg => {
      const from = pointMap[seg.from]
      const to   = pointMap[seg.to]
      if (from?.T === null || from?.s === null || to?.T === null || to?.s === null) return null
      const pts = sampleCurve_ts(
        seg.processType,
        { s: from.s!, T: from.T! },
        { s: to.s!,   T: to.T!   },
        spec.gasContext,
        60,
      )
      const svgPts = pts.map(pt => ({ x: sc.xToSVG(pt.s), y: sc.yToSVG(pt.T) }))
      const segKey = `${seg.from}-${seg.to}`
      return (
        <ProcessCurve
          key={segKey} points={svgPts}
          color={PROCESS_COLORS[seg.processType] ?? 'var(--accent)'}
          strokeWidth={hoveredSeg === segKey ? 3 : 2}
          onHover={(h) => setHoveredSeg(h ? segKey : null)}
        />
      )
    })
    .filter(Boolean)

  // Referenzlinien: Isobaren und Isochoren durch jeden Punkt im T-s Diagramm
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

  const sTicks = computeLinearTicks(range.sMin, range.sMax, 5).map(s => ({
    value: s, svgX: sc.xToSVG(s), label: s.toFixed(0),
  }))
  const TTicks = computeLinearTicks(range.TMin, range.TMax, 5).map(T => ({
    value: T, svgY: sc.yToSVG(T), label: T.toFixed(0),
  }))

  const dirMarkers = spec.processDirection
    ? spec.segments.map(seg => {
        const from = pointMap[seg.from]
        const to   = pointMap[seg.to]
        if (from?.T === null || from?.s === null || to?.T === null || to?.s === null) return null
        const midS = (from.s! + to.s!) / 2
        const midT = (from.T! + to.T!) / 2
        const ax = sc.xToSVG(to.s!) - sc.xToSVG(from.s!)
        const ay = sc.yToSVG(to.T!) - sc.yToSVG(from.T!)
        const angle = (Math.atan2(ay, ax) * 180) / Math.PI + (spec.processDirection === 'counterclockwise' ? 180 : 0)
        return (
          <DirectionMarker key={`dir-${seg.from}-${seg.to}`}
            x={sc.xToSVG(midS)} y={sc.yToSVG(midT)} angleDeg={angle}
            color={PROCESS_COLORS[seg.processType] ?? 'var(--accent)'} />
        )
      }).filter(Boolean)
    : []

  const plotCx = (PAD.left + SVG_W - PAD.right) / 2
  const plotCy = (PAD.top + SVG_H - PAD.bottom) / 2
  const energyArrows = spec.energyFlows.map((flow, i) => (
    <EnergyArrow key={i} flow={flow} anchorX={plotCx} anchorY={plotCy - i * 30} />
  ))

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
```

Steps:
1. Datei erstellen
2. `npm run build` — 0 TypeScript-Fehler
3. `npm run dev` — Carnot-Werte eingeben → T-s Diagramm zeigt Rechteck

---

## Task 12: DiagramPanel.tsx — Container der beide Diagramme verbindet

File: `src/components/diagrams/DiagramPanel.tsx`
Action: CREATE

```tsx
import { useCalculatorStore } from '../../store/calculator-store'
import { PVDiagram } from './PVDiagram'
import { TSDiagram } from './TSDiagram'

export function DiagramPanel() {
  const { module, values } = useCalculatorStore()

  // Modul hat keinen Adapter → keine Diagramme
  if (!module?.getDiagramSpec) return null

  const spec = module.getDiagramSpec(values)
  if (!spec) return null

  // Pruefe ob genuegend Daten vorhanden fuer min. ein Diagramm
  const pvReady = spec.statePoints.filter(pt => pt.p !== null && pt.v !== null).length >= 2
  const tsReady = spec.statePoints.filter(pt => pt.T !== null && pt.s !== null).length >= 2
  if (!pvReady && !tsReady) return null

  return (
    <div className="space-y-3">
      {pvReady && <PVDiagram spec={spec} />}
      {tsReady && <TSDiagram spec={spec} />}
    </div>
  )
}
```

Steps:
1. Datei erstellen
2. `npm run build` — 0 TypeScript-Fehler

---

## Task 13: DiagramPanel in App.tsx integrieren

File: `src/App.tsx`
Action: MODIFY

Rechte Spalte um `DiagramPanel` oberhalb von `ErrorDisplay` ergaenzen:

```tsx
// Import hinzufuegen:
import { DiagramPanel } from './components/diagrams/DiagramPanel'

// In der rechten Spalte (Zeile ~65), VOR ErrorDisplay einfuegen:
<div className="space-y-4">
  <DiagramPanel />           {/* NEU */}
  <ErrorDisplay errors={errors} />
  <StepDisplay steps={steps} />
</div>
```

Steps:
1. Import und Komponente einbauen
2. `npm run build` — 0 TypeScript-Fehler
3. `npm run dev` — Kompletten Carnot-Test-Case eingeben:
   - T1=300K, T3=600K, p2=4bar, p3=4bar, Rs=287, kappa=1.4
   - Beide Diagramme erscheinen in der rechten Spalte
   - p-v: Korrekte Hyperbeln, Zustandspunkte Z1-Z4
   - T-s: Rechteck (isentrope Vertikale + isotherme Horizontale)
   - Hover auf Punkt → Tooltip mit Werten
   - Energiepfeile sichtbar

---

## Task 14: README fuer die Diagram-Engine

File: `src/components/diagrams/README.md`
Action: CREATE

Enthaelt:
1. **Zweck:** Was ist die Diagram-Engine, warum existiert sie
2. **DiagramSpec erklaert:** Jedes Feld mit Beispiel
3. **Wie man einen Adapter schreibt:** Schritt-fuer-Schritt (mit Carnot als Referenz)
4. **CurveTypes und ihre Formeln:** Tabelle wie im Design-Dokument
5. **SVG-Koordinatensystem:** Wie PAD, viewBox, Scale-Funktionen zusammenhaengen
6. **Bekannte Einschraenkungen:**
   - Polytrope Overlay (mittlere Wirklinie) noch nicht implementiert → Design-Referenz
   - EnergyArrow-Positionierung bei Segment-location noch nicht implementiert
     (aktuell immer an Diagramm-Mitte, location='global' wird verwendet)
   - Sehr kleine Wertebereiche koennen Log-Scale-Fehler erzeugen (z.B. wenn alle v identisch)
7. **Dateistruktur-Referenz**

---

## Abschliessende Checks

Nach Task 14:
```bash
npm test        # Alle Tests inkl. curve-math, diagram-scales, carnot/diagram
npm run build   # 0 TypeScript-Fehler, 0 Build-Fehler
npm run dev     # Manuelle Sichtkontrolle (siehe Task 13 Schritt 3)
```

---

## Checklist

- [x] Task 1: DiagramSpec Interfaces in types.ts
- [x] Task 2: curve-math.ts — sampleCurve_pv (4 Kurventypen)
- [x] Task 3: curve-math.ts — sampleCurve_ts (3 Kurventypen)
- [x] Task 4: diagram-scales.ts — Range + SVG-Scale-Funktionen
- [x] Task 5: carnot/diagram.ts + index.ts Registrierung
- [x] Task 6: shared/Tooltip.tsx + shared/Axes.tsx
- [x] Task 7: shared/ProcessCurve.tsx + shared/ReferenceLine.tsx
- [x] Task 8: shared/StatePointMarker.tsx mit Hover
- [x] Task 9: shared/EnergyArrow.tsx + shared/DirectionMarker.tsx
- [x] Task 10: PVDiagram.tsx (p-v Rendering)
- [x] Task 11: TSDiagram.tsx (T-s Rendering)
- [x] Task 12: DiagramPanel.tsx (Container)
- [x] Task 13: App.tsx Integration
- [x] Task 14: src/components/diagrams/README.md
- [x] Alle bestehenden Tests noch gruen (90/90 passed)
- [x] npm run build erfolgreich (0 TS-Fehler)
- [x] Manuelle Sichtkontrolle: Carnot-Werte eingeben → beide Diagramme korrekt
