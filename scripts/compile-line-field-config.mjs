import { watch as watchFileSystem } from 'node:fs'
import { randomUUID } from 'node:crypto'
import { open, readFile, rename, rm } from 'node:fs/promises'
import { basename, dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import Ajv2020 from 'ajv/dist/2020.js'
import { isAlias, isMap, isSeq, parseDocument } from 'yaml'

const scriptPath = fileURLToPath(import.meta.url)
const root = resolve(dirname(scriptPath), '..')
const defaults = {
  source: resolve(root, 'src/landing/line-field/config/line-field.animation.yaml'),
  schema: resolve(root, 'src/landing/line-field/config/line-field.animation.schema.json'),
  materialsSource: resolve(root, 'src/landing/line-field/config/line-field.materials.yaml'),
  materialsSchema: resolve(root, 'src/landing/line-field/config/line-field.materials.schema.json'),
  output: resolve(root, 'src/landing/line-field/config/line-field-config.generated.ts'),
}
const generatedWarning = '// GENERATED FILE - DO NOT EDIT.\n// Edit src/landing/line-field/config/line-field.animation.yaml or line-field.materials.yaml and run `npm run line-field:config`.\n\n'

function parseArguments(argumentsList) {
  const options = { ...defaults, mode: '--write' }
  for (let index = 0; index < argumentsList.length; index += 1) {
    const argument = argumentsList[index]
    if (argument === '--write' || argument === '--check' || argument === '--watch') options.mode = argument
    else if (
      argument === '--source'
      || argument === '--schema'
      || argument === '--materials-source'
      || argument === '--materials-schema'
      || argument === '--output'
    ) {
      const value = argumentsList[index + 1]
      if (!value) throw new Error(`${argument} requires a path`)
      const key = argument.slice(2).replace(/-([a-z])/g, (_match, letter) => letter.toUpperCase())
      options[key] = resolve(value)
      index += 1
    } else throw new Error(`Unknown argument: ${argument}`)
  }
  return options
}

function hasAlias(node) {
  if (!node) return false
  if (isAlias(node)) return true
  if (isMap(node)) return node.items.some((item) => item.key?.value === '<<' || hasAlias(item.key) || hasAlias(item.value))
  if (isSeq(node)) return node.items.some(hasAlias)
  return false
}

function pathValue(value, instancePath) {
  return instancePath.split('/').filter(Boolean).reduce((current, part) => current?.[part.replace(/~1/g, '/').replace(/~0/g, '~')], value)
}

function formatSchemaErrors(errors, value) {
  return errors.map((error) => {
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
  const require = (condition, message) => { if (!condition) errors.push(message) }
  require(config.geometry.spineWidthPx >= config.geometry.lineWidthPx, 'geometry.spineWidthPx must not be below geometry.lineWidthPx')
  require(config.reveal.preloadFilmProgress < config.reveal.startFilmProgress, 'reveal.preloadFilmProgress must be before reveal.startFilmProgress')
  const mobileLeftInsetHundredths = Math.round(config.motto.mobileFinalLeftInsetRem * 100)
  const mobileRightInsetHundredths = Math.round(config.motto.mobileFinalRightInsetRem * 100)
  require(
    mobileLeftInsetHundredths > mobileRightInsetHundredths,
    'motto.mobileFinalLeftInsetRem must be greater than motto.mobileFinalRightInsetRem',
  )
  require(config.motto.orbit.phiStartDegrees < config.motto.orbit.phiPeakDegrees, 'motto.orbit.phiStartDegrees must be below phiPeakDegrees')
  require(config.motto.orbit.phiPeakDegrees < config.motto.orbit.phiEndDegrees, 'motto.orbit.phiPeakDegrees must be below phiEndDegrees')
  require(
    config.motto.depthCues.scaleStart <= config.motto.depthCues.scaleAtPhiPeak
      && config.motto.depthCues.scaleAtPhiPeak <= config.motto.depthCues.scaleEnd,
    'motto.depthCues scale landmarks must be nondecreasing',
  )
  require(
    config.motto.depthCues.blurStart >= config.motto.depthCues.blurAtPhiPeak
      && config.motto.depthCues.blurAtPhiPeak >= config.motto.depthCues.blurEnd,
    'motto.depthCues blur landmarks must be nonincreasing',
  )
  require(config.motto.depthCues.scaleEnd === 1, 'motto.depthCues.scaleEnd must equal 1')
  require(config.motto.depthCues.blurEnd === 0, 'motto.depthCues.blurEnd must equal 0')
  require(config.motto.visibility.opacityEnd === 1, 'motto.visibility.opacityEnd must equal 1')
  require(
    config.motto.visibility.phiStartDegrees >= config.motto.orbit.phiStartDegrees
      && config.motto.visibility.phiEndDegrees <= config.motto.orbit.phiEndDegrees,
    'motto.visibility phi range must stay inside the orbit phi range',
  )
  require(
    config.motto.visibility.phiStartDegrees < config.motto.visibility.phiEndDegrees,
    'motto.visibility.phiStartDegrees must be below phiEndDegrees',
  )
  const darkMixHundredths = Math.round(config.theme.dark.tipGlow.pinkMix * 100) + Math.round(config.theme.dark.tipGlow.cyanMix * 100)
  require(darkMixHundredths <= 100, 'theme.dark.tipGlow.pinkMix + cyanMix must not exceed 1')
  return errors
}

function resolveColors(value) {
  if (typeof value === 'string' && /^#[0-9A-Fa-f]{6}$/.test(value)) {
    return [1, 3, 5].map((offset) => Number((Number.parseInt(value.slice(offset, offset + 2), 16) / 255).toFixed(6)))
  }
  if (Array.isArray(value)) return value.map(resolveColors)
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([key, child]) => [key, resolveColors(child)]))
  return value
}

function typeScript(value, depth = 0) {
  const indent = '  '.repeat(depth)
  const childIndent = '  '.repeat(depth + 1)
  if (Array.isArray(value)) return `[${value.map((item) => typeScript(item, depth + 1)).join(', ')}]`
  if (value && typeof value === 'object') {
    return `{\n${Object.entries(value).map(([key, child]) => `${childIndent}${key}: ${typeScript(child, depth + 1)},`).join('\n')}\n${indent}}`
  }
  return JSON.stringify(value)
}

async function waitForTestCompileBarrier(sourceText) {
  if (process.env.NODE_ENV !== 'test') return
  const marker = process.env.LINE_FIELD_CONFIG_TEST_BARRIER_MARKER
  if (!marker || !sourceText.includes(marker)) return
  const releasePath = process.env.LINE_FIELD_CONFIG_TEST_BARRIER_RELEASE_PATH
  if (!releasePath) {
    throw new Error('LINE_FIELD_CONFIG_TEST_BARRIER_RELEASE_PATH is required with a barrier marker')
  }
  process.stdout.write('line field config test barrier entered\n')
  while (true) {
    try {
      await readFile(releasePath)
      break
    } catch (error) {
      if (!(error instanceof Error && 'code' in error && error.code === 'ENOENT')) throw error
    }
    await new Promise(resolve => setTimeout(resolve, 5))
  }
  process.stdout.write('line field config test barrier released\n')
}

function findTestFinalPublishMarker(sourceText) {
  if (process.env.NODE_ENV !== 'test') return null
  const marker = process.env.LINE_FIELD_CONFIG_TEST_FINAL_PUBLISH_BARRIER_MARKER
  return marker && sourceText.includes(marker) ? marker : null
}

async function waitForTestFinalPublishBarrier(testPublishMarker) {
  if (process.env.NODE_ENV !== 'test') return
  const marker = process.env.LINE_FIELD_CONFIG_TEST_FINAL_PUBLISH_BARRIER_MARKER
  if (!marker || testPublishMarker !== marker) return
  const releasePath = process.env.LINE_FIELD_CONFIG_TEST_FINAL_PUBLISH_BARRIER_RELEASE_PATH
  if (!releasePath) {
    throw new Error('LINE_FIELD_CONFIG_TEST_FINAL_PUBLISH_BARRIER_RELEASE_PATH is required with a final publish barrier marker')
  }
  process.stdout.write('line field config test final publish barrier entered\n')
  while (true) {
    try {
      await readFile(releasePath)
      break
    } catch (error) {
      if (!(error instanceof Error && 'code' in error && error.code === 'ENOENT')) throw error
    }
    await new Promise(resolve => setTimeout(resolve, 5))
  }
  process.stdout.write('line field config test final publish barrier released\n')
}

function temporaryOutputPath(output) {
  const testToken = process.env.NODE_ENV === 'test'
    ? process.env.LINE_FIELD_CONFIG_TEST_TEMPORARY_OUTPUT_TOKEN
    : undefined
  if (testToken && !/^[A-Za-z0-9_-]+$/.test(testToken)) {
    throw new Error('LINE_FIELD_CONFIG_TEST_TEMPORARY_OUTPUT_TOKEN must contain only letters, numbers, underscores, or hyphens')
  }
  return `${output}.${testToken ?? `${process.pid}.${randomUUID()}`}.tmp`
}

async function compile(options) {
  const [sourceText, schemaText, materialsSourceText, materialsSchemaText] = await Promise.all([
    readFile(options.source, 'utf8'),
    readFile(options.schema, 'utf8'),
    readFile(options.materialsSource, 'utf8'),
    readFile(options.materialsSchema, 'utf8'),
  ])
  await waitForTestCompileBarrier(sourceText)
  const document = parseDocument(sourceText, { uniqueKeys: true, merge: false })
  if (document.errors.length > 0) throw new Error(document.errors.map((error) => error.message).join('\n'))
  if (hasAlias(document.contents)) throw new Error('YAML aliases are not allowed')
  const materialsDocument = parseDocument(materialsSourceText, { uniqueKeys: true, merge: false })
  if (materialsDocument.errors.length > 0) throw new Error(materialsDocument.errors.map((error) => error.message).join('\n'))
  if (hasAlias(materialsDocument.contents)) throw new Error('YAML aliases are not allowed')
  const animation = document.toJS()
  const materials = materialsDocument.toJS()
  const ajv = new Ajv2020({ allErrors: true, strict: false, multipleOfPrecision: 12 })
  const validateAnimation = ajv.compile(JSON.parse(schemaText))
  if (!validateAnimation(animation)) throw new Error(formatSchemaErrors(validateAnimation.errors ?? [], animation))
  const validateMaterials = ajv.compile(JSON.parse(materialsSchemaText))
  if (!validateMaterials(materials)) throw new Error(formatSchemaErrors(validateMaterials.errors ?? [], materials))
  const { version: animationVersion, ...animationConfig } = animation
  const { version: materialsVersion, theme } = materials
  const config = { ...animationConfig, theme }
  const errors = semanticErrors(config)
  if (errors.length > 0) throw new Error(errors.join('\n'))
  const metadata = { animationVersion, materialsVersion }
  const generated = `${generatedWarning}import type { LineFieldAnimationConfig } from './line-field-config.types'\n\nexport const lineFieldAuthoringMetadata = ${typeScript(metadata)} as const\n\nexport const lineFieldConfig = ${typeScript(resolveColors(config))} as const satisfies LineFieldAnimationConfig\n`
  return { generated, testPublishMarker: findTestFinalPublishMarker(sourceText) }
}

async function writeOrCheck(options, canPublish = () => true) {
  const { generated, testPublishMarker } = await compile(options)
  if (options.mode === '--check') {
    let existing = ''
    try { existing = await readFile(options.output, 'utf8') } catch { /* a missing output is stale */ }
    if (existing !== generated) throw new Error(`${options.output.split('/').at(-1)} is stale`)
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
      await temporaryOutputHandle.writeFile(generated)
    } finally {
      await temporaryOutputHandle.close()
    }
    await waitForTestFinalPublishBarrier(testPublishMarker)
    if (!canPublish()) return false
    await rename(temporaryOutput, options.output)
    published = true
    return true
  } finally {
    if (temporaryOutputOwned && !published) await rm(temporaryOutput, { force: true })
  }
}

