#!/usr/bin/env node

/**
 * Validate and atomically publish one already-successful Session 3 capture.
 * Prefer `npm run session3:evidence -- --run ... --final ... --head ...`, which
 * fail-closes build, port isolation, capture, and this finalization step.
 */

import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import {
  copyFile,
  lstat,
  mkdir,
  readFile,
  readdir,
  rename,
  rm,
} from 'node:fs/promises'
import { dirname, join, relative, resolve } from 'node:path'
import { inflateSync } from 'node:zlib'

const projects = [
  {
    height: 900,
    project: 'desktop-chromium',
    tag: 'desktop',
    viewportTag: '1440x900',
    width: 1440,
  },
  {
    height: 844,
    project: 'mobile-chromium',
    tag: 'mobile',
    viewportTag: '390x844',
    width: 390,
  },
]
const themes = ['light', 'dark']
const motions = ['normal', 'reduced']
const pngSignature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
const normalLabels = [
  'before-preload',
  'preload',
  'visible-seed',
  'motto-start',
  'motto-mid',
  'motto-end',
  'first-auto-handoff',
  'autonomous-1',
  'autonomous-2',
  'autonomous-3',
  'reverse-trigger',
  'gather-050',
  'gather-100',
]
const normalModes = [
  'dormant',
  'scroll-build',
  'scroll-build',
  'scroll-build',
  'scroll-build',
  'scroll-build',
  'auto-handoff',
  'autonomous',
  'autonomous',
  'autonomous',
  'reverse-gather',
  'reverse-gather',
  'scroll-build',
]
const crcTable = Uint32Array.from({ length: 256 }, (_, tableIndex) => {
  let crc = tableIndex
  for (let bit = 0; bit < 8; bit += 1) {
    crc = (crc & 1) === 1 ? 0xedb88320 ^ (crc >>> 1) : crc >>> 1
  }
  return crc >>> 0
})

function fail(message) {
  throw new Error(`Session 3 evidence finalization failed: ${message}`)
}

function parseArguments(argv) {
  const values = new Map()
  if (argv.length % 2 !== 0) {
    fail('usage: --run <fresh-run-directory> --final <new-final-directory> --head <git-head>')
  }
  for (let index = 0; index < argv.length; index += 2) {
    const flag = argv[index]
    const value = argv[index + 1]
    if (!['--run', '--final', '--head'].includes(flag) || !value || values.has(flag)) {
      fail('usage: --run <fresh-run-directory> --final <new-final-directory> --head <git-head>')
    }
    values.set(flag, value)
  }
  for (const flag of ['--run', '--final', '--head']) {
    if (!values.has(flag)) {
      fail('usage: --run <fresh-run-directory> --final <new-final-directory> --head <git-head>')
    }
  }
  return {
    expectedHead: values.get('--head').trim(),
    finalDirectory: resolve(values.get('--final')),
    runDirectory: resolve(values.get('--run')),
  }
}

function realGitHead() {
  return execFileSync('git', ['rev-parse', 'HEAD'], {
    cwd: process.cwd(),
    encoding: 'utf8',
  }).trim()
}

function workingTreeChanges() {
  return execFileSync('git', ['status', '--porcelain', '--untracked-files=all'], {
    cwd: process.cwd(),
    encoding: 'utf8',
  }).trim()
}

async function pathExists(path) {
  try {
    await lstat(path)
    return true
  } catch (error) {
    if (error && error.code === 'ENOENT') return false
    throw error
  }
}

function assertSeparateDirectories(runDirectory, finalDirectory) {
  const finalFromRun = relative(runDirectory, finalDirectory)
  const runFromFinal = relative(finalDirectory, runDirectory)
  if (
    finalFromRun === ''
    || (!finalFromRun.startsWith('..') && finalFromRun !== '..')
    || (!runFromFinal.startsWith('..') && runFromFinal !== '..')
  ) {
    fail('run and final directories must not contain one another')
  }
}

function expectedCells() {
  return projects.flatMap(project => (
    themes.flatMap(theme => motions.map(motion => ({
      ...project,
      baseName: `session3-${project.tag}-${project.viewportTag}-${theme}-${motion}`,
      motion,
      theme,
    })))
  ))
}

