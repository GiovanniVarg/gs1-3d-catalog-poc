import { describe, expect, it } from 'vitest'
import { bestPriceIds, sortListings } from './price'

const listings = [
  { id: 'us-premium', currency: 'USD', price: 35, available: true },
  { id: 'ca-premium', currency: 'CAD', price: 16, available: true },
  { id: 'unpriced', currency: 'USD', price: null, available: true },
  { id: 'sold-out', currency: 'USD', price: 2, available: false },
  { id: 'us-best', currency: 'USD', price: 22, available: true },
  { id: 'ca-best', currency: 'CAD', price: 9, available: true },
  { id: 'ca-tie', currency: 'CAD', price: 9, available: true },
  { id: 'unknown-stock', currency: 'USD', price: 1, available: null },
  { id: 'unknown-currency', currency: null, price: 1, available: true },
  { id: 'gb-sold-out', currency: 'GBP', price: 3, available: false },
]

describe('currency-aware prices', () => {
  it('groups in-stock prices by currency and sorts only within those groups', () => {
    const order = sortListings(listings).map(listing => listing.id)
    expect(order).toEqual([
      'us-best', 'us-premium', 'ca-best', 'ca-tie', 'ca-premium',
      'unpriced', 'sold-out', 'unknown-stock', 'unknown-currency', 'gb-sold-out',
    ])
    expect(sortListings(listings, 'match')).toEqual(listings)
    expect(listings[0].id).toBe('us-premium')
  })

  it('identifies one priced in-stock winner per currency, keeping the first on a tie', () => {
    expect(bestPriceIds(listings, listing => listing.id)).toEqual(new Set(['us-best', 'ca-best']))
    expect(bestPriceIds([], listing => listing)).toEqual(new Set())
  })
})
