import React from 'react'
import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { CalculationStoryDisplay } from '../../src/components/CalculationStoryDisplay'
import { FormulaRegistry } from '../../src/core/formula-registry'
import { solve } from '../../src/core/solver'
import { composeJouleCalculationStory } from '../../src/modules/joule/calculation-story'
import { jouleModule } from '../../src/modules/joule'

function referenceStory() {
  const input = (value: number, unit = '') => ({ value, unit, isUserInput: true, isComputed: false })
  const result = solve(FormulaRegistry.fromModule(jouleModule), jouleModule.variables, {
    T1: input(300, 'K'), p1: input(100_000, 'Pa'), pressureRatio: input(10), T3: input(1400, 'K'), kappa: input(1.4), Rs: input(287, 'J/(kg*K)'),
  }, [], { plannedExecution: jouleModule.plannedExecution })
  const composed = composeJouleCalculationStory({ plan: result.plan!, steps: result.steps, values: result.values, variables: jouleModule.variables })
  if (composed.mode !== 'complete') throw new Error('expected complete story')
  return composed
}

describe('CalculationStoryDisplay human-reference rendering', () => {

  it('renders the approved continuous reference grammar instead of generic overview cards', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    const { container } = render(<CalculationStoryDisplay story={referenceStory()} />)

    expect(container.querySelector('.calculation-story-overview')).toBeNull()
    expect(container.querySelectorAll('[data-story-given]')).toHaveLength(6)
    expect(container.querySelector('[data-story-fact-legend]')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Herleitungen öffnen' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Herleitungen schließen' })).toBeTruthy()

    const columnHeadings = container.querySelector('[data-story-column-headings]')
    expect(columnHeadings?.textContent).toContain('Operation')
    expect(columnHeadings?.textContent).toContain('Hauptrechnung')
    expect(columnHeadings?.textContent).toContain('Grundlage · Herleitung · Bedingung')
    expect(container.querySelectorAll('[data-story-section-header]')).toHaveLength(7)
    const sectionSideText = Array.from(container.querySelectorAll('.story-section-side')).map(node => node.textContent).join(' ')
    expect(sectionSideText).toContain('gegeben')
    expect(sectionSideText).toContain('const.')
    expect(sectionSideText).toContain('mit Vorzeichen')
    expect(sectionSideText).not.toContain('extgegeben')
    expect(warn).not.toHaveBeenCalled()
    warn.mockRestore()

    const mainRows = Array.from(container.querySelectorAll('.calculation-story-section > .story-row'))
    expect(mainRows).toHaveLength(62)
    expect(mainRows.every(row => row.querySelector(':scope > .story-operation'))).toBe(true)
    expect(mainRows.every(row => row.querySelector(':scope > .story-main-equation'))).toBe(true)
    expect(mainRows.every(row => row.querySelector(':scope > .story-side'))).toBe(true)
  })
  it('renders the seven-section, 62-row story with formula-local states and attached support', () => {
    const { container } = render(<CalculationStoryDisplay story={referenceStory()} />)
    expect(container.querySelectorAll('[data-story-section]')).toHaveLength(7)
    expect(container.querySelectorAll('[data-story-row-id]').length).toBeGreaterThan(62)
    expect(container.querySelectorAll('.calculation-story-section > .story-row')).toHaveLength(62)
    expect(container.querySelectorAll('[data-story-support]')).toHaveLength(26)
    expect(container.querySelectorAll('[data-story-support][open]')).toHaveLength(25)
    expect(container.querySelectorAll('.story-fact-outline')).toHaveLength(5)
    expect(container.querySelectorAll('.story-fact-ready')).toHaveLength(22)
    expect(Array.from(container.querySelectorAll('.story-fact-ready')).every(node => node.parentElement?.classList.contains('story-equation-line'))).toBe(true)
    expect(container.innerHTML).not.toContain('katex-error')
    expect(container.innerHTML).not.toContain('LaTeX Error')
  })

  it('hides only the attached support in main-path-only mode and keeps every main row', () => {
    const { container } = render(<CalculationStoryDisplay story={referenceStory()} />)
    const button = screen.getByRole('button', { name: 'Nur Hauptpfad' })
    expect(button.getAttribute('aria-pressed')).toBe('false')
    fireEvent.click(button)
    expect(button.getAttribute('aria-pressed')).toBe('true')
    expect(container.querySelectorAll('[data-story-support]')).toHaveLength(0)
    expect(container.querySelectorAll('.calculation-story-section > .story-row')).toHaveLength(62)
    fireEvent.click(button)
    expect(container.querySelectorAll('[data-story-support]')).toHaveLength(26)
  })

  it('preserves semantic continuation subject suppression and keyboard-focusable equation scrollers', () => {
    const { container } = render(<CalculationStoryDisplay story={referenceStory()} />)
    expect(screen.getByRole('region', { name: 'Herleitung: Gleichungszeilen' }).tabIndex).toBe(0)
    const continuations = Array.from(container.querySelectorAll('[data-story-role="continuation"] .story-lhs'))
    expect(continuations.length).toBeGreaterThan(0)
    expect(continuations.every(node => node.textContent === '')).toBe(true)
    expect(container.querySelectorAll('.story-equation-scroller[tabindex="0"]').length).toBeGreaterThanOrEqual(62)
  })

  it('renders an explicit unavailable state rather than a partial learner-facing path', () => {
    render(<CalculationStoryDisplay story={{ mode: 'unavailable', reason: 'Die ausgewählte Route ist nicht vollständig belegt.' }} />)
    expect(screen.getByText('Herleitung nicht verfügbar')).toBeTruthy()
  })
})
