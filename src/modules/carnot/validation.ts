import type { SolverError, VariableState } from '../../core/types'

function get(values: Record<string, VariableState>, id: string): number | null {
  return values[id]?.value ?? null
}

function closeEnough(actual: number, expected: number, relativeTolerance = 1e-4): boolean {
  const scale = Math.max(1, Math.abs(actual), Math.abs(expected))
  return Math.abs(actual - expected) <= relativeTolerance * scale
}

export function validateCarnotCycle(values: Record<string, VariableState>): SolverError[] {
  const errors: SolverError[] = []
  const contradiction = (variableId: string, message: string) => {
    errors.push({ type: 'contradiction', variableId, message })
  }

  const T1 = get(values, 'T1')
  const T2 = get(values, 'T2')
  const T3 = get(values, 'T3')
  const T4 = get(values, 'T4')
  const eta = get(values, 'eta')

  if (T1 !== null && T3 !== null) {
    if (T3 <= T1) {
      errors.push({
        type: 'constraint_violation',
        variableId: 'T3',
        message: 'Für die Carnot-Kraftmaschine muss T_warm (T3) strikt größer als T_kalt (T1) sein.',
      })
    } else if (eta !== null && !closeEnough(eta, 1 - T1 / T3)) {
      contradiction('eta', 'Widersprüchlicher Wirkungsgrad: η muss 1 - T1/T3 entsprechen.')
    }
  }

  if (T2 !== null && T3 !== null && !closeEnough(T2, T3)) {
    contradiction('T2', 'Widersprüchliche heiße Isotherme: T2 muss T3 entsprechen.')
  }
  if (T4 !== null && T1 !== null && !closeEnough(T4, T1)) {
    contradiction('T4', 'Widersprüchliche kalte Isotherme: T4 muss T1 entsprechen.')
  }

  const qIn = get(values, 'q_in')
  const qOut = get(values, 'q_out')
  const wNetto = get(values, 'w_netto')
  if (qIn !== null && qOut !== null && wNetto !== null) {
    const expectedWork = -(qIn + qOut)
    if (!closeEnough(wNetto, expectedWork)) {
      contradiction('w_netto', 'Widersprüchliche Energiebilanz: w_netto muss -(q_in + q_out) entsprechen.')
    }
  }

  const s1 = get(values, 's1')
  const s2 = get(values, 's2')
  const s3 = get(values, 's3')
  const s4 = get(values, 's4')
  if (s1 !== null && s2 !== null && !closeEnough(s1, s2)) {
    contradiction('s2', 'Widersprüchliche Isentrope 1→2: s1 muss s2 entsprechen.')
  }
  if (s3 !== null && s4 !== null && !closeEnough(s3, s4)) {
    contradiction('s4', 'Widersprüchliche Isentrope 3→4: s3 muss s4 entsprechen.')
  }

  const Rs = get(values, 'Rs')
  if (Rs !== null) {
    for (let state = 1; state <= 4; state++) {
      const p = get(values, `p${state}`)
      const v = get(values, `v${state}`)
      const T = get(values, `T${state}`)
      if (p !== null && v !== null && T !== null && !closeEnough(p * v, Rs * T)) {
        contradiction(`p${state}`, `Widersprüchliche Zustandsgleichung in Zustand ${state}: p·v muss Rs·T entsprechen.`)
      }
    }
  }

  return errors
}
