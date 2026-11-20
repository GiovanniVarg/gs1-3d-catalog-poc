import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { mkdir, stat } from 'node:fs/promises'
import { createServer } from 'node:net'
import { once } from 'node:events'
import { setTimeout as delay } from 'node:timers/promises'
import puppeteer, { KnownDevices } from 'puppeteer-core'

const hoodGtin = '00614141000012'
const hoodRoute = '/01/' + hoodGtin

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

async function readyShot(page, path, qr = false) {
  if (qr) {
    await page.waitForFunction(() => {
      const canvas = document.querySelector('[data-qr]')
      return canvas?.getContext('2d').getImageData(0, 0, 1, 1).data[3] === 255
    })
  }
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

async function assertHood(page) {
  await page.waitForFunction(() => window.__catalog.selectedId === 'hood')
  assert.equal(await page.$eval('#detail-title', node => node.textContent), 'Hood assembly')
  assert.equal(await page.$eval('#detail', node => node.getBoundingClientRect().height > 0), true)
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
  await open(desktop, '/')
  assert.equal(await desktop.$$eval('.part-row', rows => rows.length), 18)
  for (const part of await desktop.$$eval('[data-part]', rows => rows.map(row => row.dataset.part))) {
    assert.ok(await desktop.evaluate(id => window.__catalog.projectPart(id) !== null, part), `Missing geometry for ${part}`)
  }
  console.log('✓ Catalog and all 18 model assemblies loaded')

  await open(desktop, hoodRoute + '/10/sample-lot/21/demo?linkType=info', 'hood')
  await assertHood(desktop)
  await readyShot(desktop, 'shots/desktop.png', true)
  console.log('✓ Digital Link selects Hood assembly and opens its details')

  await desktop.click('[data-clear]')
  assert.equal(new URL(desktop.url()).pathname, '/')
  await delay(700)
  const hood = await partPoint(desktop, 'hood')
  await desktop.mouse.click(hood.x, hood.y)
  await assertHood(desktop)
  assert.equal(new URL(desktop.url()).pathname, hoodRoute)
  await desktop.goBack()
  await desktop.waitForFunction(() => window.__catalog.selectedId === null)
  await desktop.goForward()
  await assertHood(desktop)
  console.log('✓ Canvas click selects the part and browser history restores selection')

  await desktop.keyboard.press('/')
  assert.equal(await desktop.evaluate(() => document.activeElement.id), 'part-search')
  await desktop.type('#part-search', 'mcx-wfl-1007')
  assert.equal(await desktop.$$eval('.part-row', rows => rows.length), 1)
  await desktop.click('[data-part="front-left"]')
  await desktop.waitForFunction(() => window.__catalog.selectedId === 'front-left')
  await desktop.click('#tab-sellers')
  assert.equal(await desktop.$$eval('.seller', rows => rows.every(row => new URL(row.href).hostname === 'example.com') && rows.length), 4)
  await desktop.click('#tab-link')
  assert.match(await desktop.$eval('.gtin-note', el => el.textContent), /Sample GTIN/)
  await delay(700)
  const assembled = await desktop.evaluate(() => window.__catalog.projectPart('hood'))
  await desktop.click('#explode')
  await desktop.waitForFunction(() => window.__catalog.exploded && document.querySelector('#explode').getAttribute('aria-pressed') === 'true')
  await delay(850)
  const exploded = await desktop.evaluate(() => window.__catalog.projectPart('hood'))
  assert.ok(Math.hypot(assembled.x - exploded.x, assembled.y - exploded.y) > 14, 'Expected an exploded part to move on screen')
  await desktop.click('#explode')
  await desktop.waitForFunction(() => !window.__catalog.exploded)
  console.log('✓ Search, list selection, example sellers, Digital Link tab and exploded view work')

  await open(desktop, '/01/00614141000013')
  assert.match(await desktop.$eval('#toast', el => el.textContent), /No part with GTIN 00614141000013/)
  const phone = await browser.newPage()
  watchErrors(phone)
  const device = KnownDevices['iPhone 16 Pro']
  await phone.emulate({ ...device, viewport: { ...device.viewport, width: 393, height: 852 } })
  assert.equal(await phone.evaluate(() => devicePixelRatio), 3)
  await open(phone, '/')
  await readyShot(phone, 'shots/phone-home.png')

  const touch = await partPoint(phone, 'hood')
  await phone.touchscreen.tap(touch.x, touch.y)
  await assertHood(phone)
  assert.equal(new URL(phone.url()).pathname, hoodRoute)
  const sizes = await phone.evaluate(() => ({
    detail: document.querySelector('#detail').getBoundingClientRect().height,
    stage: document.querySelector('.stage').getBoundingClientRect().height,
    view: innerHeight,
  }))
  assert.ok(sizes.detail < sizes.view * .35 && sizes.stage > sizes.detail, 'Peek sheet should leave the model visible')
  await readyShot(phone, 'shots/phone.png')
  await phone.tap('.sheet-handle')
  assert.equal(await phone.$eval('.sheet-handle', el => el.getAttribute('aria-expanded')), 'true')
  await phone.tap('[data-clear]')
  await phone.tap('#open-parts')
  await phone.waitForSelector('.catalog-panel.list-open', { visible: true })
  await phone.tap('[data-part="door-left"]')
  await phone.waitForFunction(() => window.__catalog.selectedId === 'door-left')
  assert.equal(await phone.$eval('#open-parts', el => el.getAttribute('aria-expanded')), 'false')
  assert.deepEqual(errors, [], 'Browser errors')
  console.log('✓ Phone touch picking, detail sheet, and parts sheet work')
  console.log('✓ Saved shots/desktop.png, shots/phone.png, and shots/phone-home.png')
} finally {
  try {
    await browser?.close()
  } finally {
    server.kill()
  }
}
