import { watch as watchFileSystem } from 'node:fs'
import { randomUUID } from 'node:crypto'
import { open, readFile, rename, rm } from 'node:fs/promises'
import { basename, dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import Ajv2020 from 'ajv/dist/2020.js'
import { isAlias, isMap, isSeq, parseDocument } from 'yaml'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const defaults = {
  source: resolve(root, 'src/landing/motion/config/elastic-menu-chain.motion.yaml'),
  schema: resolve(root, 'src/landing/motion/config/elastic-menu-chain.motion.schema.json'),
  output: resolve(root, 'src/landing/motion/config/elastic-menu-chain-config.generated.ts'),
}
const generatedWarning = '// GENERATED FILE - DO NOT EDIT.\n// Edit src/landing/motion/config/elastic-menu-chain.motion.yaml and run `npm run elastic-menu-chain:config`.\n\n'

function testTrace(message) {
  if (process.env.NODE_ENV === 'test' && process.env.ELASTIC_MENU_CHAIN_CONFIG_TEST_TRACE === '1') {
    process.stdout.write(`elastic menu chain config test ${message}\n`)
  }
}

function findTestPublishMarker(sourceText) {
  if (process.env.NODE_ENV !== 'test') return null
  const serializedMarkers = process.env.ELASTIC_MENU_CHAIN_CONFIG_TEST_PUBLISH_MARKERS
  if (!serializedMarkers) return null
  const markers = JSON.parse(serializedMarkers)
  if (!Array.isArray(markers) || markers.some(marker => typeof marker !== 'string')) {
    throw new Error('ELASTIC_MENU_CHAIN_CONFIG_TEST_PUBLISH_MARKERS must be a JSON string array')
  }
  return markers.find(marker => sourceText.includes(marker)) ?? null
}

async function waitForTestCompileBarrier(sourceText) {
  if (process.env.NODE_ENV !== 'test') return
  const marker = process.env.ELASTIC_MENU_CHAIN_CONFIG_TEST_BARRIER_MARKER
  if (!marker || !sourceText.includes(marker)) return
  const releasePath = process.env.ELASTIC_MENU_CHAIN_CONFIG_TEST_BARRIER_RELEASE_PATH
  if (!releasePath) {
    throw new Error('ELASTIC_MENU_CHAIN_CONFIG_TEST_BARRIER_RELEASE_PATH is required with a barrier marker')
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
  const marker = process.env.ELASTIC_MENU_CHAIN_CONFIG_TEST_FINAL_PUBLISH_BARRIER_MARKER
  if (!marker || testPublishMarker !== marker) return
  const releasePath = process.env.ELASTIC_MENU_CHAIN_CONFIG_TEST_FINAL_PUBLISH_BARRIER_RELEASE_PATH
  if (!releasePath) {
    throw new Error('ELASTIC_MENU_CHAIN_CONFIG_TEST_FINAL_PUBLISH_BARRIER_RELEASE_PATH is required with a final publish barrier marker')
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
    ? process.env.ELASTIC_MENU_CHAIN_CONFIG_TEST_TEMPORARY_OUTPUT_TOKEN
    : undefined
  if (testToken && !/^[A-Za-z0-9_-]+$/.test(testToken)) {
    throw new Error('ELASTIC_MENU_CHAIN_CONFIG_TEST_TEMPORARY_OUTPUT_TOKEN must contain only letters, numbers, underscores, or hyphens')
  }
  return `${output}.${testToken ?? `${process.pid}.${randomUUID()}`}.tmp`
}

function parseArguments(argumentsList) {
  const options = { ...defaults, mode: '--write' }
  let modeSeen = false
  for (let index = 0; index < argumentsList.length; index += 1) {
    const argument = argumentsList[index]
    if (argument === '--write' || argument === '--check' || argument === '--watch') {
      if (modeSeen) throw new Error('Choose exactly one of --write, --check, or --watch')
      options.mode = argument
      modeSeen = true
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

function finiteNumberErrors(value, path = '') {
  if (typeof value === 'number') return Number.isFinite(value) ? [] : [`${path || '/'} must be finite`]
  if (Array.isArray(value)) return value.flatMap((item, index) => finiteNumberErrors(item, `${path}/${index}`))
  if (value && typeof value === 'object') {
    return Object.entries(value).flatMap(([key, item]) => finiteNumberErrors(item, `${path}/${key}`))
  }
  return []
}

async function compile(options) {
  const [sourceText, schemaText] = await Promise.all([
    readFile(options.source, 'utf8'),
    readFile(options.schema, 'utf8'),
  ])
  await waitForTestCompileBarrier(sourceText)
  const document = parseDocument(sourceText, {
    merge: false,
    prettyErrors: true,
    uniqueKeys: true,
  })
  if (document.errors.length > 0) throw new Error(document.errors.map(error => error.message).join('\n'))
  if (hasAliasOrMerge(document.contents)) throw new Error('YAML aliases and merge keys are not allowed')
  const value = document.toJS({ maxAliasCount: 0 })
  const ajv = new Ajv2020({ allErrors: true, strict: true })
  const validate = ajv.compile(JSON.parse(schemaText))
  if (!validate(value)) throw new Error(formatSchemaErrors(validate.errors ?? [], value))
  const finiteErrors = finiteNumberErrors(value)
  if (finiteErrors.length > 0) throw new Error(finiteErrors.join('\n'))
  const runtimeConfig = {
    profiles: value.profiles,
    chain: value.chain,
  }
  return {
    output: `${generatedWarning}import type { ElasticMenuChainConfig } from './elastic-menu-chain-config.types'\n\nexport const elasticMenuChainConfig = ${JSON.stringify(runtimeConfig, null, 2)} as const satisfies ElasticMenuChainConfig\n`,
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
        throw new Error(`Generated elastic menu chain config is missing: ${options.output}`)
      }
      throw error
    }
    if (current !== output) throw new Error(`Generated elastic menu chain config is stale: ${options.output}`)
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
    process.stderr.write(`Elastic menu chain config watcher error (${directory}): ${message}\n`)
    process.exitCode = 1
    close()
  }
  process.once('SIGINT', close)
  process.once('SIGTERM', close)

  const execute = async () => {
    try {
      const published = await writeOrCheck({ ...options, mode: '--write' }, () => !stopped)
      if (published) process.stdout.write('Elastic menu chain config regenerated\n')
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
