import * as icon from './icons'

export function initScanner(dialog: HTMLDialogElement, onScan: (text: string) => void) {
  dialog.innerHTML = `
    <div class="scanner-content">
      <header class="scanner-heading">
        <div><div class="eyebrow">Parts Catalog 3D</div><h2 id="scanner-title">Scan a code</h2></div>
        <button class="icon-button" type="button" data-close aria-label="Close scanner">${icon.x}</button>
      </header>
      <div class="scan-preview">
        <video muted playsinline autoplay aria-hidden="true"></video>
        <div class="scan-viewfinder" aria-hidden="true"><i></i><i></i><i></i><i></i>${icon.qr}</div>
      </div>
      <p class="scan-status" role="status"></p>
      <div class="scan-notice" role="status" hidden></div>
      <form class="scan-form">
        <label for="scan-input">Paste or type a link or GTIN</label>
        <div><input id="scan-input" type="text" required autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="Part link or GTIN">
        <button type="submit" class="primary-link">Open</button></div>
      </form>
      <a href="/qr-sheet" class="scan-sheet-link">${icon.printer} Printable part QR sheet ${icon.arrowUpRight}</a>
    </div>`
  const video = dialog.querySelector('video')!
  const status = dialog.querySelector<HTMLElement>('.scan-status')!
  const notice = dialog.querySelector<HTMLElement>('.scan-notice')!
  let noticeTimer = 0
  function notify(message: string) {
    clearTimeout(noticeTimer)
    notice.textContent = message
    notice.hidden = false
    noticeTimer = window.setTimeout(() => { notice.hidden = true }, 4200)
  }
  const input = dialog.querySelector<HTMLInputElement>('#scan-input')!
  const canvas = document.createElement('canvas')
  const context = canvas.getContext('2d', { willReadFrequently: true })!
  let session: AbortController | undefined
  let stream: MediaStream | undefined
  let frame = 0
  let decode: Promise<typeof import('jsqr')['default']> | undefined

  async function decodeFrame(source: CanvasImageSource, width: number, height: number) {
    const jsQR = await (decode ??= import('jsqr').then(module => module.default))
    const scale = Math.min(1, 800 / Math.max(width, height))
    const w = Math.max(1, Math.round(width * scale))
    const h = Math.max(1, Math.round(height * scale))
    if (canvas.width !== w) canvas.width = w
    if (canvas.height !== h) canvas.height = h
    context.drawImage(source, 0, 0, w, h)
    return jsQR(context.getImageData(0, 0, w, h).data, w, h)?.data ?? null
  }

  function stopCamera() {
    session?.abort()
    cancelAnimationFrame(frame)
    stream?.getTracks().forEach(track => track.stop())
    stream = undefined
    video.srcObject = null
    dialog.classList.remove('camera-on')
  }

  function close() {
    stopCamera()
    if (dialog.open) dialog.close()
  }

  async function open() {
    if (dialog.open) return
    stopCamera()
    notice.hidden = true
    input.value = ''
    status.textContent = 'Starting camera…'
    dialog.showModal()
    if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) {
      status.textContent = window.isSecureContext ? 'No camera is available.' : 'Camera access requires a secure connection (HTTPS).'
      return
    }
    session = new AbortController()
    const { signal } = session
    let lastAttempt = 0
    let lastRead: string | null = null
    const tick = async (now: number) => {
      if (signal.aborted) return
      if (now - lastAttempt >= 145 && video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) {
        lastAttempt = now
        try {
          const text = await decodeFrame(video, video.videoWidth, video.videoHeight)
          if (signal.aborted) return
          if (text && text !== lastRead) onScan(text)
          lastRead = text
        } catch {
          if (signal.aborted) return
          status.textContent = 'The scanner could not read the camera. Use the field below.'
          stopCamera()
          return
        }
      }
      if (!signal.aborted) frame = requestAnimationFrame(tick)
    }
    try {
      const media = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } })
      if (signal.aborted) {
        media.getTracks().forEach(track => track.stop())
        return
      }
      stream = media
      video.srcObject = media
      await video.play()
      if (signal.aborted) return
      dialog.classList.add('camera-on')
      status.textContent = 'Center a QR code inside the frame.'
      frame = requestAnimationFrame(tick)
    } catch (error) {
      if (signal.aborted) return
      const name = error instanceof DOMException ? error.name : ''
      status.textContent = name === 'NotAllowedError' || name === 'SecurityError' ? 'Camera permission was denied.'
        : name === 'NotFoundError' || name === 'OverconstrainedError' ? 'No camera is available.'
        : 'The camera could not start. Use the field below.'
      stopCamera()
    }
  }

  dialog.querySelector('[data-close]')?.addEventListener('click', close)
  dialog.addEventListener('cancel', event => { event.preventDefault(); close() })
  dialog.addEventListener('close', () => { if (!dialog.open) stopCamera() })
  dialog.querySelector('form')?.addEventListener('submit', event => {
    event.preventDefault()
    onScan(input.value)
  })
  // The verification hook takes an image through the same frame decoder as the live video.
  async function decodeImage(url: string) {
    const image = new Image()
    image.src = url
    await image.decode()
    const text = await decodeFrame(image, image.naturalWidth, image.naturalHeight)
    if (text) onScan(text)
    return text
  }

  return { open, close, decodeImage, notify }
}
