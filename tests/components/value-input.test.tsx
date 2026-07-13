import React from 'react'
import { act, fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'
import { ValueInput } from '../../src/components/ValueInput'
import { useCalculatorStore } from '../../src/store/calculator-store'

describe('ValueInput', () => {
  beforeEach(() => {
    act(() => useCalculatorStore.getState().setModule('carnot'))
  })

  it('keeps significant trailing zeros for integer values', () => {
    act(() => useCalculatorStore.getState().loadPreset('reference-air'))
    render(<ValueInput variableId="p3" />)

    expect((screen.getByRole('textbox') as HTMLInputElement).value).toBe('200000')
  })

  it('clears the visible input when the calculator is reset', () => {
    render(<ValueInput variableId="T1" />)
    const input = screen.getByRole('textbox') as HTMLInputElement

    fireEvent.change(input, { target: { value: '250' } })
    expect(input.value).toBe('250')

    act(() => useCalculatorStore.getState().clearAll())

    expect(input.value).toBe('')
  })
})
