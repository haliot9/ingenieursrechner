import React from 'react'
import { act, render } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'
import App from '../../src/App'
import { useCalculatorStore } from '../../src/store/calculator-store'

describe('App module metadata', () => {
  beforeEach(() => { act(() => useCalculatorStore.getState().setModule('carnot')) })

  it('updates the document title when the active module changes', () => {
    render(<App />)
    expect(document.title).toBe('Ingenieursrechner · Carnot-Prozess')
    act(() => useCalculatorStore.getState().setModule('diesel'))
    expect(document.title).toBe('Ingenieursrechner · Diesel-Prozess')
  })

  it('updates the document title for Joule', () => {
    render(<App />)
    act(() => useCalculatorStore.getState().setModule('joule'))
    expect(document.title).toBe('Ingenieursrechner · Joule-/Brayton-Prozess')
  })
})

describe('App full Joule calculation story', () => {
  beforeEach(() => act(() => {
    useCalculatorStore.getState().setModule('joule')
    useCalculatorStore.getState().loadPreset('reference-air')
  }))

  it('renders a full story with zero primary legacy cards on the reference route', () => {
    const { container } = render(<App />)
    const story = useCalculatorStore.getState().story
    expect(story?.mode).toBe('complete')
    if (story?.mode !== 'complete') throw new Error('expected full story')
    expect(story.story.consumedSteps).toHaveLength(22)
    expect(container.querySelector('.calculation-story')).toBeTruthy()
    expect(container.querySelectorAll('.step-card')).toHaveLength(0)
  })
})