function normalScreenshots(baseName, generatedConfig) {
  const seedTag = generatedConfig?.seedTag
  if (!/^p\d{2,3}$/.test(seedTag)) {
    fail(`${baseName} has invalid generated progress tags`)
  }
  return [
    `${baseName}-seed-${seedTag}.png`,
    `${baseName}-motto-end.png`,
    `${baseName}-autonomous-f01.png`,
    `${baseName}-autonomous-f02.png`,
    `${baseName}-autonomous-f03.png`,
    `${baseName}-reverse-trigger.png`,
    `${baseName}-gather-050.png`,
    `${baseName}-gather-100.png`,
  ]
}

function expectedScreenshotMap(baseName, generatedConfig) {
  const screenshots = normalScreenshots(baseName, generatedConfig)
  return new Map([
    ['visible-seed', screenshots[0]],
    ['motto-end', screenshots[1]],
    ['autonomous-1', screenshots[2]],
    ['autonomous-2', screenshots[3]],
    ['autonomous-3', screenshots[4]],
    ['reverse-trigger', screenshots[5]],
    ['gather-050', screenshots[6]],
    ['gather-100', screenshots[7]],
  ])
}

function sameStrings(actual, expected) {
  return actual.length === expected.length
    && actual.every((value, index) => value === expected[index])
}

function isRecord(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

function record(value, context) {
  if (!isRecord(value)) fail(`${context} must be an object`)
  return value
}

function finiteNumber(value, context) {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    fail(`${context} must be finite`)
  }
  return value
}

function finiteInteger(value, context) {
  const number = finiteNumber(value, context)
  if (!Number.isInteger(number) || number < 0) fail(`${context} must be a non-negative integer`)
  return number
}

function nonEmptyString(value, context) {
  if (typeof value !== 'string' || value.trim() === '') fail(`${context} must be a non-empty string`)
  return value
}

function closeWithin(actual, expected, tolerance, context) {
  if (Math.abs(finiteNumber(actual, `${context} actual`) - finiteNumber(expected, `${context} expected`)) > tolerance) {
    fail(`${context} must be within ${tolerance}px`)
  }
}

function validateViewport(value, cell, context) {
  const viewport = record(value, `${context} viewport`)
  if (viewport.width !== cell.width || viewport.height !== cell.height) {
    fail(`${context} viewport must be ${cell.width}x${cell.height}`)
  }
}

function validatePoint(value, context) {
  const point = record(value, context)
  finiteNumber(point.x, `${context}.x`)
  finiteNumber(point.y, `${context}.y`)
}

function validateRect(value, context) {
  const rect = record(value, context)
  for (const key of ['bottom', 'height', 'left', 'right', 'top', 'width', 'x', 'y']) {
    finiteNumber(rect[key], `${context}.${key}`)
  }
  if (rect.width <= 0 || rect.height <= 0) fail(`${context} must have positive dimensions`)
  closeWithin(rect.right, rect.left + rect.width, 0.02, `${context} horizontal geometry`)
  closeWithin(rect.bottom, rect.top + rect.height, 0.02, `${context} vertical geometry`)
  closeWithin(rect.x, rect.left, 0.02, `${context} x/left geometry`)
  closeWithin(rect.y, rect.top, 0.02, `${context} y/top geometry`)
  return rect
}

function validateBacking(value, canvasRect, context) {
  const backing = record(value, context)
  const width = finiteInteger(backing.width, `${context}.width`)
  const height = finiteInteger(backing.height, `${context}.height`)
  if (width === 0 || height === 0) fail(`${context} must have positive dimensions`)
  const dprX = finiteNumber(backing.effectiveDprX, `${context}.effectiveDprX`)
  const dprY = finiteNumber(backing.effectiveDprY, `${context}.effectiveDprY`)
  if (dprX <= 0 || dprY <= 0) fail(`${context} DPR must be positive`)
  closeWithin(width / canvasRect.width, dprX, 0.02, `${context} effectiveDprX`)
  closeWithin(height / canvasRect.height, dprY, 0.02, `${context} effectiveDprY`)
}

function crc32(bytes) {
  let crc = 0xffffffff
  for (const byte of bytes) {
    crc = crcTable[(crc ^ byte) & 0xff] ^ (crc >>> 8)
  }
  return (crc ^ 0xffffffff) >>> 0
}

