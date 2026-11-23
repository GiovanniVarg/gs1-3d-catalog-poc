import '@fontsource-variable/geist/wght.css'
import '@fontsource-variable/jetbrains-mono/wght.css'
import './style.css'
import { bomUrl, cadUrl, categories, partPath, parts, type Category, type Part } from './catalog'
import snapshotJson from './gtin-snapshot.json'
import { escapeHtml, listingCard, qrCard, renderQr, sourceChips, type Listing, type Offers } from './offers-ui'
import { parseDigitalLink } from './gtin'
import * as icon from './icons'
import type { Viewer } from './viewer'

const sourceUrl = 'https://www.gs1us.org/industries-and-insights/by-topic/sunrise-2027'
const studioCredit = '<a href="https://mainstaydigital.com">Built by Mainstay Digital</a>'
const disclaimer = 'Not affiliated with or endorsed by Creality or GS1 US.'
const iconsByCategory: Record<Category, string> = {
  Toolhead: icon.settings, Motion: icon.circleDot, 'Build platform': icon.layers,
  Electronics: icon.lightbulb, 'Frame & hardware': icon.box,
}
const snapshot: Record<string, { gtin: string; partId: string; store: string; title: string; url: string; capturedAt: string }> = snapshotJson
const app = document.querySelector<HTMLDivElement>('#app')!

