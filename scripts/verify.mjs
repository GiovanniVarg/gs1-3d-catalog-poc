import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { copyFile, mkdir, readFile, stat } from 'node:fs/promises'
import { createServer } from 'node:net'
import { once } from 'node:events'
import { setTimeout as delay } from 'node:timers/promises'
import puppeteer, { KnownDevices } from 'puppeteer-core'

const snapshot = JSON.parse(await readFile(new URL('../src/gtin-snapshot.json', import.meta.url)))
const introKey = 'gs1catalog.introSeen.v1'
const sample = Object.values(snapshot).find(row => row.partId === 'hotend') ?? Object.values(snapshot)[0]
assert.ok(sample, 'Expected at least one real seller-listed GTIN in the snapshot')

async function availablePort() {
  const socket = createServer()
  socket.listen(0, '127.0.0.1')
  await once(socket, 'listening')
  const { port } = socket.address()
  await new Promise((resolve, reject) => socket.close(error => error ? reject(error) : resolve()))
  return port
}

async function previewReady(origin, server) {
  for (let attempt = 0; attempt < 100; attempt++) {
    if (server.exitCode !== null) throw new Error('Vite preview exited before serving the catalog')
    try {
      const response = await fetch(origin)
      if (response.ok && (await response.text()).includes('Parts Catalog 3D')) return
    } catch {
      // Vite has not bound the port yet.
    }
    await delay(100)
  }
  throw new Error('Timed out waiting for Vite preview')
}

await stat('dist/index.html').catch(() => { throw new Error('Run npm run build before npm run verify') })
await mkdir('shots', { recursive: true })
const host = '127.0.0.1'
const port = await availablePort()
const origin = `http://${host}:${port}`
const server = spawn(process.execPath, ['node_modules/vite/bin/vite.js', 'preview',
  '--host', host, '--port', String(port), '--strictPort'], { stdio: ['ignore', 'ignore', 'inherit'] })

let browser
const errors = []
async function open(page, path, expected = null) {
  const response = await page.goto(origin + path, { waitUntil: 'networkidle0', timeout: 45000 })
  assert.ok(response && (response.ok() || response.status() === 304), `Unexpected response for ${path}`)
  await page.waitForFunction(id => window.__catalog?.ready === true && window.__catalog.selectedId === id,
    { timeout: 45000 }, expected)
  assert.equal(await page.$eval('#loading', el => el.hidden), true)
}

async function readyShot(page, path) {
  await page.evaluate(() => document.fonts.ready.then(() => undefined))
  await delay(700)
  await page.screenshot({ path })
}

function watchErrors(page) {
  page.on('pageerror', error => errors.push(error.message))
  page.on('console', message => {
    if (message.type() === 'error') errors.push(`${message.text()} (${message.location().url})`)
  })
}

async function liveListings(page, activate = true) {
  const part = await page.evaluate(() => window.__catalog.selectedId)
  const requested = page.waitForResponse(response => new URL(response.url()).pathname === '/api/offers'
    && new URL(response.url()).searchParams.get('part') === part, { timeout: 15000 })
  if (activate) await page.click('#tab-sellers')
  const response = await requested
  assert.equal(response.status(), 200, `Offers API failed for ${part}`)
  const data = await response.json()
  assert.equal(data.part, part)
  assert.equal(data.sources.length, 7)
  assert.ok(data.sources.some(source => source.ok), `All retailers failed for ${part}: ${JSON.stringify(data.sources)}`)
  assert.ok(data.listings.length, `No live retailer listings for ${part}: ${JSON.stringify(data.sources)}`)
  assert.ok(data.listings.some(listing => listing.price !== null && listing.currency), 'No listings with a live price and currency')
  assert.ok(data.listings.every(listing => new URL(listing.url).hostname === listing.host))
  await page.waitForSelector('.seller-title', { visible: true })
  assert.equal(await page.$$eval('.seller-title', rows => rows.length), data.listings.length)
  await page.waitForSelector('.source-list')
  return data
}

async function partPoint(page, id) {
  const point = await page.evaluate(part => window.__catalog.projectPart(part), id)
  assert.ok(point && Number.isFinite(point.x) && Number.isFinite(point.y), `Expected a screen point for ${id}`)
  assert.equal(await page.evaluate(({ x, y }) => document.elementFromPoint(x, y)?.id, point), 'model')
  return point
}

