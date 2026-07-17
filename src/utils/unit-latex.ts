/** Convert a configured engineering unit to valid KaTeX without treating exponents as text. */
export function unitToLatex(unit: string): string {
  if (!unit) return ''

  const mathUnit = unit.replace(/\*/g, '\\cdot ')
  return `\\mathrm{${mathUnit}}`
}
