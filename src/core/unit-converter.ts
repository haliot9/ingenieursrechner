import { unit } from 'mathjs'

/**
 * Unit conversion utilities using math.js unit system.
 */

/** Convert a value from one unit to another */
export function convertUnit(value: number, fromUnit: string, toUnit: string): number {
  try {
    const result = unit(value, fromUnit).to(toUnit)
    return result.toNumber(toUnit)
  } catch {
    throw new Error(`Einheitenkonvertierung fehlgeschlagen: ${fromUnit} → ${toUnit}`)
  }
}

/** Check if two units are compatible (can be converted) */
export function unitsCompatible(unit1: string, unit2: string): boolean {
  try {
    unit(1, unit1).to(unit2)
    return true
  } catch {
    return false
  }
}

/** Convert to SI base unit */
export function toSI(value: number, fromUnit: string): { value: number; unit: string } {
  try {
    const u = unit(value, fromUnit)
    const si = u.toSI()
    return {
      value: si.toNumber(),
      unit: si.toString().replace(/[\d.\s]+/, '').trim(),
    }
  } catch {
    return { value, unit: fromUnit }
  }
}

/** Temperature conversions (special case because of offset) */
export function convertTemperature(value: number, from: 'K' | 'degC' | 'degF', to: 'K' | 'degC' | 'degF'): number {
  return convertUnit(value, from, to)
}

/** Pressure common conversions */
export const PRESSURE_UNITS = ['Pa', 'kPa', 'MPa', 'bar', 'atm', 'psi']
export const TEMPERATURE_UNITS = ['K', 'degC']
export const VOLUME_UNITS = ['m^3', 'L', 'cm^3']
export const ENERGY_UNITS = ['J', 'kJ', 'MJ', 'Wh', 'kWh']
export const SPECIFIC_ENERGY_UNITS = ['J/kg', 'kJ/kg']
