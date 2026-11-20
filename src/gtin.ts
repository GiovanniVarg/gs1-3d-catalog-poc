const gtinLength = /^(?:\d{8}|\d{12,14})$/

export function gtinCheckDigit(body: string): number {
  if (!/^\d+$/.test(body)) throw new TypeError('A GTIN body must contain digits')
  const sum = [...body].reverse().reduce((total, digit, index) =>
    total + Number(digit) * (index % 2 === 0 ? 3 : 1), 0)
  return (10 - sum % 10) % 10
}

export function isValidGtin(value: string): boolean {
  return gtinLength.test(value) && Number(value.at(-1)) === gtinCheckDigit(value.slice(0, -1))
}

export type DigitalLink =
  | { kind: 'catalog' }
  | { kind: 'invalid'; value: string }
  | { kind: 'part'; gtin: string }

export function parseDigitalLink(input: string): DigitalLink {
  let pathname: string
  try {
    pathname = new URL(input, 'https://example.com').pathname
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
