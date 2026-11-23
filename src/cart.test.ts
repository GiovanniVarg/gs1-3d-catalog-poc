import { describe, expect, it } from 'vitest'
import { decodeCart, encodeCart, readCartLink } from './cart'

describe('shareable parts list', () => {
  it('round-trips IDs and quantities in order', () => {
    const items = [{ id: 'hotend', qty: 1 }, { id: 'psu', qty: 2 }] as const
    expect(encodeCart(items)).toBe('hotend.1,psu.2')
    expect(decodeCart(encodeCart(items))).toEqual(items)
    expect(decodeCart('')).toEqual([])
  })

  it('drops junk and unknown IDs, combines duplicates, and caps quantities', () => {
    expect(decodeCart('abc,unknown.5,__proto__.2,hotend.2,psu.-1,hotend.3,psu.1000,lcd.0,hotbed.1.5,leveling.1e2,frame.99,frame.1')).toEqual([
      { id: 'hotend', qty: 5 }, { id: 'psu', qty: 99 }, { id: 'frame', qty: 99 },
    ])
    expect(encodeCart([{ id: 'psu', qty: 100 }, { id: 'hotbed', qty: NaN }])).toBe('psu.99')
  })

  it('requires a versioned list link, including for intentional empty lists', () => {
    expect(readCartLink(new URL('https://catalog.test/list?v=1&i='))).toEqual([])
    expect(readCartLink(new URL('https://catalog.test/list?v=2&i=psu.1'))).toBeNull()
    expect(readCartLink(new URL('https://catalog.test/list?v=1&i=junk'))).toBeNull()
    expect(readCartLink(new URL('https://catalog.test/list?i=psu.1'))).toBeNull()
    expect(readCartLink(new URL('https://catalog.test/part/hotend?v=1&i=psu.1'))).toBeNull()
  })
})
