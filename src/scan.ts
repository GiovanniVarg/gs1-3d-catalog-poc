import { parts, type Part } from './catalog'
import { readCartLink, type CartItem } from './cart'
import { isValidGtin } from './gtin'

export type ScanResult =
  | { kind: 'part'; id: Part['id'] }
  | { kind: 'gtin'; gtin: string }
  | { kind: 'cart'; items: CartItem[] }
  | { kind: 'unknown' }

function gtinResult(value: string): ScanResult {
  return isValidGtin(value) ? { kind: 'gtin', gtin: value.padStart(14, '0') } : { kind: 'unknown' }
}

export function parseScan(text: string, origin: string): ScanResult {
  const value = text.trim()
  if (/^\d+$/.test(value)) {
    const bare = gtinResult(value)
    if (bare.kind !== 'unknown') return bare
  }
  const element = /^(?:\(01\)(\d{14})(?=$|\(|\x1d)|(?:\][A-Za-z][0-9])?\x1d?01(\d{14}))/.exec(value)
  if (element) return gtinResult(element[1] ?? element[2])

  try {
    const base = new URL(origin)
    const url = new URL(value, base)
    if (url.protocol !== 'https:' && url.protocol !== 'http:') return { kind: 'unknown' }
    // GS1 Digital Links may have a resolver prefix and qualifiers after the primary key.
    const digitalLink = /(?:^|\/)01\/(\d{8,14})(?=\/|$)/.exec(url.pathname)
    if (digitalLink) return gtinResult(digitalLink[1])
    if (url.host === base.host || url.hostname === 'gs1-3d-catalog-poc.vercel.app') {
      const id = /^\/part\/([a-z0-9-]+)\/?$/.exec(url.pathname)?.[1]
      const part = parts.find(entry => entry.id === id)
      if (part) return { kind: 'part', id: part.id }
      const items = readCartLink(url)
      if (items) return { kind: 'cart', items }
    }
  } catch {
    // Malformed URL or origin.
  }
  return { kind: 'unknown' }
}