app.innerHTML = `
  <header class="site-header">
    <div class="header-content">
      <a class="brand" href="/" aria-label="Parts Catalog 3D home">
        <img src="/brand/logo.webp" width="1254" height="200" alt="Mainstay Digital">
        <span>Parts Catalog 3D</span>
      </a>
      <div class="header-actions">
        <span class="live-pill"><i></i>Live data</span>
        <button id="sunrise-button" class="sunrise-pill" type="button">Sunrise 2027 ${icon.arrowUpRight}</button>
      </div>
    </div>
  </header>
  <main class="page">
    <section class="intro" aria-labelledby="page-title">
      <div>
        <div class="eyebrow">Interactive 3D parts catalog · Live retail data</div>
        <h1 id="page-title">Creality <span>Ender-3</span></h1>
        <p>Explore the printer in 3D and find replacement parts.</p>
      </div>
      <dl class="data-legend" aria-label="Data labels">
        <div><dt><span class="badge">BOM</span></dt><dd>From Creality’s published BOM</dd></div>
        <div><dt><span class="badge badge-live">LIVE</span></dt><dd>Fetched from retailer just now</dd></div>
        <div><dt><span class="badge">UNVERIFIED</span></dt><dd>Compatibility unconfirmed</dd></div>
      </dl>
    </section>

    <div class="workspace">
      <aside class="catalog-panel card" id="catalog-panel" aria-labelledby="parts-title">
        <div class="catalog-head">
          <div class="panel-heading">
            <div><h2 id="parts-title">Parts catalog</h2><p id="part-count"></p></div>
            <button id="close-parts" class="icon-button mobile-only" type="button" aria-label="Close parts list">${icon.x}</button>
          </div>
          <label class="search-box">
            ${icon.search}<input type="search" id="part-search" placeholder="Search parts…" aria-label="Search by name, Creality part code, or category">
            <kbd aria-hidden="true">/</kbd>
          </label>
          <label class="category-box">
            <select id="category" aria-label="Part category">
              <option value="">All categories</option>
              ${categories.map(category => `<option>${category}</option>`).join('')}
            </select>
            ${icon.chevronDown}
          </label>
        </div>
        <div id="parts-list" class="parts-list"></div>
      </aside>

      <section class="stage card" aria-label="Interactive printer viewer">
        <canvas id="model" aria-label="3D Creality Ender-3. Use the parts list to select with the keyboard."></canvas>
        <div class="stage-top">
          <div class="stage-label">${icon.box}<span>3D viewer</span></div>
          <div class="view-actions">
            <button class="stage-button" type="button" id="explode" aria-pressed="false" title="Exploded view">${icon.layers}<span>Explode</span></button>
            <button class="stage-button icon-button" type="button" id="reset-view" aria-label="Reset camera" title="Reset camera">${icon.rotate}</button>
          </div>
        </div>
        <div id="loading" class="loading" role="status">
          <span id="loading-label">Loading 3D model…</span>
          <progress id="load-progress" max="1" aria-label="Model download progress"></progress>
        </div>
        <div class="stage-bottom">
          <button id="open-parts" class="open-parts mobile-only" type="button" aria-controls="catalog-panel" aria-expanded="false">${icon.list} Parts <span>${parts.length}</span></button>
          <span class="stage-hint desktop-only">${icon.mouse} Drag to orbit <i></i> Scroll to zoom <i></i> Click a part</span>
          <span class="stage-hint mobile-only">${icon.mouse} Drag · Pinch · Tap a part</span>
        </div>
      </section>

      <aside class="detail-column card" aria-label="Part information">
        <div id="empty-detail" class="empty-detail">
          <div class="empty-icon">${icon.crosshair}</div>
          <h2>Select a part</h2>
          <p>Click the printer or choose a component from the catalog to see its details.</p>
          <div class="empty-link">
            <div class="empty-link-icon">${icon.qr}</div>
            <div><h3>Part QR codes</h3><p>Use the Digital Link tab to open or share a part’s catalog page.</p></div>
          </div>
        </div>
        <section id="detail" aria-labelledby="detail-title" hidden></section>
      </aside>
    </div>
  </main>
  <footer class="site-footer">
    ${studioCredit}
    <span class="footer-disclaimer">${disclaimer}</span>
    <button id="about-button" type="button">${icon.info} About &amp; credits</button>
  </footer>
  <button id="list-backdrop" hidden type="button" tabindex="-1" aria-label="Close parts list"></button>
  <div id="toast" role="status" hidden></div>

  <dialog id="sunrise-dialog" aria-labelledby="sunrise-title">
    <div class="dialog-heading">
      <div class="dialog-icon">${icon.qr}</div>
      <button class="icon-button" type="button" data-close aria-label="Close Sunrise explainer">${icon.x}</button>
    </div>
    <h2 id="sunrise-title">Sunrise 2027 ready</h2>
    <p>Sunrise 2027 is the global retail transition from 1D UPC barcodes to 2D barcodes such as QR codes. The shift supports point-of-sale systems that can read and process 2D codes, and gives brands a way to share richer information with consumers. It also helps improve transparency and traceability across the supply chain.</p>
    <div class="dialog-callout"><strong>One QR for checkout and the catalog</strong><p>A QR code on the part or package can carry the GTIN for compatible checkouts and open that exact part in this interactive 3D catalog. GS1 Digital Link connects the GTIN to online information the brand controls.</p></div>
    <dl class="adoption">
      <dt>Crawl</dt><dd>Brands add 2D codes to existing packaging and make sure QR codes follow GS1 Digital Link standards and contain the GTIN. Retailers install Sunrise-capable scanners to read 2D codes and extract the GTIN at checkout.</dd>
      <dt>Walk</dt><dd>Brands add details such as product variants and production or expiration dates.</dd>
      <dt>Run</dt><dd>Brands use 2D codes to deepen consumer engagement.</dd>
    </dl>
    <p>Retailers and brands can adopt additional 2D capabilities after 2027.</p>
    <p>This demo shows the gap: the original Ender-3’s parts have no public GTINs, so true GS1 Digital Link QR codes would need the brand to assign GTINs.</p>
    <h3>2025 GS1 US consumer survey</h3>
    <div class="survey">
      <div><strong>79%</strong><span>more likely to buy with a scannable QR code that gives more product information</span></div>
      <div><strong>77%</strong><span>say product information matters when buying</span></div>
      <div><strong>62%</strong><span>willing to pay more for detailed product information</span></div>
    </div>
    <p class="dialog-fine">${disclaimer}</p>
    <a class="primary-link" href="${sourceUrl}" target="_blank" rel="noopener">Explore Sunrise 2027 at GS1 US ${icon.arrowUpRight}</a>
  </dialog>
  <dialog id="about-dialog" aria-labelledby="about-title">
    <div class="dialog-heading">
      <div class="dialog-icon">${icon.info}</div>
      <button class="icon-button" type="button" data-close aria-label="Close about and credits">${icon.x}</button>
    </div>
    <h2 id="about-title">About &amp; credits</h2>
    <p>${disclaimer}</p>
    <p>Part codes, names, specifications and quantities come from the <a href="${bomUrl}" target="_blank" rel="noopener">published Ender-3 BOM</a>. Retailer prices, availability and barcodes are fetched on demand. Compatibility with the original Ender-3 is unverified.</p>
    <p>3D model: <a href="${cadUrl}" target="_blank" rel="noopener">Creality Ender-3 CAD</a> by Shenzhen Creality 3D Technology Co., Ltd., GPL-3.0. Converted to glTF and simplified by Mainstay. The converted model is distributed under GPL-3.0.</p>
    <p>${studioCredit}</p>
    <a class="primary-link" href="/models/ender3.LICENSE.txt">Model license notice ${icon.arrowUpRight}</a>
  </dialog>
`

