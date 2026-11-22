import { writeFile } from 'node:fs/promises'
import { fetchOffers } from '../api/_lib/offers.js'
import { searches } from '../api/_lib/search.js'

const snapshot = {}
let successfulSources = 0
for (const partId of Object.keys(searches)) {
  const { listings, sources } = await fetchOffers(partId)
  const successful = sources.filter(source => source.ok).length
  successfulSources += successful
  console.log(`${partId}: ${listings.length} variants, ${successful}/${sources.length} successful stores`)
  for (const { barcode, gtinValid, store, title, url, fetchedAt } of listings) {
    if (!gtinValid) continue
    const gtin = barcode.padStart(14, '0')
    snapshot[gtin] ??= { gtin, partId, store, title, url, capturedAt: fetchedAt }
  }
}
if (!successfulSources) throw new Error('All retailer requests failed. The snapshot was left in place.')
const count = Object.keys(snapshot).length
if (!count) throw new Error('No valid seller-listed GTINs were returned. The snapshot was left in place.')
await writeFile(new URL('../src/gtin-snapshot.json', import.meta.url), JSON.stringify(snapshot, null, 2) + '\n')
console.log(`Captured ${count} distinct seller-listed GTINs.`)
