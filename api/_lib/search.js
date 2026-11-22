const excludes = /\b(?:refurbished|used|gift card|pre[- ]owned)\b/i

function lookup(query, mustMatch, exclusions = excludes) {
  return { query, mustMatch, excludes: exclusions }
}

export const searches = {
  hotend: lookup('ender 3 hotend', /hot ?end|nozzle/i, new RegExp(
    `${excludes.source}|\\bender[ -]3[ -]+(?:s1|v3|neo|v2 neo)\\b|\\b(?:prusa|nextruder)\\b`, 'i',
  )),
  'hotend-fans': lookup('4010 fan', /4010|40 ?x ?10|fan/i),
  extruder: lookup('ender 3 extruder', /extruder/i),
  steppers: lookup('nema 17 stepper', /nema ?17|stepper/i),
  hotbed: lookup('ender 3 bed', /bed|build plate|pei/i),
  leveling: lookup('bed leveling', /level|spring|knob/i),
  mainboard: lookup('creality board', /board/i),
  lcd: lookup('ender 3 lcd', /lcd|display|screen/i),
  psu: lookup('24v power supply', /power supply|psu/i),
  belts: lookup('gt2 belt', /gt2|2gt/i),
  pulleys: lookup('gt2 pulley', /pulley/i),
  wheels: lookup('v wheel', /wheel/i),
  'z-axis': lookup('t8 lead screw', /lead ?screw|t8|coupler/i),
  frame: lookup('2020 extrusion', /extrusion|2020|v-slot|profile/i),
  'limit-switches': lookup('limit switch', /limit|endstop/i),
  carriages: lookup('ender 3 bracket', /ender[ -]?3/i),
  fasteners: null,
}