function element<T extends HTMLElement = HTMLElement>(id: string) {
  return document.getElementById(id) as T
}

const search = element<HTMLInputElement>('part-search')
const category = element<HTMLSelectElement>('category')
const catalog = element('catalog-panel')
const list = element('parts-list')
const detail = element('detail')
const viewerCanvas = element<HTMLCanvasElement>('model')
const explode = element<HTMLButtonElement>('explode')
const mobile = matchMedia('(max-width: 900px)')
const workspace = document.querySelector<HTMLElement>('.workspace')!
let viewer: Viewer | undefined
let selected: Part | undefined
let listOpen = false
let noticeTimer = 0
let xray = true
type Tab = 'overview' | 'sellers' | 'link'
let activeTab: Tab = 'overview'
let activeGtin: string | undefined
let shownListing: Listing | undefined
let offersState: { part: Part; response?: Offers; failed?: boolean } | undefined

declare global {
  interface Window {
    __catalog: {
      readonly ready: boolean
      readonly selectedId: string | null
      readonly exploded: boolean
      readonly parts: typeof parts
      select(id: string | null): void
      explode(on?: boolean): void
      projectPart(id: string): { x: number; y: number } | null
    }
  }
}

window.__catalog = {
  get ready() { return viewer?.ready ?? false },
  get selectedId() { return selected?.id ?? null },
  get exploded() { return viewer?.exploded ?? false },
  parts,
  select(id) { setSelected(parts.find(part => part.id === id), 'push') },
  explode(on) { setExploded(on ?? !viewer?.exploded) },
  projectPart(id) { return viewer?.projectPart(id) ?? null },
}

function renderList() {
  const query = search.value.toLowerCase().trim().split(/\s+/).filter(Boolean)
  const matching = parts.filter(part => {
    const fields = [part.name, part.category, ...part.bomLines.flatMap(line => [line.code, line.name, line.spec])].join(' ').toLowerCase()
    return (!category.value || part.category === category.value) && query.every(term => fields.includes(term))
  })
  element('part-count').textContent = matching.length === parts.length
    ? `${parts.length} parts`
    : `${matching.length} of ${parts.length} parts`
  list.innerHTML = matching.map(part => `
    <button class="part-row" type="button" data-part="${part.id}" aria-pressed="${selected?.id === part.id}">
      <span class="part-icon">${iconsByCategory[part.category]}</span>
      <span class="part-row-text"><strong>${part.name}</strong><span>${part.bomLines.length} BOM ${part.bomLines.length === 1 ? 'line' : 'lines'}</span></span>
      ${icon.chevronRight}
    </button>
  `).join('') || '<p class="no-results">No matching parts. Try another search or category.</p>'
}

