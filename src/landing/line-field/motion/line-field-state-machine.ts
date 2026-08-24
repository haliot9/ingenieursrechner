import type { LineFieldAnimationConfig } from '../config/line-field-config.types'
import { createLaneTipOffsets } from '../math/line-stagger'
import { deriveLineFieldScrollMetrics } from './line-field-geometry'
import type {
  LineFieldScrollMetrics,
  LineFieldViewportGeometry,
} from './line-field-geometry'
import { evaluateMottoOrbit } from './motto-orbit'
import type { MottoOrbitFrame } from './motto-orbit'

export type LineFieldMode =
  | 'dormant'
  | 'scroll-build'
  | 'auto-handoff'
  | 'autonomous'
  | 'reverse-gather'

export interface LineFieldRenderFrame {
  readonly mode: LineFieldMode
  readonly theme: 'light' | 'dark'
  readonly anchorViewport: readonly [number, number]
  readonly sourceOriginViewportFraction: number
  readonly headerTargetViewportY: number
  readonly originDocumentY: number
  readonly commonFrontDocumentY: number
  readonly upwardSpineReveal: number
  readonly unwrappedPhase: number
  readonly tipOffsetsViewportFractions: readonly number[]
  readonly pointerProximity: number
  readonly opacity: number
  readonly filmProgress: number
  readonly mottoProgress: number
}

export interface LineFieldPointerTarget {
  readonly proximity: number
  readonly twistNormalized: number
}

interface ScrollBuildSample {
  readonly scrollY: number
  readonly commonFrontDocumentY: number
  readonly unwrappedPhase: number
}

export interface LineFieldMotionState {
  readonly epoch: number
  readonly mode: LineFieldMode
  readonly canonicalOffsets: readonly number[]
  readonly zeroOffsets: readonly number[]
  readonly lastValidGeometry: LineFieldViewportGeometry | null
  readonly previousSampleNowMs: number | null
  readonly previousScrollBuildSample: ScrollBuildSample | null
  readonly frontVelocityPxPerSecond: number
  readonly phaseVelocityRadiansPerSecond: number
  readonly pointerProximity: number
  readonly pointerTwistNormalized: number
  readonly lastSnapshot: LineFieldMotionSnapshot | null
  readonly handoffCapture: LineFieldMotionSnapshot | null
  readonly motionElapsedSeconds: number
  readonly motionViewportHeight: number
  readonly lockedSourceOriginViewportFraction: number | null
  readonly handoffScrollY: number | null
  readonly scrollPhaseOffsetRadians: number
  readonly reverseCapture: LineFieldMotionSnapshot | null
}

export interface LineFieldMotionInput {
  readonly geometry: LineFieldViewportGeometry
  readonly theme: 'light' | 'dark'
  readonly pointerTarget: LineFieldPointerTarget
  readonly nowMs: number
  readonly clockMode: 'advance' | 'rebase'
}

export interface LineFieldMotionResult {
  readonly state: LineFieldMotionState
  readonly frame: LineFieldRenderFrame
  readonly motto: MottoOrbitFrame
  readonly requestFrame: boolean
  readonly frontVelocityPxPerSecond: number
  readonly phaseVelocityRadiansPerSecond: number
}

export interface LineFieldMotionSnapshot {
  readonly sourceOriginViewportFraction: number
  readonly commonFrontDocumentY: number
  readonly unwrappedPhase: number
  readonly tipOffsetsViewportFractions: readonly number[]
  readonly upwardSpineReveal: number
  readonly opacity: number
  readonly pointerProximity: number
  readonly pointerTwistNormalized: number
  readonly frontVelocityPxPerSecond: number
  readonly phaseVelocityRadiansPerSecond: number
}

interface ClockDeltas {
  readonly sampleDeltaSeconds: number
  readonly simulationDeltaSeconds: number
  readonly nextSampleNowMs: number | null
}

interface PointerFrame {
  readonly proximity: number
  readonly twistNormalized: number
  readonly unsettled: boolean
}

const TAU = 2 * Math.PI

export const POINTER_SETTLING_EPSILON = 0.001
export const MAX_FRAME_DELTA_SECONDS = 0.05
export const TIP_OFFSET_SETTLING_EPSILON = 0.00001

const finiteOrZero = (value: number) => Number.isFinite(value) ? value : 0

const finiteOr = (value: number, fallback: number) => Number.isFinite(value) ? value : fallback

const clamp01 = (value: number) => Math.min(1, Math.max(0, finiteOrZero(value)))

const clampSigned = (value: number) => Math.min(1, Math.max(-1, finiteOrZero(value)))

