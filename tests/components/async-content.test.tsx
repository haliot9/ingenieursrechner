import React, { act, lazy } from 'react'
import '@testing-library/jest-dom/vitest'
import { render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { AsyncContent } from '../../src/components/AsyncContent'

describe('AsyncContent', () => {
  afterEach(() => vi.restoreAllMocks())

  it('announces a pending lazy view and replaces it with the resolved content', async () => {
    let resolveModule: ((module: { default: () => React.JSX.Element }) => void) | undefined
    const LazyView = lazy(() => new Promise(resolve => { resolveModule = resolve }))

    render(<AsyncContent loadingLabel="Landingpage wird geladen">
      <LazyView />
    </AsyncContent>)

    expect(screen.getByRole('status')).toHaveTextContent('Landingpage wird geladen')

    await act(async () => {
      resolveModule?.({ default: () => <p>Geladener Inhalt</p> })
    })

    expect(await screen.findByText('Geladener Inhalt')).toBeInTheDocument()
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
  })

  it('keeps a reload action available when an asynchronous view fails', () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined)
    function BrokenView(): React.JSX.Element {
      throw new Error('chunk unavailable')
    }

    render(<AsyncContent loadingLabel="Inhalt wird geladen">
      <BrokenView />
    </AsyncContent>)

    const alert = screen.getByRole('alert')
    expect(alert).toHaveTextContent('Inhalt konnte nicht geladen werden.')
    expect(screen.getByRole('link', { name: 'Seite neu laden' })).toHaveAttribute(
      'href',
      window.location.href,
    )
  })
})
