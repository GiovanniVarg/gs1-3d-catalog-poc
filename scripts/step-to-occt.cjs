const fs=require('fs');const occt=require('occt-import-js');
(async()=>{const o=await occt();const buf=new Uint8Array(fs.readFileSync('Ender3.STEP'));
const t=Date.now();const r=o.ReadStepFile(buf,{linearUnit:'meter',linearDeflectionType:'bounding_box_ratio',linearDeflection:0.002,angularDeflection:0.5});
console.log('ok',r.success,'meshes',r.meshes.length,(Date.now()-t)/1000+'s');
let tri=0;r.meshes.forEach(m=>tri+=m.index.array.length/3);console.log('tris',tri);
const walk=(n,d)=>{if(d<3)console.log(' '.repeat(d*2)+n.name,'m',n.meshes.length,'c',n.children.length);n.children.forEach(c=>walk(c,d+1))};walk(r.root,0);
fs.writeFileSync('occt.json',JSON.stringify({root:r.root,meshes:r.meshes.map(m=>({name:m.name,color:m.color,pos:Array.from(m.attributes.position.array),nor:m.attributes.normal?Array.from(m.attributes.normal.array):null,idx:Array.from(m.index.array)}))}));
})();
