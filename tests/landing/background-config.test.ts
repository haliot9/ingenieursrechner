import { spawn, spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { mkdtemp, readFile, readdir, rename, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { basename, dirname, join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { landingBackgroundConfig } from '../../src/landing/background/config/landing-background-config.generated'

const compiler = join(process.cwd(), 'scripts/compile-landing-background-config.mjs')
const authorSchema = join(
  process.cwd(),
  'src/landing/background/config/landing-background.effects.schema.json',
)
const temporaryDirectories: string[] = []

const validConfig = {
  version: 1,
  dark: {
    seed: 7241,
    count: 200,
    spread: 10,
    speed: 0.12,
    baseSize: 125,
    opacity: 0.78,
    glowStrength: 0.72,
    hoverFactor: 1,
    rotationSpeed: 0.03,
    maximumDpr: 1.5,
  },
  light: {
    layerPlacement: 'above-wavefield',
    centerXRatio: 0.55,
    widthRatio: 0.4,
    heightRatio: 0.8,
    borderRadiusPx: 28,
    borderWidthRatio: 0.07,
    brightness: 50,
    surfaceOpacity: 0.93,
    edgeBlurPx: 11,
    displacementBlurPx: 0,
    backgroundOpacity: 0.08,
    saturation: 1,
    distortionScale: -180,
    redOffset: 0,
    greenOffset: 10,
    blueOffset: 20,
  },
}

async function fixture(config: typeof validConfig = structuredClone(validConfig)) {
  const directory = await mkdtemp(join(tmpdir(), 'landing-background-config-'))
  temporaryDirectories.push(directory)
  const source = join(directory, 'landing-background.effects.yaml')
  const schema = join(directory, 'landing-background.effects.schema.json')
  const output = join(directory, 'landing-background-config.generated.ts')
  await writeFile(source, `# author comments must not affect output\n${JSON.stringify(config, null, 2)}\n`)
  await writeFile(schema, await readFile(authorSchema, 'utf8'))
  return { output, schema, source }
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
    '--output', paths.output,
  ], { encoding: 'utf8', env: environment })
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
    '--output', paths.output,
  ], { stdio: ['ignore', 'pipe', 'pipe'], env: environment })
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

