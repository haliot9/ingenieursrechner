export const THREADS_SOURCE = Object.freeze({
  repository: 'https://github.com/DavidHDev/react-bits',
  revision: 'd26ed7a476148f1253cca3f5bc9f679fda53e1f5',
  path: 'src/content/Backgrounds/Threads/Threads.jsx',
})

export const THREADS_LINE_COUNT = 40
export const THREADS_NEUTRAL_MOUSE = [0.5, 0.5] as const
export const THREADS_DEFAULT_AMPLITUDE = 1
export const THREADS_DEFAULT_DISTANCE = 0
export const THREADS_LONGITUDINAL_WORLD = 12
export const THREADS_LATERAL_WORLD = 9
export const THREADS_LATERAL_TO_LENGTH_RATIO = (
  THREADS_LATERAL_WORLD / THREADS_LONGITUDINAL_WORLD
)

const binary32 = Math.fround

const binary32Add = (left: number, right: number) => binary32(binary32(left) + binary32(right))
const binary32Subtract = (left: number, right: number) => binary32(binary32(left) - binary32(right))
const binary32Multiply = (left: number, right: number) => binary32(binary32(left) * binary32(right))
const binary32Divide = (left: number, right: number) => binary32(binary32(left) / binary32(right))
const binary32Floor = (value: number) => binary32(Math.floor(binary32(value)))
const binary32Fract = (value: number) => binary32Subtract(value, binary32Floor(value))
const binary32InverseSqrt = (value: number) => binary32(1 / Math.sqrt(binary32(value)))

const binary32Smoothstep = (lower: number, upper: number, value: number) => {
  const progress = Math.min(
    1,
    Math.max(
      0,
      binary32Divide(binary32Subtract(value, lower), binary32Subtract(upper, lower)),
    ),
  )
  const progressSquared = binary32Multiply(progress, progress)

  return binary32Multiply(
    progressSquared,
    binary32Subtract(3, binary32Multiply(2, progress)),
  )
}

const binary32Mix = (from: number, to: number, progress: number) => binary32Add(
  binary32Multiply(from, binary32Subtract(1, progress)),
  binary32Multiply(to, progress),
)

export const THREADS_LINE_PARAMETERS: ReadonlyArray<number> = Object.freeze(
  Array.from(
    { length: THREADS_LINE_COUNT },
    (_, lineIndex) => binary32Divide(lineIndex, THREADS_LINE_COUNT),
  ),
)

/** Binary32 CPU transcription of the accepted source shader's `Perlin2D`. */
export function threadsPerlin2D(x: number, y: number): number {
  const pointX = binary32(x)
  const pointY = binary32(y)
  const cellX = binary32Floor(pointX)
  const cellY = binary32Floor(pointY)
  const cellNextX = binary32Add(cellX, 1)
  const cellNextY = binary32Add(cellY, 1)
  const fractional = [
    binary32Subtract(pointX, cellX),
    binary32Subtract(pointY, cellY),
    binary32Subtract(pointX, cellNextX),
    binary32Subtract(pointY, cellNextY),
  ]
  const wrappedCells = [cellX, cellY, cellNextX, cellNextY].map((cell) => binary32Subtract(
    cell,
    binary32Multiply(binary32Floor(binary32Multiply(cell, binary32(1 / 71))), 71),
  ))
  const shiftedSquared = wrappedCells.map((cell, index) => {
    const offset = index % 2 === 0 ? 26 : 161
    const shifted = binary32Add(cell, offset)

    return binary32Multiply(shifted, shifted)
  })
  const cornerProducts = [
    binary32Multiply(shiftedSquared[0], shiftedSquared[1]),
    binary32Multiply(shiftedSquared[2], shiftedSquared[1]),
    binary32Multiply(shiftedSquared[0], shiftedSquared[3]),
    binary32Multiply(shiftedSquared[2], shiftedSquared[3]),
  ]
  const reciprocalHashX = binary32(1 / 951.135664)
  const reciprocalHashY = binary32(1 / 642.949883)
  const fractionalX = [fractional[0], fractional[2], fractional[0], fractional[2]]
  const fractionalY = [fractional[1], fractional[1], fractional[3], fractional[3]]
  const gradients = cornerProducts.map((corner, index) => {
    const gradientX = binary32Subtract(binary32Fract(binary32Multiply(corner, reciprocalHashX)), 0.49999)
    const gradientY = binary32Subtract(binary32Fract(binary32Multiply(corner, reciprocalHashY)), 0.49999)
    const inverseLength = binary32InverseSqrt(binary32Add(
      binary32Multiply(gradientX, gradientX),
      binary32Multiply(gradientY, gradientY),
    ))
    const projected = binary32Add(
      binary32Multiply(gradientX, fractionalX[index]),
      binary32Multiply(gradientY, fractionalY[index]),
    )

    return binary32Multiply(
      binary32Multiply(inverseLength, projected),
      Math.SQRT2,
    )
  })
  const fade = [fractional[0], fractional[1]].map((value) => {
    const valueSquared = binary32Multiply(value, value)
    const valueCubed = binary32Multiply(valueSquared, value)
    const polynomial = binary32Add(
      binary32Multiply(value, binary32Subtract(binary32Multiply(value, 6), 15)),
      10,
    )

    return binary32Multiply(valueCubed, polynomial)
  })
  const weights = [
    binary32Multiply(binary32Subtract(1, fade[0]), binary32Subtract(1, fade[1])),
    binary32Multiply(fade[0], binary32Subtract(1, fade[1])),
    binary32Multiply(binary32Subtract(1, fade[0]), fade[1]),
    binary32Multiply(fade[0], fade[1]),
  ]

  return gradients.reduce(
    (result, gradient, index) => binary32Add(result, binary32Multiply(gradient, weights[index])),
    0,
  )
}