const mix = (from: number, to: number, progress: number) => from + (to - from) * progress

const smoothstep01 = (value: number) => {
  const progress = clamp01(value)
  return progress * progress * (3 - 2 * progress)
}

const smoothstepIntegral01 = (value: number) => {
  const progress = clamp01(value)
  return progress ** 3 - progress ** 4 / 2
}

const liveSourceOriginViewportFraction = (geometry: LineFieldViewportGeometry) => finiteOrZero(
  geometry.anchorViewport[1] / Math.max(1, geometry.viewportHeight),
)

const normalizeElapsedSeconds = (value: number, fallback: number) => {
  const elapsed = finiteOr(value, fallback)
  return Math.round(elapsed * 1e12) / 1e12
}

function resolveClockDeltas(
  previousSampleNowMs: number | null,
  input: LineFieldMotionInput,
): ClockDeltas {
  if (!Number.isFinite(input.nowMs)) {
    return {
      sampleDeltaSeconds: 0,
      simulationDeltaSeconds: 0,
      nextSampleNowMs: null,
    }
  }

  if (
    input.clockMode === 'rebase'
    || previousSampleNowMs === null
    || input.nowMs < previousSampleNowMs
  ) {
    return {
      sampleDeltaSeconds: 0,
      simulationDeltaSeconds: 0,
      nextSampleNowMs: input.nowMs,
    }
  }

  const sampleDeltaSeconds = Math.max(0, (input.nowMs - previousSampleNowMs) / 1000)

  return {
    sampleDeltaSeconds,
    simulationDeltaSeconds: Math.min(sampleDeltaSeconds, MAX_FRAME_DELTA_SECONDS),
    nextSampleNowMs: input.nowMs,
  }
}

function settlePointer(
  currentProximity: number,
  currentTwistNormalized: number,
  target: LineFieldPointerTarget,
  deltaSeconds: number,
  smoothingSeconds: number,
): PointerFrame {
  const targetProximity = clamp01(target.proximity)
  const targetTwistNormalized = clampSigned(target.twistNormalized)
  const safeCurrentProximity = clamp01(currentProximity)
  const safeCurrentTwistNormalized = clampSigned(currentTwistNormalized)

  if (deltaSeconds <= 0 || !Number.isFinite(deltaSeconds)) {
    return {
      proximity: safeCurrentProximity,
      twistNormalized: safeCurrentTwistNormalized,
      unsettled: Math.abs(safeCurrentProximity - targetProximity) > POINTER_SETTLING_EPSILON
        || Math.abs(safeCurrentTwistNormalized - targetTwistNormalized)
          > POINTER_SETTLING_EPSILON,
    }
  }

  const timeConstant = Number.isFinite(smoothingSeconds) && smoothingSeconds > 0
    ? smoothingSeconds
    : 0
  const alpha = deltaSeconds > 0 && timeConstant > 0
    ? 1 - Math.exp(-deltaSeconds / timeConstant)
    : timeConstant === 0
      ? 1
      : 0
  let proximity = mix(safeCurrentProximity, targetProximity, alpha)
  let twistNormalized = mix(safeCurrentTwistNormalized, targetTwistNormalized, alpha)
  let unsettled = Math.abs(proximity - targetProximity) > POINTER_SETTLING_EPSILON
    || Math.abs(twistNormalized - targetTwistNormalized) > POINTER_SETTLING_EPSILON

  if (!unsettled) {
    proximity = targetProximity
    twistNormalized = targetTwistNormalized
    unsettled = false
  }

  return { proximity, twistNormalized, unsettled }
}

function frameFromSnapshot(
  mode: LineFieldMode,
  theme: 'light' | 'dark',
  geometry: LineFieldViewportGeometry,
  metrics: LineFieldScrollMetrics,
  snapshot: LineFieldMotionSnapshot,
): LineFieldRenderFrame {
  return {
    mode,
    theme,
    anchorViewport: geometry.anchorViewport,
    sourceOriginViewportFraction: snapshot.sourceOriginViewportFraction,
    headerTargetViewportY: geometry.headerTargetViewportY,
    originDocumentY: metrics.originDocumentY,
    commonFrontDocumentY: snapshot.commonFrontDocumentY,
    upwardSpineReveal: snapshot.upwardSpineReveal,
    unwrappedPhase: snapshot.unwrappedPhase,
    tipOffsetsViewportFractions: snapshot.tipOffsetsViewportFractions,
    pointerProximity: snapshot.pointerProximity,
    opacity: snapshot.opacity,
    filmProgress: metrics.filmProgress,
    mottoProgress: metrics.mottoProgress,
  }
}

