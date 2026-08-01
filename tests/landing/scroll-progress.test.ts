import { describe, expect, it } from 'vitest'
import { scrollProgress } from '../../src/landing/motion/scroll-progress'

describe('scrollProgress', () => {
  it('maps the hero travel distance to a clamped progress value', () => {
    expect(scrollProgress(0, 2400, 800)).toBe(0)
    expect(scrollProgress(-800, 2400, 800)).toBeCloseTo(.5)
    expect(scrollProgress(-1600, 2400, 800)).toBe(1)
    expect(scrollProgress(200, 2400, 800)).toBe(0)
  })
})
