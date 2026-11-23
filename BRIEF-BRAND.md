# Brief: restyle with Mainstay Digital branding

Owner ask (verbatim): "now just maker the website look good, Use the mainstay digital branding pls"

Restyle this app (Creality Ender-3 live-data 3D parts catalog) in Mainstay Digital's real brand. Do NOT invent brand elements; use only what's below (pulled from the live https://mainstaydigital.com CSS + assets on 2026-11-23). Reference screenshots of their site: /workspace/mainstay-brand/site.png (desktop) and /workspace/mainstay-brand/site-phone.png (phone) — look at them.

## Brand assets (already copied to public/brand/)
- `logo.webp` — full wordmark "MD mainstaydigital", WHITE on transparent, 1254×200. Use in header (height ~22-26px on phone, ~28px desktop), alt="Mainstay Digital".
- `logo-mark-2.webp` — "MD" mark, white on transparent, 273×200.
- `icon.png` (512, white MD on black) → favicon; `apple-icon.png` → apple-touch-icon. Replace current favicon usage.

## Palette (their Tailwind theme tokens, exact)
--color-ground #08090b (page bg) · --color-surface #101318 · --color-raised #1b2027 · --color-lifted #262c34 · --color-line #23282f · --color-edge #656d78 · --color-edge-hot #8a939e · --color-bone #ede9e0 (primary text + primary buttons: bone bg, ground text) · --color-bone-dim #b9b5ac · --color-muted #8e949b · --color-faint #6a7178 · --color-signal #5b8cff (links/accent/selection) · --color-signal-wash #0d1730 · accent gradient #8ad4f5 → #00bcf1 (sparingly) · red-500 #fb2c36 / red-300 #ffa3a3 (errors).

## Type
Geist (sans + display) and JetBrains Mono (mono eyebrows/labels/codes) — install `@fontsource-variable/geist` and `@fontsource-variable/jetbrains-mono` (OFL) and drop Inter. Display headings: Geist heavy (700-800), UPPERCASE, tight tracking (-0.025em), line-height ~0.95 like their hero "COMPLEX PRODUCTS. CLEARLY SOLD." Eyebrows: JetBrains Mono, uppercase, ~11px, letter-spacing ~0.2em, muted (like their "INDUSTRIAL 3D PRODUCT VISUALIZATION FROM CAD"). Radii small 4-8px. Thin 1px --color-line borders, flat dark surfaces, minimal shadows. Tone: confident, plain, industrial ("Complex products, clearly sold.").

## Design direction
- Dark industrial theme throughout. Header: Mainstay logo left, thin divider, product title; right: "Live data" chip (signal dot) + "Sunrise 2027" button (bone outline). Sticky, blurred ground background.
- Hero (compact, esp. mobile): mono eyebrow "INTERACTIVE 3D PARTS CATALOG · LIVE RETAIL DATA"; display H1 "CREALITY ENDER-3"; one-line sub in bone-dim. Legend (BOM / LIVE / UNVERIFIED) as small mono chips. On iPhone keep hero short so the 3D viewer is mostly above the fold.
- 3D stage: dark with subtle radial lift (#101318 → #08090b), faint grid; retune lighting/env/tone mapping for dark bg so the printer reads well (silver extrusions visible, not crushed). Selection highlight = signal blue #5b8cff; hover subtle. Viewer toolbar buttons: raised surface, 1px line border, bone icons.
- Parts list: raised rows, mono counts, active = signal-wash bg + signal left border.
- Part sheet/panel: surface bg, display-ish title, mono Creality part codes, BOM table mono codes, tabs with signal underline. Where-to-buy cards: raised, store host mono, title bone, price large, availability chips (meet contrast; sold out muted), LIVE/UNVERIFIED badges consistent. Loading = skeleton shimmer; designed empty state ("No live listings found") and error state (red-300 text + retry); neat retailer status list.
- Digital Link/QR panel: QR on white rounded tile (keep quiet zone; dark-on-light for scanning) inside dark card, mono URI + copy button, honest labels unchanged.
- Sunrise 2027 modal + About & credits: restyled dark; content unchanged (GS1 facts, GPL-3.0 Creality model credit, "Not affiliated with or endorsed by Creality or GS1 US"). Add "Built by Mainstay Digital" linking https://mainstaydigital.com in footer/about. No email addresses anywhere.
- Mobile (iPhone 16 Pro 393×852 first): safe areas, bottom sheet with grabber, 44px touch targets, no horizontal scroll, 16px inputs. Desktop 1440: 3-column layout as now.
- Accessibility: WCAG AA contrast for all text, visible focus rings (signal), prefers-reduced-motion respected.

## Keep
All functionality, routes (/part/:id, /01/:gtin), live APIs, data-honesty labels, window.__catalog test hooks, tests. Update verify selectors if needed but keep all assertions. `npm run build`, `npm test`, `npm run verify` must pass. Verify must also save: shots/brand-desktop.png (1440×900, part selected, Where to buy with live listings), shots/brand-phone.png (393×852 DPR3 home), shots/brand-phone-part.png (phone, part selected, sheet open on Where to buy). Look at your screenshots and iterate until premium and on-brand (compare with /workspace/mainstay-brand/site.png).
Commit with `git -c user.name=Codex -c user.email=codex@users.noreply.github.com commit` (include public/brand). Do not deploy, do not push.