function resultFromSnapshot(
  state: LineFieldMotionState,
  snapshot: LineFieldMotionSnapshot,
  geometry: LineFieldViewportGeometry,
  metrics: LineFieldScrollMetrics,
  theme: 'light' | 'dark',
  requestFrame: boolean,
  config: LineFieldAnimationConfig,
): LineFieldMotionResult {
  return {
    state,
    frame: frameFromSnapshot(
      state.mode,
      theme,
      geometry,
      metrics,
      snapshot,
    ),
    motto: evaluateMottoOrbit(
      metrics.mottoProgress,
      geometry,
      config.motto,
    ),
    requestFrame,
    frontVelocityPxPerSecond: snapshot.frontVelocityPxPerSecond,
    phaseVelocityRadiansPerSecond: snapshot.phaseVelocityRadiansPerSecond,
  }
}

function scrollBuildSnapshot(
  state: LineFieldMotionState,
  geometry: LineFieldViewportGeometry,
  metrics: LineFieldScrollMetrics,
  pointer: PointerFrame,
  sampleDeltaSeconds: number,
  config: LineFieldAnimationConfig,
): {
  readonly snapshot: LineFieldMotionSnapshot
  readonly sample: ScrollBuildSample
  readonly buildProgress: number
} {
  const buildProgress = smoothstep01(
    (metrics.scrollY - metrics.seedScrollY)
      / Math.max(1, metrics.buildEndScrollY - metrics.seedScrollY),
  )
  const upwardSpineReveal = smoothstep01(
    (metrics.scrollY - metrics.preloadScrollY)
      / Math.max(1, metrics.seedScrollY - metrics.preloadScrollY),
  )
  const maximumCanonicalOffset = Math.max(0, ...state.canonicalOffsets)
  const tipOffsetsViewportFractions = buildProgress === 1
    ? state.canonicalOffsets
    : state.canonicalOffsets.map((offset) => finiteOrZero(offset * buildProgress))
  const targetCommonFrontDocumentY = metrics.handoffDocumentY
    - maximumCanonicalOffset * geometry.viewportHeight
  const commonFrontDocumentY = mix(
    metrics.originDocumentY,
    targetCommonFrontDocumentY,
    buildProgress,
  )
  const unwrappedPhase = TAU * config.wave.scrollPhaseCycles * buildProgress
    + finiteOrZero(state.scrollPhaseOffsetRadians)
  let frontVelocityPxPerSecond = state.frontVelocityPxPerSecond
  let phaseVelocityRadiansPerSecond = state.phaseVelocityRadiansPerSecond

  if (
    state.previousScrollBuildSample !== null
    && metrics.scrollY > state.previousScrollBuildSample.scrollY
    && sampleDeltaSeconds > 0
  ) {
    const nextFrontVelocity = (
      commonFrontDocumentY - state.previousScrollBuildSample.commonFrontDocumentY
    ) / sampleDeltaSeconds
    const nextPhaseVelocity = (
      unwrappedPhase - state.previousScrollBuildSample.unwrappedPhase
    ) / sampleDeltaSeconds

    if (Number.isFinite(nextFrontVelocity) && nextFrontVelocity > 0) {
      frontVelocityPxPerSecond = nextFrontVelocity
    }
    if (Number.isFinite(nextPhaseVelocity) && nextPhaseVelocity > 0) {
      phaseVelocityRadiansPerSecond = nextPhaseVelocity
    }
  }

  const sample = {
    scrollY: metrics.scrollY,
    commonFrontDocumentY,
    unwrappedPhase,
  }

  return {
    buildProgress,
    sample,
    snapshot: {
      sourceOriginViewportFraction: liveSourceOriginViewportFraction(geometry),
      commonFrontDocumentY,
      unwrappedPhase,
      tipOffsetsViewportFractions,
      upwardSpineReveal,
      opacity: upwardSpineReveal,
      pointerProximity: pointer.proximity,
      pointerTwistNormalized: pointer.twistNormalized,
      frontVelocityPxPerSecond,
      phaseVelocityRadiansPerSecond,
    },
  }
}

