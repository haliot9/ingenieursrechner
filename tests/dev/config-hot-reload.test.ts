// @vitest-environment node

import { EventEmitter } from 'node:events'
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { createLogger, createServer, resolveConfig } from 'vite'
import type { Plugin, ViteDevServer } from 'vite'
import { afterEach, describe, expect, it } from 'vitest'
import { createConfigHotReloadPlugin } from '../../scripts/vite-config-hot-reload'

const temporaryDirectories: string[] = []

async function writeFixtureFile(root: string, relativePath: string, contents: string) {
  const path = join(root, relativePath)
  await mkdir(dirname(path), { recursive: true })
  await writeFile(path, contents)
}

async function waitForFile(path: string, predicate: (contents: string) => boolean) {
  const deadline = Date.now() + 4_000
  let latest = ''
  while (Date.now() < deadline) {
    try {
      latest = await readFile(path, 'utf8')
      if (predicate(latest)) return latest
    } catch {
      // The compiler may not have created its output yet.
    }
    await new Promise(resolve => setTimeout(resolve, 25))
  }
  throw new Error(`Timed out waiting for ${path}; latest contents: ${latest}`)
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
  const deadline = Date.now() + 1_500
  while (processIsAlive(pid) && Date.now() < deadline) {
    await new Promise(resolve => setTimeout(resolve, 25))
  }
  expect(processIsAlive(pid), `compiler child ${pid} must stop with the Vite server`).toBe(false)
}

async function createFixture() {
  const root = await mkdtemp(join(tmpdir(), 'vite-config-hot-reload-'))
  temporaryDirectories.push(root)

  const lineAnimation = 'src/landing/line-field/config/line-field.animation.yaml'
  const lineAnimationSchema = 'src/landing/line-field/config/line-field.animation.schema.json'
  const lineMaterials = 'src/landing/line-field/config/line-field.materials.yaml'
  const lineMaterialsSchema = 'src/landing/line-field/config/line-field.materials.schema.json'
  const lineOutput = 'src/landing/line-field/config/line-field-config.generated.ts'
  const background = 'src/landing/background/config/landing-background.effects.yaml'
  const backgroundSchema = 'src/landing/background/config/landing-background.effects.schema.json'
  const backgroundOutput = 'src/landing/background/config/landing-background-config.generated.ts'
  const elasticMenu = 'src/landing/motion/config/elastic-menu-chain.motion.yaml'
  const elasticMenuSchema = 'src/landing/motion/config/elastic-menu-chain.motion.schema.json'
  const elasticMenuOutput = 'src/landing/motion/config/elastic-menu-chain-config.generated.ts'

  for (const [path, contents] of [
    [lineAnimation, 'animation: 1\n'],
    [lineAnimationSchema, '{"animationSchema":1}\n'],
    [lineMaterials, 'materials: 1\n'],
    [lineMaterialsSchema, '{"materialsSchema":1}\n'],
    [background, 'background: 1\n'],
    [backgroundSchema, '{"backgroundSchema":1}\n'],
    [elasticMenu, 'elasticMenu: 1\n'],
    [elasticMenuSchema, '{"elasticMenuSchema":1}\n'],
    [lineOutput, 'export default "initial"\n'],
    [backgroundOutput, 'export default "initial"\n'],
    [elasticMenuOutput, 'export default "initial"\n'],
  ] as const) await writeFixtureFile(root, path, contents)

  const compilerSource = (inputs: string[], output: string) => `
import { appendFile, readFile, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
const root = resolve(new URL('..', import.meta.url).pathname)
const values = await Promise.all(${JSON.stringify(inputs)}.map(path => readFile(resolve(root, path), 'utf8')))
if (values.some(value => value.includes('INVALID'))) {
  process.stderr.write('fixture invalid config\\n')
  process.exitCode = 1
} else if (values.some(value => value.includes('BLOCK'))) {
  await writeFile(resolve(root, 'compiler.pid'), String(process.pid))
  setInterval(() => {}, 1_000)
} else {
  if (values.some(value => value.includes('SLOW'))) {
    await writeFile(resolve(root, 'compiler.started'), JSON.stringify(values))
    await new Promise(resolveDelay => setTimeout(resolveDelay, 250))
  }
  await writeFile(resolve(root, ${JSON.stringify(output)}), 'export default ' + JSON.stringify(values) + '\\n')
  await appendFile(resolve(root, 'compiler.completed'), JSON.stringify(values) + '\\n')
}
`
  await writeFixtureFile(root, 'scripts/compile-line-field-config.mjs', compilerSource(
    [lineAnimation, lineAnimationSchema, lineMaterials, lineMaterialsSchema],
    lineOutput,
  ))
  await writeFixtureFile(root, 'scripts/compile-landing-background-config.mjs', compilerSource(
    [background, backgroundSchema],
    backgroundOutput,
  ))
  await writeFixtureFile(root, 'scripts/compile-elastic-menu-chain-config.mjs', compilerSource(
    [elasticMenu, elasticMenuSchema],
    elasticMenuOutput,
  ))
  await writeFixtureFile(root, 'index.html', '<script type="module" src="/src/main.ts"></script>\n')
  await writeFixtureFile(root, 'src/main.ts', [
    `import line from './landing/line-field/config/line-field-config.generated'`,
    `import background from './landing/background/config/landing-background-config.generated'`,
    `import elasticMenu from './landing/motion/config/elastic-menu-chain-config.generated'`,
    'console.log(line, background, elasticMenu)',
  ].join('\n'))

  return {
    background,
    backgroundOutput: join(root, backgroundOutput),
    backgroundSchema,
    elasticMenu,
    elasticMenuOutput: join(root, elasticMenuOutput),
    elasticMenuSchema,
    compilerPid: join(root, 'compiler.pid'),
    compilerCompleted: join(root, 'compiler.completed'),
    compilerStarted: join(root, 'compiler.started'),
    lineAnimation,
    lineAnimationSchema,
    lineMaterials,
    lineMaterialsSchema,
    lineOutput: join(root, lineOutput),
    root,
  }
}

