import '@testing-library/jest-dom/vitest'
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import React from 'react'
import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { WrightHero } from '../../src/landing/components/WrightHero'
import { lineFieldConfig } from '../../src/landing/line-field/config/line-field-config.generated'

const LIGHT_COPY = 'Überlieferte Formel ist Ausgangspunkt. Beweis ist das Ziel.'
const DARK_COPY = 'Die Formel ist nur das Signal. Die Herleitung macht den Zusammenhang sichtbar.'

describe('WrightMottoPanel', () => {
  it('moves the active motto into a named region immediately after the film track', () => {
    const { container } = render(<WrightHero theme="light" reducedMotion={false} />)
    const section = container.querySelector('#haltung') as HTMLElement
    const sticky = section.querySelector('.wright-hero-sticky') as HTMLElement
    const filmTrack = section.querySelector('.wright-film-track') as HTMLElement
    const video = filmTrack.querySelector('.wright-hero-media')
    const copy = filmTrack.querySelector('.wright-hero-copy')
    const panel = screen.getByRole('region', { name: LIGHT_COPY })
    const statement = panel.querySelector('p') as HTMLParagraphElement

    expect(sticky.querySelector('.wright-motto')).not.toBeInTheDocument()
    expect(sticky.parentElement).toBe(filmTrack)
    expect(sticky).toContainElement(video)
    expect(sticky).not.toContainElement(copy)
    expect(filmTrack.querySelector(
      ':scope > .wright-hero-copy-overlay > .wright-hero-copy-sticky > .wright-hero-copy',
    )).toBe(copy)
    expect(filmTrack.nextElementSibling).toBe(panel)
    expect(panel.tagName).toBe('DIV')
    expect(panel.parentElement).toBe(section)
    expect(panel).toHaveAttribute('data-motto-theme', 'light')
    expect(panel).toHaveAttribute('data-motto-motion', 'orbit')
    expect(statement.id).not.toBe('')
    expect(panel).toHaveAttribute('aria-labelledby', statement.id)
    expect(panel).not.toHaveAttribute('aria-live')
  })

  it('keeps one statement and every panel node stable across theme and motion changes', () => {
    const view = render(<WrightHero theme="light" reducedMotion={false} />)
    const panel = screen.getByRole('region', { name: LIGHT_COPY })
    const slot = panel.querySelector('.wright-motto-panel__slot') as HTMLElement
    const card = panel.querySelector('.wright-motto-panel__card') as HTMLElement
    const statement = panel.querySelector('p') as HTMLParagraphElement

    expect(statement).toHaveTextContent(LIGHT_COPY)
    expect(panel.querySelectorAll('p')).toHaveLength(1)

    view.rerender(<WrightHero theme="dark" reducedMotion={false} />)
    expect(screen.getByRole('region', { name: DARK_COPY })).toBe(panel)
    expect(panel.querySelector('.wright-motto-panel__slot')).toBe(slot)
    expect(panel.querySelector('.wright-motto-panel__card')).toBe(card)
    expect(panel.querySelector('p')).toBe(statement)
    expect(statement).toHaveTextContent(DARK_COPY)
    expect(panel).toHaveAttribute('data-motto-theme', 'dark')
    expect(panel).toHaveAttribute('data-motto-motion', 'orbit')

    view.rerender(<WrightHero theme="dark" reducedMotion />)
    expect(screen.getByRole('region', { name: DARK_COPY })).toBe(panel)
    expect(panel.querySelector('.wright-motto-panel__slot')).toBe(slot)
    expect(panel.querySelector('.wright-motto-panel__card')).toBe(card)
    expect(panel.querySelector('p')).toBe(statement)
    expect(panel).toHaveAttribute('data-motto-motion', 'static')
  })

  it('derives its final layout variables from the generated motto configuration', () => {
    render(<WrightHero theme="light" reducedMotion={false} />)
    const panel = screen.getByRole('region', { name: LIGHT_COPY })

    expect(panel.style.getPropertyValue('--motto-perspective')).toBe('')
    expect(panel.style.getPropertyValue('--motto-card-max-width')).toBe(`${lineFieldConfig.motto.cardMaxWidthRem}rem`)
    expect(panel.style.getPropertyValue('--motto-final-right')).toBe(`${lineFieldConfig.motto.finalRightInsetVw}vw`)
    expect(panel.style.getPropertyValue('--motto-mobile-final-left')).toBe(
      `${lineFieldConfig.motto.mobileFinalLeftInsetRem}rem`,
    )
    expect(panel.style.getPropertyValue('--motto-mobile-final-right')).toBe(
      `${lineFieldConfig.motto.mobileFinalRightInsetRem}rem`,
    )
    expect(panel.style.getPropertyValue('--motto-final-center-y')).toBe(
      `${Number((lineFieldConfig.motto.finalCenterViewportY * 100).toFixed(6))}%`,
    )
  })

  it('consumes the generated inset variables and keeps one CSS projection on the card', async () => {
    const css = await readFile(join(
      process.cwd(),
      'src/landing/components/WrightMottoPanel.css',
    ), 'utf8')
    const styleElement = document.createElement('style')
    styleElement.textContent = css
    document.head.append(styleElement)

    const mediaRule = Array.from(styleElement.sheet?.cssRules ?? []).find(
      (rule): rule is CSSMediaRule => 'cssRules' in rule && rule.cssText.startsWith('@media'),
    )
    const slotRule = Array.from(mediaRule?.cssRules ?? []).find(
      (rule): rule is CSSStyleRule => 'selectorText' in rule
        && rule.selectorText === '.wright-motto-panel__slot',
    )
    const cardRule = Array.from(styleElement.sheet?.cssRules ?? []).find(
      (rule): rule is CSSStyleRule => 'selectorText' in rule
        && rule.selectorText === '.wright-motto-panel__card',
    )

    const left = slotRule?.style.getPropertyValue('left')
    const right = slotRule?.style.getPropertyValue('right')
    const transform = cardRule?.style.getPropertyValue('transform') ?? ''
    const compactTransform = transform.replace(/\s+/g, '')
    const transformStyle = cardRule?.style.getPropertyValue('transform-style') ?? ''
    styleElement.remove()

    expect(left).toBe('var(--motto-mobile-final-left)')
    expect(right).toBe('var(--motto-mobile-final-right)')
    expect(compactTransform).toContain('translate3d(var(--motto-orbit-x,0px),var(--motto-orbit-y,0px),0)')
    expect(compactTransform).toContain('scale(var(--motto-scale,1))')
    expect(compactTransform).not.toContain('perspective')
    expect(compactTransform).not.toContain('--motto-orbit-z')
    expect(compactTransform.indexOf('translate3d(')).toBeLessThan(
      compactTransform.indexOf('scale('),
    )
    expect(transformStyle).toBe('')
  })
})