async function validatePng(path, filename, expectedWidth, expectedHeight) {
  const bytes = await readFile(path)
  if (bytes.length < pngSignature.length || !bytes.subarray(0, 8).equals(pngSignature)) {
    fail(`${filename} is not a PNG capture`)
  }

  let offset = pngSignature.length
  let chunkIndex = 0
  let width = null
  let height = null
  let idatBytes = 0
  let sawEnd = false

  while (offset < bytes.length) {
    if (bytes.length - offset < 12) fail(`${filename} has a truncated PNG chunk header`)
    const length = bytes.readUInt32BE(offset)
    const dataStart = offset + 8
    const dataEnd = dataStart + length
    const chunkEnd = dataEnd + 4
    if (chunkEnd > bytes.length) fail(`${filename} has a PNG chunk outside the file bounds`)
    const typeBytes = bytes.subarray(offset + 4, offset + 8)
    const type = typeBytes.toString('ascii')
    if (!/^[A-Za-z]{4}$/.test(type)) fail(`${filename} has an invalid PNG chunk type`)
    const expectedCrc = bytes.readUInt32BE(dataEnd)
    const actualCrc = crc32(bytes.subarray(offset + 4, dataEnd))
    if (expectedCrc !== actualCrc) fail(`${filename} has an invalid ${type} PNG checksum`)

    if (chunkIndex === 0 && (type !== 'IHDR' || length !== 13)) {
      fail(`${filename} must start with a 13-byte PNG IHDR`)
    }
    if (type === 'IHDR') {
      if (chunkIndex !== 0 || width !== null) fail(`${filename} has a duplicate PNG IHDR`)
      width = bytes.readUInt32BE(dataStart)
      height = bytes.readUInt32BE(dataStart + 4)
      if (width === 0 || height === 0) fail(`${filename} has non-positive PNG dimensions`)
      if (bytes[dataStart + 10] !== 0 || bytes[dataStart + 11] !== 0 || bytes[dataStart + 12] > 1) {
        fail(`${filename} has unsupported PNG encoding methods`)
      }
    } else if (type === 'IDAT') {
      if (width === null) fail(`${filename} has PNG image data before IHDR`)
      idatBytes += length
    } else if (type === 'IEND') {
      if (length !== 0) fail(`${filename} has a non-empty PNG IEND`)
      if (idatBytes === 0) fail(`${filename} has no non-empty PNG IDAT`)
      if (chunkEnd !== bytes.length) fail(`${filename} has data after the terminal PNG IEND`)
      sawEnd = true
    }

    offset = chunkEnd
    chunkIndex += 1
    if (sawEnd) break
  }

  if (!sawEnd) fail(`${filename} has no terminal PNG IEND`)
  if (width !== expectedWidth || height !== expectedHeight) {
    fail(`${filename} is ${width}x${height}; expected ${expectedWidth}x${expectedHeight}`)
  }
}

function paethPredictor(left, up, upLeft) {
  const estimate = left + up - upLeft
  const leftDistance = Math.abs(estimate - left)
  const upDistance = Math.abs(estimate - up)
  const diagonalDistance = Math.abs(estimate - upLeft)
  if (leftDistance <= upDistance && leftDistance <= diagonalDistance) return left
  return upDistance <= diagonalDistance ? up : upLeft
}

