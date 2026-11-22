import fs from 'fs'
import { Document, NodeIO } from '@gltf-transform/core'
import { weld, simplify, dedup, prune, quantize, meshopt as mo, reorder } from '@gltf-transform/functions'
import { MeshoptSimplifier, MeshoptEncoder } from 'meshoptimizer'
import { EXTMeshoptCompression, KHRMeshQuantization } from '@gltf-transform/extensions'
const d = JSON.parse(fs.readFileSync('occt.json'))
const doc = new Document(); const buf = doc.createBuffer(); const scene = doc.createScene('Ender-3')
const root = doc.createNode('Ender-3'); scene.addChild(root)
const mats = new Map()
const mat = c => { const k = (c||[0.6,0.6,0.62]).map(v=>v.toFixed(2)).join(','); if(!mats.has(k)){ const col=(c||[0.6,0.6,0.62]); mats.set(k, doc.createMaterial('m'+mats.size).setBaseColorFactor([...col,1]).setMetallicFactor(0.3).setRoughnessFactor(0.55)) } return mats.get(k) }
const clean = s => (s||'').split('_')[0].replace(/[^\x20-\x7E]/g,'').replace(/¡Á/g,'X').trim()
const counts = {}
const walk = (n) => {
  for (const c of n.children) {
    if (c.meshes.length) {
      const name = clean(c.name); counts[name]=(counts[name]||0)+1
      const node = doc.createNode(`${name}#${counts[name]}`); node.setExtras({ stepName: name })
      for (const mi of c.meshes) {
        const m = d.meshes[mi]
        const prim = doc.createPrimitive()
          .setAttribute('POSITION', doc.createAccessor().setType('VEC3').setArray(new Float32Array(m.pos)).setBuffer(buf))
          .setIndices(doc.createAccessor().setType('SCALAR').setArray(new Uint32Array(m.idx)).setBuffer(buf))
          .setMaterial(mat(m.color))
        if (false) prim.setAttribute('NORMAL', doc.createAccessor().setType('VEC3').setArray(new Float32Array(m.nor)).setBuffer(buf))
        const child = doc.createNode(node.getName()+'/'+mi).setMesh(doc.createMesh().addPrimitive(prim))
        node.addChild(child)
      }
      root.addChild(node)
    }
    walk(c)
  }
}
walk(d.root)
console.log(Object.entries(counts).sort((a,b)=>b[1]-a[1]).map(([k,v])=>k+':'+v).join(' | '))
await MeshoptSimplifier.ready; await MeshoptEncoder.ready
doc.createExtension(EXTMeshoptCompression).setRequired(true).setEncoderOptions({method: EXTMeshoptCompression.EncoderMethod.QUANTIZE})
await doc.transform(dedup(), weld({}), simplify({ simplifier: MeshoptSimplifier, ratio: 0.08, error: 0.003 }), prune(), reorder({encoder: MeshoptEncoder}), quantize())
const io = new NodeIO().registerExtensions([EXTMeshoptCompression, KHRMeshQuantization]).registerDependencies({'meshopt.encoder': MeshoptEncoder})
let tri=0; for (const m of doc.getRoot().listMeshes()) for (const p of m.listPrimitives()) tri+=p.getIndices().getCount()/3
console.log('tris', tri, 'materials', mats.size)
await io.write('ender3.glb', doc)
console.log(fs.statSync('ender3.glb').size)
