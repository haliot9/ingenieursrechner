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
