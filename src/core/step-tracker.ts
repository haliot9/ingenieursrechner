import type { SolutionStep } from './types'

/**
 * StepTracker provides utilities for formatting and displaying solution steps.
 */
export class StepTracker {
  private steps: SolutionStep[] = []

  setSteps(steps: SolutionStep[]): void {
    this.steps = [...steps]
  }

  getSteps(): SolutionStep[] {
    return this.steps
  }

  getStepCount(): number {
    return this.steps.length
  }

  /** Get step that computed a specific variable */
  getStepForVariable(variableId: string): SolutionStep | undefined {
    return this.steps.find(s => s.targetVariable === variableId)
  }

  /** Generate full LaTeX for a step (multi-line display) */
  formatStepLatex(step: SolutionStep): string[] {
    return [
      `\\text{${step.explanation}}`,
      `\\text{Formel: } ${step.originalLatex}`,
      `\\text{Umgestellt: } ${step.rearrangedLatex}`,
      `\\text{Eingesetzt: } ${step.substitutedLatex}`,
      `\\boxed{${step.resultLatex}}`,
    ]
  }

  /** Generate a summary of all computation steps */
  formatAllStepsLatex(): string[][] {
    return this.steps.map(step => this.formatStepLatex(step))
  }

  clear(): void {
    this.steps = []
  }
}
