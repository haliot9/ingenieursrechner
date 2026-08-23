export type LandingRenderBoundary = 'line-field' | 'background'

export type LandingRenderFailureStage =
  | 'loading'
  | 'initialization'
  | 'motion-step'
  | 'resize'
  | 'render'
  | 'disposal'

export interface LandingRenderFailure {
  readonly boundary: LandingRenderBoundary
  readonly stage: LandingRenderFailureStage
  readonly error: Error
}

export type LandingRenderFailureReporter = (failure: LandingRenderFailure) => void

function normalizeRenderFailure(reason: unknown) {
  return reason instanceof Error
    ? reason
    : new Error('Landing renderer failed with a non-Error value', { cause: reason })
}

export function reportLandingRenderFailure(
  reporter: LandingRenderFailureReporter | undefined,
  boundary: LandingRenderBoundary,
  stage: LandingRenderFailureStage,
  reason: unknown,
) {
  if (!reporter) return
  try {
    reporter({ boundary, stage, error: normalizeRenderFailure(reason) })
  } catch {
    // Diagnostics must never replace the renderer boundary's visible fallback.
  }
}