function interpolateMotionSnapshot(
  from: LineFieldMotionSnapshot,
  to: LineFieldMotionSnapshot,
  progress: number,
): LineFieldMotionSnapshot {
  const ratio = clamp01(progress)
  const tipOffsetsViewportFractions = ratio === 0
    ? from.tipOffsetsViewportFractions
    : ratio === 1
      ? to.tipOffsetsViewportFractions
      : from.tipOffsetsViewportFractions.map((offset, laneId) => finiteOr(
          mix(offset, to.tipOffsetsViewportFractions[laneId] ?? 0, ratio),
          offset,
        ))

  return {
    sourceOriginViewportFraction: finiteOr(
      mix(from.sourceOriginViewportFraction, to.sourceOriginViewportFraction, ratio),
      from.sourceOriginViewportFraction,
    ),
    commonFrontDocumentY: finiteOr(
      mix(from.commonFrontDocumentY, to.commonFrontDocumentY, ratio),
      from.commonFrontDocumentY,
    ),
    unwrappedPhase: finiteOr(
      mix(from.unwrappedPhase, to.unwrappedPhase, ratio),
      from.unwrappedPhase,
    ),
    tipOffsetsViewportFractions,
    upwardSpineReveal: finiteOr(
      mix(from.upwardSpineReveal, to.upwardSpineReveal, ratio),
      from.upwardSpineReveal,
    ),
    opacity: finiteOr(mix(from.opacity, to.opacity, ratio), from.opacity),
    pointerProximity: finiteOr(
      mix(from.pointerProximity, to.pointerProximity, ratio),
      from.pointerProximity,
    ),
    pointerTwistNormalized: finiteOr(
      mix(from.pointerTwistNormalized, to.pointerTwistNormalized, ratio),
      from.pointerTwistNormalized,
    ),
    frontVelocityPxPerSecond: finiteOr(
      mix(from.frontVelocityPxPerSecond, to.frontVelocityPxPerSecond, ratio),
      from.frontVelocityPxPerSecond,
    ),
    phaseVelocityRadiansPerSecond: finiteOr(
      mix(from.phaseVelocityRadiansPerSecond, to.phaseVelocityRadiansPerSecond, ratio),
      from.phaseVelocityRadiansPerSecond,
    ),
  }
}

function evaluateAnalyticMotion(
  capture: LineFieldMotionSnapshot,
  elapsedSeconds: number,
  viewportHeight: number,
  lockedSourceOriginViewportFraction: number,
  zeroOffsets: readonly number[],
  config: LineFieldAnimationConfig,
): { readonly mode: 'auto-handoff' | 'autonomous'; readonly snapshot: LineFieldMotionSnapshot } {
  const duration = Math.max(0, finiteOrZero(config.handoff.velocityBlendSeconds))
  const elapsed = Math.max(0, finiteOrZero(elapsedSeconds))
  const targetFrontVelocity = config.fronts.autonomousVelocityViewportPerSecond * viewportHeight
  const targetPhaseVelocity = TAU * config.wave.autonomousCyclesPerSecond
  const acceleration = config.fronts.autonomousAccelerationViewportPerSecondSquared
    * viewportHeight
  const catchupRate = Math.max(0, finiteOrZero(config.fronts.catchupRatePerSecond))
  const captureUsesSettledOffsets = capture.tipOffsetsViewportFractions === zeroOffsets
  const catchupMultiplier = elapsed > 0 && !captureUsesSettledOffsets
    ? Math.exp(-catchupRate * elapsed)
    : 1
  const maximumConfiguredOffset = Math.max(
    0,
    finiteOrZero(
      config.fronts.maximumTipGapVh
        * config.fronts.staggerStrength
        / 200,
    ),
  )
  const offsetsHaveSettled = captureUsesSettledOffsets
    || maximumConfiguredOffset * catchupMultiplier <= TIP_OFFSET_SETTLING_EPSILON
  const tipOffsetsViewportFractions = elapsed === 0
    ? capture.tipOffsetsViewportFractions
    : offsetsHaveSettled
      ? zeroOffsets
      : capture.tipOffsetsViewportFractions.map(
          offset => finiteOrZero(offset * catchupMultiplier),
        )

  if (elapsed < duration) {
    const ratio = duration > 0 ? elapsed / duration : 1
    const easedVelocity = smoothstep01(ratio)
    const integratedBlend = smoothstepIntegral01(ratio)

    return {
      mode: 'auto-handoff',
      snapshot: {
        ...capture,
        sourceOriginViewportFraction: mix(
          capture.sourceOriginViewportFraction,
          lockedSourceOriginViewportFraction,
          easedVelocity,
        ),
        upwardSpineReveal: mix(capture.upwardSpineReveal, 1, easedVelocity),
        opacity: mix(capture.opacity, 1, easedVelocity),
        tipOffsetsViewportFractions,
        commonFrontDocumentY: finiteOr(
          capture.commonFrontDocumentY
            + capture.frontVelocityPxPerSecond * elapsed
            + (targetFrontVelocity - capture.frontVelocityPxPerSecond)
              * duration * integratedBlend,
          capture.commonFrontDocumentY,
        ),
        unwrappedPhase: finiteOr(
          capture.unwrappedPhase
            + capture.phaseVelocityRadiansPerSecond * elapsed
            + (targetPhaseVelocity - capture.phaseVelocityRadiansPerSecond)
              * duration * integratedBlend,
          capture.unwrappedPhase,
        ),
        frontVelocityPxPerSecond: finiteOr(
          capture.frontVelocityPxPerSecond
            + (targetFrontVelocity - capture.frontVelocityPxPerSecond) * easedVelocity,
          capture.frontVelocityPxPerSecond,
        ),
        phaseVelocityRadiansPerSecond: finiteOr(
          capture.phaseVelocityRadiansPerSecond
            + (targetPhaseVelocity - capture.phaseVelocityRadiansPerSecond) * easedVelocity,
          capture.phaseVelocityRadiansPerSecond,
        ),
      },
    }
  }

  const frontAtBlendEnd = capture.commonFrontDocumentY
    + capture.frontVelocityPxPerSecond * duration
    + (targetFrontVelocity - capture.frontVelocityPxPerSecond) * duration / 2
  const phaseAtBlendEnd = capture.unwrappedPhase
    + capture.phaseVelocityRadiansPerSecond * duration
    + (targetPhaseVelocity - capture.phaseVelocityRadiansPerSecond) * duration / 2
  const autonomousRemainder = Math.max(0, elapsed - duration)

  return {
    mode: 'autonomous',
    snapshot: {
      ...capture,
      sourceOriginViewportFraction: lockedSourceOriginViewportFraction,
      upwardSpineReveal: 1,
      opacity: 1,
      tipOffsetsViewportFractions,
      commonFrontDocumentY: finiteOr(
        frontAtBlendEnd
          + targetFrontVelocity * autonomousRemainder
          + 0.5 * acceleration * autonomousRemainder ** 2,
        capture.commonFrontDocumentY,
      ),
      unwrappedPhase: finiteOr(
        phaseAtBlendEnd + targetPhaseVelocity * autonomousRemainder,
        capture.unwrappedPhase,
      ),
      frontVelocityPxPerSecond: finiteOr(
        targetFrontVelocity + acceleration * autonomousRemainder,
        targetFrontVelocity,
      ),
      phaseVelocityRadiansPerSecond: finiteOr(targetPhaseVelocity, 0),
    },
  }
}

