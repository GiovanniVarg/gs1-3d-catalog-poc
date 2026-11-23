# Creality Ender-3 · Parts Catalog 3D

Explore the original Creality Ender-3 in 3D. Select an assembly on the printer or in the catalog to inspect its published BOM lines, browse live retailer results, and share its part link. Explode animates the assemblies apart, and the fade control helps isolate a selected part. Mainboard selection opens the enclosure automatically. Replay the guided intro with **Tour**.

## Run locally

```sh
npm ci
npm run dev
```

Use Node.js 22.12 or later. Drag to orbit and scroll or pinch to zoom. Search by name, Creality part code, specification, or category. Press `/` to focus search and `Esc` to close the selection. On a phone, tap **Parts** to open the list and use the handle or swipe the part sheet to expand it.

## Scan, print and share

- **Scan** reads QR codes with the rear camera on HTTPS or localhost. The same sheet accepts pasted part links, GS1 Digital Links, GTINs and shared lists. Open `/qr-sheet` to print app deep-link QR codes for all 17 parts.
- **Where to buy** defaults to the lowest in-stock price within each currency. **Best match** restores retailer search order. Compatibility remains unverified.
- **Add to list** saves parts on this device. The **List** drawer fetches current retailer prices and shows the cheapest in-stock listing for each currency, with separate subtotals. **Copy link** shares the parts and quantities. Opening a shared link replaces the saved list with an option to undo.

## Data sources

- **BOM and CAD.** Catalog groups are hand-tagged to STEP occurrence names in the model. Part codes, names, specifications and quantities are transcribed from the [published Ender-3 BOM](https://github.com/Creality3DPrinting/Ender-3/blob/master/Ender-3%20Mechanical/Ender-3%20BOM.XLS) with the source CSV in [data/ender3-bom.csv](data/ender3-bom.csv). Model finishes are illustrative.
- **Live offers.** `/api/offers?part=hotend` searches the public Shopify storefronts of Printed Solid, Micro Swiss, E3D, Fabreeko, West3D, 3D Printing Canada, and DigitMakers. Variant prices, currencies, stock, SKUs, and barcodes come from each retailer. Prices use the currency returned by its cart endpoint. Pricing and inventory may change. Compatibility with the original Ender-3 is unverified.
- **Identifiers.** `/part/hotend` is an app link. Creality has no published GTIN for this catalog's parts. Seller-listed barcodes with valid check digits are eligible for the demo's GS1 Digital Link URLs. Check digit validation confirms the number's format only. `/01/<gtin>` resolves through the checked-in snapshot and opens live offers for the captured part. The snapshot stores retailer provenance and capture time. Refresh the snapshot with `node scripts/snapshot-gtins.mjs` and rebuild. `/api/gtin?gtin=<digits>` can look up item facts in the rate-limited [UPCitemdb trial API](https://www.upcitemdb.com/api/explorer).

The Shopify and UPCitemdb requests need no API keys. Additional integrations could use eBay Browse API with eBay developer application keys or the Best Buy API with a Best Buy API key. BrickLink coverage is not applicable to printer parts.

## Build and verify

```sh
npm run build
npm test
npm run verify
```

Build outputs go to `dist/`. The Vite dev and preview servers mount the same API handlers used by the Vercel Node functions. The Vercel rewrite serves catalog deep links through the SPA.

Verification launches Chrome at `/usr/bin/google-chrome` with SwiftShader against Vite preview. It requires live retailer access for hotend and power supply results. It checks desktop and 393 × 852 iPhone interactions, including tour dismissal, the exploded mainboard, price sorting, list sharing, QR sheet print styles, and navigation from a generated QR without a camera. It writes eight `v4-*.png` screenshots in `shots/` alongside the existing verification captures.

## Credits

3D model: [Creality Ender-3 CAD](https://github.com/Creality3DPrinting/Ender-3) by Shenzhen Creality 3D Technology Co., Ltd., GPL-3.0. Converted to glTF and simplified by Mainstay. The converted model is distributed under GPL-3.0. See the [model license notice](public/models/ender3.LICENSE.txt) and the conversion scripts in `scripts/`.

The Sunrise 2027 explainer and 2025 survey figures are sourced from [GS1 US Sunrise 2027](https://www.gs1us.org/industries-and-insights/by-topic/sunrise-2027).

Live retailer data, fetched on demand. Not affiliated with or endorsed by Creality or GS1 US.
