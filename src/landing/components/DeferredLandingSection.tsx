import { useEffect, useRef, useState, type ReactNode } from 'react'

export interface DeferredLandingSectionProps {
  children: ReactNode
  id: 'module' | 'thermodynamik' | 'rechenweg' | 'projekt'
  label: string
}

export function DeferredLandingSection({ children, id, label }: DeferredLandingSectionProps) {
  const placeholderRef = useRef<HTMLElement>(null)
  const [ready, setReady] = useState(() => !window.IntersectionObserver)

  useEffect(() => {
    if (ready || !window.IntersectionObserver) return
    const placeholder = placeholderRef.current
    if (!placeholder) return

    const observer = new window.IntersectionObserver(entries => {
      if (!entries.some(entry => entry.target === placeholder && entry.isIntersecting)) return
      observer.disconnect()
      setReady(true)
    }, { rootMargin: '600px 0px', threshold: .01 })

    observer.observe(placeholder)
    return () => observer.disconnect()
  }, [ready])

  if (ready) return children

  return <section
    ref={placeholderRef}
    id={id}
    className="deferred-landing-section"
    data-deferred-section={id}
    aria-label={label}
  >
    <span aria-hidden="true">{label}</span>
  </section>
}
