export type AppLocation =
  | { page: 'landing' }
  | { page: 'calculator'; moduleId?: string }

export function readAppLocation(search: string = window.location.search): AppLocation {
  const params = new URLSearchParams(search)
  if (params.get('view') !== 'calculator') return { page: 'landing' }
  const moduleId = params.get('module')?.trim()
  return moduleId ? { page: 'calculator', moduleId } : { page: 'calculator' }
}

export function appLocationHref(location: AppLocation): string {
  if (location.page === 'landing') return './'
  const params = new URLSearchParams({ view: 'calculator' })
  if (location.moduleId) params.set('module', location.moduleId)
  return `?${params.toString()}`
}