try {
  await previewReady(origin, server)
  browser = await puppeteer.launch({
    executablePath: '/usr/bin/google-chrome',
    headless: true,
    args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
    protocolTimeout: 55000,
  })
  const desktop = await browser.newPage()
  await desktop.evaluateOnNewDocument(key => localStorage.setItem(key, '1'), introKey)
  watchErrors(desktop)
  await desktop.setViewport({ width: 1440, height: 900, deviceScaleFactor: 1 })
  await open(desktop, '/part/hotend', 'hotend')
  assert.equal(await desktop.$eval('#detail-title', node => node.textContent), 'Hotend')
  assert.equal(await desktop.$$eval('.part-row', rows => rows.length), 17)
  assert.ok(await desktop.$eval('.bom-table', table => table.textContent.includes('400106003')))
  await desktop.click('#explode')
  assert.equal(await desktop.evaluate(() => window.__catalog.exploded), true)
  await desktop.click('#explode')
  await desktop.click('#ghost')
  assert.equal(await desktop.$eval('#ghost', node => node.getAttribute('aria-pressed')), 'false')
  await desktop.click('#ghost')
  await desktop.click('#tab-link')
  await desktop.waitForFunction(() => {
    const canvas = document.querySelector('[data-qr="/part/hotend"]')
    return canvas?.getContext('2d').getImageData(0, 0, 1, 1).data[3] === 255
  })
  // The Digital Link tab also loads offers. Reopen to assert the live browser request from Where to buy.
  await open(desktop, '/part/hotend', 'hotend')
  const hotend = await liveListings(desktop)
  await readyShot(desktop, 'shots/brand-desktop.png')
  await copyFile('shots/brand-desktop.png', 'shots/real-desktop.png')
  console.log(`✓ Desktop model, BOM, and ${hotend.listings.length} real hotend listings`)

  if (hotend.listings.some(listing => listing.gtinValid)) {
    await desktop.click('.seller [data-show-gtin]')
    await desktop.waitForFunction(() => {
      const canvas = document.querySelector('[data-qr^="/01/"]')
      return canvas?.getContext('2d').getImageData(0, 0, 1, 1).data[3] === 255
    })
    assert.match(await desktop.$eval('.digital-card + .digital-card', node => node.textContent), /not verified with GS1/)
  }

  const link = `/01/${sample.gtin}/10/demo-lot`
  const resolved = desktop.waitForResponse(response => new URL(response.url()).pathname === '/api/offers'
    && new URL(response.url()).searchParams.get('part') === sample.partId, { timeout: 15000 })
  await open(desktop, link, sample.partId)
  assert.equal(await desktop.$eval('#tab-sellers', node => node.getAttribute('aria-selected')), 'true')
  const resolvedOffers = await (await resolved).json()
  if (resolvedOffers.listings.some(listing => listing.gtinValid && listing.barcode.padStart(14, '0') === sample.gtin)) {
    await desktop.waitForSelector('[data-highlighted]', { visible: true })
  }
  await desktop.click('[data-clear]')
  assert.equal(new URL(desktop.url()).pathname, '/')
  await desktop.goBack({ waitUntil: 'domcontentloaded' })
  await desktop.waitForFunction(id => window.__catalog.selectedId === id, {}, sample.partId)
  assert.equal(new URL(desktop.url()).pathname, link)
  await open(desktop, '/01/036000291452')
  assert.match(await desktop.$eval('#toast', node => node.textContent), /No catalog match for GTIN/)
  console.log('✓ Captured GTIN deep link, browser history, unknown GTIN and QR labels')

  await open(desktop, '/')
  await readyShot(desktop, 'shots/v4-desktop.png')
  await desktop.click('#explode')
  await desktop.waitForFunction(() => window.__catalog.explodeProgress > 0 && window.__catalog.explodeProgress < 1)
  await desktop.click('#explode')
  await desktop.waitForFunction(() => window.__catalog.explodeProgress === 0)
  await desktop.click('#explode')
  await desktop.waitForFunction(() => window.__catalog.explodeProgress === 1)
  const mainboard = await partPoint(desktop, 'mainboard')
  await readyShot(desktop, 'shots/v4-explode-desktop.png')
  await desktop.touchscreen.tap(mainboard.x, mainboard.y)
  await desktop.waitForFunction(() => window.__catalog.selectedId === 'mainboard')
  console.log('✓ Explode progress, mid-animation reversal, and mainboard picking')

  const phone = await browser.newPage()
  watchErrors(phone)
  const device = KnownDevices['iPhone 16 Pro']
  const iphone = { ...device, viewport: { ...device.viewport, width: 393, height: 852 } }
  await phone.emulate(iphone)
  await phone.evaluateOnNewDocument(key => localStorage.setItem(key, '1'), introKey)
  await open(phone, '/')
  assert.deepEqual(await phone.evaluate(() => [innerWidth, innerHeight, devicePixelRatio, navigator.maxTouchPoints > 0]), [393, 852, 3, true])
  assert.ok(await phone.evaluate(() => document.documentElement.scrollWidth === innerWidth), 'Phone home must fit the viewport width')
  await readyShot(phone, 'shots/brand-phone.png')
  await copyFile('shots/brand-phone.png', 'shots/real-phone-home.png')
  const touch = await partPoint(phone, 'hotbed')
  await phone.touchscreen.tap(touch.x, touch.y)
  await phone.waitForFunction(() => window.__catalog.selectedId === 'hotbed')
  assert.equal(new URL(phone.url()).pathname, '/part/hotbed')
  const sizes = await phone.evaluate(() => ({
    detail: document.querySelector('#detail').getBoundingClientRect().height,
    stage: document.querySelector('.stage').getBoundingClientRect().height,
    view: innerHeight,
  }))
  assert.ok(sizes.detail < sizes.view * .35 && sizes.stage > sizes.detail,
    `Peek sheet should leave the model visible (${JSON.stringify(sizes)})`)
  await readyShot(phone, 'shots/real-phone.png')
  await phone.tap('.sheet-handle')
  assert.equal(await phone.$eval('.sheet-handle', node => node.getAttribute('aria-expanded')), 'true')
  await phone.tap('[data-clear]')
  await phone.tap('#open-parts')
  await phone.waitForSelector('.catalog-panel.list-open', { visible: true })
  await phone.tap('[data-part="hotend"]')
  await phone.waitForFunction(() => window.__catalog.selectedId === 'hotend')
  assert.equal(await phone.$eval('#open-parts', node => node.getAttribute('aria-expanded')), 'false')
  const phoneOffers = await liveListings(phone)
  assert.equal(await phone.$eval('.sheet-handle', node => node.getAttribute('aria-expanded')), 'true')
  assert.ok(await phone.evaluate(() => document.documentElement.scrollWidth === innerWidth), 'Phone offer sheet must fit the viewport width')
  await readyShot(phone, 'shots/brand-phone-part.png')
  await copyFile('shots/brand-phone-part.png', 'shots/real-phone-buy.png')
  assert.equal(await phone.$eval('#price-order', select => select.value), 'lowest')
  const priceGroups = Map.groupBy(phoneOffers.listings.filter(row => row.available === true && row.price !== null && row.currency), row => row.currency)
  const grouped = [...priceGroups.values()].flatMap(rows => [...rows].sort((a, b) => a.price - b.price))
  const trailing = phoneOffers.listings.filter(row => !grouped.includes(row))
  assert.ok(priceGroups.size, 'Expected a real priced in-stock listing')
  assert.deepEqual(await phone.$$eval('.seller-title', links => links.map(link => link.href)),
    [...grouped, ...trailing].map(row => row.url))
  assert.deepEqual(await phone.$$eval('.best-price', badges => badges.map(badge => badge.textContent.trim())),
    [...priceGroups.keys()].map(currency => `Best price (in stock, ${currency})`))
  const currencyCount = new Set(phoneOffers.listings.filter(row => row.price !== null && row.currency).map(row => row.currency)).size
  if (currencyCount > 1) {
    assert.equal(await phone.$eval('.currency-note', note => note.textContent),
      `Prices in ${currencyCount} currencies — compared within each currency only (no conversion)`)
  }
  assert.ok(await phone.$eval('.best-price', badge => badge.getBoundingClientRect().bottom <= innerHeight),
    'The first Best price badge must be visible on the phone without scrolling')
  await readyShot(phone, 'shots/v4-buy-phone.png')
  await phone.select('#price-order', 'match')
  assert.deepEqual(await phone.$$eval('.seller-title', links => links.map(link => link.href)), phoneOffers.listings.map(row => row.url))
  console.log('✓ Live price sorting and cheapest in-stock badge per currency')

  await phone.tap('[data-add-cart]')
  assert.equal(await phone.$eval('[data-add-cart]', button => button.getAttribute('aria-pressed')), 'true')
  await phone.evaluate(() => window.__catalog.select('psu'))
  await phone.tap('[data-add-cart]')
  assert.equal(await phone.$eval('#list-count', count => count.textContent), '2')
  await phone.tap('#cart-button')
  await phone.waitForSelector('#cart-dialog[open]', { visible: true })
  assert.equal(await phone.$eval('[data-qty="psu"]', input => input.value), '1')
  await phone.$eval('[data-qty="psu"]', input => {
    input.value = '2'
    input.dispatchEvent(new Event('change', { bubbles: true }))
  })
  await phone.tap('[data-copy-share]')
  await phone.waitForSelector('#cart-url', { visible: true })
  const shareUrl = new URL(await phone.$eval('#cart-url', input => input.value))
  assert.equal(shareUrl.pathname, '/list')
  assert.equal(shareUrl.searchParams.get('v'), '1')
  assert.equal(shareUrl.searchParams.get('i'), 'hotend.1,psu.2')
  await phone.tap('#cart-dialog [data-close]')

  const fresh = await browser.createBrowserContext()
  const restored = await fresh.newPage()
  watchErrors(restored)
  await restored.emulate(iphone)
  const cartOffers = ['hotend', 'psu'].map(part => restored.waitForResponse(response => {
    const url = new URL(response.url())
    return url.pathname === '/api/offers' && url.searchParams.get('part') === part
  }, { timeout: 20000 }))
  await open(restored, shareUrl.pathname + shareUrl.search)
  assert.equal(await restored.$('#tour-dialog[open]'), null, 'A shared list must bypass the tour')
  assert.deepEqual(await restored.$$eval('[data-qty]', inputs => inputs.map(input => [input.dataset.qty, input.value])),
    [['hotend', '1'], ['psu', '2']])
  const restoredOffers = await Promise.all(cartOffers.map(async request => {
    const response = await request
    assert.equal(response.status(), 200)
    return response.json()
  }))
  await restored.waitForSelector('[data-price-for="hotend"] .cart-offer', { visible: true })
  const totals = new Map()
  for (const data of restoredOffers) {
    const currencies = Map.groupBy(data.listings.filter(row => row.available === true && row.price !== null && row.currency), row => row.currency)
    const best = [...currencies.values()].map(group => group.reduce((first, next) => next.price < first.price ? next : first))
    assert.ok(best.length, `Expected a real in-stock listing for ${data.part}`)
    await restored.waitForSelector(`[data-price-for="${data.part}"] .cart-offer`, { visible: true })
    assert.deepEqual(await restored.$$eval(`[data-price-for="${data.part}"] .cart-offer`, links => links.map(link => link.href)),
      best.map(row => row.url))
    for (const row of best) totals.set(row.currency, (totals.get(row.currency) ?? 0) + row.price * (data.part === 'psu' ? 2 : 1))
  }
  const subtotalText = await restored.evaluate(values => values.map(([currency, total]) =>
    new Intl.NumberFormat(undefined, { style: 'currency', currency, currencyDisplay: 'code' }).format(total)), [...totals])
  assert.deepEqual(await restored.$$eval('.cart-totals strong', values => values.map(value => value.textContent)), subtotalText)
  assert.match(await restored.$eval('.cart-fetched', node => node.textContent), /Live prices fetched .+; not a checkout/)
  await readyShot(restored, 'shots/v4-list-phone.png')
  await restored.tap('[data-undo]')
  await restored.waitForSelector('.cart-empty', { visible: true })
  assert.equal(new URL(restored.url()).search, '', 'Undo should clear the shared payload from the current URL')
  await fresh.close()
  console.log('✓ Two-part list shared and restored in a fresh browser with live per-currency prices and subtotals')

  const tourContext = await browser.createBrowserContext()
  const tourPage = await tourContext.newPage()
  watchErrors(tourPage)
  await tourPage.emulate(iphone)
  await open(tourPage, '/')
  await tourPage.waitForSelector('#tour-dialog[open]')
  assert.match(await tourPage.$eval('#tour-message', message => message.textContent), /Drag to orbit/)
  await readyShot(tourPage, 'shots/v4-intro-phone.png')
  await tourPage.tap('[data-tour-dismiss]:not(.icon-button)')
  await tourPage.waitForFunction(key => localStorage.getItem(key) === '1' && !document.querySelector('#tour-dialog').open, {}, introKey)
  await open(tourPage, '/')
  assert.equal(await tourPage.$('#tour-dialog[open]'), null)
  await tourPage.tap('#tour-button')
  await tourPage.tap('#tour-next')
  assert.match(await tourPage.$eval('#tour-message', message => message.textContent), /Tap any part/)
  await tourPage.keyboard.press('Escape')
  await tourPage.waitForFunction(() => !document.querySelector('#tour-dialog').open)
  await tourContext.close()
  console.log('✓ First-run tour, dismissal, persistence, and replay')

  const qrPage = await browser.newPage()
  watchErrors(qrPage)
  await qrPage.setViewport({ width: 1040, height: 920, deviceScaleFactor: 1 })
  const qrResponse = await qrPage.goto(origin + '/qr-sheet', { waitUntil: 'networkidle0' })
  assert.ok(qrResponse?.ok())
  await qrPage.waitForFunction(() => {
    const canvases = [...document.querySelectorAll('#qr-sheet canvas[data-qr]')]
    return canvases.length === 17 && canvases.every(canvas => canvas.getContext('2d').getImageData(0, 0, 1, 1).data[3] === 255)
  })
  await qrPage.evaluate(() => document.fonts.ready.then(() => undefined))
  const qrImage = await qrPage.$eval('#qr-sheet canvas[data-qr="/part/hotend"]', canvas => canvas.toDataURL())
  await qrPage.screenshot({ path: 'shots/v4-qr-sheet.png', fullPage: true })
  await qrPage.emulateMediaType('print')
  assert.equal(await qrPage.$eval('#print-sheet', button => getComputedStyle(button).display), 'none')
  assert.equal(await qrPage.$eval('body', body => getComputedStyle(body).backgroundColor), 'rgb(255, 255, 255)')
  assert.equal(await qrPage.$eval('.qr-tile', tile => getComputedStyle(tile).breakInside), 'avoid')
  await qrPage.screenshot({ path: 'shots/v4-qr-sheet-print.png', fullPage: true })
  await qrPage.close()

  await phone.evaluateOnNewDocument(() => {
    navigator.mediaDevices.getUserMedia = async ({ video }) => {
      if (video.facingMode !== 'environment') throw new Error('Expected rear camera')
      throw new DOMException('Denied in verification', 'NotAllowedError')
    }
  })
  await open(phone, '/')
  await phone.tap('#scan-mobile')
  await phone.waitForFunction(() => document.querySelector('.scan-status').textContent === 'Camera permission was denied.')
  assert.equal(await phone.$eval('#scanner-dialog video', video => video.muted && video.playsInline), true)
  await readyShot(phone, 'shots/v4-scan-phone.png')
  await phone.type('#scan-input', 'unknown qr')
  await phone.tap('.scan-form button')
  await phone.waitForFunction(() => document.querySelector('.scan-notice').textContent.includes('unknown qr'))
  const scanRead = await phone.evaluate(url => window.__catalog.decodeImage(url), qrImage)
  assert.equal(scanRead, origin + '/part/hotend')
  assert.equal(await phone.$('#scanner-dialog[open]'), null)
  assert.equal(await phone.evaluate(() => window.__catalog.selectedId), 'hotend')
  assert.equal(new URL(phone.url()).pathname, '/part/hotend')
  await phone.tap('#scan-mobile')
  await phone.type('#scan-input', shareUrl.href)
  await phone.tap('.scan-form button')
  await phone.waitForSelector('#cart-dialog[open]', { visible: true })
  assert.equal(new URL(phone.url()).pathname, '/list')
  assert.equal(await phone.$$eval('.cart-row', rows => rows.length), 2)
  console.log('✓ All 17 part QRs, printable layout, permission fallback, and generated QR decoding into a part route')

  assert.deepEqual(errors, [], 'Browser errors')
  console.log('✓ iPhone touchscreen picking, part URL, catalog sheet, and live offers sheet')
  console.log('✓ Saved all eight v4 screenshots and the existing verification screenshots in shots/')
} finally {
  try {
    await browser?.close()
  } finally {
    server.kill()
  }
}
