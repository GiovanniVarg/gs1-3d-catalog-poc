import puppeteer from 'puppeteer-core'
const B=process.env.BASE||'https://gs1-3d-catalog-poc.vercel.app'
const chk=b=>{let s=0;[...b].reverse().forEach((d,i)=>s+=+d*(i%2?1:3));return String((10-s%10)%10)}
const g=ref=>{const b='00614141'+String(ref).padStart(5,'0');return b+chk(b)}
const browser=await puppeteer.launch({executablePath:'/usr/bin/google-chrome',headless:true,args:['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist']})
const out={errors:[]}
const p=await browser.newPage(); await p.setViewport({width:393,height:852,deviceScaleFactor:2,isMobile:true,hasTouch:true})
p.on('pageerror',e=>out.errors.push(String(e)))
// 1 deep link to door-right (ref 3)
const dl=g(3); out.deepLink=B+'/01/'+dl
await p.goto(out.deepLink,{waitUntil:'networkidle0'}); await p.waitForFunction(()=>window.__catalog?.ready===true,{timeout:60000})
await new Promise(r=>setTimeout(r,1500))
out.deepSelected=await p.evaluate(()=>window.__catalog.selectedId)
out.deepPanelText=await p.evaluate(()=>document.querySelector('h2, .part-name, [data-part-name]')?.textContent?.trim())
out.qrHref=await p.evaluate(()=>[...document.querySelectorAll('a,code,span')].map(e=>e.textContent).find(t=>t&&t.includes('/01/0061414')))
// qualifiers
await p.goto(B+'/01/'+g(15)+'/10/LOT42',{waitUntil:'networkidle0'}); await p.waitForFunction(()=>window.__catalog?.ready===true,{timeout:60000}); await new Promise(r=>setTimeout(r,800))
out.qualifierSelected=await p.evaluate(()=>window.__catalog.selectedId)
// 2 touch tap on hood from home
await p.goto(B+'/',{waitUntil:'networkidle0'}); await p.waitForFunction(()=>window.__catalog?.ready===true,{timeout:60000}); await new Promise(r=>setTimeout(r,1500))
const pt=await p.evaluate(()=>window.__catalog.projectPart('hood'))
await p.touchscreen.tap(pt.x,pt.y); await new Promise(r=>setTimeout(r,1500))
out.tapSelected=await p.evaluate(()=>window.__catalog.selectedId); out.tapPath=new URL(p.url()).pathname
await p.screenshot({path:'shots/live-phone-tap.png'})
// 3 bad gtin
await p.goto(B+'/01/12345678901234',{waitUntil:'networkidle0'}); await new Promise(r=>setTimeout(r,2500))
out.badSelected=await p.evaluate(()=>window.__catalog?.selectedId ?? null)
await browser.close()
console.log(JSON.stringify(out,null,1))