function loadOffers(part: Part) {
  if (!part.live || offersState?.part === part) return
  const request: NonNullable<typeof offersState> = { part }
  offersState = request
  void fetch('/api/offers?part=' + encodeURIComponent(part.id)).then(async response => {
    if (!response.ok) throw new Error('Offers request failed')
    request.response = await response.json() as Offers
  }).catch(() => {
    request.failed = true
  }).finally(() => {
    if (offersState === request && selected === part && activeTab !== 'overview') renderTab(part)
  })
}

function retailerStatus() {
  const response = offersState?.response
  if (offersState?.failed || (response && !response.listings.length && response.sources.every(source => !source.ok))) {
    return '<div class="offer-state offer-error"><p role="status">Retailer data is unavailable.</p><button class="copy-button" type="button" data-retry>Retry</button></div>'
  }
  if (!response) return '<div class="offer-loading" role="status"><span>Searching retailers…</span><i aria-hidden="true"></i><i aria-hidden="true"></i></div>'
  return ''
}

function renderTab(part: Part) {
  const content = element('detail-content')
  content.setAttribute('aria-labelledby', 'tab-' + activeTab)
  for (const button of detail.querySelectorAll<HTMLButtonElement>('[data-tab]')) {
    const active = button.dataset.tab === activeTab
    button.setAttribute('aria-selected', String(active))
    button.tabIndex = active ? 0 : -1
  }

  if (activeTab !== 'overview') loadOffers(part)
  const offers = offersState?.response
  const hasRetailerResults = offers?.sources.some(source => source.ok)
  switch (activeTab) {
    case 'overview':
      content.innerHTML = `
        <p class="description">${part.description}</p>
        <div class="section-title"><h3>Creality bill of materials</h3><a href="${bomUrl}" target="_blank" rel="noopener">BOM source ${icon.arrowUpRight}</a></div>
        <table class="bom-table">
          <thead><tr><th scope="col">Creality code</th><th scope="col">BOM name</th><th scope="col">Spec</th><th scope="col">Qty</th></tr></thead>
          <tbody>${part.bomLines.map(line => `<tr><td>${line.code}</td><td>${escapeHtml(line.name)}</td><td>${escapeHtml(line.spec || '—')}</td><td>${line.qty}</td></tr>`).join('')}</tbody>
        </table>
        <h3>CAD STEP names</h3>
        <p class="description cad-names">${part.stepNames.map(step => typeof step === 'string' ? escapeHtml(step) : 'M2–M8 screws, washers and nuts').join(' · ')}</p>
      `
      break
    case 'sellers': {
      if (!part.live) {
        content.innerHTML = '<p class="description">Standard metric hardware. No live listing lookup.</p>'
        break
      }
      const captured = activeGtin ? snapshot[activeGtin] : undefined
      const highlighted = offers?.listings.find(listing => listing.gtinValid && listing.barcode?.padStart(14, '0') === activeGtin
        && listing.store === captured?.store && listing.url === captured.url)
        ?? offers?.listings.find(listing => listing.gtinValid && listing.barcode?.padStart(14, '0') === activeGtin)
      const listings = highlighted && offers ? [highlighted, ...offers.listings.filter(listing => listing !== highlighted)] : offers?.listings
      content.innerHTML = `
        <p class="description fit-note"><b class="badge">UNVERIFIED</b> Live results from each retailer’s public store search. Check the listing to confirm compatibility with the original Ender-3.</p>
        ${retailerStatus()}
        ${offers ? sourceChips(offers.sources) : ''}
        ${captured && offers && !highlighted ? '<p class="description">The seller-listed GTIN from this link is unavailable in the current live results.</p>' : ''}
        ${listings?.length
          ? `<div class="seller-list">${listings.map(listing => listingCard(listing, offers!.listings.indexOf(listing), listing === highlighted)).join('')}</div>`
          : hasRetailerResults ? `<div class="offer-state" role="status">${icon.search}<div><h3>No live listings found</h3><p>Check retailer search status or try again.</p></div><button class="copy-button" type="button" data-retry>Retry</button></div>` : ''}
      `
      break
    }
    case 'link': {
      const gtinPath = shownListing?.barcode ? '/01/' + shownListing.barcode.padStart(14, '0') : undefined
      const gtinListings = offers?.listings.filter(listing => listing.gtinValid)
      content.innerHTML = `
        <p class="description">No public GTIN for this part — GS1 Digital Link requires a GTIN assigned by the brand owner (Creality).</p>
        ${qrCard(partPath(part), 'App deep link (not a GS1 Digital Link)')}
        ${gtinPath && shownListing ? qrCard(gtinPath, 'GS1 Digital Link', `GTIN listed by ${shownListing.store} for ${shownListing.title} — not verified with GS1`) : ''}
        ${part.live ? `
          <h3 class="retailer-gtins">Seller-listed GTINs</h3>
          ${retailerStatus()}
          ${gtinListings?.length ? `<div class="seller-list">${gtinListings.map(listing => `
            <div class="gtin-note"><strong>${escapeHtml(listing.barcode!)}</strong>
            <p>${escapeHtml(listing.store)} · ${escapeHtml(listing.title)}</p>
            <button class="copy-button" type="button" data-show-gtin="${offers!.listings.indexOf(listing)}">Show GS1 Digital Link</button></div>`).join('')}</div>`
            : hasRetailerResults ? '<p class="description">No seller-listed GTINs with a valid check digit in the live results.</p>' : ''}
        ` : ''}
      `
      renderQr(content)
      break
    }
  }
  content.scrollTop = 0
}

