import { isValidGtin } from '../api/_lib/check-digit.js'
export { gtinCheckDigit, isValidGtin } from '../api/_lib/check-digit.js'

export type DigitalLink =
  | { kind: 'catalog' }
  | { kind: 'invalid'; value: string }
  | { kind: 'part'; gtin: string }

export function parseDigitalLink(input: string): DigitalLink {
  let pathname: string
  try {
    pathname = new URL(input, 'https://catalog.invalid').pathname
  } catch {
    return { kind: 'catalog' }
  }
  const [, identifier, raw = ''] = pathname.split('/')
  if (identifier !== '01') return { kind: 'catalog' }
  let value: string
  try {
    value = decodeURIComponent(raw)
  } catch {
    return { kind: 'invalid', value: raw }
  }
  if (!isValidGtin(value)) return { kind: 'invalid', value }
  return { kind: 'part', gtin: value.padStart(14, '0') }
}
