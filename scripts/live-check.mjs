import puppeteer from 'puppeteer-core'
const B = process.env.BASE || 'https://gs1-3d-catalog-poc.vercel.app'
const G = process.env.GTIN
const sleep = ms => new Promise(r => setTimeout(r, ms))
const browser = await puppeteer.launch({ executablePath: '/usr/bin/google-chrome', headless: true, args: ['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] })
const out = { errors: [] }
const p = await browser.newPage()
await p.setUserAgent('Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1')
await p.setViewport({ width: 393, height: 852, deviceScaleFactor: 3, isMobile: true, hasTouch: true })
p.on('pageerror', e => out.errors.push(String(e)))
const ready = () => p.waitForFunction(() => window.__catalog?.ready === true, { timeout: 60000 })
for (const u of ['/', '/part/hotend', '/01/' + G, '/api/offers?part=hotend', '/models/ender3.glb']) {
  const r = await fetch(B + u); out['status ' + u] = r.status
}
await p.goto(B + '/part/hotend', { waitUntil: 'networkidle0' }); await ready(); await sleep(1500)
out.partRoute = await p.evaluate(() => window.__catalog.selectedId)
await p.goto(B + '/01/' + G, { waitUntil: 'networkidle0' }); await ready(); await sleep(4000)
out.gtinRoute = await p.evaluate(() => window.__catalog.selectedId)
await p.goto(B + '/', { waitUntil: 'networkidle0' }); await ready(); await sleep(1500)
const pt = await p.evaluate(() => window.__catalog.projectPart('psu'))
await p.touchscreen.tap(pt.x, pt.y); await sleep(1500)
out.tapSelected = await p.evaluate(() => window.__catalog.selectedId); out.tapPath = new URL(p.url()).pathname
await p.screenshot({ path: 'shots/live-real-phone-tap.png' })
const buy = await p.$$('button, [role=tab]'); for (const b of buy) { const t = await b.evaluate(e => e.textContent.trim()); if (t === 'Where to buy') { await b.tap(); break } }
await p.waitForSelector('.seller', { timeout: 20000 }).catch(() => {})
await sleep(1000)
out.liveListings = await p.$$eval('.seller', r => r.length)
await p.screenshot({ path: 'shots/live-real-phone-buy.png' })
await browser.close()
console.log(JSON.stringify(out, null, 1))