function renderDetail(part: Part | undefined) {
  detail.hidden = !part
  element('empty-detail').hidden = !!part
  workspace.classList.toggle('has-selection', !!part)
  detail.classList.remove('expanded')
  if (!part) {
    detail.innerHTML = ''
    return
  }
  activeTab = 'overview'
  detail.innerHTML = `
    <button type="button" class="sheet-handle mobile-only" data-expand aria-expanded="false" aria-label="Expand part details"><span></span></button>
    <div class="detail-head">
      <div class="detail-top">
        <span class="detail-icon">${iconsByCategory[part.category]}</span>
        <span class="detail-category">${part.category}</span>
        <span class="badge detail-bom">BOM</span>
        <button type="button" class="icon-button" data-clear aria-label="Close part details">${icon.x}</button>
      </div>
      <h2 id="detail-title">${part.name}</h2>
      <p class="part-number">${part.bomLines.length} published BOM ${part.bomLines.length === 1 ? 'line' : 'lines'}</p>
    </div>
    <div class="detail-tabs" role="tablist" aria-label="Part details">
      <button id="tab-overview" type="button" role="tab" data-tab="overview" aria-controls="detail-content">Overview</button>
      <button id="tab-sellers" type="button" role="tab" data-tab="sellers" aria-controls="detail-content">Where to buy</button>
      <button id="tab-link" type="button" role="tab" data-tab="link" aria-controls="detail-content">Digital Link</button>
    </div>
    <div id="detail-content" class="detail-content" role="tabpanel" tabindex="0"></div>
  `
  renderTab(part)
}

function setSelected(part: Part | undefined, historyMode: 'push' | 'read', instant = false) {
  const hadGtin = historyMode === 'push' && !!activeGtin
  if (historyMode === 'push') {
    activeGtin = undefined
    const path = part ? partPath(part) : '/'
    if (path !== location.pathname || location.search || location.hash) history.pushState(null, '', path)
  }
  if (selected !== part) {
    selected = part
    offersState = undefined
    shownListing = undefined
    for (const row of list.querySelectorAll<HTMLButtonElement>('[data-part]')) {
      row.setAttribute('aria-pressed', String(row.dataset.part === part?.id))
    }
    renderDetail(part)
  } else if (hadGtin && part) {
    renderTab(part)
  }
  viewer?.select(part?.id ?? null, instant)
  const ghost = element<HTMLButtonElement>('ghost')
  ghost.hidden = !part
}

function showToast(message: string) {
  window.clearTimeout(noticeTimer)
  const toast = element('toast')
  toast.hidden = false
  toast.textContent = message
  noticeTimer = window.setTimeout(() => { toast.hidden = true }, 4200)
}

