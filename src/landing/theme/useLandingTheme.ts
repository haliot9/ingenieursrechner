import { useState } from 'react'

export type LandingTheme = 'light' | 'dark'

export function useLandingTheme() {
  const [theme, setTheme] = useState<LandingTheme>(() =>
    window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light',
  )

  return {
    theme,
    toggleTheme: () => setTheme(current => current === 'light' ? 'dark' : 'light'),
  }
}
