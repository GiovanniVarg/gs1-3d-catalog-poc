import { parts, type Part } from './catalog'

export type CartItem = { id: Part['id']; qty: number }

export function isCartPath(pathname: string) {
  return /^\/list\/?$/.test(pathname)
}

const ids = new Map(parts.map(part => [part.id as string, part.id]))

export function decodeCart(encoded: string): CartItem[] {
  const items = new Map<Part['id'], number>()
  for (const entry of encoded.split(',')) {
    const match = /^([a-z0-9-]+)\.([0-9]+)$/.exec(entry)
    const id = match && ids.get(match[1])
    const qty = match ? Number(match[2]) : 0
    if (!id || qty < 1) continue
    items.set(id, Math.min(99, (items.get(id) ?? 0) + qty))
  }
  return [...items].map(([id, qty]) => ({ id, qty }))
}

export function encodeCart(items: readonly CartItem[]): string {
  const encoded = items.map(({ id, qty }) => `${id}.${qty}`).join(',')
  return decodeCart(encoded).map(({ id, qty }) => `${id}.${qty}`).join(',')
}

export function readCartLink(url: URL): CartItem[] | null {
  const items = url.searchParams.get('i')
  if (!isCartPath(url.pathname) || url.searchParams.get('v') !== '1' || items === null) return null
  const decoded = decodeCart(items)
  return items && !decoded.length ? null : decoded
}
