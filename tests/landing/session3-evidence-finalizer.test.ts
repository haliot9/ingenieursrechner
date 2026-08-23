import { execFileSync, spawnSync } from 'node:child_process'
import { deflateSync } from 'node:zlib'
import {
  chmod,
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  rm,
  writeFile,
} from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'

const finalizer = join(process.cwd(), 'scripts/finalize-session3-evidence.mjs')
const runner = join(process.cwd(), 'scripts/run-session3-evidence.mjs')
const temporaryDirectories: string[] = []

const evidenceProjects = [
  {
    height: 900,
    project: 'desktop-chromium',
    tag: 'desktop',
    viewport: '1440x900',
    width: 1440,
  },
  {
    height: 844,
    project: 'mobile-chromium',
    tag: 'mobile',
    viewport: '390x844',
    width: 390,
  },
] as const

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
] as const

const screenshotLabels = new Set([
  'visible-seed',
  'motto-end',
  'autonomous-1',
  'autonomous-2',
  'autonomous-3',
  'reverse-trigger',
  'gather-050',
  'gather-100',
])

const crcTable = Array.from({ length: 256 }, (_, tableIndex) => {
  let crc = tableIndex
  for (let bit = 0; bit < 8; bit += 1) {
    crc = (crc & 1) === 1 ? 0xedb88320 ^ (crc >>> 1) : crc >>> 1
  }
  return crc >>> 0
})

function crc32(bytes: Buffer) {
  let crc = 0xffffffff
  for (const byte of bytes) {
    crc = crcTable[(crc ^ byte) & 0xff] ^ (crc >>> 8)
  }
  return (crc ^ 0xffffffff) >>> 0
}

function pngChunk(type: string, data: Buffer) {
  const typeBytes = Buffer.from(type, 'ascii')
  const chunk = Buffer.alloc(12 + data.length)
  chunk.writeUInt32BE(data.length, 0)
  typeBytes.copy(chunk, 4)
  data.copy(chunk, 8)
  chunk.writeUInt32BE(crc32(Buffer.concat([typeBytes, data])), 8 + data.length)
  return chunk
}

const pngCache = new Map<string, Buffer>()

function validPng(width: number, height: number, grayscale = 0, compressionLevel = 6) {
  const shade = Math.max(0, Math.min(255, Math.round(grayscale)))
  const level = Math.max(0, Math.min(9, Math.round(compressionLevel)))
  const key = `${width}x${height}@${shade}:z${level}`
  const cached = pngCache.get(key)
  if (cached) return cached

  const signature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
  const header = Buffer.alloc(13)
  header.writeUInt32BE(width, 0)
  header.writeUInt32BE(height, 4)
  header[8] = 8
  header[9] = 0
  header[10] = 0
  header[11] = 0
  header[12] = 0
  const scanlines = Buffer.alloc((width + 1) * height)
  for (let row = 0; row < height; row += 1) {
    scanlines.fill(shade, row * (width + 1) + 1, (row + 1) * (width + 1))
  }
  const result = Buffer.concat([
    signature,
    pngChunk('IHDR', header),
    pngChunk('IDAT', deflateSync(scanlines, { level })),
    pngChunk('IEND', Buffer.alloc(0)),
  ])
  pngCache.set(key, result)
  return result
}

async function fixture(options: { createRun?: boolean } = {}) {
  const directory = await mkdtemp(join(tmpdir(), 'session3-evidence-finalizer-'))
  temporaryDirectories.push(directory)
  execFileSync('git', ['init', '--quiet'], { cwd: directory })
  await writeFile(
    join(directory, '.gitignore'),
    '/capture-source\n/command.log\n/fake-bin\n/final\n/final.preparing-*\n/run\n',
  )
  await writeFile(join(directory, 'fixture.txt'), 'committed evidence source\n')
  execFileSync('git', ['add', '.gitignore', 'fixture.txt'], { cwd: directory })
  execFileSync('git', [
    '-c', 'user.name=Session 3 Test',
    '-c', 'user.email=session3@example.invalid',
    'commit', '--quiet', '-m', 'test: seed evidence source',
  ], { cwd: directory })
  const runDirectory = join(directory, 'run')
  const finalDirectory = join(directory, 'final')
  if (options.createRun !== false) await mkdir(runDirectory)
  const sourceHead = execFileSync('git', ['rev-parse', 'HEAD'], {
    cwd: directory,
    encoding: 'utf8',
  }).trim()
  return { finalDirectory, repositoryDirectory: directory, runDirectory, sourceHead }
}

