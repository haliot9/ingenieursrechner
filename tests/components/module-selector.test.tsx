import React from 'react'
import { act, fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'
import { ModuleSelector } from '../../src/components/ModuleSelector'
import { useCalculatorStore } from '../../src/store/calculator-store'

describe('ModuleSelector live search', () => {
  beforeEach(() => {
    act(() => useCalculatorStore.getState().setModule('carnot'))
  })

  it('filters registered modules while typing and selects Diesel from the dropdown', () => {
    render(<ModuleSelector />)

    const search = screen.getByRole('searchbox', { name: 'Rechnermodul suchen' })
    fireEvent.focus(search)
    fireEvent.change(search, { target: { value: 'die' } })

    expect(screen.getByRole('option', { name: 'Diesel-Prozess' })).toBeTruthy()
    expect(screen.queryByRole('option', { name: 'Carnot-Prozess' })).toBeNull()

    fireEvent.click(screen.getByRole('option', { name: 'Diesel-Prozess' }))

    expect(useCalculatorStore.getState().activeModuleId).toBe('diesel')
    expect((search as HTMLInputElement).value).toBe('Diesel-Prozess')
    expect(screen.queryByRole('listbox')).toBeNull()
  })

  it('selects the highlighted module with arrow keys and Enter', () => {
    render(<ModuleSelector />)
    const search = screen.getByRole('searchbox', { name: 'Rechnermodul suchen' })

    fireEvent.focus(search)
    fireEvent.change(search, { target: { value: 'die' } })
    fireEvent.keyDown(search, { key: 'ArrowDown' })
    fireEvent.keyDown(search, { key: 'Enter' })

    expect(useCalculatorStore.getState().activeModuleId).toBe('diesel')
    expect((search as HTMLInputElement).value).toBe('Diesel-Prozess')
  })

  it('filters registered modules while typing and selects Otto from the dropdown', () => {
    render(<ModuleSelector />)

    const search = screen.getByRole('searchbox', { name: 'Rechnermodul suchen' })
    fireEvent.focus(search)
    fireEvent.change(search, { target: { value: 'ott' } })

    expect(screen.getByRole('option', { name: 'Otto-Prozess' })).toBeTruthy()
    expect(screen.queryByRole('option', { name: 'Diesel-Prozess' })).toBeNull()

    fireEvent.keyDown(search, { key: 'ArrowDown' })
    fireEvent.keyDown(search, { key: 'Enter' })

    expect(useCalculatorStore.getState().activeModuleId).toBe('otto')
    expect((search as HTMLInputElement).value).toBe('Otto-Prozess')
  })

  it('closes an open listbox with Escape without changing the active module', () => {
    render(<ModuleSelector />)
    const search = screen.getByRole('searchbox', { name: 'Rechnermodul suchen' })

    fireEvent.focus(search)
    expect(screen.getByRole('listbox')).toBeTruthy()
    fireEvent.keyDown(search, { key: 'Escape' })

    expect(useCalculatorStore.getState().activeModuleId).toBe('carnot')
    expect(screen.queryByRole('listbox')).toBeNull()
  })
})

  it('finds and activates the registered Joule module', () => {
    render(<ModuleSelector />)
    const search = screen.getByRole('searchbox', { name: 'Rechnermodul suchen' })
    fireEvent.focus(search)
    fireEvent.change(search, { target: { value: 'jou' } })
    fireEvent.click(screen.getByRole('option', { name: 'Joule-/Brayton-Prozess' }))
    expect(useCalculatorStore.getState().activeModuleId).toBe('joule')
  })
