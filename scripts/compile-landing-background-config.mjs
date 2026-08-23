import { watch as watchFileSystem } from 'node:fs'
import { randomUUID } from 'node:crypto'
import { open, readFile, rename, rm } from 'node:fs/promises'
import { basename, dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import Ajv2020 from 'ajv/dist/2020.js'
import { isAlias, isMap, isSeq, parseDocument } from 'yaml'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const defaults = {
  source: resolve(root, 'src/landing/background/config/landing-background.effects.yaml'),
  schema: resolve(root, 'src/landing/background/config/landing-background.effects.schema.json'),
  output: resolve(root, 'src/landing/background/config/landing-background-config.generated.ts'),
}
const generatedWarning = '// GENERATED FILE - DO NOT EDIT.\n// Edit src/landing/background/config/landing-background.effects.yaml and run `npm run landing-background:config`.\n\n'

function testTrace(message) {
  if (process.env.NODE_ENV === 'test' && process.env.LANDING_BACKGROUND_CONFIG_TEST_TRACE === '1') {
    process.stdout.write(`landing background config test ${message}\n`)
  }
}

function findTestPublishMarker(sourceText) {
  if (process.env.NODE_ENV !== 'test') return null
  const serializedMarkers = process.env.LANDING_BACKGROUND_CONFIG_TEST_PUBLISH_MARKERS
  if (!serializedMarkers) return null
  const markers = JSON.parse(serializedMarkers)
  if (!Array.isArray(markers) || markers.some(marker => typeof marker !== 'string')) {
    throw new Error('LANDING_BACKGROUND_CONFIG_TEST_PUBLISH_MARKERS must be a JSON string array')
  }
  return markers.find(marker => sourceText.includes(marker)) ?? null
}

async function waitForTestCompileBarrier(sourceText) {
  if (process.env.NODE_ENV !== 'test') return
  const marker = process.env.LANDING_BACKGROUND_CONFIG_TEST_BARRIER_MARKER
  if (!marker || !sourceText.includes(marker)) return
  const releasePath = process.env.LANDING_BACKGROUND_CONFIG_TEST_BARRIER_RELEASE_PATH
  if (!releasePath) {
    throw new Error('LANDING_BACKGROUND_CONFIG_TEST_BARRIER_RELEASE_PATH is required with a barrier marker')
  }
  testTrace('barrier entered')
  while (true) {
    try {
      await readFile(releasePath)
      break
    } catch (error) {
      if (!(error instanceof Error && 'code' in error && error.code === 'ENOENT')) throw error
    }
    await new Promise(resolve => setTimeout(resolve, 5))
  }
  testTrace('barrier released')
}

async function waitForTestFinalPublishBarrier(testPublishMarker) {
  if (process.env.NODE_ENV !== 'test') return
  const marker = process.env.LANDING_BACKGROUND_CONFIG_TEST_FINAL_PUBLISH_BARRIER_MARKER
  if (!marker || testPublishMarker !== marker) return
  const releasePath = process.env.LANDING_BACKGROUND_CONFIG_TEST_FINAL_PUBLISH_BARRIER_RELEASE_PATH
  if (!releasePath) {
    throw new Error('LANDING_BACKGROUND_CONFIG_TEST_FINAL_PUBLISH_BARRIER_RELEASE_PATH is required with a final publish barrier marker')
  }
  testTrace('final publish barrier entered')
  while (true) {
    try {
      await readFile(releasePath)
      break
    } catch (error) {
      if (!(error instanceof Error && 'code' in error && error.code === 'ENOENT')) throw error
    }
    await new Promise(resolve => setTimeout(resolve, 5))
  }
  testTrace('final publish barrier released')
}

function temporaryOutputPath(output) {
  const testToken = process.env.NODE_ENV === 'test'
    ? process.env.LANDING_BACKGROUND_CONFIG_TEST_TEMPORARY_OUTPUT_TOKEN
    : undefined
  if (testToken && !/^[A-Za-z0-9_-]+$/.test(testToken)) {
    throw new Error('LANDING_BACKGROUND_CONFIG_TEST_TEMPORARY_OUTPUT_TOKEN must contain only letters, numbers, underscores, or hyphens')
  }
  return `${output}.${testToken ?? `${process.pid}.${randomUUID()}`}.tmp`
}

function parseArguments(argumentsList) {
  const options = { ...defaults, mode: '--write' }
  for (let index = 0; index < argumentsList.length; index += 1) {
    const argument = argumentsList[index]
    if (argument === '--write' || argument === '--check' || argument === '--watch') {
      options.mode = argument
    } else if (argument === '--source' || argument === '--schema' || argument === '--output') {
      const value = argumentsList[index + 1]
      if (!value) throw new Error(`${argument} requires a path`)
      options[argument.slice(2)] = resolve(value)
      index += 1
    } else {
      throw new Error(`Unknown argument: ${argument}`)
    }
  }
  return options
}

function hasAliasOrMerge(node) {
  if (!node) return false
  if (isAlias(node)) return true
  if (isMap(node)) {
    return node.items.some(item => (
      item.key?.value === '<<'
      || hasAliasOrMerge(item.key)
      || hasAliasOrMerge(item.value)
    ))
  }
  if (isSeq(node)) return node.items.some(hasAliasOrMerge)
  return false
}

function pathValue(value, instancePath) {
  return instancePath
    .split('/')
    .filter(Boolean)
    .reduce((current, part) => current?.[part.replace(/~1/g, '/').replace(/~0/g, '~')], value)
}

function formatSchemaErrors(errors, value) {
  return errors.map(error => {
    const property = error.keyword === 'additionalProperties'
      ? error.params.additionalProperty.replace(/~/g, '~0').replace(/\//g, '~1')
      : error.keyword === 'required'
        ? error.params.missingProperty
        : undefined
    const path = property ? `${error.instancePath}/${property}` : error.instancePath || '/'
    const received = JSON.stringify(pathValue(value, path)) ?? 'undefined'
    return `${path} ${error.message}; received ${received}`
  }).join('\n')
}

function semanticErrors(config) {
  const errors = []
  const numericValues = [
    ...Object.entries(config.dark),
    ...Object.entries(config.light).filter(([, value]) => typeof value === 'number'),
  ]
  for (const [key, value] of numericValues) {
    if (typeof value !== 'number' || !Number.isFinite(value)) errors.push(`${key} must be finite`)
  }
  const leftRatio = config.light.centerXRatio - config.light.widthRatio / 2
  const rightRatio = config.light.centerXRatio + config.light.widthRatio / 2
  if (leftRatio < 0 || rightRatio > 1) {
    errors.push('light strip edges must stay within [0, 1]')
  }
  return errors
}

async function compile(options) {
  const [sourceText, schemaText] = await Promise.all([
    readFile(options.source, 'utf8'),
    readFile(options.schema, 'utf8'),
  ])
  await waitForTestCompileBarrier(sourceText)
  const document = parseDocument(sourceText, { merge: false, uniqueKeys: true })
  if (document.errors.length > 0) {
    throw new Error(document.errors.map(error => error.message).join('\n'))
  }
  if (hasAliasOrMerge(document.contents)) {
    throw new Error('YAML aliases and merge keys are not allowed')
  }
  const value = document.toJS({ maxAliasCount: 0 })
  const schema = JSON.parse(schemaText)
  const ajv = new Ajv2020({ allErrors: true, multipleOfPrecision: 8, strict: true })
  const validate = ajv.compile(schema)
  if (!validate(value)) throw new Error(formatSchemaErrors(validate.errors ?? [], value))
  const semantics = semanticErrors(value)
  if (semantics.length > 0) throw new Error(semantics.join('\n'))
  const runtimeConfig = {
    dark: value.dark,
    light: value.light,
  }
  return {
    output: `${generatedWarning}import type { LandingBackgroundConfig } from './landing-background-config.types'\n\nexport const landingBackgroundConfig = ${JSON.stringify(runtimeConfig, null, 2)} as const satisfies LandingBackgroundConfig\n`,
    testPublishMarker: findTestPublishMarker(sourceText),
  }
}

async function writeOrCheck(options, canPublish = () => true) {
  const { output, testPublishMarker } = await compile(options)
  if (options.mode === '--check') {
    let current
    try {
      current = await readFile(options.output, 'utf8')
    } catch (error) {
      if (error instanceof Error && 'code' in error && error.code === 'ENOENT') {
        throw new Error(`Generated background config is missing: ${options.output}`)
      }
      throw error
    }
    if (current !== output) {
      throw new Error(`Generated background config is stale: ${options.output}`)
    }
    return true
  }
  if (!canPublish()) return false
  const temporaryOutput = temporaryOutputPath(options.output)
  let temporaryOutputOwned = false
  let published = false
  try {
    const temporaryOutputHandle = await open(temporaryOutput, 'wx')
    temporaryOutputOwned = true
    try {
      await temporaryOutputHandle.writeFile(output)
    } finally {
      await temporaryOutputHandle.close()
    }
    await waitForTestFinalPublishBarrier(testPublishMarker)
    if (!canPublish()) return false
    await rename(temporaryOutput, options.output)
    published = true
    if (testPublishMarker) testTrace(`published ${testPublishMarker}`)
    return true
  } finally {
    if (temporaryOutputOwned && !published) await rm(temporaryOutput, { force: true })
  }
}

function createSingleFlightCompileQueue(execute, isStopped) {
  let dirty = false
  let activeCompile = null
  const drain = async () => {
    while (dirty && !isStopped()) {
      dirty = false
      await execute()
    }
  }
  const queue = () => {
    if (isStopped()) return activeCompile ?? Promise.resolve()
    dirty = true
    if (activeCompile) testTrace('dirty queued')
    else activeCompile = drain().finally(() => { activeCompile = null })
    return activeCompile
  }
  return {
    clear: () => { dirty = false },
    queue,
    waitForIdle: () => activeCompile ?? Promise.resolve(),
  }
}

async function watchAndWrite(options) {
  let stopped = false
  let pending = null
  let resolveStopped
  let compileQueue
  const stoppedPromise = new Promise(resolve => { resolveStopped = resolve })
  const watchers = new Map()
  const close = () => {
    if (stopped) return
    stopped = true
    compileQueue?.clear()
    if (pending) clearTimeout(pending)
    pending = null
    for (const [directory, watcher] of watchers) {
      watcher.close()
      testTrace(`watcher closed ${directory}`)
    }
    watchers.clear()
    process.off('SIGINT', close)
    process.off('SIGTERM', close)
    testTrace('stop observed')
    resolveStopped()
  }
  const failWatcher = (directory, error) => {
    if (stopped) return
    const message = error instanceof Error ? error.message : error
    process.stderr.write(`Landing background config watcher error (${directory}): ${message}\n`)
    process.exitCode = 1
    close()
  }
  process.once('SIGINT', close)
  process.once('SIGTERM', close)

  const execute = async () => {
    try {
      const published = await writeOrCheck({ ...options, mode: '--write' }, () => !stopped)
      if (published) process.stdout.write('Landing background config regenerated\n')
    } catch (error) {
      if (!stopped) process.stderr.write(`${error instanceof Error ? error.message : error}\n`)
    }
  }
  compileQueue = createSingleFlightCompileQueue(execute, () => stopped)
  const refresh = () => {
    if (stopped) return
    if (pending) clearTimeout(pending)
    pending = setTimeout(() => {
      pending = null
      compileQueue.queue()
    }, 40)
  }

  const filenamesByDirectory = new Map()
  for (const path of [options.source, options.schema]) {
    const directory = dirname(path)
    const filenames = filenamesByDirectory.get(directory) ?? new Set()
    filenames.add(basename(path))
    filenamesByDirectory.set(directory, filenames)
  }

  try {
    for (const [directory, filenames] of filenamesByDirectory) {
      const watcher = watchFileSystem(directory, (_eventType, filename) => {
        if (filename === null || filenames.has(filename.toString())) {
          testTrace('change observed')
          refresh()
        }
      })
      watchers.set(directory, watcher)
      testTrace(`watcher opened ${directory}`)
      watcher.once('error', error => failWatcher(directory, error))
    }
  } catch (error) {
    failWatcher('setup', error)
  }

  if (!stopped) {
    compileQueue.queue()
    await compileQueue.waitForIdle()
  }
  await stoppedPromise
  await compileQueue.waitForIdle()
}

const options = parseArguments(process.argv.slice(2))
try {
  if (options.mode === '--watch') await watchAndWrite(options)
  else await writeOrCheck(options)
} catch (error) {
  console.error(error instanceof Error ? error.message : error)
  process.exitCode = 1
}