async function decodedPngPixelHash(path, filename) {
  const bytes = await readFile(path)
  let offset = pngSignature.length
  let width = 0
  let height = 0
  let bitDepth = 0
  let colorType = -1
  let interlace = -1
  const imageData = []

  while (offset < bytes.length) {
    const length = bytes.readUInt32BE(offset)
    const type = bytes.subarray(offset + 4, offset + 8).toString('ascii')
    const dataStart = offset + 8
    const dataEnd = dataStart + length
    if (type === 'IHDR') {
      width = bytes.readUInt32BE(dataStart)
      height = bytes.readUInt32BE(dataStart + 4)
      bitDepth = bytes[dataStart + 8]
      colorType = bytes[dataStart + 9]
      interlace = bytes[dataStart + 12]
    } else if (type === 'IDAT') {
      imageData.push(bytes.subarray(dataStart, dataEnd))
    } else if (type === 'IEND') {
      break
    }
    offset = dataEnd + 4
  }

  const channels = new Map([
    [0, 1],
    [2, 3],
    [4, 2],
    [6, 4],
  ]).get(colorType)
  if (bitDepth !== 8 || channels === undefined || interlace !== 0) {
    fail(`${filename} uses an unsupported PNG pixel layout for visual comparison`)
  }

  let inflated
  try {
    inflated = inflateSync(Buffer.concat(imageData))
  } catch {
    fail(`${filename} has invalid compressed PNG image data`)
  }
  const rowBytes = width * channels
  if (inflated.length !== (rowBytes + 1) * height) {
    fail(`${filename} has an unexpected decoded PNG byte length`)
  }

  const hash = createHash('sha256')
  let previous = Buffer.alloc(rowBytes)
  for (let row = 0; row < height; row += 1) {
    const rowStart = row * (rowBytes + 1)
    const filter = inflated[rowStart]
    const filtered = inflated.subarray(rowStart + 1, rowStart + 1 + rowBytes)
    const reconstructed = Buffer.allocUnsafe(rowBytes)
    for (let byte = 0; byte < rowBytes; byte += 1) {
      const left = byte >= channels ? reconstructed[byte - channels] : 0
      const up = previous[byte]
      const upLeft = byte >= channels ? previous[byte - channels] : 0
      let predictor = 0
      if (filter === 1) predictor = left
      else if (filter === 2) predictor = up
      else if (filter === 3) predictor = Math.floor((left + up) / 2)
      else if (filter === 4) predictor = paethPredictor(left, up, upLeft)
      else if (filter !== 0) fail(`${filename} uses unsupported PNG filter ${filter}`)
      reconstructed[byte] = (filtered[byte] + predictor) & 0xff
    }

    const rgba = Buffer.allocUnsafe(width * 4)
    for (let pixel = 0; pixel < width; pixel += 1) {
      const source = pixel * channels
      const target = pixel * 4
      if (colorType === 0) {
        rgba[target] = reconstructed[source]
        rgba[target + 1] = reconstructed[source]
        rgba[target + 2] = reconstructed[source]
        rgba[target + 3] = 255
      } else if (colorType === 2) {
        rgba[target] = reconstructed[source]
        rgba[target + 1] = reconstructed[source + 1]
        rgba[target + 2] = reconstructed[source + 2]
        rgba[target + 3] = 255
      } else if (colorType === 4) {
        rgba[target] = reconstructed[source]
        rgba[target + 1] = reconstructed[source]
        rgba[target + 2] = reconstructed[source]
        rgba[target + 3] = reconstructed[source + 1]
      } else {
        reconstructed.copy(rgba, target, source, source + 4)
      }
    }
    hash.update(rgba)
    previous = reconstructed
  }
  return hash.digest('hex')
}

function validateRuntimeErrors(metadata, metadataFilename) {
  if (!Array.isArray(metadata.runtimeErrors)) {
    fail(`${metadataFilename} must include a runtimeErrors array`)
  }
  if (metadata.runtimeErrors.length !== 0) {
    fail(`${metadataFilename} contains runtime errors`)
  }
}

function validateGeneratedConfig(metadata, metadataFilename) {
  const generatedConfig = record(
    metadata.generatedConfig,
    `${metadataFilename} generatedConfig`,
  )
  for (const key of ['animationVersion', 'materialsVersion']) {
    const version = finiteInteger(
      generatedConfig[key],
      `${metadataFilename} generatedConfig.${key}`,
    )
    if (version === 0) fail(`${metadataFilename} ${key} must be positive`)
  }

  const progress = key => {
    const value = nonEmptyString(
      generatedConfig[key],
      `${metadataFilename} generatedConfig.${key}`,
    )
    if (!/^p\d{2,3}$/.test(value)) fail(`${metadataFilename} ${key} is not a progress tag`)
    const percent = Number(value.slice(1))
    if (percent < 0 || percent > 100) fail(`${metadataFilename} ${key} must be between p00 and p100`)
    return percent
  }
  progress('seedTag')
  return generatedConfig
}

function validateIdentityMetadata(metadata, metadataFilename, motion) {
  const identity = record(metadata.identity, `${metadataFilename} identity`)
  nonEmptyString(identity.rootToken, `${metadataFilename} identity.rootToken`)
  if (motion === 'normal') {
    nonEmptyString(identity.canvasToken, `${metadataFilename} identity.canvasToken`)
    if (typeof identity.canvasAbsentAtPreload !== 'boolean') {
      fail(`${metadataFilename} identity.canvasAbsentAtPreload must be boolean`)
    }
  } else if (identity.canvasToken !== null) {
    fail(`${metadataFilename} Reduced Motion canvasToken must be null`)
  }
  return identity
}

