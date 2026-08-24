import { describe, expect, it } from 'vitest'
import { wrightTimeline } from '../../src/landing/motion/wright-timeline'

describe('wrightTimeline', () => {
  it('keeps the required boundary states for a selected dark theme', () => {
    expect(wrightTimeline(0, 'dark').activeCopyTheme).toBe('light')
    expect(wrightTimeline(0.72, 'dark').decay).toBe(0)
    expect(wrightTimeline(0.855, 'dark').decay).toBeCloseTo(1)
    expect(wrightTimeline(0.855, 'dark').activeCopyTheme).toBe('dark')
    expect(wrightTimeline(0.97, 'dark').decay).toBe(0)
    expect(wrightTimeline(1, 'dark').darkOpacity).toBe(1)
  })

  it('keeps a selected light theme as a stable light panel', () => {
    const state = wrightTimeline(0.9, 'light')

    expect(state.lightOpacity).toBe(1)
    expect(state.darkOpacity).toBe(0)
    expect(state.activeCopyTheme).toBe('light')
    expect(state.decay).toBe(0)
    expect(state.driftX).toBe(0)
    expect(state.rotation).toBe(0)
    expect(state.jitterX).toBe(0)
    expect(state.jitterY).toBe(0)
    expect(state.blur).toBe(0)
    expect(state.displacementScale).toBe(0)
    expect(state.turbulenceFrequency).toBe(0)
    expect(state.chromaticWash).toBe(0)
    expect(state.fractureSlope).toBe(0)
    expect(state.fractureIntercept).toBe(1)
    expect(state.charredOpacity).toBe(0)
    expect(state.ashOpacity).toBe(0)
    expect(state.desaturation).toBe(0)
    expect(state.contrast).toBe(1)
  })

  it('keeps the late theme matte independent from a selected Light copy', () => {
    expect(wrightTimeline(0.80, 'light').themeFade).toBe(0)
    expect(wrightTimeline(0.90, 'light').themeFade).toBeGreaterThan(0)
    expect(wrightTimeline(0.90, 'light').themeFade).toBeLessThan(1)
    expect(wrightTimeline(1, 'light').themeFade).toBe(1)
  })

  it('uses the specified distortion peak at the semantic swap point', () => {
    const state = wrightTimeline(0.855, 'dark')

    expect(state.blur).toBeCloseTo(3.5)
    expect(state.displacementScale).toBeCloseTo(92)
    expect(state.turbulenceFrequency).toBeCloseTo(0.046)
    expect(state.chromaticWash).toBeCloseTo(0.42)
    expect(state.fractureSlope).toBeCloseTo(7)
    expect(state.fractureIntercept).toBeCloseTo(-3.78)
    expect(state.charredOpacity).toBeCloseTo(0.92)
    expect(state.ashOpacity).toBeCloseTo(0.72)
    expect(state.desaturation).toBe(1)
    expect(state.contrast).toBeCloseTo(1.55)
    expect(Math.abs(state.jitterX)).toBeLessThanOrEqual(1)
    expect(Math.abs(state.jitterY)).toBeLessThanOrEqual(1)
  })

  it('keeps the archaeological fracture neutral outside its narrow concealment beat', () => {
    for (const progress of [0, 0.72, 0.82, 0.90, 0.97, 1]) {
      const state = wrightTimeline(progress, 'dark')

      expect(state.fractureSlope).toBe(0)
      expect(state.fractureIntercept).toBe(1)
      expect(state.charredOpacity).toBe(0)
      expect(state.ashOpacity).toBe(0)
      expect(state.desaturation).toBe(0)
      expect(state.contrast).toBe(1)
    }
  })

  it('clamps non-finite progress to the stable opening state', () => {
    const opening = wrightTimeline(0, 'dark')

    expect(wrightTimeline(Number.NaN, 'dark')).toEqual(opening)
    expect(wrightTimeline(Number.POSITIVE_INFINITY, 'dark')).toEqual(opening)
    expect(wrightTimeline(Number.NEGATIVE_INFINITY, 'dark')).toEqual(opening)
  })

  it('keeps every sampled effect within its visual bounds', () => {
    for (let index = 0; index <= 1000; index += 1) {
      const state = wrightTimeline(index / 1000, 'dark')

      expect(state.filmProgress).toBeGreaterThanOrEqual(0)
      expect(state.filmProgress).toBeLessThanOrEqual(1)
      expect(state.themeFade).toBeGreaterThanOrEqual(0)
      expect(state.themeFade).toBeLessThanOrEqual(1)
      expect(state.lightOpacity).toBeGreaterThanOrEqual(0)
      expect(state.lightOpacity).toBeLessThanOrEqual(1)
      expect(state.darkOpacity).toBeGreaterThanOrEqual(0)
      expect(state.darkOpacity).toBeLessThanOrEqual(1)
      expect(state.decay).toBeGreaterThanOrEqual(0)
      expect(state.decay).toBeLessThanOrEqual(1)
      expect(state.chromaticWash).toBeGreaterThanOrEqual(0)
      expect(state.chromaticWash).toBeLessThanOrEqual(1)
      expect(state.fractureSlope).toBeGreaterThanOrEqual(0)
      expect(state.fractureSlope).toBeLessThanOrEqual(7)
      expect(state.fractureIntercept).toBeGreaterThanOrEqual(-3.78)
      expect(state.fractureIntercept).toBeLessThanOrEqual(1)
      expect(state.charredOpacity).toBeGreaterThanOrEqual(0)
      expect(state.charredOpacity).toBeLessThanOrEqual(0.92)
      expect(state.ashOpacity).toBeGreaterThanOrEqual(0)
      expect(state.ashOpacity).toBeLessThanOrEqual(0.72)
      expect(state.desaturation).toBeGreaterThanOrEqual(0)
      expect(state.desaturation).toBeLessThanOrEqual(1)
      expect(state.contrast).toBeGreaterThanOrEqual(1)
      expect(state.contrast).toBeLessThanOrEqual(1.55)
      expect(Math.abs(state.driftX)).toBeLessThanOrEqual(8)
      expect(Math.abs(state.rotation)).toBeLessThanOrEqual(0.35)
      expect(Math.abs(state.jitterX)).toBeLessThanOrEqual(1)
      expect(Math.abs(state.jitterY)).toBeLessThanOrEqual(1)
    }
  })

  it('returns byte-identical states for equal progress in either scroll direction', () => {
    const forward = Array.from({ length: 1001 }, (_, index) => JSON.stringify(wrightTimeline(index / 1000, 'dark')))
    const reverse = Array.from({ length: 1001 }, (_, index) => JSON.stringify(wrightTimeline((1000 - index) / 1000, 'dark'))).reverse()

    expect(reverse).toEqual(forward)
  })
})
