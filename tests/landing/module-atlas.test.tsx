import React from 'react'
import '@testing-library/jest-dom/vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { ModuleAtlas } from '../../src/landing/components/ModuleAtlas'

describe('ModuleAtlas', () => {
  it('presents the registered thermodynamics processes without promising unimplemented fields', () => {
    render(<ModuleAtlas onExploreThermodynamics={vi.fn()} />)

    expect(screen.getByRole('region', { name: 'Ein System. Endliche, prüfbare Rechenräume.' })).toHaveAttribute('id', 'module')
    expect(screen.getByText('Thermodynamik')).toBeInTheDocument()
    expect(screen.getByText(/Carnot-Prozess/)).toBeInTheDocument()
    expect(screen.getByText(/Otto-Prozess/)).toBeInTheDocument()
    expect(screen.getByText(/Diesel-Prozess/)).toBeInTheDocument()
    expect(screen.getByText(/Joule-\/Brayton-Prozess/)).toBeInTheDocument()
    expect(screen.getByText('Weitere Fachgebiete')).toBeInTheDocument()

    for (const unimplementedField of ['Robotik', 'SPS', 'Rankine', 'Strömungsmechanik']) {
      expect(screen.queryByText(unimplementedField)).not.toBeInTheDocument()
    }
  })

  it('delegates exploration of thermodynamics to the landing page', () => {
    const onExploreThermodynamics = vi.fn()
    render(<ModuleAtlas onExploreThermodynamics={onExploreThermodynamics} />)

    fireEvent.click(screen.getByRole('button', { name: /Aktives Fachgebiet.*Thermodynamik/ }))

    expect(onExploreThermodynamics).toHaveBeenCalledOnce()
  })
})
