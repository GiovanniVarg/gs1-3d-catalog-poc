import { decodeCart, encodeCart, isCartPath, type CartItem } from './cart'
import { parts } from './catalog'
import { bestPriceIds, formatPrice, hasLivePrice } from './price'
import { escapeHtml, fetchPartOffers, type Offers } from './offers-ui'
import * as icon from './icons'

const storageKey = 'gs1catalog.list.v1'
const byId = new Map(parts.map(part => [part.id, part]))
const timeFormat = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' })
type PriceState = { status: 'loading' | 'error' } | { status: 'ready'; offers: Offers }

export function initCart(dialog: HTMLDialogElement, onChange: () => void, onClose: () => void) {
  let items: CartItem[] = []
  try { items = decodeCart(localStorage.getItem(storageKey) ?? '') } catch { /* the list still works without storage */ }
  let undoItems: CartItem[] | undefined
  let pricing = new Map<CartItem['id'], PriceState>()
  let session: AbortController | undefined
  dialog.innerHTML = `
    <header class="cart-heading">
      <div><div class="eyebrow">Creality Ender-3</div><h2 id="cart-title">Parts list</h2><p id="cart-count"></p></div>
      <button class="icon-button" type="button" data-close aria-label="Close parts list">${icon.x}</button>
    </header>
    <div class="cart-undo" hidden><span role="status">Replaced your list</span> <button type="button" class="copy-button" data-undo>Undo</button></div>
    <div class="cart-body">
      <p class="cart-fit" hidden><span class="badge">UNVERIFIED</span> Check each retailer listing for compatibility.</p>
      <div class="cart-items"></div>
    </div>
    <div class="cart-summary">
      <div class="cart-totals" aria-live="polite"></div>
      <p class="cart-fetched"></p>
      <div class="cart-share-actions">
        <button type="button" class="primary-link" data-copy-share>${icon.copy} Copy link</button>
        <button type="button" class="copy-button" data-native-share hidden>${icon.share} Share</button>
        <button type="button" class="copy-button" data-clear-cart>Clear list</button>
      </div>
      <div class="share-result" hidden><label for="cart-url">Share link</label><input id="cart-url" type="url" readonly><p role="status"></p></div>
    </div>`
  const get = <T extends HTMLElement = HTMLElement>(selector: string) => dialog.querySelector<T>(selector)!
  const rows = get('.cart-items')
  const shareResult = get('.share-result')
  const urlInput = get<HTMLInputElement>('#cart-url')
  const nativeShare = get<HTMLButtonElement>('[data-native-share]')
  nativeShare.hidden = typeof navigator.share !== 'function'

  function save() {
    try { localStorage.setItem(storageKey, encodeCart(items)) } catch { /* storage unavailable */ }
    onChange()
  }

  function shareUrl() {
    const url = new URL('/list', location.origin)
    url.searchParams.set('v', '1')
    url.searchParams.set('i', encodeCart(items))
    return url.href
  }

  function renderPrices(changedId?: CartItem['id']) {
    const totals = new Map<string, number>()
    const timestamps = new Set<string>()
    for (const { id, qty } of items) {
      const slot = changedId && changedId !== id ? null : rows.querySelector<HTMLElement>(`[data-price-for="${id}"]`)
      const state = pricing.get(id)
      if (!byId.get(id)?.live) {
        if (slot) slot.textContent = 'No live lookup for this part.'
      }
      else if (state?.status === 'error') {
        if (slot) slot.innerHTML = `<span>Retailer data unavailable.</span> <button class="copy-button" type="button" data-retry-price="${id}">Retry</button>`
      } else if (state?.status === 'ready') {
        const { listings, fetchedAt } = state.offers
        timestamps.add(fetchedAt)
        const cheapest = bestPriceIds(listings, listing => listing)
        const links = [...cheapest].map(listing => {
          if (!hasLivePrice(listing)) return ''
          const { currency, price, host, url, title } = listing
          totals.set(currency, (totals.get(currency) ?? 0) + qty * price)
          return `<a class="cart-offer" href="${escapeHtml(url)}" title="${escapeHtml(title)}" target="_blank" rel="noopener">
            <strong>${formatPrice(price, currency)}</strong><span>${escapeHtml(host)} ${icon.arrowUpRight}</span></a>`
        }).join('')
        if (slot) slot.innerHTML = links || 'No priced in-stock listings found.'
      } else if (slot) slot.textContent = 'Checking live prices…'
    }
    get('.cart-totals').innerHTML = [...totals].map(([currency, total]) =>
      `<div><span>Subtotal · ${currency}</span><strong>${formatPrice(total, currency)}</strong></div>`).join('')
    const times = [...new Set([...timestamps].sort().map(timestamp => timeFormat.format(new Date(timestamp))))]
    get('.cart-fetched').textContent = times.length
      ? `Live prices fetched ${times[0]}${times.length > 1 ? ' – ' + times.at(-1) : ''}; not a checkout`
      : 'Live retailer prices when available · Not a checkout'
  }

  function render() {
    const count = items.length
    get('#cart-count').textContent = `${count} ${count === 1 ? 'part' : 'parts'}`
    get('.cart-undo').hidden = undoItems === undefined
    get('.cart-fit').hidden = !count
    for (const selector of ['[data-copy-share]', '[data-clear-cart]', '[data-native-share]']) {
      get<HTMLButtonElement>(selector).disabled = !count
    }
    rows.innerHTML = count ? items.map(({ id, qty }) => {
      const part = byId.get(id)!
      return `<article class="cart-row">
        <header><div><p>${part.category}</p><h3>${part.name}</h3></div>
          <label class="cart-qty">Qty<input type="number" min="1" max="99" step="1" inputmode="numeric" value="${qty}" data-qty="${id}" aria-label="Quantity for ${part.name}"></label>
          <button type="button" data-remove="${id}" class="icon-button" aria-label="Remove ${part.name}">${icon.x}</button>
        </header><div class="cart-prices" data-price-for="${id}"></div>
      </article>`
    }).join('') : '<div class="cart-empty"><h3>Your list is empty</h3><p>Open a part and choose Add to list to compare live prices here.</p></div>'
    renderPrices()
  }

  function loadPrices(id: CartItem['id']) {
    if (!session || !byId.get(id)?.live || pricing.has(id)) return
    const { signal } = session
    pricing.set(id, { status: 'loading' })
    void fetchPartOffers(id, signal).then(offers => {
      if (signal.aborted) return
      pricing.set(id, offers.sources.some(source => source.ok) ? { status: 'ready', offers } : { status: 'error' })
    }).catch(() => {
      if (!signal.aborted) pricing.set(id, { status: 'error' })
    }).finally(() => {
      if (!signal.aborted) renderPrices(id)
    })
  }

  function saveLocalChanges() {
    undoItems = undefined
    shareResult.hidden = true
    if (isCartPath(location.pathname) && location.search) history.replaceState(null, '', location.pathname)
    save()
  }

  function update(next: CartItem[]) {
    items = next
    saveLocalChanges()
    if (dialog.open) {
      items.forEach(({ id }) => loadPrices(id))
      render()
    }
  }

  function open() {
    if (dialog.open) return
    session = new AbortController()
    pricing = new Map()
    shareResult.hidden = true
    items.forEach(({ id }) => loadPrices(id))
    render()
    dialog.showModal()
  }

  function restore(next: CartItem[]) {
    if (encodeCart(next) !== encodeCart(items)) {
      undoItems = items
      items = next
      save()
    }
    if (dialog.open) {
      shareResult.hidden = true
      items.forEach(({ id }) => loadPrices(id))
      render()
    } else open()
  }

  function toggle(id: CartItem['id']) {
    update(items.some(item => item.id === id) ? items.filter(item => item.id !== id) : [...items, { id, qty: 1 }])
  }

  rows.addEventListener('change', event => {
    const input = event.target as HTMLInputElement
    if (!input.dataset.qty) return
    const item = items.find(entry => entry.id === input.dataset.qty)
    if (!item) return
    item.qty = Math.max(1, Math.min(99, Math.trunc(input.valueAsNumber || 1)))
    input.value = String(item.qty)
    saveLocalChanges()
    get('.cart-undo').hidden = true
    renderPrices(item.id)
  })

  dialog.addEventListener('click', async event => {
    const target = event.target as Element
    if (target === dialog) dialog.close()
    const button = target.closest<HTMLButtonElement>('button')
    if (!button) return
    if (button.hasAttribute('data-close')) dialog.close()
    if (button.hasAttribute('data-undo') && undoItems) update(undoItems)
    if (button.hasAttribute('data-clear-cart')) update([])
    if (button.dataset.remove) {
      update(items.filter(item => item.id !== button.dataset.remove))
      const focusTarget = rows.querySelector<HTMLButtonElement>('[data-remove]') ?? get('[data-close]')
      focusTarget.focus()
    }
    if (button.dataset.retryPrice) {
      const id = button.dataset.retryPrice as CartItem['id']
      pricing.delete(id)
      loadPrices(id)
      renderPrices()
    }
    if (button.hasAttribute('data-copy-share')) {
      urlInput.value = shareUrl()
      shareResult.hidden = false
      const status = shareResult.querySelector('p')!
      try {
        await navigator.clipboard.writeText(urlInput.value)
        status.textContent = 'Link copied'
      } catch {
        urlInput.select()
        status.textContent = 'Select and copy the share link above.'
      }
    }
    if (button.hasAttribute('data-native-share')) {
      try {
        await navigator.share({ title: 'Creality Ender-3 parts list', url: shareUrl() })
      } catch (error) {
        if (!(error instanceof DOMException && error.name === 'AbortError')) {
          urlInput.value = shareUrl()
          shareResult.hidden = false
          shareResult.querySelector('p')!.textContent = 'Select and copy the share link above.'
        }
      }
    }
  })
  dialog.addEventListener('close', () => {
    if (dialog.open) return
    session?.abort()
    undoItems = undefined
    onClose()
  })

  return { open, restore, toggle, close: () => { if (dialog.open) dialog.close() },
    has: (id: CartItem['id']) => items.some(item => item.id === id), get count() { return items.length } }
}
