import '@fontsource-variable/inter/wght.css'
import './style.css'
import { categories, partPath, parts, type Category, type Part } from './catalog'
import { parseDigitalLink } from './gtin'
import * as icon from './icons'
import type { Viewer } from './viewer'

const sourceUrl = 'https://www.gs1us.org/industries-and-insights/by-topic/sunrise-2027'
const modelUrl = 'https://github.com/KhronosGroup/glTF-Sample-Assets/tree/main/Models/CarConcept'
const disclaimer = 'Independent proof of concept. Not affiliated with or endorsed by GS1 US.'
const usd = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' })
const iconsByCategory: Record<Category, string> = {
  Exterior: icon.car, Lighting: icon.lightbulb, 'Wheels & brakes': icon.circleDot,
  Interior: icon.layers, Powertrain: icon.settings,
}
const app = document.querySelector<HTMLDivElement>('#app')!

app.innerHTML = `
  <header class="site-header">
    <div class="header-content">
      <a class="brand" href="/" aria-label="Parts Catalog 3D home">
        <span class="brand-icon">${icon.box}</span><span>Parts Catalog <b>3D</b></span>
      </a>
      <div class="header-actions">
        <span class="sample-pill"><i></i>Sample data</span>
        <button id="sunrise-button" class="sunrise-pill" type="button" aria-label="Sunrise 2027 ready">${icon.qr} <span>Sunrise 2027<span class="ready-word"> ready</span></span> ${icon.arrowUpRight}</button>
      </div>
    </div>
  </header>
  <main class="page">
    <section class="intro" aria-labelledby="page-title">
      <div>
        <div class="eyebrow model-label">${icon.car} Vehicle catalog</div>
        <h1 id="page-title">CarConcept</h1>
        <p>Explore the model, identify a part, and see its specs and example sellers.</p>
      </div>
      <div class="intro-meta"><span class="live-dot"></span>Interactive 3D model</div>
    </section>

    <div class="workspace">
      <aside class="catalog-panel card" id="catalog-panel" aria-labelledby="parts-title">
        <div class="catalog-head">
          <div class="panel-heading">
            <div><h2 id="parts-title">Parts catalog</h2><p id="part-count"></p></div>
            <button id="close-parts" class="icon-button mobile-only" type="button" aria-label="Close parts list">${icon.x}</button>
          </div>
          <label class="search-box">
            ${icon.search}<input type="search" id="part-search" placeholder="Search parts…" aria-label="Search by name, part number, GTIN, or category">
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

      <section class="stage card" aria-label="Interactive vehicle viewer">
        <canvas id="model" aria-label="3D CarConcept. Use the parts list to select with the keyboard."></canvas>
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
          <p>Click the vehicle or choose a component from the catalog to see its details.</p>
          <div class="empty-link">
            <div class="empty-link-icon">${icon.qr}</div>
            <div><h3>GS1 Digital Link</h3><p>Each part has a QR code that opens its catalog page.</p></div>
          </div>
        </div>
        <section id="detail" aria-labelledby="detail-title" hidden></section>
      </aside>
    </div>
  </main>
  <footer class="site-footer">
    <span>Sample data for demonstration only.</span>
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
    <p>Prices, inventory, GTINs and sellers are sample data for demonstration only.</p>
    <p><a href="${modelUrl}" target="_blank" rel="noopener">3D model: CarConcept by Eric Chadwick, Khronos glTF Sample Assets, CC BY 4.0</a>. The steering-wheel emblem and Khronos logo are Khronos trademarks.</p>
    <a class="primary-link" href="https://creativecommons.org/licenses/by/4.0/" target="_blank" rel="noopener">CC BY 4.0 license ${icon.arrowUpRight}</a>
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

declare global {
  interface Window {
    __catalog: {
      readonly ready: boolean
      readonly selectedId: string | null
      readonly exploded: boolean
      projectPart(id: string): { x: number; y: number } | null
    }
  }
}

window.__catalog = {
  get ready() { return viewer?.ready ?? false },
  get selectedId() { return selected?.id ?? null },
  get exploded() { return viewer?.exploded ?? false },
  projectPart(id) { return viewer?.projectPart(id) ?? null },
}

function renderList() {
  const query = search.value.toLowerCase().trim().split(/\s+/).filter(Boolean)
  const matching = parts.filter(part => {
    const fields = [part.name, part.category, part.partNumber, part.gtin].join(' ').toLowerCase()
    return (!category.value || part.category === category.value) && query.every(term => fields.includes(term))
  })
  element('part-count').textContent = matching.length === parts.length
    ? `${parts.length} parts`
    : `${matching.length} of ${parts.length} parts`
  list.innerHTML = matching.map(part => `
    <button class="part-row" type="button" data-part="${part.id}" aria-pressed="${selected?.id === part.id}">
      <span class="part-icon">${iconsByCategory[part.category]}</span>
      <span class="part-row-text"><strong>${part.name}</strong><span>${part.partNumber}</span></span>
      ${icon.chevronRight}
    </button>
  `).join('') || '<p class="no-results">No matching parts. Try another search or category.</p>'
}

function digitalCard(part: Part) {
  const uri = location.origin + partPath(part)
  return `
    <div class="digital-card">
      <div class="qr-frame"><canvas data-qr class="qr-image" role="img" aria-label="QR code for ${part.name}"></canvas></div>
      <div class="digital-copy">
        <strong>GS1 Digital Link</strong>
        <p>Scan to open this part.</p>
        <a class="digital-uri" href="${partPath(part)}">${uri}</a>
        <button class="copy-button" type="button" data-copy>${icon.copy} Copy link</button>
      </div>
    </div>
  `
}

function renderTab(part: Part) {
  const content = element('detail-content')
  content.setAttribute('aria-labelledby', 'tab-' + activeTab)
  for (const button of detail.querySelectorAll<HTMLButtonElement>('[data-tab]')) {
    const active = button.dataset.tab === activeTab
    button.setAttribute('aria-selected', String(active))
    button.tabIndex = active ? 0 : -1
  }
  switch (activeTab) {
    case 'overview':
      content.innerHTML = `
        <p class="description">${part.description}</p>
        <h3>Specifications</h3>
        <dl class="specs">${[...part.specs, ['Qty per vehicle', part.quantity]].map(([key, value]) =>
          `<div><dt>${key}</dt><dd>${value}</dd></div>`).join('')}</dl>
        ${digitalCard(part)}
      `
      break
    case 'sellers':
      content.innerHTML = `
        <h3>Example sellers</h3>
        <p class="description">Sample prices and availability in USD.</p>
        <div class="seller-list">
          ${part.sellers.map(seller => `<a class="seller" href="${seller.url}" target="_blank" rel="noopener">
            <div><strong>${seller.name}</strong><span>Example seller · ${seller.inStock ? 'In stock' : 'Backorder'}</span><span>${seller.shipping}</span></div>
            <div><strong>${usd.format(seller.price)}</strong>${icon.arrowUpRight}</div>
          </a>`).join('')}
          <a class="seller nearby" href="${part.nearbyUrl}" target="_blank" rel="noopener">
            ${icon.mapPin}<div><strong>Find nearby</strong><span>Example seller lookup</span></div>${icon.arrowUpRight}
          </a>
        </div>
      `
      break
    case 'link':
      content.innerHTML = `
        <h3>GS1 Digital Link</h3>
        <p class="description">Open this part directly by scanning the QR code or sharing the link.</p>
        ${digitalCard(part)}
        <div class="gtin-note"><strong>${part.gtin}</strong><p>Sample GTIN (GS1 example prefix 0614141 — not a registered product)</p></div>
      `
      break
  }
  content.scrollTop = 0
  const qrCanvas = content.querySelector<HTMLCanvasElement>('[data-qr]')
  if (qrCanvas) {
    const uri = location.origin + partPath(part)
    void import('qrcode').then(({ toCanvas }) =>
      toCanvas(qrCanvas, uri, { scale: 6, margin: 4, color: { dark: '#101b30', light: '#ffffff' } })
    ).catch(() => { qrCanvas.hidden = true })
  }
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
        <span class="detail-sample">Sample data</span>
        <button type="button" class="icon-button" data-clear aria-label="Close part details">${icon.x}</button>
      </div>
      <h2 id="detail-title">${part.name}</h2>
      <p class="part-number">${part.partNumber}</p>
      <div class="price-row">
        <strong>${usd.format(part.price)}</strong>
        <span class="stock ${part.stock === 0 ? 'unavailable' : part.stock <= 4 ? 'low' : ''}"><i></i>${part.status} · ${part.stock}</span>
      </div>
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
  if (historyMode === 'push') {
    const path = part ? partPath(part) : '/'
    if (path !== location.pathname || location.search || location.hash) history.pushState(null, '', path)
  }
  if (selected !== part) {
    selected = part
    for (const row of list.querySelectorAll<HTMLButtonElement>('[data-part]')) {
      row.setAttribute('aria-pressed', String(row.dataset.part === part?.id))
    }
    renderDetail(part)
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
  const part = route.kind === 'part' ? parts.find(entry => entry.gtin === route.gtin) : undefined
  if (route.kind !== 'catalog' && !part) {
    const value = route.kind === 'part' ? route.gtin : route.value
    showToast(`No part with GTIN ${value || '(missing)'}`)
  } else {
    element('toast').hidden = true
  }
  setSelected(part, 'read', instant)
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
explode.addEventListener('click', () => {
  if (!viewer?.ready) return
  viewer.setExploded(!viewer.exploded)
  explode.setAttribute('aria-pressed', String(viewer.exploded))
})
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
  if (button.hasAttribute('data-copy')) {
    try {
      await navigator.clipboard.writeText(location.origin + partPath(selected))
      if (button.isConnected) button.innerHTML = `${icon.check} Copied`
      showToast('Digital Link copied')
    } catch {
      showToast('Select the Digital Link text to copy it.')
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
