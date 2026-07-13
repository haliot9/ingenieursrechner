import React from 'react'
import { act, render } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'
import { DiagramPanel } from '../../src/components/diagrams/DiagramPanel'
import { useCalculatorStore } from '../../src/store/calculator-store'

describe('DiagramPanel unit contract', () => {
  beforeEach(() => {
    useCalculatorStore.getState().setModule('carnot')
  })

  it('renders SI-correct diagram labels after display-unit changes', () => {
    act(() => {
      useCalculatorStore.getState().loadPreset('reference-air')
      useCalculatorStore.getState().setUnit('p1', 'bar')
      useCalculatorStore.getState().setUnit('q_in', 'kJ/kg')
    })

    const { container } = render(<DiagramPanel />)
    expect(container.textContent).toContain('qzu = 231.0 kJ/kg')
    expect(container.textContent).not.toContain('qzu = 231.0 J/kg')
  })
})
