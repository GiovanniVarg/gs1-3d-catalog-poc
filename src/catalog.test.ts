import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { searches } from '../api/_lib/search.js'
import { matchesStepName, parts } from './catalog'
import { isValidGtin } from './gtin'
import snapshot from './gtin-snapshot.json'

describe('Ender-3 sources', () => {
  it('assigns every STEP occurrence in the GLB to exactly one catalog part', () => {
    const glb = readFileSync('public/models/ender3.glb')
    expect(glb.toString('ascii', 0, 4)).toBe('glTF')
    expect(glb.toString('ascii', 16, 20)).toBe('JSON')
    type Node = { name: string; children?: number[]; extras?: { stepName?: string } }
    const { nodes, scenes } = JSON.parse(glb.toString('utf8', 20, 20 + glb.readUInt32LE(12))) as {
      nodes: Node[]
      scenes: { nodes: number[] }[]
    }
    const root = nodes[scenes[0].nodes[0]]
    expect(root.name).toBe('Ender-3')
    expect(root.children).toHaveLength(225)
    const tagged = new Set<string>()
    for (const index of root.children!) {
      const { name, extras } = nodes[index]
      expect(extras?.stepName).toBe(name.replace(/#\d+$/, ''))
      const matching = parts.filter(part => matchesStepName(part, extras!.stepName!))
      expect(matching.map(part => part.id), name).toHaveLength(1)
      tagged.add(matching[0].id)
    }
    expect(tagged).toEqual(new Set(parts.map(part => part.id)))
  })

  it('preserves published BOM names, specifications and quantities for all tagged codes', () => {
    const csv = readFileSync('data/ender3-bom.csv', 'utf8')
    const rows = new Map(csv.split(/\r?\n/).slice(2).filter(Boolean).map(line => {
      const fields = line.match(/(?<=^|,)(?:"(?:[^"]|"")*"|[^,]*)/g)!
      const [code, name, spec, , qty] = fields.map(field =>
        field.startsWith('"') ? field.slice(1, -1).replaceAll('""', '"') : field)
      return [code, { code, name, spec, qty: Number(qty) }]
    }))
    const taggedCodes = new Set<string>()
    for (const part of parts) {
      expect(part.bomLines.length).toBeGreaterThan(0)
      for (const line of part.bomLines) {
        expect(line, `${part.id} · ${line.code}`).toEqual(rows.get(line.code))
        expect(taggedCodes.has(line.code), line.code).toBe(false)
        taggedCodes.add(line.code)
      }
    }
    expect(parts.map(part => part.id).sort()).toEqual(Object.keys(searches).sort())
  })

  it('contains a live capture of valid seller-listed identifiers', () => {
    expect(Object.keys(snapshot).length).toBeGreaterThan(0)
    for (const [gtin, row] of Object.entries(snapshot)) {
      expect(isValidGtin(gtin) && gtin.length === 14).toBe(true)
      expect(row.gtin).toBe(gtin)
      expect(parts.some(part => part.id === row.partId && part.live)).toBe(true)
      expect(new URL(row.url).protocol).toBe('https:')
      expect(Number.isFinite(Date.parse(row.capturedAt))).toBe(true)
    }
  })
})