async function outputContains(
  paths: Awaited<ReturnType<typeof fixture>>,
  marker: string,
) {
  try {
    return (await readFile(paths.output, 'utf8')).includes(marker)
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

async function waitFor(condition: () => boolean | Promise<boolean>, message: string) {
  const deadline = Date.now() + 4_000
  while (Date.now() < deadline) {
    if (await condition()) return
    await new Promise(resolve => setTimeout(resolve, 25))
  }
  throw new Error(message)
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

function sha256(value: string) {
  return createHash('sha256').update(value).digest('hex')
}

async function writeSourceVersion(
  paths: Awaited<ReturnType<typeof fixture>>,
  version: number,
) {
  const config = structuredClone(validConfig)
  config.version = version
  await writeFile(paths.source, `${JSON.stringify(config, null, 2)}\n`)
}

async function writeSchemaVersion(
  paths: Awaited<ReturnType<typeof fixture>>,
  version: number,
) {
  const schema = JSON.parse(await readFile(paths.schema, 'utf8')) as {
    properties: { version: { const: number } }
  }
  schema.properties.version.const = version
  await writeFile(paths.schema, `${JSON.stringify(schema, null, 2)}\n`)
}

afterEach(async () => {
  await Promise.all(
    temporaryDirectories.splice(0).map(directory => rm(directory, { recursive: true, force: true })),
  )
})

describe('landing background configuration compiler', () => {
  it('publishes the bounded motion and Light glass calibration', () => {
    expect(landingBackgroundConfig.dark.rotationSpeed).toBe(0.03)
    expect(landingBackgroundConfig.light).toMatchObject({
      backgroundOpacity: 0.08,
      borderRadiusPx: 28,
      heightRatio: 0.8,
      layerPlacement: 'above-wavefield',
      widthRatio: 0.4,
    })
  })

  it('publishes the approved independent theme defaults without compiler-only strip edges', () => {
    expect(landingBackgroundConfig).toEqual({
      dark: validConfig.dark,
      light: validConfig.light,
    })
    expect(landingBackgroundConfig).not.toHaveProperty('version')
    expect(landingBackgroundConfig.light).not.toHaveProperty('leftRatio')
    expect(landingBackgroundConfig.light).not.toHaveProperty('rightRatio')
  })

  it('pins the compact runtime payload and detects a literal seed mutation', () => {
    const compactRuntime = JSON.stringify(landingBackgroundConfig)
    expect(Buffer.byteLength(compactRuntime, 'utf8')).toBe(494)
    expect(sha256(compactRuntime)).toBe('f0361ce44b6fbf6b4d9b6ebbbf7ef3eef1ff5fb5b5b10751af3c93af6557197f')

    const literalSeedMutant = {
      dark: { ...landingBackgroundConfig.dark, seed: 7242 },
      light: landingBackgroundConfig.light,
    }
    expect(sha256(JSON.stringify(literalSeedMutant))).toBe('e4c2f36495b801b88950fc815a51cb6147a191d49e54fa10412bf0de1c16db35')
  })

  it('emits the same closed typed module for the same authored values', async () => {
    const paths = await fixture()

    const firstResult = compile(paths)
    expect(firstResult.status, firstResult.stderr).toBe(0)
    const first = await readFile(paths.output, 'utf8')
    const secondResult = compile(paths)
    expect(secondResult.status, secondResult.stderr).toBe(0)
    const second = await readFile(paths.output, 'utf8')

    expect(second).toBe(first)
    expect(first).toContain("import type { LandingBackgroundConfig } from './landing-background-config.types'")
    expect(first).not.toContain('"leftRatio"')
    expect(first).not.toContain('"rightRatio"')
    expect(first).not.toContain('"version"')
    expect(first).toContain('as const satisfies LandingBackgroundConfig')
    expect(first).not.toContain('lineField')
  })

  it('keeps the generated runtime module byte-identical across a paired authoring version migration', async () => {
    const paths = await fixture()
    const baselineResult = compile(paths)
    expect(baselineResult.status, baselineResult.stderr).toBe(0)
    const baseline = await readFile(paths.output, 'utf8')

    await writeSourceVersion(paths, 2)
    await writeSchemaVersion(paths, 2)
    const migratedCheck = compile(paths, '--check')

    expect(migratedCheck.status, migratedCheck.stderr).toBe(0)
    expect(await readFile(paths.output, 'utf8')).toBe(baseline)
  })

  it('rejects source/schema version mismatches in either direction without replacing the last valid output', async () => {
    for (const mismatch of [
      { sourceVersion: 2, schemaVersion: 1, received: 2 },
      { sourceVersion: 1, schemaVersion: 2, received: 1 },
    ]) {
      const paths = await fixture()
      const baselineResult = compile(paths)
      expect(baselineResult.status, baselineResult.stderr).toBe(0)
      const lastValidOutput = await readFile(paths.output, 'utf8')

      await writeSourceVersion(paths, mismatch.sourceVersion)
      await writeSchemaVersion(paths, mismatch.schemaVersion)
      const rejected = compile(paths)

      expect(rejected.status).not.toBe(0)
      expect(rejected.stderr.trim()).toBe(`/version must be equal to constant; received ${mismatch.received}`)
      expect(await readFile(paths.output, 'utf8')).toBe(lastValidOutput)
    }
  })

  it('publishes either explicit wavefield layer placement without an alias', async () => {
    for (const layerPlacement of ['below-wavefield', 'above-wavefield'] as const) {
      const config = structuredClone(validConfig)
      config.light.layerPlacement = layerPlacement
      const paths = await fixture(config)

      const result = compile(paths)

      expect(result.status, result.stderr).toBe(0)
      expect(await readFile(paths.output, 'utf8')).toContain(`"layerPlacement": "${layerPlacement}"`)
    }
  })

  it('rejects either authored strip edge outside the viewport', async () => {
    for (const centerXRatio of [0.2, 0.8]) {
      const config = structuredClone(validConfig)
      config.light.centerXRatio = centerXRatio
      config.light.widthRatio = 0.5
      const paths = await fixture(config)

      const result = compile(paths)

      expect(result.status).not.toBe(0)
      expect(result.stderr).toContain('light strip edges must stay within [0, 1]')
    }
  })

  it('rejects unknown, missing, aliased, and duplicate authoring instead of falling back', async () => {
    const unknown = structuredClone(validConfig) as typeof validConfig & { lineField?: unknown }
    unknown.lineField = { opacity: 1 }
    const unknownPaths = await fixture(unknown)
    const unknownResult = compile(unknownPaths)
    expect(unknownResult.status).not.toBe(0)
    expect(unknownResult.stderr).toContain('/lineField')

    const missing = structuredClone(validConfig) as Partial<typeof validConfig>
    delete missing.light
    const missingPaths = await fixture(missing as typeof validConfig)
    const missingResult = compile(missingPaths)
    expect(missingResult.status).not.toBe(0)
    expect(missingResult.stderr).toContain('/light')
    expect(missingResult.stderr).toContain('required')

    const malformedSources = [
      'version: 1\nversion: 1\n',
      'version: &version 1\ndark: *version\n',
      '<<: { version: 1 }\n',
    ]
    for (const source of malformedSources) {
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
    await replaceFileOnce(paths.source, '"seed": 7241', '"seed": 7242')
    const temporaryToken = 'foreign-collision'
    const foreignTemporaryOutput = `${paths.output}.${temporaryToken}.tmp`
    await writeFile(foreignTemporaryOutput, 'foreign staging owner\n')

    const collision = compile(paths, '--write', {
      ...process.env,
      NODE_ENV: 'test',
      LANDING_BACKGROUND_CONFIG_TEST_TEMPORARY_OUTPUT_TOKEN: temporaryToken,
    })

    expect(collision.status).not.toBe(0)
    expect(collision.stderr).toContain('EEXIST')
    expect(await readFile(paths.output, 'utf8')).toBe(lastValidOutput)
    expect(await readFile(foreignTemporaryOutput, 'utf8')).toBe('foreign staging owner\n')
  })

  it('fails check mode when generated output is missing or stale', async () => {
    const paths = await fixture()

    const missing = compile(paths, '--check')
    expect(missing.status).not.toBe(0)
    expect(missing.stderr).toMatch(/missing|stale/i)

    expect(compile(paths).status).toBe(0)
    await writeFile(paths.output, '// stale\n')
    const stale = compile(paths, '--check')
    expect(stale.status).not.toBe(0)
    expect(stale.stderr).toMatch(/stale/i)
  })

  it('keeps watching the exact authoring basename after atomic replacement and a later edit', async () => {
    const paths = await fixture()
    const child = spawnWatcher(paths)

    try {
      await waitFor(
        () => outputContains(paths, '"seed": 7241'),
        'watch compiler did not create the initial output',
      )

      await replaceFileAtomicallyOnce(paths.source, '"seed": 7241', '"seed": 7242')
      await waitFor(
        () => outputContains(paths, '"seed": 7242'),
        'atomic replacement did not publish the recreated authoring file',
      )

      await replaceFileOnce(paths.source, '"seed": 7242', '"seed": 7243')
      await waitFor(
        () => outputContains(paths, '"seed": 7243'),
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

  it('serializes child-process recompiles so the newest valid snapshot publishes last', async () => {
    const paths = await fixture()
    const barrierReleasePath = `${paths.source}.compile-release`
    const child = spawnWatcher(paths, {
      ...process.env,
      NODE_ENV: 'test',
      LANDING_BACKGROUND_CONFIG_TEST_TRACE: '1',
      LANDING_BACKGROUND_CONFIG_TEST_BARRIER_MARKER: '"seed": 7242',
      LANDING_BACKGROUND_CONFIG_TEST_BARRIER_RELEASE_PATH: barrierReleasePath,
      LANDING_BACKGROUND_CONFIG_TEST_PUBLISH_MARKERS: JSON.stringify([
        '"seed": 7242',
        '"seed": 7243',
      ]),
    })
    let stdout = ''
    child.stdout?.setEncoding('utf8')
    child.stdout?.on('data', chunk => { stdout += chunk })

    try {
      await waitFor(
        () => outputContains(paths, '"seed": 7241'),
        'watch compiler did not create the initial output',
      )
      await replaceFileOnce(paths.source, '"seed": 7241', '"seed": 7242')
      await waitFor(
        () => stdout.includes('landing background config test barrier entered'),
        'older compile did not enter its deterministic barrier',
      )

      await replaceFileOnce(paths.source, '"seed": 7242', '"seed": 7243')
      await waitFor(
        async () => await outputContains(paths, '"seed": 7243')
          || stdout.includes('landing background config test dirty queued'),
        'newer authoring was neither published concurrently nor queued behind the active compile',
      )
      await writeFile(barrierReleasePath, 'release\n')
      await waitFor(
        () => stdout.includes('landing background config test published "seed": 7242')
          && stdout.includes('landing background config test published "seed": 7243'),
        'single-flight queue did not publish both valid snapshots',
      )

      child.kill('SIGTERM')
      expect(await waitForProcessExit(child)).toEqual({ code: 0, signal: null })
      expect(stdout.indexOf('landing background config test published "seed": 7242'))
        .toBeLessThan(stdout.indexOf('landing background config test published "seed": 7243'))
      expect(await readFile(paths.output, 'utf8')).toContain('"seed": 7243')
    } finally {
      if (processIsAlive(child.pid)) {
        child.kill('SIGKILL')
        await waitForProcessExit(child)
      }
    }
  })

  it.each(['SIGINT', 'SIGTERM'] as const)(
    'on %s clears pending work, suppresses late publication, closes one directory watcher, and exits after the active compile',
    async (signal) => {
      const paths = await fixture()
      const barrierReleasePath = `${paths.source}.${signal}.compile-release`
      const child = spawnWatcher(paths, {
        ...process.env,
        NODE_ENV: 'test',
        LANDING_BACKGROUND_CONFIG_TEST_TRACE: '1',
        LANDING_BACKGROUND_CONFIG_TEST_BARRIER_MARKER: '"seed": 7242',
        LANDING_BACKGROUND_CONFIG_TEST_BARRIER_RELEASE_PATH: barrierReleasePath,
        LANDING_BACKGROUND_CONFIG_TEST_PUBLISH_MARKERS: JSON.stringify([
          '"seed": 7242',
          '"seed": 7243',
        ]),
      })
      let stdout = ''
      child.stdout?.setEncoding('utf8')
      child.stdout?.on('data', chunk => { stdout += chunk })

      try {
        await waitFor(
          async () => await outputContains(paths, '"seed": 7241')
            && stdout.includes('landing background config test watcher opened'),
          'watch compiler did not publish initially and open its directory watcher',
        )
        const outputBeforeSignal = await readFile(paths.output, 'utf8')

        await replaceFileOnce(paths.source, '"seed": 7241', '"seed": 7242')
        await waitFor(
          () => stdout.includes('landing background config test barrier entered'),
          'active compile did not enter its deterministic barrier',
        )
        await replaceFileOnce(paths.source, '"seed": 7242', '"seed": 7243')
        await waitFor(
          async () => await outputContains(paths, '"seed": 7243')
            || stdout.includes('landing background config test dirty queued'),
          'newer authoring was neither published concurrently nor queued before shutdown',
        )

        child.kill(signal)
        await waitFor(
          () => stdout.includes('landing background config test stop observed'),
          `watch compiler did not acknowledge ${signal}`,
        )
        expect(processIsAlive(child.pid)).toBe(true)
        expect(stdout.match(/landing background config test watcher opened/g)).toHaveLength(1)
        expect(stdout.match(/landing background config test watcher closed/g)).toHaveLength(1)

        await writeFile(barrierReleasePath, 'release\n')
        await waitFor(
          () => stdout.includes('landing background config test barrier released'),
          'active compile did not finish after barrier release',
        )
        expect(await waitForProcessExit(child), 'watch compiler must await its active compile').toEqual({
          code: 0,
          signal: null,
        })
        expect(await readFile(paths.output, 'utf8')).toBe(outputBeforeSignal)
        expect(stdout).not.toContain('landing background config test published "seed": 7242')
        expect(stdout).not.toContain('landing background config test published "seed": 7243')
        expect(processIsAlive(child.pid)).toBe(false)
      } finally {
        if (processIsAlive(child.pid)) {
          child.kill('SIGKILL')
          await waitForProcessExit(child)
        }
      }
    },
  )

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
        LANDING_BACKGROUND_CONFIG_TEST_TRACE: '1',
        LANDING_BACKGROUND_CONFIG_TEST_FINAL_PUBLISH_BARRIER_MARKER: '"seed": 7242',
        LANDING_BACKGROUND_CONFIG_TEST_FINAL_PUBLISH_BARRIER_RELEASE_PATH: barrierReleasePath,
        LANDING_BACKGROUND_CONFIG_TEST_PUBLISH_MARKERS: JSON.stringify(['"seed": 7242']),
      })
      let stdout = ''
      child.stdout?.setEncoding('utf8')
      child.stdout?.on('data', chunk => { stdout += chunk })

      try {
        await waitFor(
          () => stdout.includes('landing background config test watcher opened')
            && stdout.includes('Landing background config regenerated'),
          'watch compiler did not finish its initial compile before the final-publication test',
        )
        await replaceFileOnce(paths.source, '"seed": 7241', '"seed": 7242')
        await waitFor(
          () => stdout.includes('landing background config test final publish barrier entered'),
          'active compile did not reach the deterministic final publication seam',
        )
        const stagedAtBarrier = await stagedOutputFiles(paths)

        child.kill(signal)
        await waitFor(
          () => stdout.includes('landing background config test stop observed'),
          `watch compiler did not acknowledge ${signal} at the final publication seam`,
        )
        expect(processIsAlive(child.pid)).toBe(true)
        expect(stdout.match(/landing background config test watcher opened/g)).toHaveLength(1)
        expect(stdout.match(/landing background config test watcher closed/g)).toHaveLength(1)

        await writeFile(barrierReleasePath, 'release\n')
        await waitFor(
          () => stdout.includes('landing background config test final publish barrier released'),
          'active compile did not leave the final publication seam after release',
        )
        expect(await waitForProcessExit(child), 'watch compiler must finish the owned publication attempt').toEqual({
          code: 0,
          signal: null,
        })
        expect(await readFile(paths.output, 'utf8')).toBe(lastValidOutput)
        expect(stdout).not.toContain('landing background config test published "seed": 7242')
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
})
