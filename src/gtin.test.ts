import { describe, expect, it } from 'vitest'
import { parts } from './catalog'
import { gtinCheckDigit, isValidGtin, parseDigitalLink } from './gtin'

describe('GS1 check digits', () => {
  it('computes check digits with alternating weights from the right', () => {
    expect(gtinCheckDigit('0061414100001')).toBe(2)
    expect(gtinCheckDigit('03600029145')).toBe(2)
    expect(gtinCheckDigit('1234567')).toBe(0)
  })

  it('validates supported lengths and rejects malformed values', () => {
    for (const valid of ['12345670', '036000291452', '0036000291452', '00036000291452']) {
      expect(isValidGtin(valid)).toBe(true)
    }
    for (const invalid of ['12345671', '00036000291453', '36000291452', '', 'abcd5670']) {
      expect(isValidGtin(invalid)).toBe(false)
    }
    expect(() => gtinCheckDigit('123?')).toThrow(TypeError)
  })

  it('generates unique valid example GTINs for every part', () => {
    expect(new Set(parts.map(part => part.gtin)).size).toBe(parts.length)
    expect(parts.every(part => part.gtin.startsWith('00614141') && isValidGtin(part.gtin))).toBe(true)
  })
})

describe('Digital Link routes', () => {
  it.each(['036000291452', '0036000291452', '00036000291452'])('normalizes %s', gtin => {
    expect(parseDigitalLink('/01/' + gtin)).toEqual({ kind: 'part', gtin: '00036000291452' })
  })

  it('normalizes GTIN-8 and tolerates qualifiers and query parameters', () => {
    expect(parseDigitalLink('/01/12345670/10/demo%20lot/21/123?linkType=info')).toEqual({
      kind: 'part', gtin: '00000012345670',
    })
    expect(parseDigitalLink('https://example.com/01/00614141000012/')).toEqual({
      kind: 'part', gtin: '00614141000012',
    })
  })

  it('distinguishes invalid links from catalog routes', () => {
    expect(parseDigitalLink('/01/%FF')).toEqual({ kind: 'invalid', value: '%FF' })
    expect(parseDigitalLink('/01/00614141000013')).toEqual({ kind: 'invalid', value: '00614141000013' })
    expect(parseDigitalLink('/01/')).toEqual({ kind: 'invalid', value: '' })
    expect(parseDigitalLink('/')).toEqual({ kind: 'catalog' })
  })
})
