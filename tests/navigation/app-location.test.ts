import { describe, expect, it } from 'vitest'
import { appLocationHref, readAppLocation } from '../../src/navigation/app-location'

describe('app location', () => {
  it('uses the public root as landing page', () => {
    expect(readAppLocation('')).toEqual({ page: 'landing' })
  })

  it('reads a stable calculator entry with a module', () => {
    expect(readAppLocation('?view=calculator&module=joule'))
      .toEqual({ page: 'calculator', moduleId: 'joule' })
  })

  it('builds a GitHub-Pages-safe query URL', () => {
    expect(appLocationHref({ page: 'calculator', moduleId: 'otto' }))
      .toBe('?view=calculator&module=otto')
  })
})