function dormantFallback(
  state: LineFieldMotionState,
  input: LineFieldMotionInput,
  clock: ClockDeltas,
  config: LineFieldAnimationConfig,
): LineFieldMotionResult {
  const snapshot: LineFieldMotionSnapshot = {
    sourceOriginViewportFraction: 0,
    commonFrontDocumentY: 0,
    unwrappedPhase: 0,
    tipOffsetsViewportFractions: state.zeroOffsets,
    upwardSpineReveal: 0,
    opacity: 0,
    pointerProximity: 0,
    pointerTwistNormalized: 0,
    frontVelocityPxPerSecond: 0,
    phaseVelocityRadiansPerSecond: 0,
  }
  const nextState: LineFieldMotionState = {
    ...state,
    mode: 'dormant',
    previousSampleNowMs: clock.nextSampleNowMs,
    pointerProximity: 0,
    pointerTwistNormalized: 0,
    lastSnapshot: snapshot,
    scrollPhaseOffsetRadians: 0,
  }
  const geometry: LineFieldViewportGeometry = {
    scrollY: 0,
    viewportWidth: 1,
    viewportHeight: 1,
    pageHeight: 1,
    filmTop: 0,
    filmHeight: 1,
    anchorViewport: [0, 0],
    headerTargetViewportY: 0,
    mottoTop: 0,
    mottoHeight: 0,
    mottoCardFinalCenterX: 0,
    mottoCardFinalWidth: 0,
    mottoCardFinalHeight: 0,
    mottoCardFinalTop: 0,
    mottoCardFinalBottom: 0,
  }
  const metrics = deriveLineFieldScrollMetrics(geometry, config)

  if (metrics === null) {
    throw new Error('Internal finite fallback geometry was rejected')
  }

  return resultFromSnapshot(
    nextState,
    snapshot,
    geometry,
    metrics,
    input.theme === 'light' ? 'light' : 'dark',
    false,
    config,
  )
}

