import { getHandler, respond } from './_lib/http.js'
import { fetchOffers } from './_lib/offers.js'
import { searches } from './_lib/search.js'

export default getHandler(async (params, res) => {
  const part = params.get('part')
  if (!Object.hasOwn(searches, part)) return respond(res, 404, { error: 'unknown_part' })
  respond(res, 200, await fetchOffers(part), 's-maxage=1800, stale-while-revalidate=86400')
})
