import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { mkdir, readFile, stat } from 'node:fs/promises'
import { createServer } from 'node:net'
import { once } from 'node:events'
import { setTimeout as delay } from 'node:timers/promises'
import puppeteer, { KnownDevices } from 'puppeteer-core'

const snapshot = JSON.parse(await readFile(new URL('../src/gtin-snapshot.json', import.meta.url)))
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
  await readyShot(desktop, 'shots/real-desktop.png')
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

  const phone = await browser.newPage()
  watchErrors(phone)
  const device = KnownDevices['iPhone 16 Pro']
  await phone.emulate({ ...device, viewport: { ...device.viewport, width: 393, height: 852 } })
  await open(phone, '/')
  assert.deepEqual(await phone.evaluate(() => [innerWidth, innerHeight, devicePixelRatio, navigator.maxTouchPoints > 0]), [393, 852, 3, true])
  await readyShot(phone, 'shots/real-phone-home.png')
  const touch = await partPoint(phone, 'hotbed')
  await phone.touchscreen.tap(touch.x, touch.y)
  await phone.waitForFunction(() => window.__catalog.selectedId === 'hotbed')
  assert.equal(new URL(phone.url()).pathname, '/part/hotbed')
  const sizes = await phone.evaluate(() => ({
    detail: document.querySelector('#detail').getBoundingClientRect().height,
    stage: document.querySelector('.stage').getBoundingClientRect().height,
    view: innerHeight,
  }))
  assert.ok(sizes.detail < sizes.view * .35 && sizes.stage > sizes.detail, 'Peek sheet should leave the model visible')
  await readyShot(phone, 'shots/real-phone.png')
  await phone.tap('.sheet-handle')
  assert.equal(await phone.$eval('.sheet-handle', node => node.getAttribute('aria-expanded')), 'true')
  await phone.tap('[data-clear]')
  await phone.tap('#open-parts')
  await phone.waitForSelector('.catalog-panel.list-open', { visible: true })
  await phone.tap('[data-part="hotend"]')
  await phone.waitForFunction(() => window.__catalog.selectedId === 'hotend')
  assert.equal(await phone.$eval('#open-parts', node => node.getAttribute('aria-expanded')), 'false')
  await liveListings(phone)
  assert.equal(await phone.$eval('.sheet-handle', node => node.getAttribute('aria-expanded')), 'true')
  await readyShot(phone, 'shots/real-phone-buy.png')
  assert.deepEqual(errors, [], 'Browser errors')
  console.log('✓ iPhone touchscreen picking, part URL, catalog sheet, and live offers sheet')
  console.log('✓ Saved shots/real-desktop.png, shots/real-phone.png, shots/real-phone-home.png, and shots/real-phone-buy.png')
} finally {
  try {
    await browser?.close()
  } finally {
    server.kill()
  }
}
