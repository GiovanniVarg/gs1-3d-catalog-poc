import { gtinCheckDigit } from './gtin'

export const categories = ['Exterior', 'Lighting', 'Wheels & brakes', 'Interior', 'Powertrain'] as const
export type Category = typeof categories[number]

type PartDefinition = {
  ref: number
  id: string
  name: string
  category: Category
  code: string
  nodes: RegExp
  description: string
  material: string
  weight: string
  dimensions: string
  price: number
  quantity: number
  stock: number
  explode?: [number, number, number]
}

const definitions: PartDefinition[] = [
  {
    ref: 1, id: 'hood', name: 'Hood assembly', category: 'Exterior', code: 'HD',
    nodes: /^BodyHood/, description: 'Lightweight front hood with integrated air outlets and a reinforced inner panel. The assembly lifts for access to the front service bay.',
    material: 'Aluminum alloy', weight: '8.4 kg', dimensions: '1,340 × 860 × 145 mm',
    price: 649, quantity: 1, stock: 12, explode: [0, .95, 1.02],
  },
  {
    ref: 2, id: 'door-left', name: 'Left door assembly', category: 'Exterior', code: 'DL',
    nodes: /^BodyDoorL|^InteriorDoorL/, description: 'Left-hand door assembly with exterior skin, side glass, mirror and interior trim. The inner shell provides mounting points for the handle and window mechanism.',
    material: 'Aluminum, glass and ABS', weight: '26.1 kg', dimensions: '1,280 × 985 × 210 mm',
    price: 1275, quantity: 1, stock: 3,
  },
  {
    ref: 3, id: 'door-right', name: 'Right door assembly', category: 'Exterior', code: 'DR',
    nodes: /^BodyDoorR|^InteriorDoorR/, description: 'Right-hand door module including side glass, mirror, exterior handle and interior trim. The fitted perimeter seal helps reduce wind noise around the opening.',
    material: 'Aluminum, glass and ABS', weight: '26.1 kg', dimensions: '1,280 × 985 × 210 mm',
    price: 1275, quantity: 1, stock: 4,
  },
  {
    ref: 4, id: 'windshield', name: 'Windshield & wipers', category: 'Exterior', code: 'WS',
    nodes: /^BodyWindshield/, description: 'Curved laminated front glazing with a perimeter gasket and matching wiper set. The blade profile follows the sweep of the glass.',
    material: 'Laminated glass and EPDM', weight: '12.2 kg', dimensions: '1,380 × 690 × 95 mm',
    price: 429, quantity: 1, stock: 9, explode: [0, .81, .38],
  },
  {
    ref: 5, id: 'headlights', name: 'Headlight set', category: 'Lighting', code: 'HL',
    nodes: /^BodyHeadlights$/, description: 'Paired front light modules shaped to follow the hood and fenders. Each sealed housing contains the low beam, high beam and daytime running light.',
    material: 'Polycarbonate and aluminum', weight: '3.2 kg / set', dimensions: '360 × 165 × 110 mm each',
    price: 539, quantity: 1, stock: 14, explode: [0, .08, 1.62],
  },
  {
    ref: 6, id: 'taillights', name: 'Taillight set', category: 'Lighting', code: 'TL',
    nodes: /^BodyTaillights|^BodyTurnsignalsRear/, description: 'Matched rear lamp assemblies with brake lights and turn signals. The molded lenses follow the rear body panel contours.',
    material: 'Acrylic and ABS', weight: '2.4 kg / set', dimensions: '320 × 118 × 90 mm each',
    price: 315, quantity: 1, stock: 0, explode: [0, .44, -1.1],
  },
  ...([
    [7, 'front-left', 'Front left wheel', 'FL', 'FrontL', 'front', 'left'],
    [8, 'front-right', 'Front right wheel', 'FR', 'FrontR', 'front', 'right'],
    [9, 'rear-left', 'Rear left wheel', 'RL', 'RearL', 'rear', 'left'],
    [10, 'rear-right', 'Rear right wheel', 'RR', 'RearR', 'rear', 'right'],
  ] as const).map(([ref, id, name, code, node, axle, side]): PartDefinition => ({
    ref, id, name, category: 'Wheels & brakes', code: 'W' + code,
    nodes: new RegExp('^Wheel' + node + '$'),
    description: `Mounted alloy wheel and directional tire for the ${axle} ${side} corner. The assembly is supplied balanced with a valve stem installed.`,
    material: 'Forged aluminum and rubber', weight: axle === 'front' ? '19.6 kg' : '21.2 kg',
    dimensions: axle === 'front' ? '245/35 R20 on 20 × 8.5 in' : '275/35 R20 on 20 × 9.5 in',
    price: axle === 'front' ? 485 : 525, quantity: 1, stock: ref === 9 ? 2 : 8,
  })),
  {
    ref: 11, id: 'brakes', name: 'Disc brake kit', category: 'Wheels & brakes', code: 'BK',
    nodes: /^Wheel.*Brake(?:Disc|Pad)$/, description: 'Four-corner service kit with vented rotors and matching friction pads. Rotor ventilation helps dissipate heat during repeated braking.',
    material: 'Cast iron and ceramic composite', weight: '28.4 kg / kit', dimensions: '350 mm front / 330 mm rear rotors',
    price: 725, quantity: 1, stock: 6, explode: [0, .48, 0],
  },
  {
    ref: 12, id: 'steering-wheel', name: 'Steering wheel', category: 'Interior', code: 'SW',
    nodes: /^InteriorSteeringCylinder$|^InteriorSteeringBase$/, description: 'Compact three-spoke wheel with a wrapped grip and molded center trim. The hub interface matches the concept steering column.',
    material: 'Magnesium and synthetic leather', weight: '1.8 kg', dimensions: '360 × 345 × 105 mm',
    price: 249, quantity: 1, stock: 8, explode: [.24, 1.45, 1.43],
  },
  {
    ref: 13, id: 'seats', name: 'Seat set', category: 'Interior', code: 'ST',
    nodes: /^InteriorSeats/, description: 'Pair of contoured bucket seats with integrated headrests and adjustable slider frames. Bolstered cushions support the driver and passenger during cornering.',
    material: 'Steel, molded foam and microfiber', weight: '29.2 kg / set', dimensions: '540 × 595 × 910 mm each',
    price: 960, quantity: 1, stock: 5, explode: [0, 1.78, -.62],
  },
  {
    ref: 14, id: 'pedals', name: 'Pedal set', category: 'Interior', code: 'PD',
    nodes: /^InteriorPedal/, description: 'Accelerator and brake pedals with matching arms and textured contact faces. The compact mounting layout fits the concept footwell.',
    material: 'Aluminum and stainless steel', weight: '1.4 kg / set', dimensions: '255 × 165 × 125 mm',
    price: 145, quantity: 1, stock: 16, explode: [1.02, .74, 1.38],
  },
  {
    ref: 15, id: 'engine', name: 'Engine assembly', category: 'Powertrain', code: 'EN',
    nodes: /^Engine$/, description: 'Complete engine long block with the intake and accessory housing represented in the model. The assembly mounts to the concept vehicle cradle.',
    material: 'Cast aluminum and steel', weight: '176 kg', dimensions: '725 × 680 × 655 mm',
    price: 4895, quantity: 1, stock: 0, explode: [-.54, 1.23, -1.13],
  },
  {
    ref: 16, id: 'axles', name: 'Axle set', category: 'Powertrain', code: 'AX',
    nodes: /^Axles$/, description: 'Front and rear axle assemblies with matching hub interfaces. The shafts transfer drive loads while allowing movement through suspension travel.',
    material: 'Heat-treated alloy steel', weight: '18.7 kg / set', dimensions: '1,565 mm front / 1,585 mm rear track',
    price: 580, quantity: 1, stock: 3, explode: [0, -.51, .12],
  },
  {
    ref: 17, id: 'roof-panel', name: 'Roof panel', category: 'Exterior', code: 'RF',
    nodes: /^BodyRoofPanel$/, description: 'Formed outer roof panel with a bonded reinforcement layer. The curved edges align with the windshield header and side pillars.',
    material: 'Carbon fiber composite', weight: '5.1 kg', dimensions: '1,230 × 940 × 75 mm',
    price: 820, quantity: 1, stock: 4, explode: [0, 2.35, 0],
  },
  {
    ref: 18, id: 'rear-hatch', name: 'Rear hatch & glass', category: 'Exterior', code: 'RH',
    nodes: /^InteriorRearHatch$|^BodyRearwindow$/, description: 'Rear closure with bonded glazing and inner hatch trim. The frame includes attachment points for lift supports and the latch.',
    material: 'Aluminum and tempered glass', weight: '14.3 kg', dimensions: '1,165 × 735 × 150 mm',
    price: 765, quantity: 1, stock: 7, explode: [0, 1.08, -1.02],
  },
]

