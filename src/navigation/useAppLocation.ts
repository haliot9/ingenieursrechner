import { useEffect, useState } from 'react'
import { appLocationHref, readAppLocation, type AppLocation } from './app-location'

export function useAppLocation() {
  const [location, setLocation] = useState<AppLocation>(() => readAppLocation())

  useEffect(() => {
    const sync = () => setLocation(readAppLocation())
    window.addEventListener('popstate', sync)
    return () => window.removeEventListener('popstate', sync)
  }, [])

  const navigate = (next: AppLocation) => {
    window.history.pushState({}, '', appLocationHref(next))
    setLocation(next)
    window.scrollTo({ top: 0, behavior: 'auto' })
  }

  return { location, navigate }
}
