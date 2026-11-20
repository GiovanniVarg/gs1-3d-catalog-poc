# Brief: GS1 Sunrise 2027 — 3D product catalog POC

Owner ask (verbatim): "https://www.gs1us.org/industries-and-insights/by-topic/sunrise-2027 I want you to make me a proof of concept web app for this idea! The goal here is to have a 3D catalog of a product, to where my users can see the 3d model click around find a specific piece and then it gets them all the details on that piece and where to get it themselves essentially being a online catalog."

Owner opens it on iPhone 16 Pro Safari and desktop Chrome. Mobile-first, clean, modern, fast.

## Build
Standalone static web app in THIS directory: Vite + three.js + TypeScript (no framework needed; vanilla TS fine). `npm run build` -> `dist/`. No backend. SPA: all routes serve index.html (add `vercel.json` rewrites `{"source":"/(.*)","destination":"/index.html"}` but keep /models and /assets static — Vercel serves filesystem first, so a catch-all rewrite is fine).

## Model (already in repo)
`public/models/car-concept.glb` — Khronos glTF-Sample-Assets "CarConcept" by Eric Chadwick, CC-BY-4.0 (metadata in `public/models/car-concept.LICENSE.json`). Optimized with EXT_meshopt_compression + EXT_texture_webp + KHR_mesh_quantization: use GLTFLoader with `MeshoptDecoder` from `three/examples/jsm/libs/meshopt_decoder.module.js`. Uses KHR_materials_transmission/clearcoat/iridescence/variants (three supports). Use RoomEnvironment + PMREM for lighting, ACES/AgX tone mapping, soft ground shadow/contact shadow. Show attribution in an About/credits area: "3D model: CarConcept by Eric Chadwick, Khronos glTF Sample Assets, CC BY 4.0" with link https://github.com/KhronosGroup/glTF-Sample-Assets/tree/main/Models/CarConcept . Note the steering-wheel emblem / Khronos logo is a trademark; fine to show.

Node names (inspect the GLB yourself). Group nodes into ~14-18 catalog PARTS (a part = one or more node names, including children). Suggested:
- Hood: BodyHood (+children BodyHoodInterior01/02, BodyHoodTopgrill, BodyHoodUnder)
- Door L / Door R: BodyDoorLColor1 / BodyDoorRColor1 (+children: panels, handles, windows, gaskets, interior door trim) — or split mirrors out:
- Side mirror L / R: BodyDoor{L,R}Mirror* 
- Windshield: BodyWindshield, BodyWindshieldGasket
- Wiper set: BodyWindshieldWipers, BodyWindshieldWipersBase
- Headlights: BodyHeadlights
- Taillights: BodyTaillights, BodyTaillightsPanels, BodyTurnsignalsRear
- Wheels/tires x4 or a "Wheel & tire" set: WheelFrontL/WheelFrontLRim etc. (consider 4 separate part instances sharing one SKU, or one part per corner — selecting any wheel highlights that corner; detail can say "Qty 4 per vehicle")
- Brake rotors: Wheel*BrakeDisc ; Brake pads/calipers: Wheel*BrakePad
- Steering wheel: InteriorSteering* (children of InteriorSteeringCylinder)
- Seats: InteriorSeats*
- Pedal set: InteriorPedal*
- Engine: Engine ; Axles: Axles
- Roof panel: BodyRoofPanel ; Rear hatch: InteriorRearHatch / rear window
Everything not in a part is "body" (non-selectable or a "Body shell" part). Some parts (engine, axles, pedals) are hidden inside; exploded view helps reveal them, and "x-ray"/fade-others when a part is selected helps.

