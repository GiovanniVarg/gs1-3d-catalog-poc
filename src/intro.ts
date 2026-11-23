import * as icon from './icons'

export const introKey = 'gs1catalog.introSeen.v1'

const steps = [
  { text: 'Drag to orbit · pinch to zoom', target: () => '#model', model: true },
  { text: 'Tap any part to see BOM + live prices', target: () => '#model', model: true },
  { text: 'Explode to reach hidden parts', target: () => '#explode' },
  { text: 'Scan a part QR', target: () => matchMedia('(max-width: 900px)').matches ? '#scan-mobile' : '#scan-button' },
]

export function initIntro(dialog: HTMLDialogElement) {
  dialog.innerHTML = `
    <div class="tour-spotlight" aria-hidden="true"></div>
    <section class="tour-card" aria-label="Catalog tour">
      <div class="tour-meta"><span class="eyebrow">Quick tour</span><button type="button" class="icon-button" data-tour-dismiss aria-label="Close tour">${icon.x}</button></div>
      <p id="tour-message" aria-live="polite"></p>
      <div class="tour-controls">
        <div class="tour-dots" aria-hidden="true">${steps.map(() => '<i></i>').join('')}</div>
        <button type="button" class="copy-button" data-tour-dismiss>Skip</button>
        <button type="button" class="primary-link" id="tour-next">Next</button>
      </div>
    </section>`
  const spotlight = dialog.querySelector<HTMLElement>('.tour-spotlight')!
  const card = dialog.querySelector<HTMLElement>('.tour-card')!
  const next = dialog.querySelector<HTMLButtonElement>('#tour-next')!
  const reduced = matchMedia('(prefers-reduced-motion: reduce)')
  let step = 0
  let timer = 0

  function position() {
    if (!dialog.open) return
    const current = steps[step]
    const rect = document.querySelector(current.target())?.getBoundingClientRect()
    if (!rect) return
    const width = current.model ? Math.min(rect.width * .64, 250) : rect.width + 10
    const height = current.model ? Math.min(rect.height * .47, 240) : rect.height + 10
    const left = rect.left + (rect.width - width) / 2
    const top = rect.top + (rect.height - height) / 2
    Object.assign(spotlight.style, { left: left + 'px', top: top + 'px', width: width + 'px', height: height + 'px' })
    const cardLeft = Math.max(12, Math.min(left + width / 2 - card.offsetWidth / 2, innerWidth - card.offsetWidth - 12))
    const cardTop = top + height + 14 + card.offsetHeight <= innerHeight - 12
      ? top + height + 14 : Math.max(12, top - card.offsetHeight - 14)
    Object.assign(card.style, { left: cardLeft + 'px', top: cardTop + 'px' })
  }

  function dismiss() {
    clearTimeout(timer)
    try { localStorage.setItem(introKey, '1') } catch { /* the tour still works without storage */ }
    if (dialog.open) dialog.close()
  }

  function advance() {
    step++
    if (step === steps.length) dismiss()
    else render()
  }

  function schedule() {
    clearTimeout(timer)
    if (dialog.open && !reduced.matches) timer = window.setTimeout(advance, 2500)
  }

  function render() {
    dialog.querySelector('#tour-message')!.textContent = steps[step].text
    dialog.querySelectorAll('.tour-dots i').forEach((dot, index) => dot.classList.toggle('current', index === step))
    next.textContent = step === steps.length - 1 ? 'Done' : 'Next'
    position()
    schedule()
  }

  function open() {
    if (dialog.open) return
    step = 0
    dialog.showModal()
    render()
  }

  function firstRun() {
    try { if (localStorage.getItem(introKey)) return } catch { /* storage unavailable */ }
    if (location.pathname === '/' && !document.querySelector('dialog[open]')) open()
  }

  next.addEventListener('click', advance)
  dialog.querySelectorAll('[data-tour-dismiss]').forEach(button => button.addEventListener('click', dismiss))
  dialog.addEventListener('cancel', event => { event.preventDefault(); dismiss() })
  dialog.addEventListener('click', event => { if (!card.contains(event.target as Node)) dismiss() })
  window.addEventListener('resize', position)
  window.addEventListener('scroll', position, { passive: true })
  reduced.addEventListener('change', schedule)
  return { open, firstRun }
}
