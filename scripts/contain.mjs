import puppeteer from 'puppeteer-core'
const browser = await puppeteer.launch({
  executablePath: 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  headless: true,
  args: ['--enable-unsafe-swiftshader', '--use-angle=swiftshader', '--no-sandbox'],
})
const page = await browser.newPage()
await page.setViewport({ width: 1600, height: 1000 })
await page.goto('http://localhost:5173', { waitUntil: 'networkidle2', timeout: 180000 })
await page.waitForFunction('window.__ready === true', { timeout: 180000 })
const out = await page.evaluate(() => {
  window.__jump(0.8)
  window.__scene.parts.length = 0
  window.__scene.apply = () => {}
  const THREE = window.__THREE
  const mgr = window.__scene
  let cam = mgr.camera
  if (!cam) { mgr.scene.traverse(o => { if (o.isCamera && !cam) cam = o }) }
  const pts = [[720,230],[990,270],[1380,295]]
  const res = pts.map(p => ({ pt: p, hits: [] }))
  const bbox = new THREE.Box3()
  const v = new THREE.Vector3()
  mgr.scene.traverse(o => {
    if (!o.isMesh || !o.visible) return
    const label = o.name.includes('|') ? o.name.split('|')[5] : o.name
    bbox.setFromObject(o)
    // project 8 corners -> screen rect
    let minx=1e9,miny=1e9,maxx=-1e9,maxy=-1e9
    for (let i=0;i<8;i++){
      v.set(i&1?bbox.max.x:bbox.min.x, i&2?bbox.max.y:bbox.min.y, i&4?bbox.max.z:bbox.min.z)
      v.project(cam)
      const sx=(v.x*0.5+0.5)*1600, sy=(-v.y*0.5+0.5)*1000
      minx=Math.min(minx,sx);maxx=Math.max(maxx,sx);miny=Math.min(miny,sy);maxy=Math.max(maxy,sy)
    }
    res.forEach(r=>{
      const [px,py]=r.pt
      if (px>=minx&&px<=maxx&&py>=miny&&py<=maxy)
        r.hits.push({label, w:[+((bbox.max.x-bbox.min.x).toFixed(2)),+((bbox.max.y-bbox.min.y).toFixed(2)),+((bbox.max.z-bbox.min.z).toFixed(2))],
          c:[+(((bbox.min.x+bbox.max.x)/2).toFixed(2)),+(((bbox.min.y+bbox.max.y)/2).toFixed(2)),+(((bbox.min.z+bbox.max.z)/2).toFixed(2))],
          area: Math.round((maxx-minx)*(maxy-miny))})
    })
  })
  res.forEach(r=>{ r.hits.sort((a,b)=>a.area-b.area); r.hits=r.hits.slice(0,14) })
  return res
})
console.log(JSON.stringify(out,null,1))
await browser.close()