function readRoute(instant = false) {
  const route = parseDigitalLink(location.href)
  const partMatch = /^\/part\/([a-z0-9-]+)\/?$/.exec(location.pathname)
  activeGtin = route.kind === 'part' ? route.gtin : undefined
  const captured = activeGtin ? snapshot[activeGtin] : undefined
  const partId = captured?.partId ?? partMatch?.[1]
  const part = parts.find(entry => entry.id === partId)
  element('toast').hidden = true
  if (route.kind !== 'catalog' && !part) {
    showToast(route.kind === 'invalid' ? 'Invalid GTIN in this link' : `No catalog match for GTIN ${route.gtin}`)
  } else if (!part && location.pathname.startsWith('/part/')) {
    showToast('Part unavailable in this catalog')
  }
  setSelected(part, 'read', instant)
  if (captured) activateTab('sellers')
  else if (part) {
    activeTab = 'overview'
    shownListing = undefined
    renderTab(part)
    expandDetails(false)
  }
}

function toggleList(open: boolean, restoreFocus = true) {
  listOpen = open && mobile.matches
  catalog.classList.toggle('list-open', listOpen)
  element('list-backdrop').hidden = !listOpen
  element('open-parts').setAttribute('aria-expanded', String(listOpen))
  if (listOpen) {
    catalog.querySelector<HTMLButtonElement>('#close-parts')?.focus()
  } else if (restoreFocus && mobile.matches) {
    element('open-parts').focus()
  }
}

function expandDetails(expand: boolean) {
  detail.classList.toggle('expanded', expand)
  const handle = detail.querySelector<HTMLButtonElement>('[data-expand]')
  handle?.setAttribute('aria-expanded', String(expand))
  handle?.setAttribute('aria-label', expand ? 'Collapse part details' : 'Expand part details')
}

function activateTab(tab: Tab) {
  if (!selected) return
  activeTab = tab
  renderTab(selected)
  if (mobile.matches) expandDetails(true)
}

search.addEventListener('input', renderList)
category.addEventListener('change', renderList)
list.addEventListener('click', event => {
  const row = (event.target as Element).closest<HTMLButtonElement>('[data-part]')
  if (!row) return
  const part = parts.find(entry => entry.id === row.dataset.part)
  setSelected(part, 'push')
  toggleList(false, false)
  if (mobile.matches) detail.querySelector<HTMLButtonElement>('[data-expand]')?.focus()
})

const ghost = document.createElement('button')
ghost.className = 'stage-button icon-button'
ghost.id = 'ghost'
ghost.type = 'button'
ghost.innerHTML = icon.eye
ghost.setAttribute('aria-label', 'Fade other parts')
ghost.setAttribute('aria-pressed', 'true')
ghost.title = 'Fade other parts'
ghost.hidden = true
explode.before(ghost)
ghost.addEventListener('click', () => {
  xray = !xray
  ghost.setAttribute('aria-pressed', String(xray))
  viewer?.setGhost(xray)
})
explode.disabled = true
element<HTMLButtonElement>('reset-view').disabled = true
function setExploded(on: boolean) {
  if (!viewer?.ready) return
  viewer.setExploded(on)
  explode.setAttribute('aria-pressed', String(viewer.exploded))
}
explode.addEventListener('click', () => setExploded(!viewer?.exploded))
element('reset-view').addEventListener('click', () => viewer?.resetView())
element('open-parts').addEventListener('click', () => toggleList(true))
element('close-parts').addEventListener('click', () => toggleList(false))
element('list-backdrop').addEventListener('click', () => toggleList(false))
mobile.addEventListener('change', () => toggleList(false, false))

