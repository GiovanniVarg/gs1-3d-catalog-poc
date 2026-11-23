import { describe, expect, it } from 'vitest'
import { parseScan } from './scan'
import { gtinCheckDigit } from './gtin'

const origin = 'https://catalog.test:8443'
const gtin = '00036000291452'

describe('camera and pasted scan parsing', () => {
  it.each([
    '/part/hotend',
    origin + '/part/hotend/?q=1#bom',
    'https://gs1-3d-catalog-poc.vercel.app/part/hotend',
  ])('recognizes an app deep link %s', text => {
    expect(parseScan(text, origin)).toEqual({ kind: 'part', id: 'hotend' })
  })

  it.each([
    'https://example.org/01/036000291452/10/LOT/21/serial?17=270101',
    'https://example.org/resolver/01/036000291452?sample=1',
    '/01/036000291452/10/LOT',
    ' 036000291452 ',
    '0036000291452',
    gtin,
    '(01)' + gtin,
    '(01)' + gtin + '(10)LOT',
    '01' + gtin,
    '01' + gtin + '10LOT\x1d21serial',
    ']Q3\x1d01' + gtin + '10LOT\x1d21serial',
  ])('reads GTINs from %s', text => {
    expect(parseScan(text, origin)).toEqual({ kind: 'gtin', gtin })
  })

  it('validates GTIN-8 and normalizes its padding', () => {
    const body = '7351353'
    const short = body + gtinCheckDigit(body)
    expect(parseScan(short, origin)).toEqual({ kind: 'gtin', gtin: short.padStart(14, '0') })
  })

  it.each(['/list?v=1&i=hotend.1%2Cpsu.2', 'https://gs1-3d-catalog-poc.vercel.app/list?v=1&i=hotend.1,psu.2'])(
    'recognizes a versioned list URL %s', text => {
      expect(parseScan(text, origin)).toEqual({ kind: 'cart', items: [{ id: 'hotend', qty: 1 }, { id: 'psu', qty: 2 }] })
    },
  )

  it.each([
    '', 'garbage', 'https://example.org/part/hotend', 'https://catalog.test/part/hotend', '/part/unknown',
    '036000291453', 'https://example.org/01/036000291453/21/serial', '(01)00036000291453',
    '0100036000291453', 'javascript:/01/036000291452', 'https://example.org/list?v=1&i=psu.2',
    '/list?v=2&i=psu.2', '/list?v=1&i=unknown.2',
  ])('rejects unsupported or invalid input %s', text => {
    expect(parseScan(text, origin)).toEqual({ kind: 'unknown' })
  })
})