export function getLineFieldMotionSnapshot(
  result: LineFieldMotionResult,
): LineFieldMotionSnapshot {
  return {
    sourceOriginViewportFraction: result.frame.sourceOriginViewportFraction,
    commonFrontDocumentY: result.frame.commonFrontDocumentY,
    unwrappedPhase: result.frame.unwrappedPhase,
    tipOffsetsViewportFractions: result.frame.tipOffsetsViewportFractions,
    upwardSpineReveal: result.frame.upwardSpineReveal,
    opacity: result.frame.opacity,
    pointerProximity: result.frame.pointerProximity,
    pointerTwistNormalized: result.state.pointerTwistNormalized,
    frontVelocityPxPerSecond: result.frontVelocityPxPerSecond,
    phaseVelocityRadiansPerSecond: result.phaseVelocityRadiansPerSecond,
  }
}

export function createLineFieldMotionState(
  config: LineFieldAnimationConfig,
): LineFieldMotionState {
  const canonicalOffsets = createLaneTipOffsets({
    tipCount: config.geometry.staggeredTipCount,
    seed: config.fronts.seed,
    maximumTipGapVh: config.fronts.maximumTipGapVh / 100,
    staggerStrength: config.fronts.staggerStrength,
  })
  const zeroOffsets = canonicalOffsets.map(() => 0)

  return {
    epoch: 0,
    mode: 'dormant',
    canonicalOffsets,
    zeroOffsets,
    lastValidGeometry: null,
    previousSampleNowMs: null,
    previousScrollBuildSample: null,
    frontVelocityPxPerSecond: 0,
    phaseVelocityRadiansPerSecond: 0,
    pointerProximity: 0,
    pointerTwistNormalized: 0,
    lastSnapshot: null,
    handoffCapture: null,
    motionElapsedSeconds: 0,
    motionViewportHeight: 0,
    lockedSourceOriginViewportFraction: null,
    handoffScrollY: null,
    scrollPhaseOffsetRadians: 0,
    reverseCapture: null,
  }
}