export function createSingleFlightCompileQueue(execute, isStopped) {
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
    if (!activeCompile) {
      activeCompile = drain().finally(() => { activeCompile = null })
    }
    return activeCompile
  }
  return {
    clear: () => { dirty = false },
    queue,
    waitForIdle: () => activeCompile ?? Promise.resolve(),
  }
}

async function watchAndCompile(options) {
  let stopped = false
  let pending = null
  let resolveStopped
  let compileQueue
  const stoppedPromise = new Promise((resolve) => { resolveStopped = resolve })
  const watchers = new Map()
  const close = () => {
    if (stopped) return
    stopped = true
    compileQueue?.clear()
    if (pending) clearTimeout(pending)
    pending = null
    for (const watcher of watchers.values()) watcher.close()
    watchers.clear()
    process.off('SIGINT', close)
    process.off('SIGTERM', close)
    if (process.env.NODE_ENV === 'test' && (
      process.env.LINE_FIELD_CONFIG_TEST_BARRIER_RELEASE_PATH
      || process.env.LINE_FIELD_CONFIG_TEST_FINAL_PUBLISH_BARRIER_RELEASE_PATH
    )) {
      process.stdout.write('line field config test stop observed\n')
    }
    resolveStopped()
  }
  const failWatcher = (directory, error) => {
    if (stopped) return
    const message = error instanceof Error ? error.message : error
    process.stderr.write(`line field config watcher error (${directory}): ${message}\n`)
    process.exitCode = 1
    close()
  }
  process.once('SIGINT', close)
  process.once('SIGTERM', close)

  const execute = async () => {
    try {
      const published = await writeOrCheck({ ...options, mode: '--write' }, () => !stopped)
      if (published) process.stdout.write('line field config compiled\n')
    } catch (error) {
      if (!stopped) process.stderr.write(`${error.message}\n`)
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
  for (const path of [
    options.source,
    options.schema,
    options.materialsSource,
    options.materialsSchema,
  ]) {
    const directory = dirname(path)
    const filenames = filenamesByDirectory.get(directory) ?? new Set()
    filenames.add(basename(path))
    filenamesByDirectory.set(directory, filenames)
  }

  try {
    for (const [directory, filenames] of filenamesByDirectory) {
      const watcher = watchFileSystem(directory, (_eventType, filename) => {
        if (filename === null || filenames.has(filename.toString())) {
          refresh()
        }
      })
      watchers.set(directory, watcher)
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

async function run() {
  const options = parseArguments(process.argv.slice(2))
  if (options.mode !== '--watch') return writeOrCheck(options)
  return watchAndCompile(options)
}

if (process.argv[1] && resolve(process.argv[1]) === scriptPath) {
  run().catch((error) => {
    process.stderr.write(`${error.message}\n`)
    process.exitCode = 1
  })
}
