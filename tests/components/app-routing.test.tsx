import React from 'react'
import '@testing-library/jest-dom/vitest'
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

  it('announces the lazy route while its page module resolves', () => {
    render(<App />)

    expect(screen.getByText('Landingpage wird geladen')).toHaveAttribute('role', 'status')
  })

  it('renders the landing page at the public root', async () => {
    render(<App />)

    expect(await screen.findByRole('heading', { name: 'Nicht nur rechnen. Systeme verstehen.' })).toBeTruthy()
  })

  it('renders the requested calculator module from its query URL', async () => {
    window.history.replaceState({}, '', '?view=calculator&module=joule')

    render(<App />)

    expect(await screen.findByRole('heading', { name: 'Joule-/Brayton-Prozess' })).toBeTruthy()
  })

  it('opens the Carnot calculator from the landing CTA', async () => {
    render(<App />)

    fireEvent.click(await screen.findByRole('button', { name: 'Rechner öffnen' }))

    expect(await screen.findByRole('heading', { name: 'Carnot-Prozess' })).toBeTruthy()
    expect(window.location.search).toBe('?view=calculator&module=carnot')
    expect(window.scrollTo).toHaveBeenCalledWith({ top: 0, behavior: 'auto' })
  })
})