function validateTargets(metadata, metadataFilename) {
  const targets = record(metadata.targets, `${metadataFilename} targets`)
  for (const key of [
    'buildEnd',
    'filmRange',
    'filmTop',
    'handoffDocumentY',
    'mottoEnd',
    'mottoMid',
    'mottoStart',
  ]) {
    finiteNumber(targets[key], `${metadataFilename} targets.${key}`)
  }
  if (targets.filmRange <= 0) fail(`${metadataFilename} filmRange must be positive`)
  if (!(targets.mottoStart <= targets.mottoMid && targets.mottoMid <= targets.mottoEnd)) {
    fail(`${metadataFilename} motto targets must be ordered`)
  }
  closeWithin(
    targets.mottoMid,
    (targets.mottoStart + targets.mottoEnd) / 2,
    1,
    `${metadataFilename} motto midpoint`,
  )
  if (targets.buildEnd < targets.mottoEnd) {
    fail(`${metadataFilename} buildEnd must not precede mottoEnd`)
  }
  return targets
}

function validateState(stateValue, options) {
  const {
    cell,
    expectedCanvasAbsent,
    expectedLabel,
    expectedMode,
    expectedScreenshot,
    expectedStatus,
    expectedTheme,
    identityMetadata,
    metadataFilename,
    reduced,
  } = options
  const context = `${metadataFilename} state ${expectedLabel}`
  const state = record(stateValue, context)
  if (state.label !== expectedLabel) fail(`${metadataFilename} has invalid state labels/order`)
  if (state.mode !== expectedMode || state.status !== expectedStatus) {
    fail(`${context} has invalid status/mode`)
  }
  if (state.theme !== expectedTheme) fail(`${context} has the wrong theme`)
  if (state.reducedMotion !== (reduced ? 'true' : 'false')) {
    fail(`${context} has the wrong Reduced Motion state`)
  }
  validateViewport(state.viewport, cell, context)
  nonEmptyString(state.formula, `${context} formula`)
  const actualScrollY = finiteNumber(state.actualScrollY, `${context} actualScrollY`)
  const formulaTarget = finiteNumber(state.formulaTarget, `${context} formulaTarget`)
  if (Math.abs(actualScrollY - formulaTarget) > 1) {
    fail(`${context} actualScrollY must be within 1px of formulaTarget`)
  }
  const frameSequence = finiteInteger(state.frameSequence, `${context} frameSequence`)
  if (state.horizontalOverflow !== false) fail(`${context} reports horizontal overflow`)
  validatePoint(state.anchor, `${context} anchor`)
  validateRect(state.headerRect, `${context} headerRect`)
  const fieldRect = validateRect(state.fieldRect, `${context} fieldRect`)
  closeWithin(fieldRect.left, 0, 1, `${context} fieldRect left`)
  closeWithin(fieldRect.top, 0, 1, `${context} fieldRect top`)
  closeWithin(fieldRect.width, cell.width, 1, `${context} fieldRect width`)
  closeWithin(fieldRect.height, cell.height, 1, `${context} fieldRect height`)

  const identity = record(state.identity, `${context} identity`)
  if (identity.rootTokenMatches !== true || identity.rootToken !== identityMetadata.rootToken) {
    fail(`${context} root identity does not match`)
  }
  if (identity.canvasTokenMatches !== true || identity.canvasAbsent !== expectedCanvasAbsent) {
    fail(`${context} canvas identity does not match its expected lifecycle`)
  }

  if (expectedCanvasAbsent) {
    if (identity.canvasToken !== null || state.canvasRect !== null || state.backing !== null) {
      fail(`${context} must not contain a canvas or backing store`)
    }
  } else {
    if (identity.canvasToken !== identityMetadata.canvasToken) {
      fail(`${context} canvas token differs from the cell token`)
    }
    const canvasRect = validateRect(state.canvasRect, `${context} canvasRect`)
    closeWithin(canvasRect.left, 0, 1, `${context} canvas left`)
    closeWithin(canvasRect.top, 0, 1, `${context} canvas top`)
    closeWithin(canvasRect.width, cell.width, 1, `${context} canvas width`)
    closeWithin(canvasRect.height, cell.height, 1, `${context} canvas height`)
    if (canvasRect.left < -1 || canvasRect.right > cell.width + 1) {
      fail(`${context} canvas exceeds the viewport width`)
    }
    validateBacking(state.backing, canvasRect, `${context} backing`)
  }

  const expectedRequestCount = reduced || expectedLabel === 'before-preload' ? 0 : 1
  if (
    state.rendererAssetRequestCount !== expectedRequestCount
    || !Array.isArray(state.rendererAssetRequests)
    || state.rendererAssetRequests.length !== expectedRequestCount
    || state.rendererAssetRequests.some(request => (
      typeof request !== 'string'
      || !/^\/assets\/LandingLineRenderer-[^/]+\.js$/.test(request)
    ))
  ) {
    fail(`${context} has an invalid renderer request count/list`)
  }

  if (state.screenshot !== expectedScreenshot) {
    fail(`${context} has an invalid screenshot mapping`)
  }
  if (expectedScreenshot === null) {
    if (state.screenshotFrameSequence !== null) {
      fail(`${context} must not have screenshot frame metadata`)
    }
  } else {
    const screenshotSequence = record(
      state.screenshotFrameSequence,
      `${context} screenshotFrameSequence`,
    )
    const before = finiteInteger(screenshotSequence.before, `${context} screenshot before`)
    const after = finiteInteger(screenshotSequence.after, `${context} screenshot after`)
    if (after < before || after !== frameSequence) {
      fail(`${context} has inconsistent screenshot frame sequencing`)
    }
    if (expectedLabel.startsWith('autonomous-') && after !== before) {
      fail(`${context} autonomous screenshot was not captured on its gated frame`)
    }
  }

  return { actualScrollY, formulaTarget, frameSequence, state }
}

