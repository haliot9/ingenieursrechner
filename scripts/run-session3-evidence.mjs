#!/usr/bin/env node

/**
 * Fail-closed Session 3 evidence path:
 *   exact clean HEAD -> production build -> isolated port -> eight-cell capture
 *   -> structural/schema validation -> atomic final publication.
 *
 * Example:
 *   npm run session3:evidence -- \
 *     --run /absolute/fresh/capture \
 *     --final /absolute/new/final \
 *     --head 0123456789abcdef0123456789abcdef01234567
 */

import { execFileSync, spawnSync } from 'node:child_process'
import { lstat, readdir } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { relative, resolve } from 'node:path'

const finalizerScript = fileURLToPath(new URL('./finalize-session3-evidence.mjs', import.meta.url))

function fail(message) {
  throw new Error(`Session 3 evidence run failed: ${message}`)
}

function parseArguments(argv) {
  const usage = 'usage: --run <fresh-run-directory> --final <new-final-directory> --head <git-head>'
  if (argv.length % 2 !== 0) fail(usage)
  const values = new Map()
  for (let index = 0; index < argv.length; index += 2) {
    const flag = argv[index]
    const value = argv[index + 1]
    if (!['--run', '--final', '--head'].includes(flag) || !value || values.has(flag)) fail(usage)
    values.set(flag, value)
  }
  for (const flag of ['--run', '--final', '--head']) {
    if (!values.has(flag)) fail(usage)
  }
  return {
    expectedHead: values.get('--head').trim(),
    finalDirectory: resolve(values.get('--final')),
    runDirectory: resolve(values.get('--run')),
  }
}

function gitOutput(args) {
  return execFileSync('git', args, {
    cwd: process.cwd(),
    encoding: 'utf8',
  }).trim()
}

function validateSource(expectedHead, stage) {
  if (!/^[0-9a-f]{40,64}$/.test(expectedHead)) fail('--head must be a full Git object ID')
  const actualHead = gitOutput(['rev-parse', 'HEAD'])
  if (actualHead !== expectedHead) {
    fail(`${stage}: requested HEAD ${expectedHead} does not equal real HEAD ${actualHead}`)
  }
  if (gitOutput(['status', '--porcelain', '--untracked-files=all'])) {
    fail(`${stage}: working tree differs from HEAD`)
  }
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

async function assertFreshRunDirectory(runDirectory) {
  try {
    const stats = await lstat(runDirectory)
    if (!stats.isDirectory()) fail(`run path exists but is not a directory: ${runDirectory}`)
    if ((await readdir(runDirectory)).length !== 0) {
      fail(`run directory is not empty; use a fresh path: ${runDirectory}`)
    }
  } catch (error) {
    if (error && error.code === 'ENOENT') return
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

function runCommand(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: process.cwd(),
    env: options.env ?? process.env,
    stdio: 'inherit',
  })
  if (result.error) fail(`${options.label ?? command} could not start (${result.error.message})`)
  if (result.signal) fail(`${options.label ?? command} was terminated by ${result.signal}`)
  if (result.status !== 0) {
    fail(`${options.label ?? command} exited with status ${result.status}`)
  }
}

function assertPreviewPortFree() {
  const args = ['-nP', '-iTCP:4173', '-sTCP:LISTEN']
  const result = spawnSync('lsof', args, {
    cwd: process.cwd(),
    encoding: 'utf8',
    env: process.env,
  })
  if (result.error) fail(`port 4173 check could not start (${result.error.message})`)
  if (result.signal) fail(`port 4173 check was terminated by ${result.signal}`)
  if (result.status === 0) {
    fail(`port 4173 is already occupied${result.stdout.trim() ? ` (${result.stdout.trim()})` : ''}`)
  }
  if (result.status !== 1) fail(`port 4173 check exited unexpectedly with status ${result.status}`)
}

async function runEvidence({ expectedHead, finalDirectory, runDirectory }) {
  assertSeparateDirectories(runDirectory, finalDirectory)
  await assertFreshRunDirectory(runDirectory)
  if (await pathExists(finalDirectory)) {
    fail(`final destination already exists and will not be overwritten: ${finalDirectory}`)
  }

  validateSource(expectedHead, 'preflight')
  runCommand('npm', ['run', 'build'], { label: 'production build' })
  validateSource(expectedHead, 'after build')
  assertPreviewPortFree()

  runCommand('npx', [
    'playwright',
    'test',
    'e2e/landing-journeys.spec.ts',
    '--grep',
    '@session3-evidence',
    '--workers=1',
    '--retries=0',
  ], {
    env: {
      ...process.env,
      CI: '1',
      SESSION3_EVIDENCE_HEAD: expectedHead,
      SESSION3_EVIDENCE_RUN_DIR: runDirectory,
    },
    label: 'Session 3 Playwright capture',
  })

  validateSource(expectedHead, 'after capture')
  if (await pathExists(finalDirectory)) {
    fail(`final destination appeared during capture: ${finalDirectory}`)
  }
  runCommand(process.execPath, [
    finalizerScript,
    '--run', runDirectory,
    '--final', finalDirectory,
    '--head', expectedHead,
  ], { label: 'Session 3 evidence finalization' })
}

try {
  await runEvidence(parseArguments(process.argv.slice(2)))
} catch (error) {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`)
  process.exitCode = 1
}
