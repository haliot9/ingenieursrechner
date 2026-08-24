export interface WrightTimelineState {
  filmProgress: number
  themeFade: number
  decay: number
  lightOpacity: number
  darkOpacity: number
  activeCopyTheme: 'light' | 'dark'
  driftX: number
  rotation: number
  jitterX: number
  jitterY: number
  blur: number
  displacementScale: number
  turbulenceFrequency: number
  chromaticWash: number
  fractureSlope: number
  fractureIntercept: number
  charredOpacity: number
  ashOpacity: number
  desaturation: number
  contrast: number
}

export const WRIGHT_TIMELINE = {
  decayStart: 0.72,
  swapStart: 0.849,
  swapPoint: 0.855,
  swapEnd: 0.861,
  decayEnd: 0.97,
  themeFadeStart: 0.80,
  themeFadeEnd: 1,
} as const

const clamp01 = (value: number) => Math.min(1, Math.max(0, Number.isFinite(value) ? value : 0))

const smootherstep = (from: number, to: number, value: number) => {
  const x = clamp01((value - from) / Math.max(Number.EPSILON, to - from))
  return x * x * x * (x * (x * 6 - 15) + 10)
}

const stableLightState = (filmProgress: number): WrightTimelineState => ({
  filmProgress,
  themeFade: smootherstep(WRIGHT_TIMELINE.themeFadeStart, WRIGHT_TIMELINE.themeFadeEnd, filmProgress),
  decay: 0,
  lightOpacity: 1,
  darkOpacity: 0,
  activeCopyTheme: 'light',
  driftX: 0,
  rotation: 0,
  jitterX: 0,
  jitterY: 0,
  blur: 0,
  displacementScale: 0,
  turbulenceFrequency: 0,
  chromaticWash: 0,
  fractureSlope: 0,
  fractureIntercept: 1,
  charredOpacity: 0,
  ashOpacity: 0,
  desaturation: 0,
  contrast: 1,
})

export function wrightTimeline(progress: number, selectedTheme: 'light' | 'dark'): WrightTimelineState {
  const filmProgress = clamp01(progress)

  if (selectedTheme === 'light' || filmProgress <= WRIGHT_TIMELINE.decayStart) {
    return stableLightState(filmProgress)
  }

  const rise = smootherstep(WRIGHT_TIMELINE.decayStart, WRIGHT_TIMELINE.swapPoint, filmProgress)
  const fall = 1 - smootherstep(WRIGHT_TIMELINE.swapPoint, WRIGHT_TIMELINE.decayEnd, filmProgress)
  const decay = clamp01(Math.min(rise, fall))
  const crossfade = smootherstep(WRIGHT_TIMELINE.swapStart, WRIGHT_TIMELINE.swapEnd, filmProgress)
  const peak = smootherstep(0.82, WRIGHT_TIMELINE.swapPoint, filmProgress)
    * (1 - smootherstep(WRIGHT_TIMELINE.swapPoint, 0.90, filmProgress))
  const fracture = clamp01(peak)

  return {
    filmProgress,
    themeFade: smootherstep(WRIGHT_TIMELINE.themeFadeStart, WRIGHT_TIMELINE.themeFadeEnd, filmProgress),
    decay,
    lightOpacity: clamp01(1 - crossfade),
    darkOpacity: crossfade,
    activeCopyTheme: filmProgress >= WRIGHT_TIMELINE.swapPoint ? 'dark' : 'light',
    driftX: 8 * decay * Math.sin(filmProgress * Math.PI * 3),
    rotation: 0.35 * decay * Math.sin(filmProgress * Math.PI * 2),
    jitterX: fracture * Math.sin(filmProgress * Math.PI * 97),
    jitterY: fracture * Math.cos(filmProgress * Math.PI * 83),
    blur: 3.5 * decay,
    displacementScale: 92 * decay,
    turbulenceFrequency: decay === 0 ? 0 : 0.012 + 0.034 * decay,
    chromaticWash: 0.42 * decay,
    fractureSlope: 7 * fracture,
    fractureIntercept: Math.max(-3.78, 1 - 4.78 * fracture),
    charredOpacity: 0.92 * fracture,
    ashOpacity: 0.72 * fracture,
    desaturation: fracture,
    contrast: 1 + 0.55 * fracture,
  }
}
