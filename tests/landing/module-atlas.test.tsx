import React from 'react'
import '@testing-library/jest-dom/vitest'
import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { ModuleAtlas } from '../../src/landing/components/ModuleAtlas'

describe('ModuleAtlas', () => {
  it('keeps the chapter framing without duplicating the interactive thermodynamics explorer', () => {
    render(<ModuleAtlas />)

    expect(screen.getByRole('region', { name: 'Ein System. Endliche, prüfbare Rechenräume.' })).toHaveAttribute('id', 'module')
    expect(screen.queryByRole('button', { name: /Aktives Fachgebiet.*Thermodynamik/ })).not.toBeInTheDocument()
    expect(screen.queryByText('Thermodynamik')).not.toBeInTheDocument()
    expect(screen.queryByText(/Carnot-Prozess/)).not.toBeInTheDocument()
    expect(screen.getByText('Weitere Fachgebiete')).toBeInTheDocument()

    for (const unimplementedField of ['Robotik', 'SPS', 'Rankine', 'Strömungsmechanik']) {
      expect(screen.queryByText(unimplementedField)).not.toBeInTheDocument()
    }
  })
})
