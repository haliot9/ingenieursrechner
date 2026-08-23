export const LANDING_CHAPTERS = [
  { id: 'haltung', label: 'Haltung' },
  { id: 'module', label: 'Module' },
  { id: 'thermodynamik', label: 'Thermodynamik' },
  { id: 'rechenweg', label: 'Rechenweg' },
  { id: 'projekt', label: 'Projekt' },
] as const

export type LandingChapterId = (typeof LANDING_CHAPTERS)[number]['id']
export type DeferredLandingChapterId = Exclude<LandingChapterId, 'haltung'>
