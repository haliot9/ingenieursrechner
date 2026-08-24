import React from 'react'
import '@testing-library/jest-dom/vitest'
import { fireEvent, render, screen, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { ProjectCoda } from '../../src/landing/components/ProjectCoda'

const EXPECTED_PROOF_POINTS = [
  'Browser-only',
  'Deterministisch',
  'Getestet',
  'Modular',
  'Agent-ready',
]

describe('ProjectCoda', () => {
  it('presents only the factual repository proof points and public source link', () => {
    const { container } = render(<ProjectCoda onOpenCalculator={vi.fn()} />)

    const section = screen.getByRole('region', { name: 'Projektbeleg.' })
    expect(section).toHaveAttribute('id', 'projekt')
    const proofPoints = within(screen.getByRole('list', { name: 'Projekteigenschaften' }))
      .getAllByRole('listitem')
      .map(item => item.textContent)
    expect(proofPoints).toEqual(EXPECTED_PROOF_POINTS)
    expect(screen.getByRole('link', { name: 'Repository ansehen' })).toHaveAttribute(
      'href',
      'https://github.com/haliot9/ingenieursrechner',
    )
    expect(container.textContent).not.toMatch(/AI-powered calculator/i)
  })

  it('delegates the calculator action without owning module selection', () => {
    const onOpenCalculator = vi.fn()
    render(<ProjectCoda onOpenCalculator={onOpenCalculator} />)

    fireEvent.click(screen.getByRole('button', { name: 'Rechner öffnen' }))

    expect(onOpenCalculator).toHaveBeenCalledOnce()
    expect(onOpenCalculator).toHaveBeenCalledWith()
  })
})
