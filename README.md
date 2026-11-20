# Parts Catalog 3D

A static proof of concept for exploring a concept car, identifying a component, and seeing its specifications and example sellers. Open a part by selecting it on the model, searching the catalog, or scanning its GS1 Digital Link QR code. Exploded view and part fading help expose interior components.

## Run locally

```sh
npm ci
npm run dev
```

Use Node.js 22.12 or later. Drag to orbit and scroll or pinch to zoom. Search by name, part number, GTIN, or category. Press `/` to focus search and `Esc` to clear the selection. On a phone, tap **Parts** to open search. Tap the handle or swipe up on a part's bottom sheet to expand it.

## Build and verify

```sh
npm run build
npm test
npm run verify
```

The build outputs `dist/`. For static hosting, serve existing files directly and fall back to `index.html` for app routes. The included Vercel configuration supplies the SPA rewrite. The verifier starts Vite preview and requires system Chrome at `/usr/bin/google-chrome`. It exercises the production app and saves desktop and emulated iPhone screenshots in `shots/`.

The sample hood link is `/01/00614141000012`. The app accepts optional path qualifiers and ignores `linkType` query parameters. GTIN-8, GTIN-12, and GTIN-13 identifiers are validated and left-padded to 14 digits for lookup.

## Sample data and credits

All parts data, prices, inventory, and seller listings are fictional examples. Sample GTINs use the GS1 example prefix `0614141` and do not represent registered products. Seller links point to the reserved domain `example.com`.

3D model: [CarConcept by Eric Chadwick, Khronos glTF Sample Assets](https://github.com/KhronosGroup/glTF-Sample-Assets/tree/main/Models/CarConcept), licensed [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/). The model and textures are credited to Eric Chadwick of Darmstadt Graphics Group GmbH. The steering-wheel emblem and Khronos logo are Khronos trademarks. See the [model license metadata](public/models/car-concept.LICENSE.json).

The Sunrise 2027 explainer and 2025 survey figures are sourced from [GS1 US Sunrise 2027](https://www.gs1us.org/industries-and-insights/by-topic/sunrise-2027). Independent proof of concept. Not affiliated with or endorsed by GS1 US.