function validateNormalMetadata(metadata, cell, metadataFilename, screenshots, identity, targets) {
  if (!Array.isArray(metadata.states)) fail(`${metadataFilename} states must be an array`)
  const actualLabels = metadata.states.map(state => state?.label)
  if (!sameStrings(actualLabels, normalLabels)) {
    fail(`${metadataFilename} has invalid state labels/order`)
  }

  const screenshotMap = expectedScreenshotMap(cell.baseName, metadata.generatedConfig)
  const validatedStates = metadata.states.map((state, index) => validateState(state, {
    cell,
    expectedCanvasAbsent: index === 0
      || (index === 1 && identity.canvasAbsentAtPreload === true),
    expectedLabel: normalLabels[index],
    expectedMode: normalModes[index],
    expectedScreenshot: screenshotMap.get(normalLabels[index]) ?? null,
    expectedStatus: index === 0
      ? 'dormant'
      : index === 1 && identity.canvasAbsentAtPreload === true
        ? 'loading'
        : 'ready',
    expectedTheme: cell.theme,
    identityMetadata: identity,
    metadataFilename,
    reduced: false,
  }))
  for (let index = 1; index < validatedStates.length; index += 1) {
    const preloadMayNotHaveRendered = index === 1 && identity.canvasAbsentAtPreload === true
    const sequenceInvalid = preloadMayNotHaveRendered
      ? validatedStates[index].frameSequence < validatedStates[index - 1].frameSequence
      : validatedStates[index].frameSequence <= validatedStates[index - 1].frameSequence
    if (sequenceInvalid) {
      fail(`${metadataFilename} frameSequence must increase across its state sequence`)
    }
  }

  const expectedAutonomous = screenshots.slice(2, 5)
  if (
    !Array.isArray(metadata.autonomousScreenshots)
    || !sameStrings(metadata.autonomousScreenshots, expectedAutonomous)
  ) {
    fail(`${metadataFilename} has an incomplete autonomous sequence`)
  }

  closeWithin(validatedStates[3].formulaTarget, targets.mottoStart, 1, `${metadataFilename} motto-start target`)
  closeWithin(validatedStates[4].formulaTarget, targets.mottoMid, 1, `${metadataFilename} motto-mid target`)
  closeWithin(validatedStates[5].formulaTarget, targets.mottoEnd, 1, `${metadataFilename} motto-end target`)
  closeWithin(validatedStates[6].formulaTarget, targets.buildEnd, 1, `${metadataFilename} handoff target`)
  for (const index of [7, 8, 9]) {
    closeWithin(
      validatedStates[index].formulaTarget,
      validatedStates[6].actualScrollY,
      1,
      `${metadataFilename} autonomous fixed-scroll target`,
    )
  }
  if (!(validatedStates[10].actualScrollY < validatedStates[9].actualScrollY)) {
    fail(`${metadataFilename} reverse trigger must cross below the frozen handoff scroll`)
  }
  for (const index of [11, 12]) {
    closeWithin(
      validatedStates[index].actualScrollY,
      validatedStates[10].actualScrollY,
      1,
      `${metadataFilename} time-driven gather fixed-scroll target`,
    )
  }

  const handoff = record(metadata.firstHandoff, `${metadataFilename} firstHandoff`)
  if (handoff.mode !== 'auto-handoff') fail(`${metadataFilename} firstHandoff has the wrong mode`)
  closeWithin(handoff.requestedScrollY, targets.buildEnd, 1, `${metadataFilename} requested handoff`)
  closeWithin(handoff.actualScrollY, targets.buildEnd, 1, `${metadataFilename} actual handoff`)

  if (!Array.isArray(metadata.themePersistence)) {
    fail(`${metadataFilename} themePersistence must be an array`)
  }
  const expectedPersistence = cell.theme === 'light'
    ? [
        ['theme-light-before', 'light'],
        ['theme-dark', 'dark'],
        ['theme-light-after', 'light'],
      ]
    : []
  if (metadata.themePersistence.length !== expectedPersistence.length) {
    fail(`${metadataFilename} has an invalid theme persistence sequence`)
  }
  let previousSequence = -1
  for (let index = 0; index < expectedPersistence.length; index += 1) {
    const [label, theme] = expectedPersistence[index]
    const state = validateState(metadata.themePersistence[index], {
      cell,
      expectedCanvasAbsent: false,
      expectedLabel: label,
      expectedMode: 'autonomous',
      expectedScreenshot: null,
      expectedStatus: 'ready',
      expectedTheme: theme,
      identityMetadata: identity,
      metadataFilename,
      reduced: false,
    })
    closeWithin(
      state.actualScrollY,
      validatedStates[6].actualScrollY,
      1,
      `${metadataFilename} theme persistence scroll`,
    )
    if (state.frameSequence <= previousSequence) {
      fail(`${metadataFilename} theme persistence frameSequence must increase`)
    }
    previousSequence = state.frameSequence
  }
}

