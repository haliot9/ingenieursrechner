import { spawn, spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { mkdtemp, readFile, readdir, rename, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { basename, dirname, join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { elasticMenuChainConfig } from '../../src/landing/motion/config/elastic-menu-chain-config.generated'

const compiler = join(process.cwd(), 'scripts/compile-elastic-menu-chain-config.mjs')
const productionSchema = join(process.cwd(), 'src/landing/motion/config/elastic-menu-chain.motion.schema.json')
const productionSource = join(process.cwd(), 'src/landing/motion/config/elastic-menu-chain.motion.yaml')
const temporaryDirectories: string[] = []

function hash(contents: string) {
  return createHash('sha256').update(contents).digest('hex')
}

function replaceOnce(source: string, expected: string, replacement: string) {
  const next = source.replace(expected, replacement)
  if (next === source) throw new Error(`Fixture authoring did not contain ${expected}`)
  return next
}

async function fixture() {
  const directory = await mkdtemp(join(tmpdir(), 'elastic-menu-chain-config-'))
  temporaryDirectories.push(directory)
  const source = join(directory, 'elastic-menu-chain.motion.yaml')
  const schema = join(directory, 'elastic-menu-chain.motion.schema.json')
  const output = join(directory, 'elastic-menu-chain-config.generated.ts')
  const [sourceText, schemaText] = await Promise.all([
    readFile(productionSource, 'utf8'),
    readFile(productionSchema, 'utf8'),
  ])
  await Promise.all([writeFile(source, sourceText), writeFile(schema, schemaText)])
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
  const next = replaceOnce(current, expected, replacement)
  await writeFile(path, next)
}

async function replaceFileAtomicallyOnce(path: string, expected: string, replacement: string) {
  const current = await readFile(path, 'utf8')
  const next = replaceOnce(current, expected, replacement)
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

async function writeSourceVersion(
  paths: Awaited<ReturnType<typeof fixture>>,
  version: number,
) {
  const source = await readFile(paths.source, 'utf8')
  await writeFile(paths.source, replaceOnce(source, 'version: 1', `version: ${version}`))
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

afterEach(async () => {
  await Promise.all(temporaryDirectories.splice(0).map(directory => rm(directory, { recursive: true, force: true })))
})

describe('elastic menu chain configuration compiler', () => {
  it('generates the approved typed menu profiles and shared chain defaults from production authority copies', async () => {
    const paths = await fixture()

    const result = compile(paths)

    expect(result.status, result.stderr).toBe(0)
    const generated = await readFile(paths.output, 'utf8')
    expect(generated).toContain('as const satisfies ElasticMenuChainConfig')
    expect(generated).toContain('"ease": "power3.out"')
    expect(generated).toContain('"ease": "bounce.out"')
    expect(generated).toContain('"threshold": 0.1')
    expect(generated).toContain('"pullAtPreviousProgress": 0.42')
    expect(generated).toContain('"exitStartViewportPercent": 22')
    expect(generated).not.toContain('"version"')
    expect(elasticMenuChainConfig).not.toHaveProperty('version')
    expect(elasticMenuChainConfig.profiles.lead.ease).toBe('power3.out')
    expect(elasticMenuChainConfig.profiles.follower.ease).toBe('bounce.out')
    expect(elasticMenuChainConfig.chain.threshold).toBe(0.1)
    expect(elasticMenuChainConfig.chain.pullAtPreviousProgress).toBe(0.42)
    expect(elasticMenuChainConfig.chain.exitStartViewportPercent).toBe(22)
  })

  it('pins the compact runtime payload and detects a literal threshold mutation', () => {
    const compactRuntime = JSON.stringify(elasticMenuChainConfig)
    expect(Buffer.byteLength(compactRuntime, 'utf8')).toBe(526)
    expect(hash(compactRuntime)).toBe('6621712606ecd5cd0188fddc021b062c59d79c3ac289a93ea6ee8e9557d758c6')

    const literalThresholdMutant = {
      profiles: elasticMenuChainConfig.profiles,
      chain: { ...elasticMenuChainConfig.chain, threshold: 0.2 },
    }
    expect(hash(JSON.stringify(literalThresholdMutant))).toBe('e3b9f1e895cc8ff7337721a3656ee55e1e48b38ea5a4a573027ab0359d219f93')
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

      if (mismatch.sourceVersion !== 1) await writeSourceVersion(paths, mismatch.sourceVersion)
      if (mismatch.schemaVersion !== 1) await writeSchemaVersion(paths, mismatch.schemaVersion)
      const rejected = compile(paths)

      expect(rejected.status).not.toBe(0)
      expect(rejected.stderr.trim()).toBe(`/version must be equal to constant; received ${mismatch.received}`)
      expect(await readFile(paths.output, 'utf8')).toBe(lastValidOutput)
    }
  })

  it('rejects mutations of the production YAML without overwriting a previously valid generated module', async () => {
    const invalidMutations = [
      ['unknown key', (source: string) => `${source}unknown: true\n`, '/unknown'],
      ['missing key', (source: string) => source.replace('  exitStartViewportPercent: 22\n', ''), '/chain/exitStartViewportPercent'],
      ['duplicate key', (source: string) => `${source}version: 1\n`, 'unique'],
      ['alias', (source: string) => replaceOnce(source, 'version: 1', 'version: &version 1\ncopy: *version'), 'alias'],
      ['merge key', (source: string) => `${source}<<: { version: 1 }\n`, 'merge'],
      ['wrong ease', (source: string) => replaceOnce(source, '    ease: bounce.out', '    ease: elastic.out'), '/profiles/follower/ease'],
      ['lead uses follower ease', (source: string) => replaceOnce(source, '    ease: power3.out', '    ease: bounce.out'), '/profiles/lead/ease'],
      ['follower uses lead ease', (source: string) => replaceOnce(source, '    ease: bounce.out', '    ease: power3.out'), '/profiles/follower/ease'],
      ['opacity below range', (source: string) => replaceOnce(source, '    initialOpacity: 0', '    initialOpacity: -0.01'), '/profiles/lead/initialOpacity'],
      ['threshold above range', (source: string) => replaceOnce(source, '  threshold: 0.1', '  threshold: 1.01'), '/chain/threshold'],
      ['progress above range', (source: string) => replaceOnce(source, '  pullAtPreviousProgress: 0.42', '  pullAtPreviousProgress: 1.01'), '/chain/pullAtPreviousProgress'],
      ['non-positive duration', (source: string) => replaceOnce(source, '    duration: 2.2', '    duration: 0'), '/profiles/lead/duration'],
      ['distance above production maximum', (source: string) => replaceOnce(source, '    distance: 180', '    distance: 10001'), '/profiles/lead/distance'],
      ['duration above production maximum', (source: string) => replaceOnce(source, '    duration: 2.2', '    duration: 60.01'), '/profiles/lead/duration'],
      ['scale above production maximum', (source: string) => replaceOnce(source, '    scale: 1', '    scale: 10.01'), '/profiles/lead/scale'],
      ['delay above production maximum', (source: string) => replaceOnce(source, '    delay: 0', '    delay: 60.01'), '/profiles/lead/delay'],
      ['disappear duration above production maximum', (source: string) => replaceOnce(source, '    disappearDuration: 0.5', '    disappearDuration: 60.01'), '/profiles/lead/disappearDuration'],
    ] as const

    for (const [name, mutateSource, expectedError] of invalidMutations) {
      const paths = await fixture()
      expect(compile(paths).status).toBe(0)
      const validOutput = await readFile(paths.output, 'utf8')
      const validHash = hash(validOutput)
      await writeFile(paths.source, mutateSource(await readFile(paths.source, 'utf8')))

      const result = compile(paths)

      expect(result.status, name).not.toBe(0)
      expect(result.stderr).toContain(expectedError)
      const preservedOutput = await readFile(paths.output, 'utf8')
      expect(preservedOutput).toBe(validOutput)
      expect(hash(preservedOutput)).toBe(validHash)
    }
  })

  it('does not delete a staging path it did not create when exclusive temp creation collides', async () => {
    const paths = await fixture()
    const baseline = compile(paths)
    expect(baseline.status, baseline.stderr).toBe(0)
    const lastValidOutput = await readFile(paths.output, 'utf8')
    await replaceFileOnce(paths.source, '  threshold: 0.1', '  threshold: 0.2')
    const temporaryToken = 'foreign-collision'
    const foreignTemporaryOutput = `${paths.output}.${temporaryToken}.tmp`
    await writeFile(foreignTemporaryOutput, 'foreign staging owner\n')

    const collision = compile(paths, '--write', {
      ...process.env,
      NODE_ENV: 'test',
      ELASTIC_MENU_CHAIN_CONFIG_TEST_TEMPORARY_OUTPUT_TOKEN: temporaryToken,
    })

    expect(collision.status).not.toBe(0)
    expect(collision.stderr).toContain('EEXIST')
    expect(await readFile(paths.output, 'utf8')).toBe(lastValidOutput)
    expect(await readFile(foreignTemporaryOutput, 'utf8')).toBe('foreign staging owner\n')
  })

  it('watches copied production authority, recovers after invalid authoring, and exits on SIGTERM', async () => {
    const paths = await fixture()
    const child = spawnWatcher(paths)
    let stdout = ''
    let stderr = ''
    child.stdout?.setEncoding('utf8')
    child.stderr?.setEncoding('utf8')
    child.stdout?.on('data', chunk => { stdout += chunk })
    child.stderr?.on('data', chunk => { stderr += chunk })

    try {
      await waitFor(async () => {
        try {
          return (await readFile(paths.output, 'utf8')).includes('"threshold": 0.1')
        } catch {
          return false
        }
      }, 'watch compiler did not create the initial output')

      const source = await readFile(paths.source, 'utf8')
      await writeFile(paths.source, replaceOnce(source, '  threshold: 0.1', '  threshold: 0.2'))
      await waitFor(async () => (await readFile(paths.output, 'utf8')).includes('"threshold": 0.2'), 'YAML edit did not regenerate output')

      const logCountBeforeSchemaEdit = stdout.match(/Elastic menu chain config regenerated/g)?.length ?? 0
      const schema = await readFile(paths.schema, 'utf8')
      await writeFile(paths.schema, replaceOnce(schema, '  "type": "object",', '  "title": "watch schema update",\n  "type": "object",'))
      await waitFor(
        () => (stdout.match(/Elastic menu chain config regenerated/g)?.length ?? 0) > logCountBeforeSchemaEdit,
        'schema edit did not regenerate output',
      )

      const validOutput = await readFile(paths.output, 'utf8')
      const validHash = hash(validOutput)
      const updatedSource = await readFile(paths.source, 'utf8')
      await writeFile(paths.source, replaceOnce(updatedSource, '  threshold: 0.2', '  threshold: 1.1'))
      await waitFor(() => stderr.includes('/chain/threshold'), 'invalid YAML edit did not report a validation error')
      const preservedOutput = await readFile(paths.output, 'utf8')
      expect(preservedOutput).toBe(validOutput)
      expect(hash(preservedOutput)).toBe(validHash)

      await writeFile(paths.source, replaceOnce(updatedSource, '  threshold: 0.2', '  threshold: 0.3'))
      await waitFor(async () => (await readFile(paths.output, 'utf8')).includes('"threshold": 0.3'), 'valid YAML edit did not recover')

      child.kill('SIGTERM')
      expect(await waitForProcessExit(child), 'watch compiler must exit cleanly after SIGTERM').toEqual({ code: 0, signal: null })
      expect(processIsAlive(child.pid)).toBe(false)
    } finally {
      if (processIsAlive(child.pid)) {
        child.kill('SIGKILL')
        await waitForProcessExit(child)
      }
    }
  })

  it('keeps watching the exact authoring basename after atomic replacement and a later edit', async () => {
    const paths = await fixture()
    const child = spawnWatcher(paths)

    try {
      await waitFor(
        () => outputContains(paths, '"threshold": 0.1'),
        'watch compiler did not create the initial output',
      )

      await replaceFileAtomicallyOnce(paths.source, '  threshold: 0.1', '  threshold: 0.2')
      await waitFor(
        () => outputContains(paths, '"threshold": 0.2'),
        'atomic replacement did not publish the recreated authoring file',
      )

      await replaceFileOnce(paths.source, '  threshold: 0.2', '  threshold: 0.3')
      await waitFor(
        () => outputContains(paths, '"threshold": 0.3'),
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
      ELASTIC_MENU_CHAIN_CONFIG_TEST_TRACE: '1',
      ELASTIC_MENU_CHAIN_CONFIG_TEST_BARRIER_MARKER: 'threshold: 0.2',
      ELASTIC_MENU_CHAIN_CONFIG_TEST_BARRIER_RELEASE_PATH: barrierReleasePath,
      ELASTIC_MENU_CHAIN_CONFIG_TEST_PUBLISH_MARKERS: JSON.stringify([
        'threshold: 0.2',
        'threshold: 0.3',
      ]),
    })
    let stdout = ''
    child.stdout?.setEncoding('utf8')
    child.stdout?.on('data', chunk => { stdout += chunk })

    try {
      await waitFor(
        () => outputContains(paths, '"threshold": 0.1'),
        'watch compiler did not create the initial output',
      )
      await replaceFileOnce(paths.source, '  threshold: 0.1', '  threshold: 0.2')
      await waitFor(
        () => stdout.includes('elastic menu chain config test barrier entered'),
        'older compile did not enter its deterministic barrier',
      )

      await replaceFileOnce(paths.source, '  threshold: 0.2', '  threshold: 0.3')
      await waitFor(
        async () => await outputContains(paths, '"threshold": 0.3')
          || stdout.includes('elastic menu chain config test dirty queued'),
        'newer authoring was neither published concurrently nor queued behind the active compile',
      )
      await writeFile(barrierReleasePath, 'release\n')
      await waitFor(
        () => stdout.includes('elastic menu chain config test published threshold: 0.2')
          && stdout.includes('elastic menu chain config test published threshold: 0.3'),
        'single-flight queue did not publish both valid snapshots',
      )

      child.kill('SIGTERM')
      expect(await waitForProcessExit(child)).toEqual({ code: 0, signal: null })
      expect(stdout.indexOf('elastic menu chain config test published threshold: 0.2'))
        .toBeLessThan(stdout.indexOf('elastic menu chain config test published threshold: 0.3'))
      expect(await readFile(paths.output, 'utf8')).toContain('"threshold": 0.3')
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
        ELASTIC_MENU_CHAIN_CONFIG_TEST_TRACE: '1',
        ELASTIC_MENU_CHAIN_CONFIG_TEST_BARRIER_MARKER: 'threshold: 0.2',
        ELASTIC_MENU_CHAIN_CONFIG_TEST_BARRIER_RELEASE_PATH: barrierReleasePath,
        ELASTIC_MENU_CHAIN_CONFIG_TEST_PUBLISH_MARKERS: JSON.stringify([
          'threshold: 0.2',
          'threshold: 0.3',
        ]),
      })
      let stdout = ''
      child.stdout?.setEncoding('utf8')
      child.stdout?.on('data', chunk => { stdout += chunk })

      try {
        await waitFor(
          async () => await outputContains(paths, '"threshold": 0.1')
            && stdout.includes('elastic menu chain config test watcher opened'),
          'watch compiler did not publish initially and open its directory watcher',
        )
        const outputBeforeSignal = await readFile(paths.output, 'utf8')

        await replaceFileOnce(paths.source, '  threshold: 0.1', '  threshold: 0.2')
        await waitFor(
          () => stdout.includes('elastic menu chain config test barrier entered'),
          'active compile did not enter its deterministic barrier',
        )
        await replaceFileOnce(paths.source, '  threshold: 0.2', '  threshold: 0.3')
        await waitFor(
          async () => await outputContains(paths, '"threshold": 0.3')
            || stdout.includes('elastic menu chain config test dirty queued'),
          'newer authoring was neither published concurrently nor queued before shutdown',
        )

        child.kill(signal)
        await waitFor(
          () => stdout.includes('elastic menu chain config test stop observed'),
          `watch compiler did not acknowledge ${signal}`,
        )
        expect(processIsAlive(child.pid)).toBe(true)
        expect(stdout.match(/elastic menu chain config test watcher opened/g)).toHaveLength(1)
        expect(stdout.match(/elastic menu chain config test watcher closed/g)).toHaveLength(1)

        await writeFile(barrierReleasePath, 'release\n')
        await waitFor(
          () => stdout.includes('elastic menu chain config test barrier released'),
          'active compile did not finish after barrier release',
        )
        expect(await waitForProcessExit(child), 'watch compiler must await its active compile').toEqual({
          code: 0,
          signal: null,
        })
        expect(await readFile(paths.output, 'utf8')).toBe(outputBeforeSignal)
        expect(stdout).not.toContain('elastic menu chain config test published threshold: 0.2')
        expect(stdout).not.toContain('elastic menu chain config test published threshold: 0.3')
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
        ELASTIC_MENU_CHAIN_CONFIG_TEST_TRACE: '1',
        ELASTIC_MENU_CHAIN_CONFIG_TEST_FINAL_PUBLISH_BARRIER_MARKER: 'threshold: 0.2',
        ELASTIC_MENU_CHAIN_CONFIG_TEST_FINAL_PUBLISH_BARRIER_RELEASE_PATH: barrierReleasePath,
        ELASTIC_MENU_CHAIN_CONFIG_TEST_PUBLISH_MARKERS: JSON.stringify(['threshold: 0.2']),
      })
      let stdout = ''
      child.stdout?.setEncoding('utf8')
      child.stdout?.on('data', chunk => { stdout += chunk })

      try {
        await waitFor(
          () => stdout.includes('elastic menu chain config test watcher opened')
            && stdout.includes('Elastic menu chain config regenerated'),
          'watch compiler did not finish its initial compile before the final-publication test',
        )
        await replaceFileOnce(paths.source, '  threshold: 0.1', '  threshold: 0.2')
        await waitFor(
          () => stdout.includes('elastic menu chain config test final publish barrier entered'),
          'active compile did not reach the deterministic final publication seam',
        )
        const stagedAtBarrier = await stagedOutputFiles(paths)

        child.kill(signal)
        await waitFor(
          () => stdout.includes('elastic menu chain config test stop observed'),
          `watch compiler did not acknowledge ${signal} at the final publication seam`,
        )
        expect(processIsAlive(child.pid)).toBe(true)
        expect(stdout.match(/elastic menu chain config test watcher opened/g)).toHaveLength(1)
        expect(stdout.match(/elastic menu chain config test watcher closed/g)).toHaveLength(1)

        await writeFile(barrierReleasePath, 'release\n')
        await waitFor(
          () => stdout.includes('elastic menu chain config test final publish barrier released'),
          'active compile did not leave the final publication seam after release',
        )
        expect(await waitForProcessExit(child), 'watch compiler must finish the owned publication attempt').toEqual({
          code: 0,
          signal: null,
        })
        expect(await readFile(paths.output, 'utf8')).toBe(lastValidOutput)
        expect(stdout).not.toContain('elastic menu chain config test published threshold: 0.2')
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

  it('rejects missing and stale generated output in check mode', async () => {
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
})
