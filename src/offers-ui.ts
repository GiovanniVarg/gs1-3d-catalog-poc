import * as icon from './icons'
import { formatPrice, hasLivePrice } from './price'

type Source = { host: string; ok: boolean; ms: number; error?: string }
export type Listing = {
  store: string
  host: string
  title: string
  vendor: string | null
  url: string
  image: string | null
  price: number | null
  currency: string | null
  available: boolean | null
  sku: string | null
  barcode: string | null
  gtinValid: boolean
  fetchedAt: string
}
export type Offers = { part: string; fetchedAt: string; sources: Source[]; listings: Listing[] }

export async function fetchPartOffers(id: string, signal?: AbortSignal): Promise<Offers> {
  const response = await fetch('/api/offers?part=' + encodeURIComponent(id), { signal })
  if (!response.ok) throw new Error('Offers request failed')
  return response.json()
}

export function escapeHtml(value: string) {
  const entities: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }
  return value.replace(/[&<>"']/g, char => entities[char])
}

const time = new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit' })

export function listingCard(listing: Listing, index: number, highlight: boolean, bestPrice: boolean) {
  const { currency, available, barcode, gtinValid, fetchedAt } = listing
  const amount = hasLivePrice(listing)
    ? formatPrice(listing.price, listing.currency)
    : 'Price unavailable'
  const stock = available === null ? 'Stock unavailable' : available ? 'In stock' : 'Sold out'
  return `
    <article class="seller${highlight ? ' seller-highlight' : ''}"${highlight ? ' data-highlighted' : ''}>
      <div class="seller-meta"><strong>${escapeHtml(listing.host)}</strong><span class="badge badge-live">LIVE</span></div>
      ${highlight ? '<span class="gtin-match">Matches this GTIN link</span>' : ''}
      ${bestPrice ? `<div class="best-price">${icon.check}<strong>Best price</strong> <small>(in stock, ${escapeHtml(currency!)})</small></div>` : ''}
      <a class="seller-title" href="${escapeHtml(listing.url)}" target="_blank" rel="noopener">${escapeHtml(listing.title)} ${icon.arrowUpRight}</a>
      <div class="seller-price"><strong>${escapeHtml(amount)}</strong><span class="stock ${available ? '' : 'unavailable'}"><i></i>${stock}</span></div>
      <div class="seller-facts"><span>${escapeHtml(listing.vendor || 'Vendor unavailable')}</span><span>SKU ${escapeHtml(listing.sku || 'unavailable')}</span></div>
      <span>Fetched <time datetime="${escapeHtml(fetchedAt)}">${time.format(new Date(fetchedAt))}</time></span>
      ${gtinValid && barcode ? `<div class="seller-gtin"><span>Seller-listed GTIN ${escapeHtml(barcode)}</span>
        <button class="copy-button" type="button" data-show-gtin="${index}">Show GS1 Digital Link</button></div>` : ''}
    </article>
  `
}

export function sourceChips(sources: Source[]) {
  return `<details class="source-status"${sources.every(source => !source.ok) ? ' open' : ''}>
    <summary>Retailer search status · ${sources.filter(source => source.ok).length}/${sources.length} OK</summary>
    <ul class="source-list">${sources.map(({ host, ok, ms, error }) => `
      <li class="${ok ? 'source-ok' : 'source-failed'}" title="${ms} ms${error ? ' · ' + escapeHtml(error) : ''}">
        <span>${escapeHtml(host)}</span><b>${ok ? 'OK' : 'Failed'}</b>
      </li>`).join('')}</ul></details>`
}

export function qrCard(path: string, label: string, note?: string) {
  const uri = escapeHtml(location.origin + path)
  return `
    <div class="digital-card" tabindex="-1">
      <div class="qr-frame"><canvas data-qr="${path}" class="qr-image" role="img" aria-label="${label} QR code"></canvas></div>
      <div class="digital-copy">
        <strong>${label}</strong>
        ${note ? `<p>${escapeHtml(note)}</p>` : ''}
        <a class="digital-uri" href="${path}">${uri}</a>
        <button class="copy-button" type="button" data-copy="${path}">${icon.copy} Copy link</button>
      </div>
    </div>
  `
}

export function renderQr(content: HTMLElement) {
  for (const canvas of content.querySelectorAll<HTMLCanvasElement>('[data-qr]')) {
    void import('qrcode').then(({ toCanvas }) =>
      toCanvas(canvas, location.origin + canvas.dataset.qr, {
        scale: 6, margin: 4, color: { dark: '#08090b', light: '#ffffff' },
      }),
    ).catch(() => { canvas.hidden = true })
  }
}