## Interactions (must work with mouse AND touch)
- OrbitControls (damping, pan limited, min/max distance). Raycast picking on pointer events; distinguish tap from drag (movement < ~6px and < 350ms) so orbit drags don't select.
- Hover highlight on desktop (emissive tint or outline; don't mutate shared materials permanently — clone materials per part at load).
- Tap/click a part -> select: highlight it, dim/ghost others (opacity ~0.25) optionally, smoothly animate camera to frame the part's bounding box (tween target+position), open detail panel. Tap empty space / close button -> deselect and restore.
- Exploded-view toggle: animate each part outward from model center along its centroid direction (part-specific offsets OK) — smooth tween.
- Parts list / search sidebar (desktop: left sidebar; phone: a "Parts" button opens a searchable list sheet). Search by name, part number, GTIN, category. Clicking a list item selects in 3D (same as tap). Hotspot number badges optional.
- Detail panel: desktop right-side panel; phone bottom sheet (peek + expand, swipe/close), must not cover the whole model at peek; respect safe-area insets (iPhone notch/home bar), `viewport-fit=cover`, no zoom-on-input (16px inputs), `touch-action: none` on canvas.

## Part data (src/catalog.ts) — ALL SAMPLE DATA, label it everywhere ("Sample data" badge in panel, footer disclaimer)
Per part: id, name, category, partNumber (e.g. "MCX-HD-1001"), GTIN-14, description (2-3 sentences, realistic), specs (key/value list: material, weight, dimensions, fitment, warranty), price (USD), stock status (In stock / Low stock / Backorder w/ qty), qty per vehicle, sellers: 3-4 EXAMPLE sellers each with name (clearly fictional, e.g. "Example Auto Parts Co.", "Sample OEM Direct", "DemoParts Marketplace"), price, shipping/ETA, in-stock, and a link. Links must point to clearly non-real/example destinations: use `https://example.com/...` URLs (reserved domain) and label "Example seller". Also include a "Find nearby" sample entry.
GTINs: use the GS1 documentation example company prefix 0614141 (used throughout GS1 standards docs as an example — NOT a real brand). GTIN-14 = "0" + "0614141" + 5-digit item ref + mod-10 check digit, i.e. 14 digits like 0061414100001X. COMPUTE CORRECT GS1 check digits in code (write a `gtinCheckDigit`/`isValidGtin` util and a unit test). Label: "Sample GTIN (GS1 example prefix 0614141 — not a registered product)".

## GS1 Digital Link per part
- URI: `${location.origin}/01/${gtin}` (GS1 Digital Link URI syntax: path `/01/{GTIN-14}`; may be followed by qualifiers like `/10/{batch}` or `/21/{serial}` — parse and ignore/display them). Also support `?linkType=...` gracefully (ignore).
- Render a QR code of that URI in the detail panel (use npm `qrcode` lib to render to canvas/SVG/data URL; dark on white with quiet zone). Show the URI text with copy button.
- Route `/01/:gtin` (and `/01/:gtin/...` qualifiers, also accept 8/12/13-digit GTIN by left-padding to 14) opens the app with that part selected, camera framed, panel open. Unknown/invalid GTIN -> friendly toast "No part with GTIN ..." and normal catalog. Use history.pushState to update URL to /01/<gtin> on selection and back to / on deselect; handle popstate.

## Sunrise 2027 explainer (short, accurate — use ONLY these facts from the GS1 US page https://www.gs1us.org/industries-and-insights/by-topic/sunrise-2027 ; do not invent others)
- Sunrise 2027: global transition in retail from 1D UPC barcodes to 2D barcodes (like QR codes) giving greater transparency, stronger traceability and richer data across the supply chain; supports retailers in making POS systems able to read and process 2D codes, and brands sharing more info with consumers.
- Crawl: Brands add 2D barcodes to existing packaging and make sure QR codes use GS1 Digital Link standards and include the GTIN. Retailers install Sunrise-capable scanners that read 2D barcodes and extract the GTIN at POS.
- Walk: Brands add data like product variants and production/expiration dates. Run: brands maximize consumer engagement.
- Not necessary to implement all 2D capabilities by 2027.
- 2025 GS1 US consumer survey: 79% more likely to purchase products with a scannable QR code giving more product info; 77% say product info is important; 62% willing to spend more for detailed product info.
- GS1 Digital Link connects a product's unique identity (GTIN) to online sources of information brands control.
Pitch line for the POC: one QR on the part/package = scans at checkout (GTIN) AND opens this interactive 3D catalog page for that exact part. Present as a small "Sunrise 2027 ready" card/modal (badge in header opens it) with link to the GS1 US page. Add disclaimer: "Independent proof of concept. Not affiliated with or endorsed by GS1 US."

## Design
Mainstay-ish clean dark/light? Pick a polished light theme with a subtle gradient stage, Inter/system font, rounded 16px cards, subtle shadows. Header: "Parts Catalog 3D" + "Sample data" pill + "Sunrise 2027 ready" pill. Loading progress bar while GLB loads. 60fps on iPhone: cap devicePixelRatio at 2, antialias, shadow via a single baked/contact shadow plane, no heavy postprocessing. Keyboard: Esc deselect, / focuses search.

Optional (only if cheap, skip otherwise): none. No AR needed.

## Verify (must pass headless)
- `npm run build` passes; `npm test` (vitest) for GTIN check digit + Digital Link parsing.
- `npm run verify`: a Node script using puppeteer-core or playwright-core with system Chrome at /usr/bin/google-chrome (headless, `--use-gl=swiftshader` or `--enable-unsafe-swiftshader`, `--ignore-gpu-blocklist`) against `vite preview`: (1) page loads, model loaded flag `window.__catalog.ready === true`; (2) deep link `/01/<gtin of e.g. Hood>` opens with that part selected (`window.__catalog.selectedId`) and panel visible showing that part's name; (3) simulated pointer tap on canvas at the projected screen center of a known visible part (expose `window.__catalog.projectPart(id)` returning screen x,y) selects that part and updates URL to /01/<gtin>; (4) list click selects; (5) explode toggle works. Also save screenshots: `shots/desktop.png` (1440x900, part selected), `shots/phone.png` (393x852 DPR3 iPhone 16 Pro UA, part selected with bottom sheet), `shots/phone-home.png`.
- No email addresses anywhere in the app. Never use any @mainstaydigital.com address.
- README.md: what it is, run/build/verify, model credit+license, data is sample, GS1 facts source.
- Commit with `git -c user.name=Codex -c user.email=codex@users.noreply.github.com commit`. Do not deploy, do not push.
