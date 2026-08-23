// @vitest-environment node

import { spawn } from 'node:child_process'
import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { createServer } from 'node:http'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import type { ChildProcess } from 'node:child_process'
import type { Server } from 'node:http'
import type { Socket } from 'node:net'
import { afterEach, describe, expect, it, vi } from 'vitest'

const originalCi = process.env.CI
const occupiedServers = new Set<Server>()
const socketsByServer = new Map<Server, Set<Socket>>()
const activePlaywrightChildren = new Set<ChildProcess>()
const childClosePromises = new Map<ChildProcess, Promise<void>>()

type SpawnedCommand = {
  args: string[]
  command: string
  awaitReady?: () => Promise<void>
  onSpawn?: (child: ChildProcess) => void
  reapForTest?: (child: ChildProcess, closePromise: Promise<void>) => Promise<void>
  timeoutMs?: number
}

type CommandResult = {
  exitCode: number | null
  output: string
  signalCode: NodeJS.Signals | null
  timedOut: boolean
}

function closeServer(server: Server) {
  return new Promise<void>((resolve, reject) => {
    if (!server.listening) {
      resolve()
      return
    }
    for (const socket of socketsByServer.get(server) ?? []) socket.destroy()
    server.close(error => error ? reject(error) : resolve())
  })
}

async function occupyCanonicalPreviewPort() {
  const server = createServer((_request, response) => {
    response.writeHead(200, { 'content-type': 'text/plain' })
    response.end('occupied preview port')
  })
  const sockets = new Set<Socket>()
  socketsByServer.set(server, sockets)
  server.on('connection', socket => {
    sockets.add(socket)
    socket.once('close', () => sockets.delete(socket))
  })
  await new Promise<void>((resolve, reject) => {
    const onError = (error: Error) => reject(error)
    server.once('error', onError)
    server.listen(4173, '127.0.0.1', () => {
      server.off('error', onError)
      resolve()
    })
  })
  occupiedServers.add(server)
  return server
}

async function releaseOccupiedServer(server: Server) {
  occupiedServers.delete(server)
  await closeServer(server)
  socketsByServer.delete(server)
}

function waitForClose(closePromise: Promise<void>, timeoutMs: number) {
  return new Promise<boolean>(resolve => {
    const timeout = setTimeout(() => resolve(false), timeoutMs)
    closePromise.then(() => {
      clearTimeout(timeout)
      resolve(true)
    })
  })
}

function terminateWindowsProcessTree(pid: number) {
  return new Promise<void>((resolve, reject) => {
    const taskkill = spawn('taskkill', ['/PID', String(pid), '/T', '/F'], {
      stdio: 'ignore',
      windowsHide: true,
    })
    const timeout = setTimeout(() => {
      taskkill.kill('SIGKILL')
      reject(new Error(`Timed out terminating Windows process tree ${pid}`))
    }, 1_000)
    taskkill.once('error', error => {
      clearTimeout(timeout)
      reject(error)
    })
    taskkill.once('close', exitCode => {
      clearTimeout(timeout)
      if (exitCode === 0) resolve()
      else reject(new Error(`taskkill failed for process tree ${pid} with exit code ${exitCode}`))
    })
  })
}

async function signalChildProcessGroup(child: ChildProcess, signal: NodeJS.Signals) {
  if (!child.pid) return
  if (process.platform === 'win32') {
    if (!processIsAlive(child.pid)) return
    await terminateWindowsProcessTree(child.pid)
    return
  }
  try {
    process.kill(-child.pid, signal)
  } catch (error) {
    if (!(error instanceof Error) || !('code' in error) || error.code !== 'ESRCH') throw error
  }
}

async function reapChildProcessGroup(child: ChildProcess, closePromise: Promise<void>) {
  await signalChildProcessGroup(child, 'SIGTERM')
  if (await waitForClose(closePromise, 250)) return

  if (process.platform === 'win32') {
    throw new Error(`Timed out while reaping Windows process tree ${child.pid ?? 'without a pid'}`)
  }

  await signalChildProcessGroup(child, 'SIGKILL')
  if (await waitForClose(closePromise, 1_000)) return

  throw new Error(`Timed out while reaping child process group ${child.pid ?? 'without a pid'}`)
}

