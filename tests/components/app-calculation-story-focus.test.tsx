import React from 'react'
import { act, fireEvent, render } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'
import App from '../../src/App'
import { useCalculatorStore } from '../../src/store/calculator-store'

describe('App calculation-story focus mode', () => {
  beforeEach(() => act(() => {
    useCalculatorStore.getState().setModule('joule')
    useCalculatorStore.getState().loadPreset('reference-air')
  }))

  it('uses the same solved store state while entering and leaving the full-width story surface', () => {
    const etaBefore = useCalculatorStore.getState().values.eta?.value
    const { container } = render(<App />)
    const focusButton = container.querySelector<HTMLButtonElement>('[data-calculation-story-focus-control]')
    expect(focusButton).toBeTruthy()
    fireEvent.click(focusButton!)
    expect(container.querySelector('.workspace-grid')?.classList.contains('is-story-focused')).toBe(true)
    expect(container.querySelector('.input-panel')?.hasAttribute('hidden')).toBe(true)
    expect(useCalculatorStore.getState().values.eta?.value).toBe(etaBefore)
    const leaveButton = container.querySelector<HTMLButtonElement>('[data-calculation-story-focus-control]')
    expect(leaveButton?.getAttribute('aria-label')).toBe('Rechenweg-Fokus verlassen')
    fireEvent.click(leaveButton!)
    expect(container.querySelector('.workspace-grid')?.classList.contains('is-story-focused')).toBe(false)
    expect(container.querySelector('.input-panel')?.hasAttribute('hidden')).toBe(false)
    expect(useCalculatorStore.getState().values.eta?.value).toBe(etaBefore)
    expect(document.activeElement).toBe(focusButton)
  })
})
