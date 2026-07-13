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
