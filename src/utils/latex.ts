import katex from 'katex'

/** Convert a configured engineering unit to valid KaTeX without treating exponents as text. */
export function unitToLatex(unit: string): string {
  if (!unit) return ''

  const mathUnit = unit.replace(/\*/g, '\\cdot ')
  return `\\mathrm{${mathUnit}}`
}

/**
 * Render a LaTeX string to HTML using KaTeX.
 */
export function renderLatex(latex: string, displayMode: boolean = false): string {
  try {
    return katex.renderToString(latex, {
      throwOnError: false,
      displayMode,
      trust: true,
    })
  } catch {
    return `<span class="text-red-400">LaTeX Error: ${latex}</span>`
  }
}

/**
 * Format a number for LaTeX display.
 */
export function numberToLatex(n: number, unit?: string): string {
  if (!isFinite(n)) return '\\text{undefined}'

  let numStr: string
  if (Math.abs(n) >= 1e6 || (Math.abs(n) < 1e-3 && n !== 0)) {
    const exp = Math.floor(Math.log10(Math.abs(n)))
    const mantissa = n / Math.pow(10, exp)
    numStr = `${mantissa.toFixed(3)} \\times 10^{${exp}}`
  } else {
    const rounded = Math.round(n * 1e10) / 1e10
    numStr = Number.isInteger(rounded) ? rounded.toString() : rounded.toPrecision(6).replace(/\.?0+$/, '')
  }

  if (unit) {
    return `${numStr} \\; ${unitToLatex(unit)}`
  }
  return numStr
}
