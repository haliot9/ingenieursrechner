import type { DiagramSpec, DiagramStatePoint, VariableState } from '../../core/types'

function get(values: Record<string, VariableState>, id: string): number | null { return values[id]?.value ?? null }

export function getJouleDiagramSpec(values: Record<string, VariableState>): DiagramSpec | null {
  const statePoints: DiagramStatePoint[] = [1, 2, 3, 4].map(state => ({ id: String(state), label: 'Z' + String.fromCharCode(8320 + state), p: get(values, 'p' + state), v: get(values, 'v' + state), T: get(values, 'T' + state), s: get(values, 's' + state) }))
  const pvReady = statePoints.filter(point => point.p !== null && point.v !== null).length >= 2
  const tsReady = statePoints.filter(point => point.T !== null && point.s !== null).length >= 2
  if (!pvReady && !tsReady) return null
  const qIn = get(values, 'q_in'), qOut = get(values, 'q_out'), wNetto = get(values, 'w_netto')
  return {
    statePoints,
    segments: [
      { from: '1', to: '2', processType: 'adiabatic', label: '1→2 isentrop' },
      { from: '2', to: '3', processType: 'isobaric', label: '2→3 isobar' },
      { from: '3', to: '4', processType: 'adiabatic', label: '3→4 isentrop' },
      { from: '4', to: '1', processType: 'isobaric', label: '4→1 isobar' },
    ],
    energyFlows: [
      ...(qIn === null ? [] : [{ type: 'heat' as const, value: qIn, label: 'q_{zu}', location: '2-3' }]),
      ...(qOut === null ? [] : [{ type: 'heat' as const, value: qOut, label: 'q_{ab}', location: '4-1' }]),
      ...(wNetto === null ? [] : [{ type: 'work' as const, value: wNetto, label: 'w_{netto}', location: 'global' }]),
    ],
    gasContext: { kappa: get(values, 'kappa'), Rs: get(values, 'Rs'), cp: get(values, 'cp'), cv: get(values, 'cv') },
    processDirection: wNetto === null ? null : wNetto < 0 ? 'clockwise' : 'counterclockwise',
  }
}