function runPlaywrightWithOccupiedPreviewPort(options: Partial<SpawnedCommand> = {}) {
  return new Promise<CommandResult>((resolve, reject) => {
    const environment = { ...process.env }
    delete environment.CI
    const command = options.command ?? process.execPath
    const args = options.args ?? [
      join(process.cwd(), 'node_modules', '@playwright', 'test', 'cli.js'),
      'test',
      'e2e/accessibility.spec.ts',
      '--project=desktop-chromium',
      '--grep=light-theme primary controls meet WCAG AA contrast',
      '--workers=1',
    ]
    const child = spawn(command, args, {
      cwd: process.cwd(),
      detached: process.platform !== 'win32',
      env: environment,
      stdio: ['ignore', 'pipe', 'pipe'],
    })
    activePlaywrightChildren.add(child)
    options.onSpawn?.(child)
    let resolveClose: () => void
    const closePromise = new Promise<void>(resolve => { resolveClose = resolve })
    childClosePromises.set(child, closePromise)
    let output = ''
    let settled = false
    let terminalError: unknown
    let hasTerminalError = false
    let timedOut = false
    let timeout: ReturnType<typeof setTimeout> | undefined
    const finish = (callback: () => void) => {
      if (settled) return
      settled = true
      if (timeout) clearTimeout(timeout)
      callback()
    }
    const recordTerminalError = (error: unknown) => {
      if (hasTerminalError) return
      hasTerminalError = true
      terminalError = error
    }
    const rejectTerminalError = () => {
      if (hasTerminalError) finish(() => reject(terminalError))
    }
    const reap = options.reapForTest ?? reapChildProcessGroup
    const armTimeout = () => {
      if (settled) return
      timeout = setTimeout(() => {
        timedOut = true
        void reap(child, closePromise).catch(error => {
          recordTerminalError(error)
          rejectTerminalError()
        })
      }, options.timeoutMs ?? 5_000)
    }
    const rejectAfterReadinessFailure = async (error: unknown) => {
      recordTerminalError(error)
      try {
        await reap(child, closePromise)
      } catch (reapError) {
        terminalError = new Error(`Readiness failed and cleanup also failed: ${String(error)}; ${String(reapError)}`)
        rejectTerminalError()
      }
    }

    child.stdout.on('data', chunk => { output += String(chunk) })
    child.stderr.on('data', chunk => { output += String(chunk) })
    child.once('error', error => {
      recordTerminalError(error)
    })
    child.once('close', (exitCode, signalCode) => {
      activePlaywrightChildren.delete(child)
      childClosePromises.delete(child)
      resolveClose()
      if (hasTerminalError) finish(() => reject(terminalError))
      else finish(() => resolve({ exitCode, output, signalCode, timedOut }))
    })
    if (options.awaitReady) void options.awaitReady().then(armTimeout).catch(rejectAfterReadinessFailure)
    else armTimeout()
  })
}

function processIsAlive(pid: number) {
  try {
    process.kill(pid, 0)
    return true
  } catch {
    return false
  }
}

async function waitForProcessExit(pid: number) {
  const deadline = Date.now() + 1_000
  while (processIsAlive(pid) && Date.now() < deadline) {
    await new Promise(resolve => setTimeout(resolve, 20))
  }
  return !processIsAlive(pid)
}

async function waitForDescendantReadiness(path: string) {
  const deadline = Date.now() + 1_000
  while (Date.now() < deadline) {
    try {
      if ((await readFile(path, 'utf8')).trim() === 'ready') return
    } catch {
      // The descendant has not installed its handler and announced readiness yet.
    }
    await new Promise(resolve => setTimeout(resolve, 20))
  }
  throw new Error('Timed out waiting for descendant SIGTERM-handler readiness')
}

