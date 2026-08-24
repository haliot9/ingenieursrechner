import React from 'react'
import { act, render } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'
import { CalculatorPage } from '../../src/calculator/CalculatorPage'
import { useCalculatorStore } from '../../src/store/calculator-store'

describe('App calculation-story desktop placement', () => {
  beforeEach(() => act(() => {
    useCalculatorStore.getState().setModule('joule')
    useCalculatorStore.getState().loadPreset('reference-air')
  }))

  it('keeps input and analysis above a permanently full-width calculation story', () => {
    const etaBefore = useCalculatorStore.getState().values.eta?.value
    const { container } = render(<CalculatorPage onBackToLanding={() => undefined} />)
    const workspace = container.querySelector('.workspace-grid')
    const input = container.querySelector('.input-panel')
    const analysis = container.querySelector('.analysis-panel')
    const storyArea = container.querySelector('.calculation-story-area')

    expect(workspace).toBeTruthy()
    expect(input?.hasAttribute('hidden')).toBe(false)
    expect(analysis?.querySelector('.calculation-story')).toBeNull()
    expect(analysis?.querySelector('.steps-panel')).toBeNull()
    expect(container.textContent).not.toContain('Alternative Herleitung für')
    expect(storyArea?.querySelector('.calculation-story')).toBeTruthy()
    expect(workspace?.nextElementSibling).toBe(storyArea)
    expect(container.querySelector('[data-calculation-story-focus-control]')).toBeNull()
    expect(useCalculatorStore.getState().values.eta?.value).toBe(etaBefore)
  })
})
