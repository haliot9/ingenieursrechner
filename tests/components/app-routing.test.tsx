import React from 'react'
import { act, fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import App from '../../src/App'
import { useCalculatorStore } from '../../src/store/calculator-store'

describe('App routing', () => {
  beforeEach(() => {
    window.history.replaceState({}, '', './')
    window.scrollTo = vi.fn()
    act(() => useCalculatorStore.getState().setModule('carnot'))
  })

  it('renders the landing page at the public root', () => {
    render(<App />)

    expect(screen.getByRole('heading', { name: 'Nicht nur rechnen. Systeme verstehen.' })).toBeTruthy()
  })

  it('renders the requested calculator module from its query URL', () => {
    window.history.replaceState({}, '', '?view=calculator&module=joule')

    render(<App />)

    expect(screen.getByRole('heading', { name: 'Joule-/Brayton-Prozess' })).toBeTruthy()
  })

  it('opens the Carnot calculator from the landing CTA', () => {
    render(<App />)

    fireEvent.click(screen.getByRole('button', { name: 'Rechner öffnen' }))

    expect(screen.getByRole('heading', { name: 'Carnot-Prozess' })).toBeTruthy()
    expect(window.location.search).toBe('?view=calculator&module=carnot')
    expect(window.scrollTo).toHaveBeenCalledWith({ top: 0, behavior: 'auto' })
  })
})
