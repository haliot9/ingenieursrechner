export interface MagneticCandidate {
  id: string
  visibleRatio: number
  distanceToLanding: number
}

export function chooseMagneticTarget(
  candidates: MagneticCandidate[],
  reducedMotion: boolean,
) {
  if (reducedMotion) return undefined

  return candidates
    .filter(candidate => candidate.visibleRatio >= .72 && Math.abs(candidate.distanceToLanding) <= 120)
    .sort((a, b) => Math.abs(a.distanceToLanding) - Math.abs(b.distanceToLanding))[0]?.id
}
