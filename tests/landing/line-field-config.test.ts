import { mkdtemp, readFile, readdir, rename, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { basename, dirname, join } from 'node:path'
import { spawn, spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { pathToFileURL } from 'node:url'
import { afterEach, describe, expect, it } from 'vitest'
import * as lineFieldGenerated from '../../src/landing/line-field/config/line-field-config.generated'
import { WRIGHT_TIMELINE } from '../../src/landing/motion/wright-timeline'

const { lineFieldConfig } = lineFieldGenerated

const compiler = join(process.cwd(), 'scripts/compile-line-field-config.mjs')
const authorSchema = join(
  process.cwd(),
  'src/landing/line-field/config/line-field.animation.schema.json',
)
const materialsAuthorSchema = join(
  process.cwd(),
  'src/landing/line-field/config/line-field.materials.schema.json',
)
const temporaryDirectories: string[] = []
const retiredCropKeys = ['projectedWidthVw', 'bleedPaddingPx'] as const
const retiredCropValues = { projectedWidthVw: 10, bleedPaddingPx: 24 } as const
const retiredRevealKeys = [
  'exponent',
  'edgeSoftness',
  'anchorOcclusionRadiusVh',
  'anchorOcclusionSoftnessPx',
  'anchorOcclusionReleaseFilmProgress',
] as const
const retiredRevealValues = {
  exponent: 4,
  edgeSoftness: 0.04,
  anchorOcclusionRadiusVh: 5,
  anchorOcclusionSoftnessPx: 18,
  anchorOcclusionReleaseFilmProgress: 0.96,
} as const
const retiredNoEffectControls = [
  ['geometry', 'rotationYDegrees', 90, '/geometry/rotationYDegrees'],
  ['wave', 'directionDegrees', 45, '/wave/directionDegrees'],
  ['wave', 'wavelengthVh', 28, '/wave/wavelengthVh'],
  ['wave', 'phaseWarp', 0.08, '/wave/phaseWarp'],
  ['wave', 'initialAmplitude', 0.03, '/wave/initialAmplitude'],
  ['wave', 'basePeakAmplitude', 0.7, '/wave/basePeakAmplitude'],
  ['wave', 'cursorPeakAmplitude', 0.88, '/wave/cursorPeakAmplitude'],
  ['wave', 'risePositionFar', 0.75, '/wave/risePositionFar'],
  ['wave', 'risePositionNear', 0.25, '/wave/risePositionNear'],
  ['wave', 'dampingStart', 0.75, '/wave/dampingStart'],
  ['wave', 'bottomAmplitude', 0.38, '/wave/bottomAmplitude'],
  ['wave', 'pointerFrequencyBoost', 0.1, '/wave/pointerFrequencyBoost'],
] as const
const retiredLaneSelectionControls = [
  ['laneCountDesktop', 36, '/geometry/laneCountDesktop'],
  ['laneCountMobile', 24, '/geometry/laneCountMobile'],
  ['mobileBreakpointPx', 640, '/geometry/mobileBreakpointPx'],
] as const
const retiredMaximumTwist = [
  'maximumTwistDegrees',
  6,
  '/pointer/maximumTwistDegrees',
] as const

const validConfig = {
  version: 1,
  geometry: { staggeredTipCount: 36, spineWidthPx: 1.8, lineWidthPx: 0.75, headerGapPx: 0 },
  wave: { scrollPhaseCycles: 2.4, autonomousCyclesPerSecond: 0.65 },
  reveal: { preloadFilmProgress: 0.72, startFilmProgress: 0.88 },
  fronts: { seed: 3817, maximumTipGapVh: 3, staggerStrength: 0.75, catchupRatePerSecond: 7, autonomousVelocityViewportPerSecond: 0.72, autonomousAccelerationViewportPerSecondSquared: 1.2 },
  handoff: { triggerPastMottoVh: 8, velocityBlendSeconds: 0.45, reverseDeadbandPx: 2 },
  pointer: { radiusVw: 18, smoothingSeconds: 0.16 },
  motto: {
    travelViewportHeights: 1, cardMaxWidthRem: 34, finalRightInsetVw: 8, mobileFinalLeftInsetRem: 3, mobileFinalRightInsetRem: 1, finalCenterViewportY: 0.56,
    orbit: { thetaXDegrees: 30, thetaYDegrees: 10, phiStartDegrees: 80, phiPeakDegrees: 180, phiEndDegrees: 290, originDriftRadiusRatio: 0.3116666667, localOffsetRadiusRatio: 0.25 },
    projection: { startCenterXViewportRatio: 0.7, preferredBulge: 1, minimumLeftGutterPx: 16, minimumLeftGutterVw: 2, blurSafetyMultiplier: 2, sampleCount: 96 },
    depthCues: { scaleStart: 0.22, scaleAtPhiPeak: 0.5, scaleEnd: 1, blurStart: 1, blurAtPhiPeak: 0.5, blurEnd: 0, blurMaximumPx: 8 },
    visibility: { phiStartDegrees: 80, phiEndDegrees: 120, opacityStart: 0, opacityEnd: 1 },
  },
  theme: {
    tailOpacityAtTip: 0.1,
    dark: { body: { startColor: '#E945F5', middleColor: '#6F6F6F', endColor: '#6A6A6A', coreOpacity: 0.82, emissionOpacity: 0.24, emissionRadiusPx: 8.5, freshTrailLengthPx: 90 }, linePrimary: '#FFF8FF', lineSecondary: '#FF4DB8', lineAccent: '#78F2FF', baseOpacity: 0.76, lineGlow: { radiusPx: 5.5, opacity: 0.14 }, tipGlow: { diameterToLineWidth: 1.75, tailLengthToDiameter: 4, haloDiameterToHead: 2.5, opacity: 0.88, freshTrailLengthPx: 90, pinkMix: 0.7, cyanMix: 0.16, pulseHz: 0.82, pulseDepth: 0.72, secondaryPulseRatio: 1.37 } },
    light: { body: { wetBlueBlack: '#0A2C5D', settledBlue: '#164581', agedSepia: '#86613C', fadedWarmSepia: '#BF9E6F', coreOpacity: 0.62, freshTrailLengthPx: 52.5, fiberScalePx: 5, fiberStrength: 0.28, sheenOpacity: 0.12, absorptionRadiusPx: 11, absorptionOpacity: 0.10 }, linePrimary: '#3B2B20', lineSecondary: '#8B6748', paperFiber: '#D8BE9A', baseOpacity: 0.48, tipInk: { wetColor: '#0B2D5B', diameterToLineWidth: 1.75, tailLengthToDiameter: 3, bleedDiameterToHead: 1.6, lineBleedRadiusPx: 5.5, freshTrailLengthPx: 52.5, irregularity: 0.18, absorptionOpacity: 0.16, specularOpacity: 0.84 } },
  },
  performance: { maximumDpr: 1.5, maximumRenderDimensionPx: 1600 },
}

function schemaFor(value: unknown): Record<string, unknown> {
  if (Array.isArray(value)) return { type: 'array', items: schemaFor(value[0]) }
  if (typeof value === 'object' && value !== null) {
    return {
      type: 'object',
      properties: Object.fromEntries(Object.entries(value).map(([key, child]) => [key, schemaFor(child)])),
      required: Object.keys(value),
      additionalProperties: false,
    }
  }
  return typeof value === 'number'
    ? { type: 'number', multipleOf: 0.01 }
    : { type: typeof value }
}

async function fixture() {
  const directory = await mkdtemp(join(tmpdir(), 'line-field-config-'))
  temporaryDirectories.push(directory)
  const source = join(directory, 'line-field.animation.yaml')
  const schema = join(directory, 'line-field.animation.schema.json')
  const materialsSource = join(directory, 'line-field.materials.yaml')
  const materialsSchema = join(directory, 'line-field.materials.schema.json')
  const output = join(directory, 'line-field-config.generated.ts')
  const animation = structuredClone(validConfig) as Record<string, unknown>
  const theme = animation.theme
  delete animation.theme
  const configSchema = schemaFor(animation)
  const geometry = configSchema.properties as Record<string, Record<string, unknown>>
  const geometryProperties = (geometry.geometry.properties as Record<string, Record<string, unknown>>)
  geometryProperties.staggeredTipCount = { type: 'integer', minimum: 5, maximum: 40 }
  const mottoProperties = (geometry.motto.properties as Record<string, Record<string, unknown>>)
  const orbitProperties = (mottoProperties.orbit.properties as Record<string, Record<string, unknown>>)
  orbitProperties.originDriftRadiusRatio = { type: 'number', minimum: 0, maximum: 2 }
  await writeFile(source, `# a deliberately commented author file\n${JSON.stringify(animation, null, 2)}\n`)
  await writeFile(schema, `${JSON.stringify(configSchema, null, 2)}\n`)
  await writeFile(materialsSource, `${JSON.stringify({ version: 1, theme }, null, 2)}\n`)
  await writeFile(materialsSchema, `${JSON.stringify(schemaFor({ version: 1, theme }), null, 2)}\n`)
  return { source, schema, materialsSource, materialsSchema, output }
}

async function fixtureWithAuthorSchema() {
  const paths = await fixture()
  const schema = JSON.parse(await readFile(authorSchema, 'utf8')) as {
    $defs: Record<string, { required: string[] }>
  }
  for (const [section, key] of retiredNoEffectControls) {
    schema.$defs[section].required = schema.$defs[section].required.filter(requiredKey => requiredKey !== key)
  }
  await writeFile(paths.schema, `${JSON.stringify(schema, null, 2)}\n`)
  await writeFile(paths.materialsSchema, await readFile(materialsAuthorSchema, 'utf8'))
  return paths
}

async function fixtureWithRetiredNoEffectControlsOptional() {
  return fixtureWithAuthorSchema()
}

function compile(
  paths: Awaited<ReturnType<typeof fixture>>,
  mode: '--write' | '--check' = '--write',
  environment: NodeJS.ProcessEnv = process.env,
) {
  return spawnSync(process.execPath, [
    compiler,
    mode,
    '--source', paths.source,
    '--schema', paths.schema,
    '--materials-source', paths.materialsSource,
    '--materials-schema', paths.materialsSchema,
    '--output', paths.output,
  ], {
    encoding: 'utf8',
    env: environment,
  })
}

function sha256Json(value: unknown) {
  return createHash('sha256').update(JSON.stringify(value)).digest('hex')
}

function generatedRuntimeExport(generated: string) {
  const marker = 'export const lineFieldConfig = '
  const start = generated.indexOf(marker)
  if (start < 0) throw new Error('Generated module did not export lineFieldConfig')
  return generated.slice(start)
}

function generatedAuthoringMetadata(generated: string) {
  const match = generated.match(
    /export const lineFieldAuthoringMetadata = \{\s*animationVersion: (\d+),\s*materialsVersion: (\d+),\s*\} as const/,
  )
  return match
    ? { animationVersion: Number(match[1]), materialsVersion: Number(match[2]) }
    : null
}

async function setDocumentVersion(path: string, version: number) {
  const source = await readFile(path, 'utf8')
  const documentStart = source.indexOf('{')
  if (documentStart < 0) throw new Error(`Fixture document has no object: ${path}`)
  const document = JSON.parse(source.slice(documentStart)) as Record<string, unknown>
  document.version = version
  await writeFile(path, `${JSON.stringify(document, null, 2)}\n`)
}

async function setSchemaVersion(path: string, version: number) {
  const schema = JSON.parse(await readFile(path, 'utf8')) as {
    properties: { version: { const: number } }
  }
  schema.properties.version.const = version
  await writeFile(path, `${JSON.stringify(schema, null, 2)}\n`)
}

async function replaceFileOnce(path: string, expected: string, replacement: string) {
  const current = await readFile(path, 'utf8')
  const next = current.replace(expected, replacement)
  if (next === current) throw new Error(`Fixture file did not contain ${expected}`)
  await writeFile(path, next)
}

async function replaceFileAtomicallyOnce(path: string, expected: string, replacement: string) {
  const current = await readFile(path, 'utf8')
  const next = current.replace(expected, replacement)
  if (next === current) throw new Error(`Fixture file did not contain ${expected}`)
  const replacementPath = `${path}.replacement`
  await writeFile(replacementPath, next)
  await rename(replacementPath, path)
}

async function setSchemaMaximum(path: string, propertyPath: string[], maximum: number) {
  const schema = JSON.parse(await readFile(path, 'utf8')) as Record<string, unknown>
  let node = schema
  for (const property of propertyPath) {
    const properties = node.properties
    if (!properties || typeof properties !== 'object' || Array.isArray(properties)) {
      throw new Error(`Fixture schema has no properties at ${propertyPath.join('.')}`)
    }
    const child = (properties as Record<string, unknown>)[property]
    if (!child || typeof child !== 'object' || Array.isArray(child)) {
      throw new Error(`Fixture schema has no property ${propertyPath.join('.')}`)
    }
    node = child as Record<string, unknown>
  }
  node.maximum = maximum
  await writeFile(path, `${JSON.stringify(schema, null, 2)}\n`)
}

async function waitFor(condition: () => boolean | Promise<boolean>, message: string) {
  const deadline = Date.now() + 4_000
  while (Date.now() < deadline) {
    if (await condition()) return
    await new Promise(resolve => setTimeout(resolve, 25))
  }
  throw new Error(message)
}

async function outputContains(
  paths: Awaited<ReturnType<typeof fixture>>,
  ...markers: string[]
) {
  try {
    const output = await readFile(paths.output, 'utf8')
    return markers.every(marker => output.includes(marker))
  } catch {
    return false
  }
}

async function stagedOutputFiles(paths: Awaited<ReturnType<typeof fixture>>) {
  const outputBasename = basename(paths.output)
  return (await readdir(dirname(paths.output))).filter(entry => (
    entry.startsWith(`${outputBasename}.`) && entry.endsWith('.tmp')
  ))
}

function processIsAlive(pid: number | undefined) {
  if (!pid) return false
  try {
    process.kill(pid, 0)
    return true
  } catch {
    return false
  }
}

async function waitForProcessExit(child: ReturnType<typeof spawn>, timeoutMs = 1_500) {
  if (child.exitCode !== null || child.signalCode !== null) {
    return { code: child.exitCode, signal: child.signalCode }
  }
  return new Promise<{ code: number | null, signal: NodeJS.Signals | null } | undefined>(resolve => {
    const timeout = setTimeout(() => {
      child.off('exit', onExit)
      resolve(undefined)
    }, timeoutMs)
    const onExit = (code: number | null, signal: NodeJS.Signals | null) => {
      clearTimeout(timeout)
      resolve({ code, signal })
    }
    child.once('exit', onExit)
  })
}

function spawnWatcher(
  paths: Awaited<ReturnType<typeof fixture>>,
  environment: NodeJS.ProcessEnv = process.env,
) {
  return spawn(process.execPath, [
    compiler,
    '--watch',
    '--source', paths.source,
    '--schema', paths.schema,
    '--materials-source', paths.materialsSource,
    '--materials-schema', paths.materialsSchema,
    '--output', paths.output,
  ], { stdio: ['ignore', 'pipe', 'pipe'], env: environment })
}

async function updateConfig(
  paths: Awaited<ReturnType<typeof fixture>>,
  update: (config: typeof validConfig) => void,
) {
  const config = structuredClone(validConfig)
  update(config)
  const animation = config as unknown as Record<string, unknown>
  const theme = animation.theme
  delete animation.theme
  await writeFile(paths.source, `${JSON.stringify(animation, null, 2)}\n`)
  await writeFile(paths.materialsSource, `${JSON.stringify({ version: 1, theme }, null, 2)}\n`)
}

afterEach(async () => {
  await Promise.all(temporaryDirectories.splice(0).map((directory) => rm(directory, { recursive: true, force: true })))
})

describe('line field configuration compiler', () => {
  it('publishes the exact post-pointer runtime payload without an authoring version', () => {
    const serialized = JSON.stringify(lineFieldConfig)

    expect(Object.hasOwn(lineFieldConfig, 'version')).toBe(false)
    expect(Buffer.byteLength(serialized, 'utf8')).toBe(2700)
    expect(sha256Json(lineFieldConfig)).toBe(
      '9b4c68a3ad64b9dd9676d4a980348d8755ea43551136e12f1eba99730b444062',
    )
    expect(Reflect.get(lineFieldGenerated, 'lineFieldAuthoringMetadata')).toEqual({
      animationVersion: 1,
      materialsVersion: 1,
    })
  })

  it('detects the literal seed 3817 to 3818 runtime mutant independently', () => {
    const falseSeed = {
      ...structuredClone(lineFieldConfig),
      fronts: { ...lineFieldConfig.fronts, seed: 3818 },
    }

    expect(sha256Json(falseSeed)).toBe(
      'a5707e5c92b43c6e850895df5436803ed3d3a792d480080a597beffc362d26d4',
    )
    expect(sha256Json(falseSeed)).not.toBe(sha256Json(lineFieldConfig))
  })

  it('changes only authoring metadata when animation version advances with its schema', async () => {
    const paths = await fixtureWithAuthorSchema()
    expect(compile(paths).status).toBe(0)
    const baseline = await readFile(paths.output, 'utf8')

    await setDocumentVersion(paths.source, 2)
    await setSchemaVersion(paths.schema, 2)
    const result = compile(paths)

    expect(result.status, result.stderr).toBe(0)
    const advanced = await readFile(paths.output, 'utf8')
    expect(generatedRuntimeExport(advanced)).toBe(generatedRuntimeExport(baseline))
    expect(generatedAuthoringMetadata(baseline)).toEqual({
      animationVersion: 1,
      materialsVersion: 1,
    })
    expect(generatedAuthoringMetadata(advanced)).toEqual({
      animationVersion: 2,
      materialsVersion: 1,
    })
    expect(advanced.replace('animationVersion: 2', 'animationVersion: 1')).toBe(baseline)
  })

  it('changes only independent authoring metadata when materials version advances with its schema', async () => {
    const paths = await fixtureWithAuthorSchema()
    expect(compile(paths).status).toBe(0)
    const baseline = await readFile(paths.output, 'utf8')

    await setDocumentVersion(paths.materialsSource, 2)
    await setSchemaVersion(paths.materialsSchema, 2)
    const result = compile(paths)

    expect(result.status, result.stderr).toBe(0)
    const advanced = await readFile(paths.output, 'utf8')
    expect(generatedRuntimeExport(advanced)).toBe(generatedRuntimeExport(baseline))
    expect(generatedAuthoringMetadata(baseline)).toEqual({
      animationVersion: 1,
      materialsVersion: 1,
    })
    expect(generatedAuthoringMetadata(advanced)).toEqual({
      animationVersion: 1,
      materialsVersion: 2,
    })
    expect(advanced.replace('materialsVersion: 2', 'materialsVersion: 1')).toBe(baseline)
  })

  it.each([
    ['animation', 'source', 'schema'],
    ['materials', 'materialsSource', 'materialsSchema'],
  ] as const)(
    'rejects mismatched %s version at /version without replacing the last valid output',
    async (_label, sourceKey, schemaKey) => {
      const paths = await fixtureWithAuthorSchema()
      const initial = compile(paths)
      expect(initial.status, initial.stderr).toBe(0)
      const published = await readFile(paths.output, 'utf8')

      await setDocumentVersion(paths[sourceKey], 2)
      const result = compile(paths)

      expect(result.status).not.toBe(0)
      expect(result.stderr).toContain('/version must be equal to constant; received 2')
      expect(await readFile(paths.output, 'utf8')).toBe(published)
      expect(JSON.parse(await readFile(paths[schemaKey], 'utf8'))).toHaveProperty(
        'properties.version.const',
        1,
      )
    },
  )

  it('does not publish retired reveal.completionOvershootVh no-effect authoring', () => {
    expect(lineFieldConfig.reveal).not.toHaveProperty('completionOvershootVh')
  })

  it('rejects retired reveal.completionOvershootVh authoring at its exact path and preserves the last valid output', async () => {
    const paths = await fixture()
    const validResult = compile(paths)
    expect(validResult.status, validResult.stderr).toBe(0)
    const lastValidOutput = await readFile(paths.output, 'utf8')
    const source = await readFile(paths.source, 'utf8')
    const animation = JSON.parse(source.slice(source.indexOf('{'))) as typeof validConfig
    ;(animation.reveal as Record<string, unknown>).completionOvershootVh = 8
    await writeFile(paths.source, `${JSON.stringify(animation, null, 2)}\n`)
    await writeFile(paths.schema, await readFile(authorSchema, 'utf8'))

    const result = compile(paths)

    expect(result.status).not.toBe(0)
    expect(result.stderr).toContain('/reveal/completionOvershootVh')
    expect(result.stderr).toContain('must NOT have additional properties')
    expect(await readFile(paths.output, 'utf8')).toBe(lastValidOutput)
  })

  it.each(retiredNoEffectControls)(
    'does not publish retired %s.%s no-effect authoring',
    (section, key) => {
      expect(lineFieldConfig[section]).not.toHaveProperty(key)
    },
  )

  it.each(retiredNoEffectControls)(
    'rejects retired %s.%s authoring at its exact path and preserves the last valid output',
    async (section, key, value, path) => {
      const paths = await fixtureWithRetiredNoEffectControlsOptional()
      const validResult = compile(paths)
      expect(validResult.status, validResult.stderr).toBe(0)
      const lastValidOutput = await readFile(paths.output, 'utf8')
      await updateConfig(paths, (config) => {
        ;(config[section] as Record<string, unknown>)[key] = value
      })

      const result = compile(paths)

      expect(result.status).not.toBe(0)
      expect(result.stderr).toContain(path)
      expect(result.stderr).toContain('must NOT have additional properties')
      expect(await readFile(paths.output, 'utf8')).toBe(lastValidOutput)
    },
  )

  it('keeps adjacent consumed wave.scrollPhaseCycles authoring observable in generated output', async () => {
    const paths = await fixture()
    await updateConfig(paths, (config) => { config.wave.scrollPhaseCycles = 2.41 })

    const result = compile(paths)

    expect(result.status, result.stderr).toBe(0)
    expect(await readFile(paths.output, 'utf8')).toContain('scrollPhaseCycles: 2.41')
  })

  it.each(retiredCropKeys)('does not publish retired geometry.%s crop controls', (key) => {
    expect(lineFieldConfig.geometry).not.toHaveProperty(key)
  })

  it.each(retiredCropKeys)('rejects retired geometry.%s authoring at its exact path', async (key) => {
    const paths = await fixtureWithAuthorSchema()
    const source = await readFile(paths.source, 'utf8')
    const animation = JSON.parse(source.slice(source.indexOf('{'))) as typeof validConfig
    ;(animation.geometry as Record<string, unknown>)[key] = retiredCropValues[key]
    await writeFile(paths.source, `${JSON.stringify(animation, null, 2)}\n`)

    const result = compile(paths)

    expect(result.status).not.toBe(0)
    expect(result.stderr).toContain(`/geometry/${key}`)
    expect(result.stderr).toContain('must NOT have additional properties')
  })

  it('keeps an adjacent live geometry control observable in generated output', async () => {
    const paths = await fixture()
    await updateConfig(paths, (config) => { config.geometry.lineWidthPx = 0.76 })

    const result = compile(paths)

    expect(result.status, result.stderr).toBe(0)
    expect(await readFile(paths.output, 'utf8')).toContain('lineWidthPx: 0.76')
  })

  it.each(retiredRevealKeys)('does not publish retired reveal.%s controls', (key) => {
    expect(lineFieldConfig.reveal).not.toHaveProperty(key)
  })

  it.each(retiredRevealKeys)('rejects retired reveal.%s authoring at its exact path', async (key) => {
    const paths = await fixtureWithAuthorSchema()
    const source = await readFile(paths.source, 'utf8')
    const animation = JSON.parse(source.slice(source.indexOf('{'))) as typeof validConfig
    ;(animation.reveal as Record<string, unknown>)[key] = retiredRevealValues[key]
    await writeFile(paths.source, `${JSON.stringify(animation, null, 2)}\n`)

    const result = compile(paths)

    expect(result.status).not.toBe(0)
    expect(result.stderr).toContain(`/reveal/${key}`)
    expect(result.stderr).toContain('must NOT have additional properties')
  })

  it.each([
    ['preloadFilmProgress', 0.71],
    ['startFilmProgress', 0.81],
  ] as const)('keeps adjacent live reveal.%s observable in generated output', async (key, value) => {
    const paths = await fixture()
    await updateConfig(paths, (config) => { config.reveal[key] = value })

    const result = compile(paths)

    expect(result.status, result.stderr).toBe(0)
    expect(await readFile(paths.output, 'utf8')).toContain(`${key}: ${value}`)
  })

  it('publishes the bounded light-body readability calibration', () => {
    expect(lineFieldConfig.theme.light.body.coreOpacity).toBe(0.62)
    expect(lineFieldConfig.theme.light.body.absorptionOpacity).toBe(0.10)
  })

  it('publishes independent dark and frozen-reference light body materials', () => {
    expect(lineFieldConfig.theme.dark.body).toEqual({
      startColor: [0.913725, 0.270588, 0.960784],
      middleColor: [0.435294, 0.435294, 0.435294],
      endColor: [0.415686, 0.415686, 0.415686],
      coreOpacity: 0.82,
      emissionOpacity: 0.24,
      emissionRadiusPx: 8.5,
      freshTrailLengthPx: 90,
    })
    expect(lineFieldConfig.theme.light.body).toEqual({
      wetBlueBlack: [0.039216, 0.172549, 0.364706],
      settledBlue: [0.086275, 0.270588, 0.505882],
      agedSepia: [0.52549, 0.380392, 0.235294],
      fadedWarmSepia: [0.74902, 0.619608, 0.435294],
      coreOpacity: 0.62,
      freshTrailLengthPx: 52.5,
      fiberScalePx: 5,
      fiberStrength: 0.28,
      sheenOpacity: 0.12,
      absorptionRadiusPx: 11,
      absorptionOpacity: 0.1,
    })
  })

  it('preserves every accepted endpoint value through material-file extraction', () => {
    expect(lineFieldConfig.theme).toMatchObject({
      tailOpacityAtTip: 0.1,
      dark: {
        linePrimary: [1, 0.972549, 1],
        lineSecondary: [1, 0.301961, 0.721569],
        lineAccent: [0.470588, 0.94902, 1],
        baseOpacity: 0.76,
        lineGlow: { radiusPx: 5.5, opacity: 0.26 },
        tipGlow: {
          diameterToLineWidth: 1.75,
          tailLengthToDiameter: 4,
          haloDiameterToHead: 2.5,
          opacity: 0.88,
          freshTrailLengthPx: 90,
          pinkMix: 0.7,
          cyanMix: 0.16,
          pulseHz: 0.82,
          pulseDepth: 0.72,
          secondaryPulseRatio: 1.37,
        },
      },
      light: {
        linePrimary: [0.231373, 0.168627, 0.12549],
        lineSecondary: [0.545098, 0.403922, 0.282353],
        paperFiber: [0.847059, 0.745098, 0.603922],
        baseOpacity: 0.44,
        tipInk: {
          wetColor: [0.043137, 0.176471, 0.356863],
          diameterToLineWidth: 1.75,
          tailLengthToDiameter: 3,
          bleedDiameterToHead: 1.6,
          lineBleedRadiusPx: 7.5,
          freshTrailLengthPx: 52.5,
          irregularity: 0.28,
          absorptionOpacity: 0.22,
          specularOpacity: 0.84,
        },
      },
    })
  })

  it('rejects an invalid body-material control at its material path', async () => {
    const paths = await fixtureWithAuthorSchema()
    const materials = JSON.parse(await readFile(paths.materialsSource, 'utf8'))
    materials.theme.dark.body = {
      startColor: '#E945F5',
      middleColor: '#6F6F6F',
      endColor: '#6A6A6A',
      coreOpacity: 0.82,
      emissionOpacity: 1.01,
      emissionRadiusPx: 8.5,
      freshTrailLengthPx: 90,
    }
    await writeFile(paths.materialsSource, `${JSON.stringify(materials, null, 2)}\n`)

    const result = compile(paths)

    expect(result.status).not.toBe(0)
    expect(result.stderr).toContain('/theme/dark/body/emissionOpacity')
    expect(result.stderr).toContain('must be <= 1')
    expect(result.stderr).toContain('received 1.01')
  })

  it('compiles separate animation and material authoring into the stable public theme interface', async () => {
    const paths = await fixture()

    const result = compile(paths)

    expect(result.status, result.stderr).toBe(0)
    const generated = await readFile(paths.output, 'utf8')
    expect(generated).toContain('theme: {')
    expect(generated).toContain('tailOpacityAtTip: 0.1')
    expect(generated).toContain('linePrimary: [1, 0.972549, 1]')
    expect(generated).toContain('wetColor: [0.043137, 0.176471, 0.356863]')
  })

  it('starts the visible field exactly when the Wright clip begins to fade', () => {
    expect(lineFieldConfig.reveal.startFilmProgress).toBe(WRIGHT_TIMELINE.themeFadeStart)
  })

  it('emits the same typed module twice for a valid commented config', async () => {
    const paths = await fixture()

    expect(compile(paths).status).toBe(0)
    const first = await readFile(paths.output, 'utf8')
    expect(compile(paths).status).toBe(0)
    const second = await readFile(paths.output, 'utf8')

    expect(first).toBe(second)
    expect(first).toMatch(
      /^\/\/ GENERATED FILE - DO NOT EDIT\.\n\/\/ Edit src\/landing\/line-field\/config\/line-field\.animation\.yaml or line-field\.materials\.yaml and run `npm run line-field:config`\.\n\n/,
    )
    expect(first).toContain("import type { LineFieldAnimationConfig } from './line-field-config.types'")
    expect(first).toContain('linePrimary: [1, 0.972549, 1]')
    expect(first).toContain('wetColor: [0.043137, 0.176471, 0.356863]')
    expect(first).toContain('as const satisfies LineFieldAnimationConfig')
  })

  it('accepts the explicit wet blue ink color in the author schema', async () => {
    const paths = await fixtureWithAuthorSchema()

    const result = compile(paths)

    expect(result.status).toBe(0)
  })

  it('rejects an unknown key with its YAML path', async () => {
    const paths = await fixture()
    await updateConfig(paths, (config) => Object.assign(config.geometry, { 'a/b~c': 1 }))

    const result = compile(paths)

    expect(result.status).not.toBe(0)
    expect(result.stderr).toContain('/geometry/a~1b~0c')
    expect(result.stderr).toContain('received 1')
  })

  it('rejects a missing required key with its YAML path', async () => {
    const paths = await fixture()
    await updateConfig(paths, (config) => { delete (config.geometry as Record<string, unknown>).lineWidthPx })

    const result = compile(paths)

    expect(result.status).not.toBe(0)
    expect(result.stderr).toContain('/geometry/lineWidthPx')
    expect(result.stderr).toContain('received undefined')
  })

  it('rejects a value outside its schema range with the received value', async () => {
    const paths = await fixture()
    await updateConfig(paths, (config) => { config.geometry.staggeredTipCount = 41 })

    const result = compile(paths)

    expect(result.status).not.toBe(0)
    expect(result.stderr).toContain('/geometry/staggeredTipCount')
    expect(result.stderr).toContain('41')
  })

  it('rejects a number outside the hundredth grid', async () => {
    const paths = await fixture()
    await updateConfig(paths, (config) => { config.wave.scrollPhaseCycles = 2.413 })

    const result = compile(paths)

    expect(result.status).not.toBe(0)
    expect(result.stderr).toContain('/wave/scrollPhaseCycles')
    expect(result.stderr).toContain('2.413')
  })

  it('rejects duplicate keys, aliases, and merge keys', async () => {
    for (const source of [
      'version: 1\nversion: 1\n',
      'version: &version 1\ngeometry: *version\n',
      '<<: { version: 1 }\n',
    ]) {
      const paths = await fixture()
      await writeFile(paths.source, source)

      const result = compile(paths)

      expect(result.status).not.toBe(0)
      expect(result.stderr).toMatch(/unique|alias|merge key/i)
    }
  })

  it('does not delete a staging path it did not create when exclusive temp creation collides', async () => {
    const paths = await fixture()
    const baseline = compile(paths)
    expect(baseline.status, baseline.stderr).toBe(0)
    const lastValidOutput = await readFile(paths.output, 'utf8')
    await replaceFileOnce(paths.source, '"staggeredTipCount": 36', '"staggeredTipCount": 35')
    const temporaryToken = 'foreign-collision'
    const foreignTemporaryOutput = `${paths.output}.${temporaryToken}.tmp`
    await writeFile(foreignTemporaryOutput, 'foreign staging owner\n')

    const collision = compile(paths, '--write', {
      ...process.env,
      NODE_ENV: 'test',
      LINE_FIELD_CONFIG_TEST_TEMPORARY_OUTPUT_TOKEN: temporaryToken,
    })

    expect(collision.status).not.toBe(0)
    expect(collision.stderr).toContain('EEXIST')
    expect(await readFile(paths.output, 'utf8')).toBe(lastValidOutput)
    expect(await readFile(foreignTemporaryOutput, 'utf8')).toBe('foreign staging owner\n')
  })

  it('publishes staggeredTipCount and rejects retired lane-selection keys without replacing the last valid output', async () => {
    const paths = await fixtureWithAuthorSchema()
    const initial = compile(paths)

    expect(initial.status, initial.stderr).toBe(0)
    const published = await readFile(paths.output, 'utf8')
    expect(published).toContain('staggeredTipCount: 36')
    expect(published).not.toContain('laneCountDesktop')
    expect(published).not.toContain('laneCountMobile')
    expect(published).not.toContain('mobileBreakpointPx')

    for (const [key, value, path] of retiredLaneSelectionControls) {
      await updateConfig(paths, (config) => {
        Object.assign(config.geometry, { [key]: value })
      })

      const result = compile(paths)

      expect(result.status).not.toBe(0)
      expect(result.stderr).toContain(path)
      expect(await readFile(paths.output, 'utf8')).toBe(published)
      await updateConfig(paths, (config) => {
        delete (config.geometry as Record<string, unknown>)[key]
      })
    }
  })

  it('does not publish maximumTwistDegrees and rejects it at the exact path without replacing the last valid output', async () => {
    const paths = await fixtureWithAuthorSchema()
    const initial = compile(paths)

    expect(initial.status, initial.stderr).toBe(0)
    const published = await readFile(paths.output, 'utf8')
    expect(published).not.toContain(retiredMaximumTwist[0])
    await updateConfig(paths, (config) => {
      Object.assign(config.pointer, { [retiredMaximumTwist[0]]: retiredMaximumTwist[1] })
    })

    const result = compile(paths)

    expect(result.status).not.toBe(0)
    expect(result.stderr).toContain(retiredMaximumTwist[2])
    expect(result.stderr).toContain('must NOT have additional properties')
    expect(await readFile(paths.output, 'utf8')).toBe(published)
  })

  it('rejects mobile motto insets that do not preserve right weighting', async () => {
    for (const [leftInset, rightInset] of [[1, 1], [1, 2]] as const) {
      const paths = await fixture()
      await updateConfig(paths, (config) => {
        config.motto.mobileFinalLeftInsetRem = leftInset
        config.motto.mobileFinalRightInsetRem = rightInset
      })

      const result = compile(paths)

      expect(result.status).not.toBe(0)
      expect(result.stderr).toContain(
        'motto.mobileFinalLeftInsetRem must be greater than motto.mobileFinalRightInsetRem',
      )
    }
  })

  it('accepts the calibrated mobile motto insets through the author schema', async () => {
    const paths = await fixtureWithAuthorSchema()

    const result = compile(paths)

    expect(result.status).toBe(0)
    const generated = await readFile(paths.output, 'utf8')
    expect(generated).toContain('mobileFinalLeftInsetRem: 3')
    expect(generated).toContain('mobileFinalRightInsetRem: 1')
  })

  it('accepts the shared tail fade and theme-specific endpoint material controls', async () => {
    const paths = await fixtureWithAuthorSchema()

    const result = compile(paths)

    expect(result.status).toBe(0)
    const generated = await readFile(paths.output, 'utf8')
    expect(generated).toContain('tailOpacityAtTip: 0.1')
    expect(generated).toContain('opacity: 0.88')
    expect(generated).toContain('specularOpacity: 0.84')
  })

  it('rejects endpoint material opacities outside their physical ratios', async () => {
    for (const [key, value, diagnostic] of [
      ['tailOpacityAtTip', 0.09, 'must be >= 0.1'],
      ['tipGlowOpacity', 1.01, 'must be <= 1'],
      ['specularOpacity', 1.01, 'must be <= 1'],
    ] as const) {
      const paths = await fixtureWithAuthorSchema()
      await updateConfig(paths, (config) => {
        if (key === 'tailOpacityAtTip') config.theme.tailOpacityAtTip = value
        if (key === 'tipGlowOpacity') config.theme.dark.tipGlow.opacity = value
        if (key === 'specularOpacity') config.theme.light.tipInk.specularOpacity = value
      })

      const result = compile(paths)

      expect(result.status).not.toBe(0)
      expect(result.stderr).toContain(diagnostic)
    }
  })

  it('keeps mobile motto insets inside practical author-schema bounds', async () => {
    for (const [key, value, diagnostic] of [
      ['mobileFinalLeftInsetRem', 5.01, 'must be <= 5'],
      ['mobileFinalRightInsetRem', 0.49, 'must be >= 0.5'],
    ] as const) {
      const paths = await fixtureWithAuthorSchema()
      await updateConfig(paths, (config) => {
        config.motto[key] = value
      })

      const result = compile(paths)

      expect(result.status).not.toBe(0)
      expect(result.stderr).toContain(`/motto/${key}`)
      expect(result.stderr).toContain(diagnostic)
      expect(result.stderr).toContain(`received ${value}`)
    }
  })

  it('rejects contradictory normalized orbit landmarks', async () => {
    for (const [, update, diagnostic] of [
      ['theta ordering', (config: typeof validConfig) => { config.motto.orbit.phiPeakDegrees = 80 }, 'motto.orbit.phiStartDegrees must be below phiPeakDegrees'],
      ['visibility range', (config: typeof validConfig) => { config.motto.visibility.phiEndDegrees = 300 }, 'motto.visibility phi range must stay inside the orbit phi range'],
      ['visibility ordering equal', (config: typeof validConfig) => { config.motto.visibility.phiStartDegrees = 120 }, 'motto.visibility.phiStartDegrees must be below phiEndDegrees'],
      ['visibility ordering reversed', (config: typeof validConfig) => { config.motto.visibility.phiStartDegrees = 121 }, 'motto.visibility.phiStartDegrees must be below phiEndDegrees'],
      ['scale ordering', (config: typeof validConfig) => { config.motto.depthCues.scaleAtPhiPeak = 0.1 }, 'motto.depthCues scale landmarks must be nondecreasing'],
      ['blur ordering', (config: typeof validConfig) => { config.motto.depthCues.blurAtPhiPeak = 1.1 }, 'motto.depthCues blur landmarks must be nonincreasing'],
      ['scale final signal', (config: typeof validConfig) => { config.motto.depthCues.scaleEnd = 0.99 }, 'motto.depthCues.scaleEnd must equal 1'],
      ['blur final signal', (config: typeof validConfig) => { config.motto.depthCues.blurEnd = 0.01 }, 'motto.depthCues.blurEnd must equal 0'],
      ['opacity final signal', (config: typeof validConfig) => { config.motto.visibility.opacityEnd = 0.99 }, 'motto.visibility.opacityEnd must equal 1'],
    ] as const) {
      const paths = await fixture()
      await updateConfig(paths, update)

      const result = compile(paths)

      expect(result.status).not.toBe(0)
      expect(result.stderr).toContain(diagnostic)
    }
  })

  it('watches all four authoring inputs, preserves the last valid output, recovers, and exits cleanly', async () => {
    const paths = await fixture()
    const child = spawnWatcher(paths)
    let stderr = ''
    child.stderr?.setEncoding('utf8')
    child.stderr?.on('data', chunk => { stderr += chunk })

    try {
      await waitFor(
        () => outputContains(paths, 'staggeredTipCount: 36', 'tailOpacityAtTip: 0.1'),
        'watch compiler did not create the initial output with current animation and material markers',
      )

      await replaceFileOnce(paths.source, '"staggeredTipCount": 36', '"staggeredTipCount": 35')
      await waitFor(
        () => outputContains(paths, 'staggeredTipCount: 35', 'tailOpacityAtTip: 0.1'),
        'animation YAML edit did not publish its current marker',
      )

      await replaceFileOnce(paths.materialsSource, '"tailOpacityAtTip": 0.1', '"tailOpacityAtTip": 0.11')
      await waitFor(
        () => outputContains(paths, 'staggeredTipCount: 35', 'tailOpacityAtTip: 0.11'),
        'materials YAML edit did not publish its current marker',
      )

      const beforeInvalidAnimationSchema = await readFile(paths.output, 'utf8')
      await setSchemaMaximum(paths.schema, ['geometry', 'staggeredTipCount'], 34)
      await waitFor(
        () => stderr.includes('/geometry/staggeredTipCount must be <= 34; received 35'),
        'animation schema edit did not validate the current animation marker',
      )
      expect(await readFile(paths.output, 'utf8')).toBe(beforeInvalidAnimationSchema)

      await replaceFileOnce(paths.source, '"staggeredTipCount": 35', '"staggeredTipCount": 36')
      await waitFor(
        () => stderr.includes('/geometry/staggeredTipCount must be <= 34; received 36'),
        'invalid animation YAML did not report its new current marker',
      )
      expect(await readFile(paths.output, 'utf8')).toBe(beforeInvalidAnimationSchema)

      await setSchemaMaximum(paths.schema, ['geometry', 'staggeredTipCount'], 36)
      await waitFor(
        () => outputContains(paths, 'staggeredTipCount: 36', 'tailOpacityAtTip: 0.11'),
        'animation schema recovery did not publish the waiting animation marker',
      )

      const beforeInvalidMaterialsSchema = await readFile(paths.output, 'utf8')
      await setSchemaMaximum(paths.materialsSchema, ['theme', 'tailOpacityAtTip'], 0.105)
      await waitFor(
        () => stderr.includes('/theme/tailOpacityAtTip must be <= 0.105; received 0.11'),
        'materials schema edit did not validate the current material marker',
      )
      expect(await readFile(paths.output, 'utf8')).toBe(beforeInvalidMaterialsSchema)

      await replaceFileOnce(paths.materialsSource, '"tailOpacityAtTip": 0.11', '"tailOpacityAtTip": 0.12')
      await waitFor(
        () => stderr.includes('/theme/tailOpacityAtTip must be <= 0.105; received 0.12'),
        'invalid materials YAML did not report its new current marker',
      )
      expect(await readFile(paths.output, 'utf8')).toBe(beforeInvalidMaterialsSchema)

      await setSchemaMaximum(paths.materialsSchema, ['theme', 'tailOpacityAtTip'], 0.12)
      await waitFor(
        () => outputContains(paths, 'staggeredTipCount: 36', 'tailOpacityAtTip: 0.12'),
        'materials schema recovery did not publish the waiting material marker',
      )

      child.kill('SIGTERM')
      expect(await waitForProcessExit(child), 'watch compiler must exit cleanly after SIGTERM').toEqual({
        code: 0,
        signal: null,
      })
      expect(processIsAlive(child.pid)).toBe(false)
    } finally {
      if (processIsAlive(child.pid)) {
        child.kill('SIGKILL')
        await waitForProcessExit(child)
      }
    }
  })

  it('serializes dirty recompiles so an older snapshot cannot overwrite current authoring', async () => {
    const compilerModule = await import(pathToFileURL(compiler).href) as {
      createSingleFlightCompileQueue: (
        execute: () => Promise<void>,
        isStopped: () => boolean,
      ) => {
        queue: () => Promise<void>,
        waitForIdle: () => Promise<void>,
      },
    }
    let currentMarker = 'initial'
    const started: string[] = []
    const published: string[] = []
    const releases: Array<() => void> = []
    const queue = compilerModule.createSingleFlightCompileQueue(async () => {
      const snapshot = currentMarker
      started.push(snapshot)
      await new Promise<void>(resolve => releases.push(resolve))
      published.push(snapshot)
    }, () => false)

    queue.queue()
    await waitFor(() => started.length === 1, 'initial compile did not start')
    currentMarker = 'intermediate'
    queue.queue()
    currentMarker = 'current'
    queue.queue()

    expect(started).toEqual(['initial'])
    releases.shift()?.()
    await waitFor(() => started.length === 2, 'dirty compile did not start after the active compile')
    expect(started).toEqual(['initial', 'current'])
    releases.shift()?.()
    await queue.waitForIdle()

    expect(published).toEqual(['initial', 'current'])
  })

  it('does not publish an active compile after SIGTERM', async () => {
    const paths = await fixture()
    const barrierReleasePath = `${paths.source}.compile-release`
    const child = spawnWatcher(paths, {
      ...process.env,
      NODE_ENV: 'test',
      LINE_FIELD_CONFIG_TEST_BARRIER_MARKER: '"staggeredTipCount": 35',
      LINE_FIELD_CONFIG_TEST_BARRIER_RELEASE_PATH: barrierReleasePath,
    })
    let stdout = ''
    child.stdout?.setEncoding('utf8')
    child.stdout?.on('data', chunk => { stdout += chunk })

    try {
      await waitFor(
        () => outputContains(paths, 'staggeredTipCount: 36'),
        'watch compiler did not create the initial current output',
      )
      const outputBeforeSignal = await readFile(paths.output, 'utf8')

      await replaceFileOnce(paths.source, '"staggeredTipCount": 36', '"staggeredTipCount": 35')
      await waitFor(
        () => stdout.includes('line field config test barrier entered'),
        'active compile did not reach its deterministic signal barrier',
      )
      child.kill('SIGTERM')
      await waitFor(
        () => stdout.includes('line field config test stop observed'),
        'watch compiler did not acknowledge SIGTERM before barrier release',
      )
      await writeFile(barrierReleasePath, 'release\n')
      await waitFor(
        () => stdout.includes('line field config test barrier released'),
        'active compile did not acknowledge its deterministic barrier release',
      )

      expect(await waitForProcessExit(child), 'watch compiler must await and suppress the active publication').toEqual({
        code: 0,
        signal: null,
      })
      expect(await readFile(paths.output, 'utf8')).toBe(outputBeforeSignal)
      expect(processIsAlive(child.pid)).toBe(false)
    } finally {
      if (processIsAlive(child.pid)) {
        child.kill('SIGKILL')
        await waitForProcessExit(child)
      }
    }
  })

  it.each(['SIGINT', 'SIGTERM'] as const)(
    'on %s does not replace the last-valid output when shutdown lands at the final publication seam',
    async (signal) => {
      const paths = await fixture()
      const baseline = compile(paths)
      expect(baseline.status, baseline.stderr).toBe(0)
      const lastValidOutput = await readFile(paths.output, 'utf8')
      const barrierReleasePath = `${paths.output}.${signal}.final-publish-release`
      const child = spawnWatcher(paths, {
        ...process.env,
        NODE_ENV: 'test',
        LINE_FIELD_CONFIG_TEST_FINAL_PUBLISH_BARRIER_MARKER: '"staggeredTipCount": 35',
        LINE_FIELD_CONFIG_TEST_FINAL_PUBLISH_BARRIER_RELEASE_PATH: barrierReleasePath,
      })
      let stdout = ''
      child.stdout?.setEncoding('utf8')
      child.stdout?.on('data', chunk => { stdout += chunk })

      try {
        await waitFor(
          () => stdout.includes('line field config compiled'),
          'watch compiler did not finish its initial compile before the final-publication test',
        )
        await replaceFileOnce(paths.source, '"staggeredTipCount": 36', '"staggeredTipCount": 35')
        await waitFor(
          () => stdout.includes('line field config test final publish barrier entered'),
          'active compile did not reach the deterministic final publication seam',
        )
        const stagedAtBarrier = await stagedOutputFiles(paths)

        child.kill(signal)
        await waitFor(
          () => stdout.includes('line field config test stop observed'),
          `watch compiler did not acknowledge ${signal} at the final publication seam`,
        )
        expect(processIsAlive(child.pid)).toBe(true)

        await writeFile(barrierReleasePath, 'release\n')
        await waitFor(
          () => stdout.includes('line field config test final publish barrier released'),
          'active compile did not leave the final publication seam after release',
        )
        expect(await waitForProcessExit(child), 'watch compiler must finish the owned publication attempt').toEqual({
          code: 0,
          signal: null,
        })
        expect(await readFile(paths.output, 'utf8')).toBe(lastValidOutput)
        expect(stagedAtBarrier).toHaveLength(1)
        expect(await stagedOutputFiles(paths)).toEqual([])
        expect(processIsAlive(child.pid)).toBe(false)
      } finally {
        if (processIsAlive(child.pid)) {
          child.kill('SIGKILL')
          await waitForProcessExit(child)
        }
      }
    },
  )

  it('keeps watching a recreated authoring file and its new inode', async () => {
    const paths = await fixture()
    const child = spawnWatcher(paths)

    try {
      await waitFor(
        () => outputContains(paths, 'staggeredTipCount: 36'),
        'watch compiler did not create the initial current output',
      )

      await replaceFileAtomicallyOnce(paths.source, '"staggeredTipCount": 36', '"staggeredTipCount": 35')
      await waitFor(
        () => outputContains(paths, 'staggeredTipCount: 35'),
        'atomic rename/recreate did not publish its current marker',
      )

      await replaceFileOnce(paths.source, '"staggeredTipCount": 35', '"staggeredTipCount": 34')
      await waitFor(
        () => outputContains(paths, 'staggeredTipCount: 34'),
        'watch compiler detached from the recreated authoring file',
      )

      child.kill('SIGTERM')
      expect(await waitForProcessExit(child)).toEqual({ code: 0, signal: null })
    } finally {
      if (processIsAlive(child.pid)) {
        child.kill('SIGKILL')
        await waitForProcessExit(child)
      }
    }
  })

  it('fails check mode when generated output is stale', async () => {
    const paths = await fixture()
    await writeFile(paths.output, 'export const stale = true\n')

    const result = compile(paths, '--check')

    expect(result.status).not.toBe(0)
    expect(result.stderr).toContain('line-field-config.generated.ts is stale')
  })

  it('fails check mode when only the material authoring has changed', async () => {
    const paths = await fixture()
    expect(compile(paths).status).toBe(0)
    await updateConfig(paths, (config) => {
      config.theme.dark.body.startColor = '#00FF00'
    })

    const result = compile(paths, '--check')

    expect(result.status).not.toBe(0)
    expect(result.stderr).toContain('line-field-config.generated.ts is stale')
  })
})