async function stopDetachedProcessGroup(pid: number) {
  if (process.platform === 'win32') {
    if (!processIsAlive(pid)) return
    await terminateWindowsProcessTree(pid)
    return
  }
  try {
    process.kill(-pid, 'SIGKILL')
  } catch (error) {
    if (!(error instanceof Error) || !('code' in error) || error.code !== 'ESRCH') throw error
  }
}

async function loadPlaywrightConfig(ci?: string) {
  vi.resetModules()
  if (ci === undefined) delete process.env.CI
  else process.env.CI = ci
  return (await import('../../playwright.config.ts')).default
}

afterEach(async () => {
  const failures: unknown[] = []
  try {
    const childResults = await Promise.allSettled([...activePlaywrightChildren].map(async child => {
      const closePromise = childClosePromises.get(child)
      if (closePromise) await reapChildProcessGroup(child, closePromise)
    }))
    const serverResults = await Promise.allSettled([...occupiedServers].map(releaseOccupiedServer))
    failures.push(...childResults, ...serverResults)
  } finally {
    if (originalCi === undefined) delete process.env.CI
    else process.env.CI = originalCi
  }
  const rejected = failures.filter((result): result is PromiseRejectedResult => result.status === 'rejected')
  if (rejected.length) throw new Error(`Cleanup failures:\n${rejected.map(result => String(result.reason)).join('\n')}`)
})

