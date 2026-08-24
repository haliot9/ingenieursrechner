import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { parse } from 'yaml'

interface WorkflowStep {
  name?: string
  run?: string
  env?: Record<string, string>
}

interface WorkflowJob {
  name?: string
  needs?: string | string[]
  if?: string
  strategy?: {
    matrix?: Record<string, unknown>
  }
  steps?: WorkflowStep[]
}

interface Workflow {
  jobs?: Record<string, WorkflowJob>
}

interface PackageManifest {
  scripts?: Record<string, string>
}

const workflowPath = resolve(process.cwd(), '.github/workflows/ci.yml')
const deploymentPath = resolve(process.cwd(), '.github/workflows/deploy-pages.yml')
const packagePath = resolve(process.cwd(), 'package.json')

function requireJob(workflow: Workflow, jobId: string): WorkflowJob {
  const job = workflow.jobs?.[jobId]
  if (!job) throw new Error(`CI workflow is missing required job: ${jobId}`)
  return job
}

function requireStep(job: WorkflowJob, name: string): WorkflowStep {
  const step = job.steps?.find(candidate => candidate.name === name)
  if (!step) throw new Error(`CI job is missing required step: ${name}`)
  return step
}

describe('pull-request CI ownership', () => {
  it('requires isolated desktop and mobile browser gates before the protected verify result', async () => {
    const workflow = parse(await readFile(workflowPath, 'utf8')) as Workflow
    const deployment = parse(await readFile(deploymentPath, 'utf8')) as Workflow
    const packageManifest = JSON.parse(await readFile(packagePath, 'utf8')) as PackageManifest
    const quality = requireJob(workflow, 'quality')
    const browser = requireJob(workflow, 'browser')
    const verify = requireJob(workflow, 'verify')

    expect(requireStep(quality, 'Run tests').run).toBe('npm test')
    expect(requireStep(quality, 'Run lint').run).toBe('npm run lint')
    expect(requireStep(quality, 'Run production build').run).toBe('npm run build')
    expect(requireStep(quality, 'Audit runtime dependencies').run).toBe('npm run audit:production')

    expect(browser.needs).toBe('quality')
    expect(browser.strategy?.matrix?.project).toEqual([
      'desktop-chromium',
      'mobile-chromium',
    ])
    expect(requireStep(browser, 'Run isolated browser journeys').run).toBe(
      'npm run test:e2e:release -- --project="${{ matrix.project }}" --workers=1 --reporter=line',
    )
    expect(packageManifest.scripts?.['test:e2e:release']).toBe(
      'npm run build && playwright test e2e/routing-calculator.spec.ts e2e/theme-control-materials.spec.ts e2e/line-field-renderer.spec.ts e2e/performance.spec.ts',
    )
    expect(packageManifest.scripts?.['test:e2e:full']).toBe('npm run build && playwright test')
    expect(requireStep(requireJob(deployment, 'build'), 'Run production build and browser journeys').run)
      .toBe('npm run test:e2e:release')

    expect(verify.name).toBe('verify')
    expect(verify.if).toBe('always()')
    expect(verify.needs).toEqual(['quality', 'browser'])

    const gate = requireStep(verify, 'Require every release gate')
    expect(gate.env).toEqual({
      QUALITY_RESULT: '${{ needs.quality.result }}',
      BROWSER_RESULT: '${{ needs.browser.result }}',
    })
    expect(gate.run).toContain('QUALITY_RESULT" = "success')
    expect(gate.run).toContain('BROWSER_RESULT" = "success')
  })
})
