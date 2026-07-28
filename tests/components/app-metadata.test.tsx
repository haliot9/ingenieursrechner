import React from 'react'
import { act, render } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'
import App from '../../src/App'
import { useCalculatorStore } from '../../src/store/calculator-store'

describe('App module metadata', () => {
  beforeEach(() => {
    act(() => useCalculatorStore.getState().setModule('carnot'))
  })

  it('updates the document title when the active module changes', () => {
    render(<App />)
    expect(document.title).toBe('Ingenieursrechner · Carnot-Prozess')

    act(() => useCalculatorStore.getState().setModule('diesel'))

    expect(document.title).toBe('Ingenieursrechner · Diesel-Prozess')
  })
})

  it('updates the document title for Joule', () => {
    render(<App />)
    act(() => useCalculatorStore.getState().setModule('joule'))
    expect(document.title).toBe('Ingenieursrechner · Joule-/Brayton-Prozess')
  })


describe('App calculation-story hybrid', () => {
  beforeEach(() => {
    act(() => {
      useCalculatorStore.getState().setModule('joule')
      useCalculatorStore.getState().loadPreset('reference-air')
    })
  })

  it('renders the reference story with remaining legacy Joule cards but without consumed cv/cp cards', () => {
    const { container } = render(<App />)
    const primarySteps = useCalculatorStore.getState().presentation?.primarySteps ?? []
    const remainingTargets = primarySteps
      .filter(step => !(['cv', 'cp'].includes(step.targetVariable)))
      .map(step => step.targetVariable)

    expect(container.querySelector('.calculation-story')).toBeTruthy()
    expect(remainingTargets).toContain('T2')
    expect(container.querySelectorAll('.step-card')).toHaveLength(remainingTargets.length)
    expect(remainingTargets).not.toContain('cv')
    expect(remainingTargets).not.toContain('cp')
  })
})
