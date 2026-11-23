export type PricedListing = { price: number | null; currency: string | null; available: boolean | null }
export type PriceOrder = 'lowest' | 'match'

export function hasLivePrice<T extends PricedListing>(listing: T): listing is T & { price: number; currency: string } {
  return listing.price !== null && Number.isFinite(listing.price) && listing.currency !== null && /^[A-Z]{3}$/.test(listing.currency)
}

export function sortListings<T extends PricedListing>(listings: readonly T[], order: PriceOrder = 'lowest'): T[] {
  if (order === 'match') return [...listings]
  const currencies = new Map<string, (T & { price: number })[]>()
  const remaining: T[] = []
  for (const listing of listings) {
    if (listing.available !== true || !hasLivePrice(listing)) {
      remaining.push(listing)
      continue
    }
    const group = currencies.get(listing.currency)
    if (group) group.push(listing)
    else currencies.set(listing.currency, [listing])
  }
  const ranked = [...currencies.values()].flatMap(group => group.sort((a, b) => a.price - b.price))
  return [...ranked, ...remaining]
}

export function bestPriceIds<T extends PricedListing, Id>(listings: readonly T[], identify: (listing: T, index: number) => Id): Set<Id> {
  const cheapest = new Map<string, { price: number; id: Id }>()
  listings.forEach((listing, index) => {
    if (listing.available !== true || !hasLivePrice(listing)) return
    const previous = cheapest.get(listing.currency)
    if (!previous || listing.price < previous.price) {
      cheapest.set(listing.currency, { price: listing.price, id: identify(listing, index) })
    }
  })
  return new Set([...cheapest.values()].map(({ id }) => id))
}

export function formatPrice(amount: number, currency: string) {
  return new Intl.NumberFormat(undefined, { style: 'currency', currency, currencyDisplay: 'code' }).format(amount)
}
