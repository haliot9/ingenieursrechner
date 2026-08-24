import { spawn } from 'node:child_process'
import { statSync } from 'node:fs'
import { resolve } from 'node:path'
import type { Plugin, ViteDevServer } from 'vite'

type CompilerTarget = {
  inputs: string[]
  name: string
  script: string
}

function captureInputRevision(inputs: string[]) {
  return inputs.map(path => {
    try {
      const stats = statSync(path, { bigint: true })
      return `${stats.dev}:${stats.ino}:${stats.size}:${stats.mtimeNs}:${stats.ctimeNs}`
    } catch (error) {
      const code = error instanceof Error && 'code' in error ? String(error.code) : 'UNKNOWN'
      return `unreadable:${code}`
    }
  }).join('|')
}

function compilerTargets(root: string): CompilerTarget[] {
  return [
    {
      name: 'line field',
      inputs: [
        'src/landing/line-field/config/line-field.animation.yaml',
        'src/landing/line-field/config/line-field.animation.schema.json',
        'src/landing/line-field/config/line-field.materials.yaml',
        'src/landing/line-field/config/line-field.materials.schema.json',
      ].map(path => resolve(root, path)),
      script: resolve(root, 'scripts/compile-line-field-config.mjs'),
    },
    {
      name: 'landing background',
      inputs: [
        'src/landing/background/config/landing-background.effects.yaml',
        'src/landing/background/config/landing-background.effects.schema.json',
      ].map(path => resolve(root, path)),
      script: resolve(root, 'scripts/compile-landing-background-config.mjs'),
    },
    {
      name: 'elastic menu chain',
      inputs: [
        'src/landing/motion/config/elastic-menu-chain.motion.yaml',
        'src/landing/motion/config/elastic-menu-chain.motion.schema.json',
      ].map(path => resolve(root, path)),
      script: resolve(root, 'scripts/compile-elastic-menu-chain-config.mjs'),
    },
  ]
}

function compile(target: CompilerTarget, root: string, server: ViteDevServer, isClosing: () => boolean) {
  const child = spawn(process.execPath, [target.script, '--write'], {
    cwd: root,
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  let stderr = ''
  child.stderr.setEncoding('utf8')
  child.stderr.on('data', chunk => { stderr += chunk })
  child.once('error', error => {
    if (!isClosing()) server.config.logger.error(`[config-hmr] ${target.name}: ${error.message}`)
  })
  child.once('close', code => {
    if (isClosing()) return
    if (code === 0) server.config.logger.info(`[config-hmr] ${target.name} regenerated`)
    else server.config.logger.error(`[config-hmr] ${target.name}: ${stderr.trim() || `compiler exited ${code}`}`)
  })
  return child
}

export function createConfigHotReloadPlugin(options: { root?: string } = {}): Plugin {
  let server: ViteDevServer | undefined
  let root = options.root ? resolve(options.root) : process.cwd()
  let onChange: ((path: string) => void) | undefined
  let closing = false
  const activeCompilers = new Set<ReturnType<typeof spawn>>()
  const reconciliationTimers = new Set<ReturnType<typeof setTimeout>>()

  return {
    name: 'ingenieursrechner-config-hot-reload',
    apply: 'serve',
    configResolved(config) {
      root = options.root ? resolve(options.root) : config.root
    },
    configureServer(viteServer) {
      server = viteServer
      const targets = compilerTargets(root)
      const targetByInput = new Map(targets.flatMap(target => target.inputs.map(path => [path, target] as const)))
      const targetStates = new Map(targets.map(target => [target, {
        pending: false,
        reconciliationTimer: undefined as ReturnType<typeof setTimeout> | undefined,
        running: undefined as ReturnType<typeof spawn> | undefined,
      }]))
      const startCompiler = (target: CompilerTarget) => {
        const state = targetStates.get(target)
        if (!state || state.running || closing) return
        if (state.reconciliationTimer) {
          clearTimeout(state.reconciliationTimer)
          reconciliationTimers.delete(state.reconciliationTimer)
          state.reconciliationTimer = undefined
        }
        state.pending = false
        const startingInputRevision = captureInputRevision(target.inputs)
        const child = compile(target, root, viteServer, () => closing)
        state.running = child
        activeCompilers.add(child)
        child.once('close', () => {
          activeCompilers.delete(child)
          state.running = undefined
          const closingInputRevision = captureInputRevision(target.inputs)
          const inputsChangedDuringCompile = !closing && closingInputRevision !== startingInputRevision
          if ((state.pending || inputsChangedDuringCompile) && !closing) startCompiler(target)
          else if (!closing) {
            // Chokidar suppresses same-path changes inside a 50 ms window without
            // emitting a trailing event. Reconcile once after that window so a
            // save immediately following a fast compiler close is not lost.
            const timer = setTimeout(() => {
              reconciliationTimers.delete(timer)
              if (state.reconciliationTimer === timer) state.reconciliationTimer = undefined
              if (!closing && captureInputRevision(target.inputs) !== closingInputRevision) {
                startCompiler(target)
              }
            }, 75)
            state.reconciliationTimer = timer
            reconciliationTimers.add(timer)
          }
        })
      }
      viteServer.watcher.add([...targetByInput.keys()])
      onChange = path => {
        const target = targetByInput.get(resolve(path))
        if (!target || closing) return
        const state = targetStates.get(target)
        if (!state) return
        state.pending = true
        startCompiler(target)
      }
      viteServer.watcher.on('change', onChange)
    },
    async closeBundle() {
      closing = true
      if (server && onChange) server.watcher.off('change', onChange)
      for (const timer of reconciliationTimers) clearTimeout(timer)
      reconciliationTimers.clear()
      await Promise.all([...activeCompilers].map(child => new Promise<void>(resolveChild => {
        child.once('close', () => resolveChild())
        child.kill('SIGTERM')
      })))
    },
  }
}