export function stepLineFieldMotion(
  state: LineFieldMotionState,
  input: LineFieldMotionInput,
  config: LineFieldAnimationConfig,
): LineFieldMotionResult {
  const clock = resolveClockDeltas(state.previousSampleNowMs, input)
  const inputMetrics = deriveLineFieldScrollMetrics(input.geometry, config)
  const geometryCandidate = inputMetrics === null ? state.lastValidGeometry : input.geometry

  if (geometryCandidate === null) {
    return dormantFallback(state, input, clock, config)
  }

  const metrics = inputMetrics ?? deriveLineFieldScrollMetrics(geometryCandidate, config)
  if (metrics === null) {
    return dormantFallback(state, input, clock, config)
  }

  const geometry: LineFieldViewportGeometry = {
    ...geometryCandidate,
    scrollY: metrics.scrollY,
  }
  const theme = input.theme === 'light' ? 'light' : 'dark'

  if (state.mode === 'reverse-gather' && state.reverseCapture !== null) {
    if (
      state.handoffScrollY !== null
      && metrics.scrollY >= state.handoffScrollY
      && state.lastSnapshot !== null
    ) {
      const capture = state.lastSnapshot
      const nextState: LineFieldMotionState = {
        ...state,
        epoch: state.epoch + 1,
        mode: 'auto-handoff',
        lastValidGeometry: geometry,
        previousSampleNowMs: clock.nextSampleNowMs,
        pointerProximity: capture.pointerProximity,
        pointerTwistNormalized: capture.pointerTwistNormalized,
        lastSnapshot: capture,
        handoffCapture: capture,
        motionElapsedSeconds: 0,
        motionViewportHeight: geometry.viewportHeight,
        reverseCapture: null,
        frontVelocityPxPerSecond: capture.frontVelocityPxPerSecond,
        phaseVelocityRadiansPerSecond: capture.phaseVelocityRadiansPerSecond,
      }

      return resultFromSnapshot(
        nextState,
        capture,
        geometry,
        metrics,
        theme,
        true,
        config,
      )
    }

    const pointer = settlePointer(
      state.pointerProximity,
      state.pointerTwistNormalized,
      input.pointerTarget,
      clock.simulationDeltaSeconds,
      config.pointer.smoothingSeconds,
    )
    const capture = state.reverseCapture
    const targetBuild = scrollBuildSnapshot(
      state,
      geometry,
      metrics,
      pointer,
      0,
      config,
    )
    const target: LineFieldMotionSnapshot = {
      ...targetBuild.snapshot,
      frontVelocityPxPerSecond: 0,
      phaseVelocityRadiansPerSecond: 0,
    }
    const duration = Math.max(0, finiteOrZero(config.handoff.velocityBlendSeconds))
    const nextElapsedSeconds = normalizeElapsedSeconds(
      state.motionElapsedSeconds + clock.sampleDeltaSeconds,
      state.motionElapsedSeconds,
    )
    const gatherProgress = duration > 0
      ? clamp01(nextElapsedSeconds / duration)
      : 1
    const easedGather = smoothstep01(gatherProgress)
    const settledPhase = capture.unwrappedPhase
      + capture.phaseVelocityRadiansPerSecond * duration / 2
    const deceleratingPhase = capture.unwrappedPhase
      + capture.phaseVelocityRadiansPerSecond
        * duration
        * (gatherProgress - smoothstepIntegral01(gatherProgress))
    const snapshot = gatherProgress === 1
      ? target
      : {
          ...interpolateMotionSnapshot(capture, target, easedGather),
          unwrappedPhase: finiteOr(
            deceleratingPhase
              + (target.unwrappedPhase - settledPhase) * easedGather,
            capture.unwrappedPhase,
          ),
          pointerProximity: pointer.proximity,
          pointerTwistNormalized: pointer.twistNormalized,
        }

    if (gatherProgress === 1) {
      const nextState: LineFieldMotionState = {
        ...state,
        mode: 'scroll-build',
        lastValidGeometry: geometry,
        previousSampleNowMs: clock.nextSampleNowMs,
        previousScrollBuildSample: targetBuild.sample,
        pointerProximity: pointer.proximity,
        pointerTwistNormalized: pointer.twistNormalized,
        lastSnapshot: target,
        handoffCapture: null,
        motionElapsedSeconds: 0,
        motionViewportHeight: 0,
        lockedSourceOriginViewportFraction: null,
        handoffScrollY: null,
        reverseCapture: null,
        frontVelocityPxPerSecond: 0,
        phaseVelocityRadiansPerSecond: 0,
      }

      return resultFromSnapshot(
        nextState,
        target,
        geometry,
        metrics,
        theme,
        pointer.unsettled,
        config,
      )
    }

    const nextState: LineFieldMotionState = {
      ...state,
      mode: 'reverse-gather',
      lastValidGeometry: geometry,
      previousSampleNowMs: clock.nextSampleNowMs,
      pointerProximity: pointer.proximity,
      pointerTwistNormalized: pointer.twistNormalized,
      lastSnapshot: snapshot,
      motionElapsedSeconds: nextElapsedSeconds,
      frontVelocityPxPerSecond: snapshot.frontVelocityPxPerSecond,
      phaseVelocityRadiansPerSecond: snapshot.phaseVelocityRadiansPerSecond,
    }

    return resultFromSnapshot(
      nextState,
      snapshot,
      geometry,
      metrics,
      theme,
      true,
      config,
    )
  }

  if (
    (state.mode === 'auto-handoff' || state.mode === 'autonomous')
    && state.handoffCapture !== null
  ) {
    const handoffScrollY = state.handoffScrollY ?? metrics.buildEndScrollY

    if (
      metrics.scrollY < handoffScrollY - config.handoff.reverseDeadbandPx
      && state.lastSnapshot !== null
    ) {
      const capture = state.lastSnapshot
      const buildProgress = smoothstep01(
        (metrics.scrollY - metrics.seedScrollY)
          / Math.max(1, metrics.buildEndScrollY - metrics.seedScrollY),
      )
      const canonicalScrollPhase = TAU * config.wave.scrollPhaseCycles * buildProgress
      const duration = Math.max(0, finiteOrZero(config.handoff.velocityBlendSeconds))
      const settledPhase = capture.unwrappedPhase
        + capture.phaseVelocityRadiansPerSecond * duration / 2
      const scrollPhaseOffsetRadians = finiteOr(
        settledPhase - canonicalScrollPhase,
        state.scrollPhaseOffsetRadians,
      )
      const nextState: LineFieldMotionState = {
        ...state,
        mode: 'reverse-gather',
        lastValidGeometry: geometry,
        previousSampleNowMs: clock.nextSampleNowMs,
        lastSnapshot: capture,
        motionElapsedSeconds: 0,
        handoffScrollY,
        scrollPhaseOffsetRadians,
        reverseCapture: capture,
        frontVelocityPxPerSecond: capture.frontVelocityPxPerSecond,
        phaseVelocityRadiansPerSecond: capture.phaseVelocityRadiansPerSecond,
      }

      return resultFromSnapshot(
        nextState,
        capture,
        geometry,
        metrics,
        theme,
        true,
        config,
      )
    }

    const pointer = settlePointer(
      state.pointerProximity,
      state.pointerTwistNormalized,
      input.pointerTarget,
      clock.simulationDeltaSeconds,
      config.pointer.smoothingSeconds,
    )
    const nextElapsedSeconds = normalizeElapsedSeconds(
      state.motionElapsedSeconds + clock.sampleDeltaSeconds,
      state.motionElapsedSeconds,
    )
    const analytic = evaluateAnalyticMotion(
      state.handoffCapture,
      nextElapsedSeconds,
      state.motionViewportHeight,
      state.lockedSourceOriginViewportFraction
        ?? state.handoffCapture.sourceOriginViewportFraction,
      state.zeroOffsets,
      config,
    )
    const snapshot: LineFieldMotionSnapshot = {
      ...analytic.snapshot,
      pointerProximity: pointer.proximity,
      pointerTwistNormalized: pointer.twistNormalized,
    }
    const nextState: LineFieldMotionState = {
      ...state,
      mode: analytic.mode,
      lastValidGeometry: geometry,
      previousSampleNowMs: clock.nextSampleNowMs,
      pointerProximity: pointer.proximity,
      pointerTwistNormalized: pointer.twistNormalized,
      lastSnapshot: snapshot,
      motionElapsedSeconds: nextElapsedSeconds,
      handoffScrollY,
      frontVelocityPxPerSecond: snapshot.frontVelocityPxPerSecond,
      phaseVelocityRadiansPerSecond: snapshot.phaseVelocityRadiansPerSecond,
    }

    return resultFromSnapshot(
      nextState,
      snapshot,
      geometry,
      metrics,
      theme,
      true,
      config,
    )
  }

  const afterPreload = metrics.scrollY >= metrics.preloadScrollY
  const pointer = afterPreload
    ? settlePointer(
      state.pointerProximity,
      state.pointerTwistNormalized,
      input.pointerTarget,
      clock.simulationDeltaSeconds,
      config.pointer.smoothingSeconds,
    )
    : {
      proximity: state.pointerProximity,
      twistNormalized: state.pointerTwistNormalized,
      unsettled: false,
    }
  const build = scrollBuildSnapshot(
    state,
    geometry,
    metrics,
    pointer,
    clock.sampleDeltaSeconds,
    config,
  )
  const leadingTipDocumentY = build.snapshot.commonFrontDocumentY
    + Math.max(0, ...build.snapshot.tipOffsetsViewportFractions) * geometry.viewportHeight
  const reachesHandoff = afterPreload
    && (build.buildProgress === 1 || leadingTipDocumentY >= metrics.handoffDocumentY)

  if (reachesHandoff) {
    const capture = build.snapshot
    const nextState: LineFieldMotionState = {
      ...state,
      mode: 'auto-handoff',
      lastValidGeometry: geometry,
      previousSampleNowMs: clock.nextSampleNowMs,
      previousScrollBuildSample: build.sample,
      frontVelocityPxPerSecond: capture.frontVelocityPxPerSecond,
      phaseVelocityRadiansPerSecond: capture.phaseVelocityRadiansPerSecond,
      pointerProximity: pointer.proximity,
      pointerTwistNormalized: pointer.twistNormalized,
      lastSnapshot: capture,
      handoffCapture: capture,
      motionElapsedSeconds: 0,
      motionViewportHeight: geometry.viewportHeight,
      lockedSourceOriginViewportFraction: capture.sourceOriginViewportFraction,
      handoffScrollY: metrics.buildEndScrollY,
      reverseCapture: null,
    }

    return resultFromSnapshot(
      nextState,
      capture,
      geometry,
      metrics,
      theme,
      true,
      config,
    )
  }

  const mode: LineFieldMode = afterPreload ? 'scroll-build' : 'dormant'
  const nextState: LineFieldMotionState = {
    ...state,
    mode,
    lastValidGeometry: geometry,
    previousSampleNowMs: clock.nextSampleNowMs,
    previousScrollBuildSample: afterPreload ? build.sample : null,
    frontVelocityPxPerSecond: build.snapshot.frontVelocityPxPerSecond,
    phaseVelocityRadiansPerSecond: build.snapshot.phaseVelocityRadiansPerSecond,
    pointerProximity: pointer.proximity,
    pointerTwistNormalized: pointer.twistNormalized,
    lastSnapshot: build.snapshot,
    scrollPhaseOffsetRadians: afterPreload ? state.scrollPhaseOffsetRadians : 0,
  }

  return resultFromSnapshot(
    nextState,
    build.snapshot,
    geometry,
    metrics,
    theme,
    afterPreload && pointer.unsettled,
    config,
  )
}
