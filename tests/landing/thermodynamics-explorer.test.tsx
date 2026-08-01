import React from 'react'
import '@testing-library/jest-dom/vitest'
import { fireEvent, render, screen, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { LandingPage } from '../../src/landing/LandingPage'
import { ThermodynamicsExplorer } from '../../src/landing/components/ThermodynamicsExplorer'
import { getThermodynamicsModules } from '../../src/landing/model/landing-modules'

function advanceToCycles() {
  fireEvent.click(screen.getByRole('button', { name: 'Thermodynamik erkunden' }))
  fireEvent.click(screen.getByRole('button', { name: 'Kreisprozesse erkunden' }))
}

describe('ThermodynamicsExplorer', () => {
  it('advances one layer at a time and reverses the exact path on one live surface', () => {
    render(<ThermodynamicsExplorer onSelectionChange={vi.fn()} onOpenCalculator={vi.fn()} />)

    const explorer = screen.getByRole('region', { name: 'Thermodynamik-Explorer' })
    const stage = explorer.querySelector('[aria-live="polite"]')
    expect(explorer).toHaveAttribute('id', 'thermodynamik')
    expect(stage).not.toBeNull()
    expect(screen.getByRole('heading', { name: 'Thermodynamik' })).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Kreisprozesse' })).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Thermodynamik erkunden' }))
    expect(screen.getByRole('heading', { name: 'Kreisprozesse' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Carnot-Prozess' })).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Kreisprozesse erkunden' }))
    for (const module of getThermodynamicsModules()) {
      expect(screen.getByRole('button', { name: module.name })).toBeInTheDocument()
    }

    fireEvent.click(screen.getByRole('button', { name: 'Carnot-Prozess' }))
    expect(screen.getByRole('heading', { name: 'Carnot-Prozess' })).toBeInTheDocument()
    expect(screen.getByText(/Berechnung thermodynamischer Zustandsgrößen/)).toBeInTheDocument()
    expect(within(screen.getByRole('list', { name: 'Prozessfolge' })).getAllByRole('listitem')).toHaveLength(4)
    expect(screen.getByText('T-s Diagramm')).toBeInTheDocument()
    expect(screen.getByLabelText('Referenzdiagramm').querySelector('svg')).not.toBeNull()
    expect(screen.getByRole('button', { name: 'Im Rechner öffnen' })).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Zurück' }))
    expect(screen.getByRole('button', { name: 'Carnot-Prozess' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Zurück' }))
    expect(screen.getByRole('heading', { name: 'Kreisprozesse' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Carnot-Prozess' })).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Zurück' }))
    expect(screen.getByRole('heading', { name: 'Thermodynamik' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Zurück' })).not.toBeInTheDocument()
    expect(explorer.querySelector('[aria-live="polite"]')).toBe(stage)
  })

  it('reports and opens the correct calculator for every registered process', () => {
    const onSelectionChange = vi.fn()
    const onOpenCalculator = vi.fn()
    render(
      <ThermodynamicsExplorer
        onSelectionChange={onSelectionChange}
        onOpenCalculator={onOpenCalculator}
      />,
    )
    advanceToCycles()

    const modules = getThermodynamicsModules()
    for (const module of modules) {
      fireEvent.click(screen.getByRole('button', { name: module.name }))
      fireEvent.click(screen.getByRole('button', { name: 'Im Rechner öffnen' }))
      expect(onSelectionChange).toHaveBeenLastCalledWith(module.id)
      expect(onOpenCalculator).toHaveBeenLastCalledWith(module.id)
      fireEvent.click(screen.getByRole('button', { name: 'Zurück' }))
    }

    expect(onSelectionChange.mock.calls.map(([moduleId]) => moduleId)).toEqual(
      modules.map(module => module.id),
    )
    expect(onOpenCalculator.mock.calls.map(([moduleId]) => moduleId)).toEqual(
      modules.map(module => module.id),
    )
  })

  it('keeps the selected module in the landing page for its global calculator action', () => {
    const onOpenCalculator = vi.fn()
    render(<LandingPage onOpenCalculator={onOpenCalculator} />)
    advanceToCycles()

    fireEvent.click(screen.getByRole('button', { name: 'Joule-/Brayton-Prozess' }))
    fireEvent.click(screen.getByRole('button', { name: 'Rechner öffnen' }))

    expect(onOpenCalculator).toHaveBeenCalledWith('joule')
  })
})