function createControlledPlugin(root: string) {
  const watcher = Object.assign(new EventEmitter(), {
    add: () => undefined,
  })
  const logger = createLogger('silent', { allowClearScreen: false })
  const infoMessages: string[] = []
  logger.info = message => { infoMessages.push(message) }
  const server = {
    config: { logger },
    watcher,
  } as unknown as ViteDevServer
  const plugin = createConfigHotReloadPlugin({ root })
  const configureServer = plugin.configureServer as Exclude<Plugin['configureServer'], undefined>
  const closeBundle = plugin.closeBundle as Exclude<Plugin['closeBundle'], undefined>

  if (typeof configureServer !== 'function' || typeof closeBundle !== 'function') {
    throw new Error('config hot-reload plugin must expose callable lifecycle hooks')
  }
  configureServer(server)

  return {
    close: () => closeBundle.call(plugin),
    emitChange: (path: string) => watcher.emit('change', path),
    infoMessages,
  }
}

afterEach(async () => {
  await Promise.all(temporaryDirectories.splice(0).map(path => rm(path, { force: true, recursive: true })))
})

describe('Vite config hot reload', () => {
  it('installs the config hot-reload plugin in the real Vite serve configuration', async () => {
    const config = await resolveConfig({
      configFile: join(process.cwd(), 'vite.config.ts'),
      logLevel: 'silent',
    }, 'serve')

    expect(config.plugins.filter(plugin => plugin.name === 'ingenieursrechner-config-hot-reload')).toHaveLength(1)
  })

  it('regenerates each generated module when any declared YAML or schema input changes', async () => {
    const paths = await createFixture()
    const server = await createServer({
      configFile: false,
      root: paths.root,
      plugins: [createConfigHotReloadPlugin({ root: paths.root })],
      server: { hmr: false, middlewareMode: true },
    })

    try {
      await new Promise(resolve => setTimeout(resolve, 100))

      const previousByOutput = new Map([
        [paths.lineOutput, await readFile(paths.lineOutput, 'utf8')],
        [paths.backgroundOutput, await readFile(paths.backgroundOutput, 'utf8')],
        [paths.elasticMenuOutput, await readFile(paths.elasticMenuOutput, 'utf8')],
      ])
      for (const [relativePath, contents, marker, output] of [
        [paths.lineAnimation, 'animation: marker-line-animation', 'marker-line-animation', paths.lineOutput],
        [paths.lineAnimationSchema, '{"animationSchema":"marker-line-animation-schema"}', 'marker-line-animation-schema', paths.lineOutput],
        [paths.lineMaterials, 'materials: marker-line-materials', 'marker-line-materials', paths.lineOutput],
        [paths.lineMaterialsSchema, '{"materialsSchema":"marker-line-materials-schema"}', 'marker-line-materials-schema', paths.lineOutput],
        [paths.background, 'background: marker-background', 'marker-background', paths.backgroundOutput],
        [paths.backgroundSchema, '{"backgroundSchema":"marker-background-schema"}', 'marker-background-schema', paths.backgroundOutput],
        [paths.elasticMenu, 'elasticMenu: marker-elastic-menu', 'marker-elastic-menu', paths.elasticMenuOutput],
        [paths.elasticMenuSchema, '{"elasticMenuSchema":"marker-elastic-menu-schema"}', 'marker-elastic-menu-schema', paths.elasticMenuOutput],
      ] as const) {
        const unaffectedOutputs = [...previousByOutput.entries()]
          .filter(([candidateOutput]) => candidateOutput !== output)
        await writeFile(join(paths.root, relativePath), `${contents}\n`)
        const generated = await waitForFile(output, generatedContents => generatedContents.includes(marker))
        previousByOutput.set(output, generated)
        for (const [unaffectedOutput, unaffectedContents] of unaffectedOutputs) {
          expect(await readFile(unaffectedOutput, 'utf8')).toBe(unaffectedContents)
        }
      }
    } finally {
      await server.close()
    }
  })

  it('reports a compiler error and recovers on a later valid edit without restarting Vite', async () => {
    const paths = await createFixture()
    const errors: string[] = []
    const logger = createLogger('silent', { allowClearScreen: false })
    logger.error = message => { errors.push(message) }
    const server = await createServer({
      configFile: false,
      customLogger: logger,
      root: paths.root,
      plugins: [createConfigHotReloadPlugin({ root: paths.root })],
      server: { hmr: false, middlewareMode: true },
    })

    try {
      const initial = await readFile(paths.elasticMenuOutput, 'utf8')
      await new Promise(resolve => setTimeout(resolve, 100))
      await writeFile(join(paths.root, paths.elasticMenu), 'INVALID\n')
      const deadline = Date.now() + 4_000
      while (!errors.some(message => message.includes('fixture invalid config')) && Date.now() < deadline) {
        await new Promise(resolve => setTimeout(resolve, 25))
      }
      expect(errors).toContainEqual(expect.stringContaining('[config-hmr] elastic menu chain: fixture invalid config'))
      expect(await readFile(paths.elasticMenuOutput, 'utf8')).toBe(initial)

      await writeFile(join(paths.root, paths.elasticMenu), 'elasticMenu: recovered\n')
      await waitForFile(paths.elasticMenuOutput, contents => contents !== initial && contents.includes('recovered'))
    } finally {
      await server.close()
    }
  })

  it('rechecks the newest authoring state when an in-flight save coalesces into one watcher event', async () => {
    const paths = await createFixture()
    const controlledPlugin = createControlledPlugin(paths.root)

    try {
      await writeFile(join(paths.root, paths.background), 'background: SLOW_OLD\n')
      controlledPlugin.emitChange(join(paths.root, paths.background))
      await waitForFile(paths.compilerStarted, contents => contents.includes('SLOW_OLD'))
      await writeFile(join(paths.root, paths.background), 'background: newest__\n')
      await waitForFile(paths.compilerCompleted, contents => contents.trim().split('\n').length >= 2)

      expect(await readFile(paths.backgroundOutput, 'utf8')).toContain('newest__')
    } finally {
      await controlledPlugin.close()
    }
  })

  it('rechecks an authoring save immediately after compiler close without a second watcher event', async () => {
    const paths = await createFixture()
    const controlledPlugin = createControlledPlugin(paths.root)

    try {
      await writeFile(join(paths.root, paths.background), 'background: first-save\n')
      controlledPlugin.emitChange(join(paths.root, paths.background))
      const deadline = Date.now() + 4_000
      while (
        !controlledPlugin.infoMessages.some(message => message.includes('landing background regenerated'))
        && Date.now() < deadline
      ) await new Promise(resolve => setTimeout(resolve, 5))
      expect(controlledPlugin.infoMessages).toContainEqual(
        expect.stringContaining('landing background regenerated'),
      )

      await writeFile(join(paths.root, paths.background), 'background: post-close\n')
      await waitForFile(paths.compilerCompleted, contents => contents.trim().split('\n').length >= 2)

      expect(await readFile(paths.backgroundOutput, 'utf8')).toContain('post-close')
    } finally {
      await controlledPlugin.close()
    }
  })

  it('stops an in-flight compiler child when the Vite server closes', async () => {
    const paths = await createFixture()
    const server = await createServer({
      configFile: false,
      root: paths.root,
      plugins: [createConfigHotReloadPlugin({ root: paths.root })],
      server: { hmr: false, middlewareMode: true },
    })
    let childPid: number | undefined

    try {
      await new Promise(resolve => setTimeout(resolve, 100))
      await writeFile(join(paths.root, paths.elasticMenu), 'BLOCK\n')
      childPid = Number(await waitForFile(paths.compilerPid, contents => Number.isInteger(Number(contents))))
      expect(processIsAlive(childPid)).toBe(true)

      await server.close()
      await waitForProcessExit(childPid)
    } finally {
      await server.close()
      if (childPid && processIsAlive(childPid)) process.kill(childPid, 'SIGKILL')
    }
  })
})
