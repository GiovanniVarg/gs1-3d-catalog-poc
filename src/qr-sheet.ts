import { partPath, parts } from './catalog'
import { renderQr } from './offers-ui'
import * as icon from './icons'

export function initQrSheet(sheet: HTMLElement) {
  const label = 'App deep link (not a GS1 Digital Link — no public GTIN)'
  sheet.innerHTML = `
    <header class="qr-sheet-head">
      <a class="qr-back" href="/">‹ Back to catalog</a>
      <img src="/brand/logo.webp" width="1254" height="200" alt="Mainstay Digital">
      <div class="qr-sheet-title">
        <div><div class="eyebrow">Creality Ender-3</div><h1>Part QR sheet</h1></div>
        <button id="print-sheet" class="primary-link" type="button">${icon.printer} Print</button>
      </div>
      <p>Scan a code with your camera or the catalog scanner to open that part’s 3D view, BOM and available retailer listings.</p>
    </header>
    <div class="qr-grid">${parts.map(part => `
      <article class="qr-tile">
        <header><p>${part.category}</p><h2><a href="${partPath(part)}">${part.name}</a></h2></header>
        <canvas data-qr="${partPath(part)}" role="img" aria-label="QR code for ${part.name}"></canvas>
        <div><span class="badge">BOM</span> <span class="qr-codes">${part.bomLines.map(line => line.code).join(' · ')}</span></div>
        <p class="qr-caption">${label}</p>
      </article>`).join('')}</div>`
  sheet.querySelector('#print-sheet')?.addEventListener('click', () => window.print())
  renderQr(sheet)
}
