import { searches } from '../api/_lib/search.js'

export const bomUrl = 'https://github.com/Creality3DPrinting/Ender-3/blob/master/Ender-3%20Mechanical/Ender-3%20BOM.XLS'
export const cadUrl = 'https://github.com/Creality3DPrinting/Ender-3'

export const categories = ['Toolhead', 'Motion', 'Build platform', 'Electronics', 'Frame & hardware'] as const
export type Category = typeof categories[number]
type PartId = keyof typeof searches

export type BomLine = { code: string; name: string; spec: string; qty: number }
export type Part = {
  id: PartId
  name: string
  category: Category
  stepNames: readonly (string | RegExp)[]
  bomLines: readonly BomLine[]
  description: string
  live: { query: string; mustMatch: RegExp; excludes: RegExp } | null
}

type BomRow = [code: string, name: string, spec: string, qty: number]

function tag(
  id: PartId, name: string, category: Category, stepNames: Part['stepNames'], description: string, rows: BomRow[],
): Part {
  return {
    id, name, category, stepNames, description, live: searches[id],
    bomLines: rows.map(([code, name, spec, qty]) => ({ code, name, spec, qty })),
  }
}

// BOM rows are transcribed from data/ender3-bom.csv. STEP tags refer to CAD occurrences,
// including grouped assemblies whose individual BOM lines are not separately modeled.
export const parts: readonly Part[] = [

  tag("hotend", "Hotend", "Toolhead", [
    "Sprinkler assembly",
  ], "The assembly includes a heat block, a 0.4 mm nozzle, a radiator, a 24 V heater and a nozzle thermistor.", [
    ["400104004", "Heat block", "20*20*10", 1],
    ["400106003", "nozzle", "0.4mm", 2],
    ["400105008", "Radiator", "12*20*27.8mm,2*M3", 1],
    ["400308002", "Heater", "24V，40W-L1000MM，Φ6*20", 1],
    ["400303006", "Nozzle thermistor", "D1.8-L1000mm-100K", 1],
    ["400107006", "Catheter", "D7-M6-L28mm", 1],
  ]),
  tag("hotend-fans", "Hotend fans & shroud", "Toolhead", [
    "Fan assembly",
  ], "Two 24 V 4010 fans, a fan cover and a nozzle fan duct are listed in the BOM.", [
    ["400309032", "Cold section fan", "24V-4010-L1000-7600r", 1],
    ["400309044", "Nozzle fan", "24V-4010-L1000-5800r", 1],
    ["400101029", "Fan cover", "0.8mm", 1],
    ["400402023", "Nozzle fan duct", "", 1],
  ]),
  tag("extruder", "Extruder", "Toolhead", [
    "E housing", "E idler tensioner", "E gear", "Extrusion Spring",
    "M6 Pneumatic joint",
  ], "Extruder housing, idler tensioner, gear, spring and pneumatic joints.", [
    ["400404033", "E housing", "", 1],
    ["400404032", "E idler tensioner", "", 1],
    ["400103001", "E gear", "D11-40", 1],
    ["400204002", "Extrusion Spring", "1.1*8*L22", 5],
    ["400210001", "Pneumatic joint", "D4M8", 1],
    ["400210002", "M6 Pneumatic joint", "KJH04-06", 2],
    ["400407013", "D4 Teflon tube", "D4-d2-L400mm", 1],
  ]),
  tag("steppers", "Stepper motors", "Motion", [
    "42-34 motor", "40-42 motor",
  ], "The BOM lists three 42-34 motors and one 42-40 motor. The CAD labels the latter “40-42 motor”.", [
    ["400201001", "42-34 Motor", "JK42HS34-0844YA-03F", 3],
    ["400201004", "42-40 Motor", "JK42HS40-1004AC-01F", 1],
  ]),
  tag("hotbed", "Heated bed", "Build platform", [
    "Hot bed", "Y plate",
  ], "24 V heated bed, 235 × 235 mm, 220 W per the Ender-3 BOM.", [
    ["400302026", "Hot bed", "24V，235*235mm，220W", 1],
    ["400101129", "Y plate", "4mm", 1],
    ["400303022", "Bed  thermistor", "D1.8-L700mm-100K", 1],
    ["400505021", "Fiber board", "235*235*1.0mm", 1],
    ["400404030", "Hot bed wire bracket", "", 1],
    ["400404031", "Hot bed line support cover", "", 1],
  ]),
  tag("leveling", "Bed leveling", "Build platform", [
    "Bed level springs", "Hand Twisted Nut",
  ], "The CAD shows springs and hand-twisted nuts under the bed. The BOM does not list a separate bed spring code.", [
    ["400404040", "Hand Twisted Nut", "D60mm", 4],
  ]),
  tag("mainboard", "Mainboard & case fan", "Electronics", [
    "Control panel", "Case fan", "Sheetmetal enclosure top", "Sheetmetal enclosure bottom",
  ], "1284P control panel, 24 V case fan and two sheet-metal enclosure pieces.", [
    ["200101027", "Control panel", "1284P", 1],
    ["400309045", "Case fan", "24V-4010-L150mm", 1],
    ["400101130", "Sheetmetal enclosure bottom", "0.8MM", 1],
    ["400101131", "Sheetmetal enclosure top", "0.8MM", 1],
  ]),
  tag("lcd", "LCD & knob", "Electronics", [
    "lcd", "lcd Knob", "LCD support",
  ], "LCD and knob mounted on the LCD support.", [
    ["200102010", "LCD", "", 1],
    ["400307001", "lcd Knob", "", 1],
    ["400101133", "LCD support", "2MM", 1],
  ]),
  tag("psu", "Power supply", "Electronics", [
    "24V15A power supply", "Power holder", "power switch",
  ], "24 V, 15 A power supply with a holder and a 10 A power switch.", [
    ["400301008", "24V15A power supply", " 24V 15A", 1],
    ["400402028", "Power holder", "2mm", 1],
    ["400305007", "power switch", "10A", 1],
  ]),
  tag("belts", "X & Y belts", "Motion", [
    "X belt", "Y belt",
  ], "The BOM lists separate 6 mm-wide belts for the X and Y axes.", [
    ["400212037", "X   belt", "2M-W6-L786mm", 1],
    ["400212038", "Y  belt", "2M-W6-L743mm", 1],
  ]),
  tag("pulleys", "Pulleys", "Motion", [
    "2GT-pulley", "pulley mount",
  ], "The BOM lists two 2GT pulleys. The CAD also shows pulley mounts.", [
    ["400211009", "2GT-pulley", "2GT-d5-20-6mm", 2],
  ]),
  tag("wheels", "V-wheels", "Motion", [
    "V Wheel Component", "Eccentric column", "Spacers for rollers",
  ], "Rollers, 625ZZ bearings, eccentric columns and roller spacers.", [
    ["400403003", "Rollers", "", 13],
    ["400202004", "625ZZ Pillow", "625ZZ", 26],
    ["400108002", "Eccentric column", "D7.2-d5-H-8.35mm", 5],
    ["400108001", "Spacers for rollers", "D8-d5-H-8.35mm", 11],
  ]),
  tag("z-axis", "Z-axis drive", "Motion", [
    "Z threaded rod", "z nut", "Z coupler", "Z motor bracket",
  ], "T8 threaded rod and nut, with a coupler and a Z motor bracket.", [
    ["400206017", "Z threaded rod", "T8*8-L365mm", 1],
    ["400205111", "z nut", "T8*8", 1],
    ["400208004", "Z coupler", "D5*8", 1],
    ["400402010", "Z motor bracket", "", 1],
  ]),
  tag("frame", "Frame extrusions", "Frame & hardware", [
    "2020 profile", "2040 profile", "4040 profile", "2020 Endcap",
    "4040 Endcap",
  ], "2020, 2040 and 4040 profiles form the frame, with endcaps shown on the 2020 and 4040 profiles.", [
    ["400102065", "2020 Top Profile", "20*20-L330", 1],
    ["400102066", "2020 X Profile", "20*20-L345", 1],
    ["400102067", "2040 Y Profile", "20*40-L330", 1],
    ["400102068", "2040 Right Profile", "20*40-L400", 1],
    ["400102069", "2040 Left Profile", "20*40-L400", 1],
    ["400102070", "4040 Central Profile", "40*40-L250", 1],
    ["400102071", "4040 Left Profile", "40*40-L290", 1],
    ["400102072", "4040 Right Profile", "40*40-L290-2", 1],
    ["400402020", "2020 Endcap", "2020", 2],
    ["400404041", "4040 Endcap", "ABS", 2],
  ]),
  tag("limit-switches", "Limit switches", "Electronics", [
    "limit switch", "Z Limit Switch assembly", "X limit switch bracket", "Y limit switch bracket",
  ], "Three 3-pin limit switches and X, Y and Z brackets.", [
    ["400304001", "limit switch", "3PIN", 3],
    ["400404038", "X limit switch bracket", "ABS", 1],
    ["400402032", "Y limit switch bracket", "ABS", 1],
    ["400402033", "Z limit switch bracket", "ABS", 1],
  ]),
  tag("carriages", "Carriages & brackets", "Frame & hardware", [
    "Y Motor holder", "X motor bracket", "E motor bracket", "E plate",
    "Z Stent", "X Adjustment Block", "Support frame", "Support tube",
    "Copper cover", "F688 pillow", "624U pillow", "M30 Plastic nut",
    "M4 T-Slot Nut", "M5 T-Slot Nut",
  ], "Motors and moving assemblies are mounted on plates and brackets. This group also includes the support tube and its mounting hardware.", [
    ["400101005", "Y Motor holder", "3mm", 1],
    ["400101104", "X motor bracket", "3mm，B1", 1],
    ["400101103", "E motor bracket", "2.5mm，B1", 1],
    ["400101002", "E plate", "2.5mm", 1],
    ["400101027", "Z Stent", "3.0mm", 1],
    ["400101006", "X Adjustment Block", "3mm", 1],
    ["400101007", "Y Adjustment Block", "3mm", 1],
    ["400101081", "Support frame", "2.0mm", 1],
    ["400403004", "Support tube", "", 1],
    ["400214001", "Copper cover", "D8-0.8", 4],
    ["400202003", "F688ZZ  Pillow", "F688ZZ", 4],
    ["400202002", "624U  Pillow", "624U", 1],
    ["400403005", "M30 Plastic nut", "M30*6.5", 2],
    ["400205101", "M4  T-Slot Nut", "M4T", 8],
    ["400205102", "M5  T-Slot Nut", "M5T", 3],
  ]),
  tag("fasteners", "Metric fasteners", "Frame & hardware", [
    "M340 Flush Head Screw",
    /^M[2-8](?!\d)(?! T-Slot Nut$).*(?:screw|washer|nut)$/i,
  ], "Standard metric hardware. Some fastener names differ between the CAD and the BOM. The table lists the published BOM lines.", [
    ["400205002", "M2*8  Socket Head Screw", "M2*8", 2],
    ["400205003", "M2*10 Socket Head Screw", "M2*10", 2],
    ["400205007", "M3*18 Socket Head Screw", "M3*18", 1],
    ["400205013", "M4*8Socket Head Screw", "M4*8", 7],
    ["400205014", "M4*10 Socket Head Screw", "M4*10", 2],
    ["400205015", "M4*16 Socket Head Screw", "M4*16", 4],
    ["400205018", "M3*3  screw", "M3*3", 4],
    ["400205019", "M4  screw", "M4", 4],
    ["400205021", "M3*4  Pan Head Screw", "M3*4", 1],
    ["400205029", "M3*6  Pan Head Screw", "M3*6", 18],
    ["400205031", "M3*10 Pan Head Screw", "M3*10", 12],
    ["400205032", "M3*16 Pan Head Screw", "M3*16", 5],
    ["400205044", "M5*8 Pan Head Screw", "M5*8", 8],
    ["400205053", "M5*30 Pan Head Screw", "M5*30", 10],
    ["400205055", "M5*40 Pan Head Screw", "M5*40", 3],
    ["400205060", "M3*10 Pan Head Screw", "M3*10-P", 1],
    ["400205068", "M4*14  Pan Head Screw", "M4*14-P", 2],
    ["400205074", "M4*35 Flush Head Screw", "M4*35-P", 4],
    ["400205097", "M5 Self-locking nut", "M5", 13],
    ["400205098", "M8 Self-locking nut", "M8", 2],
    ["400205105", "M3 Split Washer", "M3", 6],
    ["400205106", "M4  Split Washer", "M4", 7],
    ["400205107", "M5  Split Washer", "M5", 12],
    ["400205109", "M5  washer", "M5", 5],
    ["400205110", "M5  washer1", "5*8*1", 13],
    ["400205122", "M4*20  Socket Head Screw", "M4*20", 3],
    ["400205140", "M4*18  Pan Head Screw", "M4*18-P", 2],
    ["400205141", "M3*40  Pan Head Screw", "M3*40-P", 4],
    ["400205144", "M3*18  Pan Head Screw", "M3*18-P", 2],
    ["400205148", "M4*16 Screw", "", 5],
    ["400205153", "M3*6   Screw", "M3*6", 2],
    ["400205163", "M5*25 Socket Head Screw", "M5*25", 6],
    ["400205165", "M5*40 Socket Head Screw", "M5*40", 2],
    ["400205166", "M5*45 Socket Head Screw", "M5*45", 10],
    ["400205176", "M8*35  Pan Head Screw", "M8*35", 2],
  ]),
]

export function matchesStepName(part: Part, stepName: string) {
  return part.stepNames.some(tag => typeof tag === 'string' ? tag === stepName : tag.test(stepName))
}

export function partPath(part: Part) {
  return '/part/' + part.id
}