export const parts = definitions.map(part => {
  const gtinBody = '00614141' + String(part.ref).padStart(5, '0')
  const partNumber = `MCX-${part.code}-${1000 + part.ref}`
  const sellerPath = `https://example.com/parts/${part.id}`
  return {
    ...part,
    partNumber,
    gtin: gtinBody + gtinCheckDigit(gtinBody),
    status: part.stock === 0 ? 'Backorder' : part.stock <= 4 ? 'Low stock' : 'In stock',
    specs: [
      ['Material', part.material],
      ['Weight', part.weight],
      ['Dimensions', part.dimensions],
      ['Fitment', 'CarConcept MCX'],
      ['Warranty', '12 months (sample)'],
    ],
    sellers: [
      { name: 'Example Auto Parts Co.', price: part.price, shipping: part.stock ? 'Ships in 2–4 days' : 'ETA 2–3 weeks', inStock: part.stock > 0, url: sellerPath + '/example-auto' },
      { name: 'Sample OEM Direct', price: part.price + 24, shipping: 'Ships in 3–5 days', inStock: true, url: sellerPath + '/sample-oem' },
      { name: 'DemoParts Marketplace', price: part.price - 15, shipping: 'ETA 1–2 weeks', inStock: false, url: sellerPath + '/demoparts' },
    ],
    nearbyUrl: sellerPath + '/nearby',
  }
})

export type Part = typeof parts[number]

export function partPath(part: Part): string {
  return '/01/' + part.gtin
}
