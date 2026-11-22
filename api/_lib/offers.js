import { isValidGtin } from './check-digit.js'
import { fetchJson } from './http.js'
import { searches } from './search.js'

const stores = {
  'printedsolid.com': 'Printed Solid',
  'store.micro-swiss.com': 'Micro Swiss',
  'e3d-online.com': 'E3D',
  'www.fabreeko.com': 'Fabreeko',
  'west3d.com': 'West3D',
  'www.3dprintingcanada.com': '3D Printing Canada',
  'www.digitmakers.ca': 'DigitMakers',
}
const currencies = new Map()
const currencyTtl = 30 * 60 * 1000

async function getCurrency(host, signal) {
  const cached = currencies.get(host)
  if (cached && cached.expires > Date.now()) return cached.currency
  const { currency } = await fetchJson(`https://${host}/cart.js`, signal)
  if (typeof currency !== 'string' || !/^[A-Z]{3}$/.test(currency)) throw new Error('Cart currency unavailable')
  currencies.set(host, { currency, expires: Date.now() + currencyTtl })
  return currency
}

function imageUrl(value, origin) {
  if (typeof value !== 'string' || !value) return null
  try {
    const image = new URL(value, origin)
    return image.protocol === 'https:' ? image.href : null
  } catch {
    return null
  }
}

async function getProduct(origin, handle, signal) {
  const product = await fetchJson(`${origin}/products/${handle}.js`, signal)
  if (typeof product.title !== 'string' || !Array.isArray(product.variants)) throw new Error('Unexpected product response')
  return product
}

function describeError(error) {
  return error?.name === 'TimeoutError' ? 'Timed out' : error?.message || 'Request failed'
}

async function searchStore(host, store, search) {
  const signal = AbortSignal.timeout(6000)
  const origin = `https://${host}`
  const params = new URLSearchParams({ q: search.query, 'resources[type]': 'product', 'resources[limit]': '6' })
  const result = await fetchJson(`${origin}/search/suggest.json?${params}`, signal)
  const products = result.resources?.results?.products
  if (!Array.isArray(products)) throw new Error('Unexpected search response')
  const matches = [...new Set(products.filter(product =>
    typeof product.title === 'string' && search.mustMatch.test(product.title) && !search.excludes.test(product.title)
    && typeof product.handle === 'string' && /^[\w-]+$/.test(product.handle)
  ).map(product => product.handle))].slice(0, 2)
  if (!matches.length) return { listings: [] }

  const [currencyResult, ...results] = await Promise.allSettled([
    getCurrency(host, signal),
    ...matches.map(handle => getProduct(origin, handle, signal)),
  ])
  const currency = currencyResult.status === 'fulfilled' ? currencyResult.value : null
  const errors = [currencyResult, ...results].filter(result => result.status === 'rejected')
  const fetchedAt = new Date().toISOString()
  const listings = results.flatMap((result, index) => {
    if (result.status !== 'fulfilled') return []
    const product = result.value
    return product.variants.map(variant => {
      const barcode = typeof variant.barcode === 'string' ? variant.barcode.trim() : null
      return {
        store, host, title: product.title, vendor: product.vendor || null,
        url: `${origin}/products/${matches[index]}${Number.isSafeInteger(variant.id) ? `?variant=${variant.id}` : ''}`,
        image: imageUrl(variant.featured_image?.src || product.featured_image, origin),
        price: Number.isSafeInteger(variant.price) && variant.price >= 0 ? variant.price / 100 : null,
        currency,
        available: typeof variant.available === 'boolean' ? variant.available : null,
        sku: variant.sku || null,
        barcode: barcode || null,
        // Shopify stores often auto-fill short barcodes from variant IDs; only trust 12-14 digit codes that are not the variant ID tail.
        gtinValid: Boolean(barcode && /^\d{12,14}$/.test(barcode) && !String(variant.id ?? '').endsWith(barcode) && isValidGtin(barcode)),
        fetchedAt,
      }
    })
  })
  return {
    error: errors.length ? errors.map(result => describeError(result.reason)).join(', ') : undefined,
    listings,
  }
}

export async function fetchOffers(part) {
  const search = searches[part]
  const fetchedAt = new Date().toISOString()
  const durations = new Map()
  const entries = search ? Object.entries(stores) : []
  const results = await Promise.allSettled(entries.map(([host, store]) => {
    const start = Date.now()
    return searchStore(host, store, search).finally(() => durations.set(host, Date.now() - start))
  }))
  const sources = results.map((result, index) => {
    const host = entries[index][0]
    const error = result.status === 'fulfilled' ? result.value.error : describeError(result.reason)
    return { host, ok: !error, ms: durations.get(host), ...(error && { error }) }
  })
  const listings = results.flatMap(result => result.status === 'fulfilled' ? result.value.listings : [])
  const stockRank = value => value === true ? 0 : value === false ? 1 : 2
  listings.sort((a, b) => stockRank(a.available) - stockRank(b.available)
    || (a.price ?? Infinity) - (b.price ?? Infinity))
  return { part, fetchedAt, sources, listings }
}
