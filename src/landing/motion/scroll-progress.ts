export function scrollProgress(top: number, sectionHeight: number, viewportHeight: number): number {
  const distance = Math.max(1, sectionHeight - viewportHeight)
  return Math.min(1, Math.max(0, -top / distance))
}
