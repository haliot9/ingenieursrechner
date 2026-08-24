export interface LaneTipOffsetParameters {
  readonly tipCount: number
  readonly seed: number
  readonly maximumTipGapVh: number
  readonly staggerStrength: number
}

const finiteOrZero = (value: number) => Number.isFinite(value) ? value : 0

const clamp01 = (value: number) => Math.min(1, Math.max(0, finiteOrZero(value)))

export function createLaneTipOffsets(parameters: LaneTipOffsetParameters): readonly number[] {
  const tipCount = Math.max(0, Math.floor(finiteOrZero(parameters.tipCount)))
  const maximumTipGapVh = Math.max(0, finiteOrZero(parameters.maximumTipGapVh))
  const staggerStrength = clamp01(parameters.staggerStrength)
  const halfGap = maximumTipGapVh * staggerStrength / 2
  let hash = Math.trunc(finiteOrZero(parameters.seed)) >>> 0

  return Array.from({ length: tipCount }, (_, laneIndex) => {
    hash = (hash + 0x6D2B79F5) >>> 0
    let value = hash
    value = Math.imul(value ^ value >>> 15, value | 1)
    value ^= value + Math.imul(value ^ value >>> 7, value | 61)
    value = (value ^ value >>> 14) >>> 0

    if (laneIndex === 0 || halfGap === 0) {
      return 0
    }

    return (value / 0x100000000 * 2 - 1) * halfGap
  })
}

export function settleTipOffset(
  current: number,
  target: number,
  catchupRatePerSecond: number,
  deltaSeconds: number,
): number {
  const sanitizedCurrent = finiteOrZero(current)

  if (
    !Number.isFinite(catchupRatePerSecond)
    || catchupRatePerSecond <= 0
    || !Number.isFinite(deltaSeconds)
    || deltaSeconds <= 0
  ) {
    return sanitizedCurrent
  }

  const sanitizedTarget = finiteOrZero(target)
  const settled = sanitizedTarget
    + (sanitizedCurrent - sanitizedTarget) * Math.exp(-catchupRatePerSecond * deltaSeconds)

  return finiteOrZero(settled)
}
