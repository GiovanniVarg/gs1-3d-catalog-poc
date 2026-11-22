import { isValidGtin } from './_lib/check-digit.js'
import { fetchJson, getHandler, respond } from './_lib/http.js'

const cache = 's-maxage=86400'
const provider = 'UPCitemdb'

export default getHandler(async (params, res) => {
  const gtin = params.get('gtin')
  if (!isValidGtin(gtin)) return respond(res, 400, { error: 'invalid_gtin' })
  try {
    const data = await fetchJson(`https://api.upcitemdb.com/prod/trial/lookup?upc=${gtin}`)
    if (data.code === 'EXCEED_LIMIT') return respond(res, 200, { error: 'rate_limited' }, cache)
    if (data.code !== 'OK') return respond(res, 502, { error: 'lookup_unavailable' })
    const items = (data.items || []).map(item => ({
      title: item.title || null, brand: item.brand || null, model: item.model || null,
      offersCount: Array.isArray(item.offers) ? item.offers.length : null,
    }))
    respond(res, 200, { gtin, source: provider, items }, cache)
  } catch (error) {
    if (error.status === 429) return respond(res, 200, { error: 'rate_limited' }, cache)
    respond(res, 502, { error: 'lookup_unavailable' })
  }
})