function expectedNormalScreenshots(baseName: string) {
  return [
    `${baseName}-seed-p88.png`,
    `${baseName}-motto-end.png`,
    `${baseName}-autonomous-f01.png`,
    `${baseName}-autonomous-f02.png`,
    `${baseName}-autonomous-f03.png`,
    `${baseName}-reverse-trigger.png`,
    `${baseName}-gather-050.png`,
    `${baseName}-gather-100.png`,
  ]
}

function screenshotForLabel(baseName: string, label: string) {
  const filenames: Record<string, string> = {
    'autonomous-1': `${baseName}-autonomous-f01.png`,
    'autonomous-2': `${baseName}-autonomous-f02.png`,
    'autonomous-3': `${baseName}-autonomous-f03.png`,
    'gather-050': `${baseName}-gather-050.png`,
    'gather-100': `${baseName}-gather-100.png`,
    'motto-end': `${baseName}-motto-end.png`,
    'reverse-trigger': `${baseName}-reverse-trigger.png`,
    'visible-seed': `${baseName}-seed-p88.png`,
  }
  return filenames[label] ?? null
}

function rect(left: number, top: number, width: number, height: number) {
  return {
    bottom: top + height,
    height,
    left,
    right: left + width,
    top,
    width,
    x: left,
    y: top,
  }
}