describe('Playwright preview-server ownership', () => {
  it('starts this checkout on the canonical strict preview address without reuse', async () => {
    const config = await loadPlaywrightConfig()
    const webServer = config.webServer

    expect(config.workers).toBe(1)
    expect(config.use?.baseURL).toBe('http://127.0.0.1:4173')
    expect(webServer).not.toBeInstanceOf(Array)
    expect(webServer?.url).toBe(config.use?.baseURL)
    expect(webServer?.command).toBe('npm run preview -- --host 127.0.0.1 --port 4173 --strictPort')
    expect.soft(webServer?.reuseExistingServer).toBe(false)
  })

  it('does not reuse the preview server in CI either', async () => {
    const config = await loadPlaywrightConfig('true')

    expect(config.webServer).not.toBeInstanceOf(Array)
    expect(config.webServer?.reuseExistingServer).toBe(false)
  })

  it('rejects a real listener on the canonical preview port before a browser journey can reuse it', async () => {
    const listener = await occupyCanonicalPreviewPort()
    let result: CommandResult

    try {
      result = await runPlaywrightWithOccupiedPreviewPort()
    } finally {
      await releaseOccupiedServer(listener)
    }

    expect(result!.exitCode).not.toBe(0)
    expect(result!.output).toContain('http://127.0.0.1:4173 is already used')
    expect(result!.output).not.toContain('Running 1 test')
    expect(result!.output).not.toContain('4174')

    const replacementListener = await occupyCanonicalPreviewPort()
    await releaseOccupiedServer(replacementListener)
  })

  it('reaps a SIGTERM-ignoring process group before the timeout result is returned', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'playwright-server-ownership-'))
    const descendantPidPath = join(directory, 'descendant.pid')
    const readinessPath = join(directory, 'descendant.ready')
    const descendantSource = [
      'setTimeout(() => {',
      "process.on('SIGTERM', () => {})",
      "require('node:fs').writeFileSync(process.argv[1], String(process.pid))",
      "require('node:fs').writeFileSync(process.argv[2], 'ready')",
      'setInterval(() => {}, 1_000)',
      '}, 150)',
    ].join('; ')
    const parentSource = [
      "const { spawn } = require('node:child_process')",
      "process.on('SIGTERM', () => {})",
      `spawn(process.execPath, ['-e', ${JSON.stringify(descendantSource)}, process.argv[1], process.argv[2]], { stdio: 'ignore' })`,
      'setInterval(() => {}, 1_000)',
    ].join('; ')
    let leaderPid: number | undefined
    let descendantPid: number | undefined

    try {
      const result = await runPlaywrightWithOccupiedPreviewPort({
        args: ['-e', parentSource, descendantPidPath, readinessPath],
        awaitReady: () => waitForDescendantReadiness(readinessPath),
        command: process.execPath,
        onSpawn: child => { leaderPid = child.pid },
        timeoutMs: 100,
      })
      descendantPid = Number(await readFile(descendantPidPath, 'utf8'))

      expect(result).toMatchObject({ timedOut: true })
      expect(await waitForProcessExit(leaderPid!)).toBe(true)
      expect(await waitForProcessExit(descendantPid)).toBe(true)
    } finally {
      try {
        descendantPid ??= Number(await readFile(descendantPidPath, 'utf8'))
      } catch {
        // The child can be reaped before it writes the fixture PID.
      }
      if (leaderPid) await stopDetachedProcessGroup(leaderPid)
      if (leaderPid) await waitForProcessExit(leaderPid)
      if (descendantPid) await waitForProcessExit(descendantPid)
      await rm(directory, { force: true, recursive: true })
    }
  })

  it('rejects the readiness error only after reaping its leader and descendant', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'playwright-server-readiness-failure-'))
    const descendantPidPath = join(directory, 'descendant.pid')
    const readinessPath = join(directory, 'descendant.ready')
    const descendantSource = [
      "process.on('SIGTERM', () => {})",
      "require('node:fs').writeFileSync(process.argv[1], String(process.pid))",
      "require('node:fs').writeFileSync(process.argv[2], 'ready')",
      'setInterval(() => {}, 1_000)',
    ].join('; ')
    const parentSource = [
      "const { spawn } = require('node:child_process')",
      "process.on('SIGTERM', () => {})",
      `spawn(process.execPath, ['-e', ${JSON.stringify(descendantSource)}, process.argv[1], process.argv[2]], { stdio: 'ignore' })`,
      'setInterval(() => {}, 1_000)',
    ].join('; ')
    const intendedError = new Error('intentional descendant readiness failure')
    let leaderPid: number | undefined
    let descendantPid: number | undefined
    let receivedError: unknown

    try {
      try {
        await runPlaywrightWithOccupiedPreviewPort({
          args: ['-e', parentSource, descendantPidPath, readinessPath],
          awaitReady: async () => {
            await waitForDescendantReadiness(readinessPath)
            throw intendedError
          },
          command: process.execPath,
          onSpawn: child => { leaderPid = child.pid },
        })
      } catch (error) {
        receivedError = error
      }
      descendantPid = Number(await readFile(descendantPidPath, 'utf8'))

      expect(receivedError).toBe(intendedError)
      expect(await waitForProcessExit(leaderPid!)).toBe(true)
      expect(await waitForProcessExit(descendantPid)).toBe(true)
    } finally {
      try {
        descendantPid ??= Number(await readFile(descendantPidPath, 'utf8'))
      } catch {
        // The descendant can be reaped before it writes the fixture PID.
      }
      if (leaderPid) await stopDetachedProcessGroup(leaderPid)
      if (leaderPid) await waitForProcessExit(leaderPid)
      if (descendantPid) await waitForProcessExit(descendantPid)
      await rm(directory, { force: true, recursive: true })
    }
  })

  it('rejects a timed-out reaper failure while retaining child ownership for afterEach', async () => {
    const intendedError = new Error('intentional timeout reaper failure')
    let child: ChildProcess | undefined
    let receivedError: unknown

    try {
      await runPlaywrightWithOccupiedPreviewPort({
        args: ['-e', 'setInterval(() => {}, 1_000)'],
        command: process.execPath,
        onSpawn: spawned => { child = spawned },
        reapForTest: async () => { throw intendedError },
        timeoutMs: 50,
      })
    } catch (error) {
      receivedError = error
    }

    expect(receivedError).toBe(intendedError)
    expect(activePlaywrightChildren).toContain(child)
    expect(childClosePromises.has(child!)).toBe(true)
  }, 1_000)
})