detail.addEventListener('click', async event => {
  const button = (event.target as Element).closest<HTMLButtonElement>('button')
  if (!button || !selected) return
  if (button.hasAttribute('data-clear')) {
    setSelected(undefined, 'push')
    if (mobile.matches) element('open-parts').focus()
  }
  if (button.hasAttribute('data-expand')) expandDetails(!detail.classList.contains('expanded'))
  if (button.dataset.tab) activateTab(button.dataset.tab as Tab)
  if (button.hasAttribute('data-retry')) {
    offersState = undefined
    renderTab(selected)
  }
  if (button.dataset.showGtin !== undefined) {
    const listing = offersState?.response?.listings[Number(button.dataset.showGtin)]
    if (listing?.gtinValid) {
      shownListing = listing
      activateTab('link')
      detail.querySelector<HTMLElement>('[data-qr^="/01/"]')?.closest<HTMLElement>('.digital-card')?.focus()
    }
  }
  if (button.dataset.copy) {
    try {
      await navigator.clipboard.writeText(location.origin + button.dataset.copy)
      if (button.isConnected) button.innerHTML = `${icon.check} Copied`
      showToast('Link copied')
    } catch {
      showToast('Select the link text to copy it.')
    }
  }
})

detail.addEventListener('keydown', event => {
  const tabs: Tab[] = ['overview', 'sellers', 'link']
  if (!(event.target as Element).closest('[data-tab]')) return
  const index = tabs.indexOf(activeTab)
  const next = event.key === 'ArrowRight' ? tabs[(index + 1) % tabs.length]
    : event.key === 'ArrowLeft' ? tabs[(index + tabs.length - 1) % tabs.length]
    : event.key === 'Home' ? tabs[0] : event.key === 'End' ? tabs.at(-1) : undefined
  if (!next) return
  event.preventDefault()
  activateTab(next)
  element('tab-' + next).focus()
})

let swipeStart: number | null = null
detail.addEventListener('touchstart', event => {
  if (event.touches.length === 1 && (event.target as Element).closest('.sheet-handle, .detail-head')) {
    swipeStart = event.touches[0].clientY
  } else {
    swipeStart = null
  }
}, { passive: true })
detail.addEventListener('touchend', event => {
  if (swipeStart === null) return
  const delta = event.changedTouches[0].clientY - swipeStart
  swipeStart = null
  if (Math.abs(delta) > 34) expandDetails(delta < 0)
}, { passive: true })
detail.addEventListener('touchcancel', () => { swipeStart = null })

for (const name of ['sunrise', 'about']) {
  const dialog = element<HTMLDialogElement>(name + '-dialog')
  element(name + '-button').addEventListener('click', () => dialog.showModal())
  dialog.querySelector('[data-close]')?.addEventListener('click', () => dialog.close())
  dialog.addEventListener('click', event => {
    if (event.target !== dialog) return
    const rect = dialog.getBoundingClientRect()
    if (event.clientX < rect.left || event.clientX > rect.right ||
        event.clientY < rect.top || event.clientY > rect.bottom) dialog.close()
  })
}

document.addEventListener('keydown', event => {
  if (document.querySelector('dialog[open]')) return
  if (event.key === 'Escape') {
    if (listOpen) toggleList(false)
    else if (selected) setSelected(undefined, 'push')
    return
  }
  if (event.key !== '/' || (event.target as HTMLElement).matches('input, select, textarea, [contenteditable]')) return
  event.preventDefault()
  if (mobile.matches) toggleList(true)
  search.focus()
})

window.addEventListener('popstate', () => readRoute())
renderList()
readRoute(true)

async function loadModel() {
  const label = element('loading-label')
  const progress = element<HTMLProgressElement>('load-progress')
  try {
    const { Viewer } = await import('./viewer')
    viewer = new Viewer(viewerCanvas, id => setSelected(parts.find(part => part.id === id), 'push'))
    viewer.setGhost(xray)
    await viewer.load(fraction => {
      progress.value = fraction
      label.textContent = fraction < 1 ? `Loading 3D model… ${Math.round(fraction * 100)}%` : 'Preparing the model…'
    })
    viewer.select(selected?.id ?? null, true)
    element('loading').hidden = true
    explode.disabled = false
    element<HTMLButtonElement>('reset-view').disabled = false
  } catch (error) {
    console.error(error)
    progress.hidden = true
    label.textContent = 'The 3D model couldn’t load. You can still browse the parts catalog.'
  }
}

void loadModel()