function validateReducedMetadata(metadata, cell, metadataFilename, screenshots, identity, targets) {
  if (!Array.isArray(metadata.states) || metadata.states.length !== 1) {
    fail(`${metadataFilename} must have exactly one Reduced Motion state`)
  }
  const state = validateState(metadata.states[0], {
    cell,
    expectedCanvasAbsent: true,
    expectedLabel: 'reduced-final',
    expectedMode: 'static',
    expectedScreenshot: screenshots[0],
    expectedStatus: 'fallback-reduced-motion',
    expectedTheme: cell.theme,
    identityMetadata: identity,
    metadataFilename,
    reduced: true,
  })
  closeWithin(state.formulaTarget, targets.mottoEnd, 1, `${metadataFilename} Reduced Motion target`)
}

function validateMetadata(metadataValue, cell, expectedHead, metadataFilename, screenshots) {
  const metadata = record(metadataValue, metadataFilename)
  if (
    metadata.sourceHead !== expectedHead
    || metadata.project !== cell.project
    || metadata.theme !== cell.theme
    || metadata.motion !== cell.motion
  ) {
    fail(`${metadataFilename} does not match its HEAD/project/theme/motion cell`)
  }
  validateViewport(metadata.viewport, cell, metadataFilename)
  validateRuntimeErrors(metadata, metadataFilename)
  const identity = validateIdentityMetadata(metadata, metadataFilename, cell.motion)
  const targets = validateTargets(metadata, metadataFilename)
  if (cell.motion === 'normal') {
    validateNormalMetadata(metadata, cell, metadataFilename, screenshots, identity, targets)
  } else {
    validateReducedMetadata(metadata, cell, metadataFilename, screenshots, identity, targets)
  }
}