function normalState(
  baseName: string,
  label: typeof normalLabels[number],
  index: number,
  viewport: { height: number; width: number },
  theme: 'dark' | 'light',
) {
  const targets = [0, 100, 200, 400, 500, 600, 700, 700, 700, 700, 680, 680, 680]
  const modes = [
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
  const screenshot = screenshotForLabel(baseName, label)
  const canvasAbsent = label === 'before-preload'
  const rendererAssetRequests = canvasAbsent
    ? []
    : ['/assets/LandingLineRenderer-fixture.js']

  return {
    actualScrollY: targets[index],
    anchor: { x: viewport.width / 2, y: viewport.height / 2 },
    backing: canvasAbsent
      ? null
      : { effectiveDprX: 1, effectiveDprY: 1, height: viewport.height, width: viewport.width },
    canvasRect: canvasAbsent
      ? null
      : rect(0, 0, viewport.width, viewport.height),
    fieldRect: rect(0, 0, viewport.width, viewport.height),
    formula: `fixture formula for ${label}`,
    formulaTarget: targets[index],
    frameSequence: index,
    headerRect: rect(0, -targets[index], viewport.width, 80),
    horizontalOverflow: false,
    identity: {
      canvasAbsent,
      canvasToken: canvasAbsent ? null : 'canvas-token',
      canvasTokenMatches: true,
      rootToken: 'root-token',
      rootTokenMatches: true,
    },
    label,
    mode: modes[index],
    reducedMotion: 'false',
    rendererAssetRequestCount: rendererAssetRequests.length,
    rendererAssetRequests,
    screenshot,
    screenshotFrameSequence: screenshotLabels.has(label)
      ? { after: index, before: index }
      : null,
    status: label === 'before-preload' ? 'dormant' : 'ready',
    theme,
    viewport,
  }
}

function themePersistenceState(
  label: string,
  theme: 'dark' | 'light',
  sequence: number,
  viewport: { height: number; width: number },
) {
  const state = normalState(
    'unused',
    'autonomous-1',
    normalLabels.indexOf('autonomous-1'),
    viewport,
    theme,
  )
  return {
    ...state,
    frameSequence: sequence,
    label,
    screenshot: null,
    screenshotFrameSequence: null,
    theme,
  }
}

async function writeValidRun(runDirectory: string, sourceHead: string) {
  const expectedFiles: string[] = []
  for (const { height, project, tag, viewport: viewportTag, width } of evidenceProjects) {
    const viewport = { height, width }
    for (const theme of ['light', 'dark'] as const) {
      const normalBase = `session3-${tag}-${viewportTag}-${theme}-normal`
      const normalDirectory = join(runDirectory, normalBase)
      const normalScreenshots = expectedNormalScreenshots(normalBase)
      const normalMetadata = `${normalBase}-metadata.json`
      await mkdir(normalDirectory)
      await Promise.all(normalScreenshots.map((filename) => {
        const shade = filename.includes('reverse-trigger')
          ? 48
          : filename.includes('gather-050')
            ? 112
            : filename.includes('gather-100')
              ? 176
              : 0
        return writeFile(join(normalDirectory, filename), validPng(width, height, shade))
      }))
      const states = normalLabels.map((label, index) => (
        normalState(normalBase, label, index, viewport, theme)
      ))
      await writeFile(join(normalDirectory, normalMetadata), `${JSON.stringify({
        autonomousScreenshots: normalScreenshots.slice(2, 5),
        firstHandoff: { actualScrollY: 700, mode: 'auto-handoff', requestedScrollY: 700 },
        generatedConfig: {
          animationVersion: 1,
          materialsVersion: 1,
          seedTag: 'p88',
        },
        identity: {
          canvasAbsentAtPreload: false,
          canvasToken: 'canvas-token',
          rootToken: 'root-token',
        },
        motion: 'normal',
        project,
        runtimeErrors: [],
        sourceHead,
        states,
        targets: {
          buildEnd: 700,
          filmRange: 1000,
          filmTop: 0,
          handoffDocumentY: 1300,
          mottoEnd: 600,
          mottoMid: 500,
          mottoStart: 400,
        },
        theme,
        themePersistence: theme === 'light'
          ? [
              themePersistenceState('theme-light-before', 'light', 30, viewport),
              themePersistenceState('theme-dark', 'dark', 31, viewport),
              themePersistenceState('theme-light-after', 'light', 32, viewport),
            ]
          : [],
        viewport,
      }, null, 2)}\n`)
      expectedFiles.push(...normalScreenshots, normalMetadata)

      const reducedBase = `session3-${tag}-${viewportTag}-${theme}-reduced`
      const reducedDirectory = join(runDirectory, reducedBase)
      const reducedScreenshot = `${reducedBase}-final.png`
      const reducedMetadata = `${reducedBase}-metadata.json`
      await mkdir(reducedDirectory)
      await writeFile(join(reducedDirectory, reducedScreenshot), validPng(width, height))
      await writeFile(join(reducedDirectory, reducedMetadata), `${JSON.stringify({
        generatedConfig: {
          animationVersion: 1,
          materialsVersion: 1,
          seedTag: 'p88',
        },
        identity: { canvasToken: null, rootToken: 'root-token' },
        motion: 'reduced',
        project,
        runtimeErrors: [],
        sourceHead,
        states: [{
          actualScrollY: 600,
          anchor: { x: width / 2, y: height / 2 },
          backing: null,
          canvasRect: null,
          fieldRect: rect(0, 0, width, height),
          formula: 'mottoEnd in Reduced Motion static flow',
          formulaTarget: 600,
          frameSequence: 0,
          headerRect: rect(0, -600, width, 80),
          horizontalOverflow: false,
          identity: {
            canvasAbsent: true,
            canvasToken: null,
            canvasTokenMatches: true,
            rootToken: 'root-token',
            rootTokenMatches: true,
          },
          label: 'reduced-final',
          mode: 'static',
          reducedMotion: 'true',
          rendererAssetRequestCount: 0,
          rendererAssetRequests: [],
          screenshot: reducedScreenshot,
          screenshotFrameSequence: { after: 0, before: 0 },
          status: 'fallback-reduced-motion',
          theme,
          viewport,
        }],
        targets: {
          buildEnd: 700,
          filmRange: 1,
          filmTop: 0,
          handoffDocumentY: 1300,
          mottoEnd: 600,
          mottoMid: 300,
          mottoStart: 0,
        },
        theme,
        viewport,
      }, null, 2)}\n`)
      expectedFiles.push(reducedScreenshot, reducedMetadata)
    }
  }
  return expectedFiles.sort()
}

function finalize(
  runDirectory: string,
  finalDirectory: string,
  sourceHead: string,
  repositoryDirectory: string,
) {
  return spawnSync(process.execPath, [
    finalizer,
    '--run', runDirectory,
    '--final', finalDirectory,
    '--head', sourceHead,
  ], { cwd: repositoryDirectory, encoding: 'utf8' })
}

async function readMetadata(runDirectory: string, baseName: string) {
  const path = join(runDirectory, baseName, `${baseName}-metadata.json`)
  return {
    path,
    value: JSON.parse(await readFile(path, 'utf8')) as Record<string, unknown>,
  }
}

async function writeExecutable(path: string, source: string) {
  await writeFile(path, source)
  await chmod(path, 0o755)
}

async function runnerHarness() {
  const evidenceFixture = await fixture({ createRun: false })
  const captureSource = join(evidenceFixture.repositoryDirectory, 'capture-source')
  const fakeBin = join(evidenceFixture.repositoryDirectory, 'fake-bin')
  const commandLog = join(evidenceFixture.repositoryDirectory, 'command.log')
  await mkdir(captureSource)
  await mkdir(fakeBin)
  await writeValidRun(captureSource, evidenceFixture.sourceHead)

  await writeExecutable(join(fakeBin, 'npm'), `#!/usr/bin/env node
const fs = require('node:fs')
fs.appendFileSync(process.env.SESSION3_FAKE_COMMAND_LOG, 'npm ' + process.argv.slice(2).join(' ') + '\\n')
process.exit(Number(process.env.SESSION3_FAKE_BUILD_STATUS || 0))
`)
  await writeExecutable(join(fakeBin, 'lsof'), `#!/usr/bin/env node
const fs = require('node:fs')
fs.appendFileSync(process.env.SESSION3_FAKE_COMMAND_LOG, 'lsof ' + process.argv.slice(2).join(' ') + '\\n')
const status = Number(process.env.SESSION3_FAKE_LSOF_STATUS || 1)
if (status === 0) process.stdout.write('node 123 test 1u IPv4 TCP 127.0.0.1:4173 (LISTEN)\\n')
process.exit(status)
`)
  await writeExecutable(join(fakeBin, 'npx'), `#!/usr/bin/env node
const fs = require('node:fs')
fs.appendFileSync(process.env.SESSION3_FAKE_COMMAND_LOG, 'npx ' + process.argv.slice(2).join(' ') + '\\n')
const status = Number(process.env.SESSION3_FAKE_CAPTURE_STATUS || 0)
if (status !== 0) process.exit(status)
if (
  process.env.CI !== '1'
  || process.env.SESSION3_EVIDENCE_HEAD !== process.env.SESSION3_FAKE_EXPECTED_HEAD
  || process.env.SESSION3_EVIDENCE_RUN_DIR !== process.env.SESSION3_FAKE_EXPECTED_RUN
) process.exit(91)
fs.mkdirSync(process.env.SESSION3_EVIDENCE_RUN_DIR, { recursive: true })
for (const entry of fs.readdirSync(process.env.SESSION3_FAKE_CAPTURE_SOURCE)) {
  fs.cpSync(
    process.env.SESSION3_FAKE_CAPTURE_SOURCE + '/' + entry,
    process.env.SESSION3_EVIDENCE_RUN_DIR + '/' + entry,
    { recursive: true },
  )
}
`)

  const run = (overrides: NodeJS.ProcessEnv = {}) => spawnSync(process.execPath, [
    runner,
    '--run', evidenceFixture.runDirectory,
    '--final', evidenceFixture.finalDirectory,
    '--head', evidenceFixture.sourceHead,
  ], {
    cwd: evidenceFixture.repositoryDirectory,
    encoding: 'utf8',
    env: {
      ...process.env,
      CI: '0',
      PATH: `${fakeBin}:${process.env.PATH ?? ''}`,
      SESSION3_FAKE_CAPTURE_SOURCE: captureSource,
      SESSION3_FAKE_COMMAND_LOG: commandLog,
      SESSION3_FAKE_EXPECTED_HEAD: evidenceFixture.sourceHead,
      SESSION3_FAKE_EXPECTED_RUN: evidenceFixture.runDirectory,
      ...overrides,
    },
  })

  const calls = async () => {
    try {
      return (await readFile(commandLog, 'utf8')).trim().split('\n').filter(Boolean)
    } catch (error) {
      if (error instanceof Error && 'code' in error && error.code === 'ENOENT') return []
      throw error
    }
  }

  return { ...evidenceFixture, calls, captureSource, run }
}

afterEach(async () => {
  await Promise.all(temporaryDirectories.splice(0).map(directory => (
    rm(directory, { force: true, recursive: true })
  )))
})

describe('Session 3 evidence finalizer', () => {
  it('publishes only a complete exact eight-cell matrix for the real Git HEAD', async () => {
    const { finalDirectory, repositoryDirectory, runDirectory, sourceHead } = await fixture()
    const expectedFiles = await writeValidRun(runDirectory, sourceHead)

    const result = finalize(runDirectory, finalDirectory, sourceHead, repositoryDirectory)

    expect(result.status, result.stderr).toBe(0)
    expect((await readdir(finalDirectory)).sort()).toEqual(expectedFiles)
    expect(result.stdout).toContain('36 PNG + 8 JSON')
  })

  it('rejects a coherently centered narrow field, canvas, and backing store', async () => {
    const { finalDirectory, repositoryDirectory, runDirectory, sourceHead } = await fixture()
    await writeValidRun(runDirectory, sourceHead)
    const baseName = 'session3-desktop-1440x900-light-normal'
    const metadata = await readMetadata(runDirectory, baseName)
    const states = metadata.value.states as Array<Record<string, unknown>>
    const visibleSeed = states[2]
    const obsoleteNarrowRect = {
      bottom: 900,
      height: 900,
      left: 624,
      right: 816,
      top: 0,
      width: 192,
      x: 624,
      y: 0,
    }
    visibleSeed.fieldRect = { ...obsoleteNarrowRect }
    visibleSeed.canvasRect = { ...obsoleteNarrowRect }
    visibleSeed.backing = {
      effectiveDprX: 1,
      effectiveDprY: 1,
      height: 900,
      width: 192,
    }
    await writeFile(metadata.path, `${JSON.stringify(metadata.value, null, 2)}\n`)

    const result = finalize(runDirectory, finalDirectory, sourceHead, repositoryDirectory)

    expect(result.status).not.toBe(0)
    expect(result.stderr).toContain('fieldRect')
    await expect(readdir(finalDirectory)).rejects.toMatchObject({ code: 'ENOENT' })
  })

  it('rejects an origin-aligned narrow canvas and coherent backing beneath a full-viewport field', async () => {
    const { finalDirectory, repositoryDirectory, runDirectory, sourceHead } = await fixture()
    await writeValidRun(runDirectory, sourceHead)
    const baseName = 'session3-mobile-390x844-dark-normal'
    const metadata = await readMetadata(runDirectory, baseName)
    const states = metadata.value.states as Array<Record<string, unknown>>
    const visibleSeed = states[2]
    visibleSeed.canvasRect = {
      bottom: 844,
      height: 844,
      left: 0,
      right: 87,
      top: 0,
      width: 87,
      x: 0,
      y: 0,
    }
    visibleSeed.backing = {
      effectiveDprX: 1,
      effectiveDprY: 1,
      height: 844,
      width: 87,
    }
    await writeFile(metadata.path, `${JSON.stringify(metadata.value, null, 2)}\n`)

    const result = finalize(runDirectory, finalDirectory, sourceHead, repositoryDirectory)

    expect(result.status).not.toBe(0)
    expect(result.stderr).toContain('canvas width')
    await expect(readdir(finalDirectory)).rejects.toMatchObject({ code: 'ENOENT' })
  })

  it('rejects visually identical reverse trigger and timed-gather captures', async () => {
    const { finalDirectory, repositoryDirectory, runDirectory, sourceHead } = await fixture()
    await writeValidRun(runDirectory, sourceHead)
    const baseName = 'session3-desktop-1440x900-light-normal'
    const directory = join(runDirectory, baseName)
    const reverseBytes = await readFile(join(directory, `${baseName}-reverse-trigger.png`))
    const gatherHalfBytes = validPng(1440, 900, 48, 1)
    const gatherCompleteBytes = validPng(1440, 900, 48, 9)
    expect(gatherHalfBytes.equals(reverseBytes)).toBe(false)
    expect(gatherCompleteBytes.equals(reverseBytes)).toBe(false)
    expect(gatherCompleteBytes.equals(gatherHalfBytes)).toBe(false)
    await Promise.all([
      writeFile(join(directory, `${baseName}-gather-050.png`), gatherHalfBytes),
      writeFile(join(directory, `${baseName}-gather-100.png`), gatherCompleteBytes),
    ])

    const result = finalize(runDirectory, finalDirectory, sourceHead, repositoryDirectory)

    expect(result.status).not.toBe(0)
    expect(result.stderr).toContain('reverse/gather screenshots must be visually distinct')
    await expect(readdir(finalDirectory)).rejects.toMatchObject({ code: 'ENOENT' })
  })

  it('accepts an explicitly loading, canvas-absent preload state', async () => {
    const { finalDirectory, repositoryDirectory, runDirectory, sourceHead } = await fixture()
    await writeValidRun(runDirectory, sourceHead)
    const baseName = 'session3-desktop-1440x900-dark-normal'
    const metadata = await readMetadata(runDirectory, baseName)
    const identity = metadata.value.identity as Record<string, unknown>
    const states = metadata.value.states as Array<Record<string, unknown>>
    const preload = states[1]
    identity.canvasAbsentAtPreload = true
    preload.status = 'loading'
    preload.frameSequence = states[0].frameSequence
    preload.backing = null
    preload.canvasRect = null
    preload.identity = {
      canvasAbsent: true,
      canvasToken: null,
      canvasTokenMatches: true,
      rootToken: 'root-token',
      rootTokenMatches: true,
    }
    await writeFile(metadata.path, `${JSON.stringify(metadata.value, null, 2)}\n`)

    const result = finalize(runDirectory, finalDirectory, sourceHead, repositoryDirectory)

    expect(result.status, result.stderr).toBe(0)
    expect(await readdir(finalDirectory)).toHaveLength(44)
  })

  it('rejects a signature-only PNG without publishing', async () => {
    const { finalDirectory, repositoryDirectory, runDirectory, sourceHead } = await fixture()
    await writeValidRun(runDirectory, sourceHead)
    const baseName = 'session3-desktop-1440x900-dark-normal'
    await writeFile(
      join(runDirectory, baseName, `${baseName}-motto-end.png`),
      Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    )

    const result = finalize(runDirectory, finalDirectory, sourceHead, repositoryDirectory)

    expect(result.status).not.toBe(0)
    expect(result.stderr).toContain('PNG')
    await expect(readdir(finalDirectory)).rejects.toMatchObject({ code: 'ENOENT' })
  })

  it('rejects a structurally valid PNG with the wrong viewport dimensions', async () => {
    const { finalDirectory, repositoryDirectory, runDirectory, sourceHead } = await fixture()
    await writeValidRun(runDirectory, sourceHead)
    const baseName = 'session3-mobile-390x844-light-reduced'
    await writeFile(
      join(runDirectory, baseName, `${baseName}-final.png`),
      validPng(391, 844),
    )

    const result = finalize(runDirectory, finalDirectory, sourceHead, repositoryDirectory)

    expect(result.status).not.toBe(0)
    expect(result.stderr).toContain('expected 390x844')
    await expect(readdir(finalDirectory)).rejects.toMatchObject({ code: 'ENOENT' })
  })

  it('rejects a PNG whose chunk checksum does not match its bytes', async () => {
    const { finalDirectory, repositoryDirectory, runDirectory, sourceHead } = await fixture()
    await writeValidRun(runDirectory, sourceHead)
    const baseName = 'session3-desktop-1440x900-dark-normal'
    const screenshotPath = join(runDirectory, baseName, `${baseName}-motto-end.png`)
    const bytes = Buffer.from(await readFile(screenshotPath))
    bytes[20] ^= 0x01
    await writeFile(screenshotPath, bytes)

    const result = finalize(runDirectory, finalDirectory, sourceHead, repositoryDirectory)

    expect(result.status).not.toBe(0)
    expect(result.stderr).toContain('checksum')
    await expect(readdir(finalDirectory)).rejects.toMatchObject({ code: 'ENOENT' })
  })

  it('rejects captured runtime errors without publishing', async () => {
    const { finalDirectory, repositoryDirectory, runDirectory, sourceHead } = await fixture()
    await writeValidRun(runDirectory, sourceHead)
    const baseName = 'session3-desktop-1440x900-light-normal'
    const metadata = await readMetadata(runDirectory, baseName)
    metadata.value.runtimeErrors = ['pageerror: fixture failure']
    await writeFile(metadata.path, `${JSON.stringify(metadata.value, null, 2)}\n`)

    const result = finalize(runDirectory, finalDirectory, sourceHead, repositoryDirectory)

    expect(result.status).not.toBe(0)
    expect(result.stderr).toContain('runtime errors')
    await expect(readdir(finalDirectory)).rejects.toMatchObject({ code: 'ENOENT' })
  })

  it('rejects reordered normal-motion state labels without publishing', async () => {
    const { finalDirectory, repositoryDirectory, runDirectory, sourceHead } = await fixture()
    await writeValidRun(runDirectory, sourceHead)
    const baseName = 'session3-desktop-1440x900-light-normal'
    const metadata = await readMetadata(runDirectory, baseName)
    const states = metadata.value.states as Array<Record<string, unknown>>
    ;[states[2], states[3]] = [states[3], states[2]]
    await writeFile(metadata.path, `${JSON.stringify(metadata.value, null, 2)}\n`)

    const result = finalize(runDirectory, finalDirectory, sourceHead, repositoryDirectory)

    expect(result.status).not.toBe(0)
    expect(result.stderr).toContain('state labels/order')
    await expect(readdir(finalDirectory)).rejects.toMatchObject({ code: 'ENOENT' })
  })

  it('rejects a scroll target miss greater than one pixel', async () => {
    const { finalDirectory, repositoryDirectory, runDirectory, sourceHead } = await fixture()
    await writeValidRun(runDirectory, sourceHead)
    const baseName = 'session3-desktop-1440x900-dark-normal'
    const metadata = await readMetadata(runDirectory, baseName)
    const states = metadata.value.states as Array<Record<string, unknown>>
    states[6].actualScrollY = 602
    await writeFile(metadata.path, `${JSON.stringify(metadata.value, null, 2)}\n`)

    const result = finalize(runDirectory, finalDirectory, sourceHead, repositoryDirectory)

    expect(result.status).not.toBe(0)
    expect(result.stderr).toContain('within 1px')
    await expect(readdir(finalDirectory)).rejects.toMatchObject({ code: 'ENOENT' })
  })

  it.each([
    ['animationVersion', 'not-a-version'],
    ['materialsVersion', 'not-a-version'],
    ['animationVersion', 1.5],
    ['materialsVersion', 1.5],
    ['animationVersion', 0],
    ['materialsVersion', 0],
  ])('rejects malformed generated-config provenance for %s = %s', async (field, value) => {
    const { finalDirectory, repositoryDirectory, runDirectory, sourceHead } = await fixture()
    await writeValidRun(runDirectory, sourceHead)
    const baseName = 'session3-desktop-1440x900-light-normal'
    const metadata = await readMetadata(runDirectory, baseName)
    const generatedConfig = metadata.value.generatedConfig as Record<string, unknown>
    generatedConfig[field] = value
    await writeFile(metadata.path, `${JSON.stringify(metadata.value, null, 2)}\n`)

    const result = finalize(runDirectory, finalDirectory, sourceHead, repositoryDirectory)

    expect(result.status).not.toBe(0)
    expect(result.stderr).toContain(field)
    await expect(readdir(finalDirectory)).rejects.toMatchObject({ code: 'ENOENT' })
  })

  it.each([
    'animationVersion',
    'materialsVersion',
  ])('rejects a one-cell %s mutant through the shared-config fingerprint', async (field) => {
    const { finalDirectory, repositoryDirectory, runDirectory, sourceHead } = await fixture()
    await writeValidRun(runDirectory, sourceHead)
    const baseName = 'session3-mobile-390x844-dark-reduced'
    const metadata = await readMetadata(runDirectory, baseName)
    const generatedConfig = metadata.value.generatedConfig as Record<string, unknown>
    generatedConfig[field] = 2
    await writeFile(metadata.path, `${JSON.stringify(metadata.value, null, 2)}\n`)

    const result = finalize(runDirectory, finalDirectory, sourceHead, repositoryDirectory)

    expect(result.status).not.toBe(0)
    expect(result.stderr).toContain("does not share the run's generated config")
    await expect(readdir(finalDirectory)).rejects.toMatchObject({ code: 'ENOENT' })
  })

  it('rejects stale run files without publishing a destination', async () => {
    const { finalDirectory, repositoryDirectory, runDirectory, sourceHead } = await fixture()
    await writeValidRun(runDirectory, sourceHead)
    await writeFile(join(runDirectory, 'stale-candidate.png'), validPng(1, 1))

    const result = finalize(runDirectory, finalDirectory, sourceHead, repositoryDirectory)

    expect(result.status).not.toBe(0)
    expect(result.stderr).toContain('run directory contains a non-cell entry')
    await expect(readdir(finalDirectory)).rejects.toMatchObject({ code: 'ENOENT' })
  })

  it('refuses to overwrite an existing final destination', async () => {
    const { finalDirectory, repositoryDirectory, runDirectory, sourceHead } = await fixture()
    await writeValidRun(runDirectory, sourceHead)
    await mkdir(finalDirectory)
    await writeFile(join(finalDirectory, 'owner-reviewed.txt'), 'keep me\n')

    const result = finalize(runDirectory, finalDirectory, sourceHead, repositoryDirectory)

    expect(result.status).not.toBe(0)
    expect(result.stderr).toContain('already exists and will not be overwritten')
    expect(await readdir(finalDirectory)).toEqual(['owner-reviewed.txt'])
  })

  it('rejects a requested HEAD that is not the repository HEAD', async () => {
    const { finalDirectory, repositoryDirectory, runDirectory } = await fixture()
    const incorrectHead = '0'.repeat(40)

    const result = finalize(runDirectory, finalDirectory, incorrectHead, repositoryDirectory)

    expect(result.status).not.toBe(0)
    expect(result.stderr).toContain('does not equal real HEAD')
    await expect(readdir(finalDirectory)).rejects.toMatchObject({ code: 'ENOENT' })
  })

  it('rejects evidence from tracked files that differ from the requested HEAD', async () => {
    const {
      finalDirectory,
      repositoryDirectory,
      runDirectory,
      sourceHead,
    } = await fixture()
    await writeValidRun(runDirectory, sourceHead)
    await writeFile(join(repositoryDirectory, 'fixture.txt'), 'dirty source tree\n')

    const result = finalize(runDirectory, finalDirectory, sourceHead, repositoryDirectory)

    expect(result.status).not.toBe(0)
    expect(result.stderr).toContain('working tree differs from HEAD')
    await expect(readdir(finalDirectory)).rejects.toMatchObject({ code: 'ENOENT' })
  })

  it('rejects an untracked source file that is not part of the requested HEAD', async () => {
    const {
      finalDirectory,
      repositoryDirectory,
      runDirectory,
      sourceHead,
    } = await fixture()
    await writeValidRun(runDirectory, sourceHead)
    await writeFile(join(repositoryDirectory, 'untracked-source.ts'), 'export const drift = true\n')

    const result = finalize(runDirectory, finalDirectory, sourceHead, repositoryDirectory)

    expect(result.status).not.toBe(0)
    expect(result.stderr).toContain('working tree differs from HEAD')
    await expect(readdir(finalDirectory)).rejects.toMatchObject({ code: 'ENOENT' })
  })
})

describe('Session 3 fail-closed evidence runner', () => {
  it('chains build, a free-port check, exact Playwright capture, and finalization', async () => {
    const harness = await runnerHarness()

    const result = harness.run()

    expect(result.status, result.stderr).toBe(0)
    expect(await harness.calls()).toEqual([
      'npm run build',
      'lsof -nP -iTCP:4173 -sTCP:LISTEN',
      'npx playwright test e2e/landing-journeys.spec.ts --grep @session3-evidence --workers=1 --retries=0',
    ])
    expect(await readdir(harness.finalDirectory)).toHaveLength(44)
  })

  it('accepts an existing empty mktemp run directory as fresh', async () => {
    const harness = await runnerHarness()
    await mkdir(harness.runDirectory)

    const result = harness.run()

    expect(result.status, result.stderr).toBe(0)
    expect(await readdir(harness.finalDirectory)).toHaveLength(44)
  })

  it('stops before port check, capture, and finalization when the build fails', async () => {
    const harness = await runnerHarness()

    const result = harness.run({ SESSION3_FAKE_BUILD_STATUS: '23' })

    expect(result.status).not.toBe(0)
    expect(await harness.calls()).toEqual(['npm run build'])
    await expect(readdir(harness.finalDirectory)).rejects.toMatchObject({ code: 'ENOENT' })
  })

  it('stops before capture and finalization when port 4173 is occupied', async () => {
    const harness = await runnerHarness()

    const result = harness.run({ SESSION3_FAKE_LSOF_STATUS: '0' })

    expect(result.status).not.toBe(0)
    expect(await harness.calls()).toEqual([
      'npm run build',
      'lsof -nP -iTCP:4173 -sTCP:LISTEN',
    ])
    await expect(readdir(harness.finalDirectory)).rejects.toMatchObject({ code: 'ENOENT' })
  })

  it('fails closed when the port probe itself errors', async () => {
    const harness = await runnerHarness()

    const result = harness.run({ SESSION3_FAKE_LSOF_STATUS: '2' })

    expect(result.status).not.toBe(0)
    expect(await harness.calls()).toEqual([
      'npm run build',
      'lsof -nP -iTCP:4173 -sTCP:LISTEN',
    ])
    await expect(readdir(harness.finalDirectory)).rejects.toMatchObject({ code: 'ENOENT' })
  })

  it('stops before finalization when Playwright capture fails', async () => {
    const harness = await runnerHarness()

    const result = harness.run({ SESSION3_FAKE_CAPTURE_STATUS: '17' })

    expect(result.status).not.toBe(0)
    expect(await harness.calls()).toHaveLength(3)
    await expect(readdir(harness.finalDirectory)).rejects.toMatchObject({ code: 'ENOENT' })
  })

  it('does not publish when final validation rejects the captured matrix', async () => {
    const harness = await runnerHarness()
    const baseName = 'session3-desktop-1440x900-dark-normal'
    await writeFile(
      join(harness.captureSource, baseName, `${baseName}-motto-end.png`),
      validPng(2, 2),
    )

    const result = harness.run()

    expect(result.status).not.toBe(0)
    expect(await harness.calls()).toHaveLength(3)
    await expect(readdir(harness.finalDirectory)).rejects.toMatchObject({ code: 'ENOENT' })
  })
})
