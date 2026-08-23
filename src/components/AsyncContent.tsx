import { Component, Suspense, type ErrorInfo, type ReactNode } from 'react'

interface AsyncErrorBoundaryProps {
  children: ReactNode
  sectionId?: string
  sectionLabel?: string
}

interface AsyncErrorBoundaryState {
  failed: boolean
}

class AsyncErrorBoundary extends Component<AsyncErrorBoundaryProps, AsyncErrorBoundaryState> {
  state: AsyncErrorBoundaryState = { failed: false }

  static getDerivedStateFromError(): AsyncErrorBoundaryState {
    return { failed: true }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Asynchronous content failed to load', error, info)
  }

  render() {
    if (!this.state.failed) return this.props.children

    const message = <div className="async-content__error" role="alert">
      <strong>Inhalt konnte nicht geladen werden.</strong>
      <a href={window.location.href}>Seite neu laden</a>
    </div>

    return this.props.sectionId
      ? <section
          id={this.props.sectionId}
          className="deferred-landing-section deferred-landing-section--error"
          aria-label={this.props.sectionLabel}
        >{message}</section>
      : <main className="app-route-state">{message}</main>
  }
}

export interface AsyncContentProps {
  children: ReactNode
  loadingLabel: string
  sectionId?: string
  sectionLabel?: string
}

function LoadingContent({ loadingLabel, sectionId, sectionLabel }: Omit<AsyncContentProps, 'children'>) {
  const status = <p role="status">{loadingLabel}</p>
  return sectionId
    ? <section
        id={sectionId}
        className="deferred-landing-section deferred-landing-section--loading"
        aria-label={sectionLabel}
        aria-busy="true"
      >{status}</section>
    : <main className="app-route-state" aria-busy="true">{status}</main>
}

export function AsyncContent({ children, loadingLabel, sectionId, sectionLabel }: AsyncContentProps) {
  return <AsyncErrorBoundary sectionId={sectionId} sectionLabel={sectionLabel}>
    <Suspense fallback={<LoadingContent
      loadingLabel={loadingLabel}
      sectionId={sectionId}
      sectionLabel={sectionLabel}
    />}>
      {children}
    </Suspense>
  </AsyncErrorBoundary>
}