async function validateCell(runDirectory, cell, expectedHead, sharedConfig) {
  const cellDirectory = join(runDirectory, cell.baseName)
  const metadataFilename = `${cell.baseName}-metadata.json`
  let metadata
  try {
    metadata = JSON.parse(await readFile(join(cellDirectory, metadataFilename), 'utf8'))
  } catch (error) {
    fail(`${metadataFilename} is missing or invalid JSON (${error.message})`)
  }

  const generatedConfig = validateGeneratedConfig(metadata, metadataFilename)
  const configFingerprint = JSON.stringify(generatedConfig)
  if (sharedConfig.value === null) sharedConfig.value = configFingerprint
  if (configFingerprint !== sharedConfig.value) {
    fail(`${metadataFilename} does not share the run's generated config`)
  }

  const screenshots = cell.motion === 'normal'
    ? normalScreenshots(cell.baseName, metadata.generatedConfig)
    : [`${cell.baseName}-final.png`]
  validateMetadata(metadata, cell, expectedHead, metadataFilename, screenshots)

  const expectedFiles = [...screenshots, metadataFilename].sort()
  const actualFiles = await readdir(cellDirectory, { withFileTypes: true })
  if (actualFiles.some(entry => !entry.isFile())) {
    fail(`${cell.baseName} contains a non-file entry`)
  }
  const actualFilenames = actualFiles.map(entry => entry.name).sort()
  if (!sameStrings(actualFilenames, expectedFiles)) {
    fail(`${cell.baseName} inventory differs from its exact expected files`)
  }

  const referencedScreenshots = metadata.states
    .map(state => state.screenshot)
    .filter(value => typeof value === 'string')
    .sort()
  if (!sameStrings(referencedScreenshots, [...screenshots].sort())) {
    fail(`${metadataFilename} does not reference every expected screenshot exactly once`)
  }

  await Promise.all(screenshots.map(filename => (
    validatePng(join(cellDirectory, filename), filename, cell.width, cell.height)
  )))
  if (cell.motion === 'normal') {
    const reverseGatherFiles = [
      `${cell.baseName}-reverse-trigger.png`,
      `${cell.baseName}-gather-050.png`,
      `${cell.baseName}-gather-100.png`,
    ]
    const [reverseTrigger, gatherHalf, gatherComplete] = await Promise.all(
      reverseGatherFiles.map(filename => decodedPngPixelHash(
        join(cellDirectory, filename),
        filename,
      )),
    )
    if (
      reverseTrigger === gatherHalf
      || reverseTrigger === gatherComplete
      || gatherHalf === gatherComplete
    ) {
      fail(`${metadataFilename} reverse/gather screenshots must be visually distinct`)
    }
  }
  return expectedFiles.map(filename => ({
    filename,
    source: join(cellDirectory, filename),
  }))
}

async function validateRun(runDirectory, expectedHead) {
  const cells = expectedCells()
  const runEntries = await readdir(runDirectory, { withFileTypes: true })
  if (runEntries.some(entry => !entry.isDirectory())) {
    fail('run directory contains a non-cell entry')
  }
  const actualCells = runEntries.map(entry => entry.name).sort()
  const expectedCellNames = cells.map(cell => cell.baseName).sort()
  if (!sameStrings(actualCells, expectedCellNames)) {
    fail('run directory does not contain the exact eight evidence cells')
  }

  const sharedConfig = { value: null }
  const files = []
  for (const cell of cells) {
    files.push(...await validateCell(runDirectory, cell, expectedHead, sharedConfig))
  }
  const pngCount = files.filter(({ filename }) => filename.endsWith('.png')).length
  const jsonCount = files.filter(({ filename }) => filename.endsWith('.json')).length
  const uniqueNames = new Set(files.map(({ filename }) => filename))
  if (pngCount !== 36 || jsonCount !== 8 || uniqueNames.size !== 44) {
    fail(`expected exact 36 PNG + 8 JSON inventory; received ${pngCount} PNG + ${jsonCount} JSON`)
  }
  return files
}

async function publish({ expectedHead, finalDirectory, runDirectory }) {
  if (!/^[0-9a-f]{40,64}$/.test(expectedHead)) fail('--head must be a full Git object ID')
  const actualHead = realGitHead()
  if (expectedHead !== actualHead) {
    fail(`requested HEAD ${expectedHead} does not equal real HEAD ${actualHead}`)
  }
  if (workingTreeChanges()) {
    fail('working tree differs from HEAD')
  }
  assertSeparateDirectories(runDirectory, finalDirectory)
  if (await pathExists(finalDirectory)) {
    fail(`final destination already exists and will not be overwritten: ${finalDirectory}`)
  }

  const files = await validateRun(runDirectory, expectedHead)
  await mkdir(dirname(finalDirectory), { recursive: true })
  const preparedDirectory = `${finalDirectory}.preparing-${process.pid}`
  if (await pathExists(preparedDirectory)) {
    fail(`prepared destination already exists: ${preparedDirectory}`)
  }

  try {
    await mkdir(preparedDirectory)
    for (const { filename, source } of files) {
      await copyFile(source, join(preparedDirectory, filename))
    }
    if (await pathExists(finalDirectory)) {
      fail(`final destination appeared during publication: ${finalDirectory}`)
    }
    await rename(preparedDirectory, finalDirectory)
  } catch (error) {
    await rm(preparedDirectory, { force: true, recursive: true })
    throw error
  }

  process.stdout.write(
    `Published Session 3 evidence: 36 PNG + 8 JSON for ${expectedHead} at ${finalDirectory}\n`,
  )
}

try {
  await publish(parseArguments(process.argv.slice(2)))
} catch (error) {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`)
  process.exitCode = 1
}