/** Accepted source centerline before line rasterization. */
export function threadsCenterline(
  downstream: number,
  lineParameter: number,
  timeSeconds: number,
  amplitude = THREADS_DEFAULT_AMPLITUDE,
  distance = THREADS_DEFAULT_DISTANCE,
  mouse: readonly [number, number] = THREADS_NEUTRAL_MOUSE,
): number {
  const x = binary32(downstream)
  const p = binary32(lineParameter)
  const splitPoint = binary32Add(0.1, binary32Multiply(p, 0.4))
  const amplitudeNormal = binary32Smoothstep(splitPoint, 0.7, x)
  const mouseAmplitude = binary32Add(
    1,
    binary32Multiply(binary32Subtract(mouse[1], 0.5), 0.2),
  )
  const finalAmplitude = binary32Multiply(
    binary32Multiply(
      binary32Multiply(amplitudeNormal, 0.5),
      amplitude,
    ),
    mouseAmplitude,
  )
  const timeScaled = binary32Add(
    binary32Divide(timeSeconds, 10),
    binary32Multiply(binary32Subtract(mouse[0], 0.5), 1),
  )
  const firstNoise = threadsPerlin2D(
    binary32Multiply(timeScaled, 2.5),
    binary32Multiply(binary32Add(x, p), 2.5),
  )
  const secondNoise = binary32Divide(
    threadsPerlin2D(
      binary32Multiply(timeScaled, 3.5),
      binary32Multiply(binary32Add(x, timeScaled), 3.5),
    ),
    1.5,
  )
  const xNoise = binary32Mix(firstNoise, secondNoise, binary32Multiply(x, 0.3))

  return binary32Add(
    binary32Add(0.5, binary32Multiply(binary32Subtract(p, 0.5), distance)),
    binary32Multiply(binary32Divide(xNoise, 2), finalAmplitude),
  )
}

const threadsPixel = (width: number, height: number) => binary32Divide(
  1,
  Math.max(binary32(width), binary32(height)),
)

export function threadsLineWidth(lineParameter: number, width: number, height: number): number {
  return binary32Multiply(
    binary32Multiply(7, threadsPixel(width, height)),
    binary32Subtract(1, lineParameter),
  )
}

export function threadsLineSoftness(
  downstream: number,
  lineParameter: number,
  width: number,
  height: number,
): number {
  const p = binary32(lineParameter)
  const splitPoint = binary32Add(0.1, binary32Multiply(p, 0.4))
  const blur = binary32Multiply(
    binary32Smoothstep(splitPoint, binary32Add(splitPoint, 0.05), downstream),
    p,
  )

  return binary32Multiply(binary32Multiply(10, threadsPixel(width, height)), blur)
}

export function threadsLineOpacity(lineParameter: number): number {
  const power = binary32(Math.pow(binary32(lineParameter), binary32(0.3)))

  return binary32Subtract(1, binary32Smoothstep(0, 1, power))
}
