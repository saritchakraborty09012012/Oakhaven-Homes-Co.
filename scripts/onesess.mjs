import puppeteer from 'puppeteer-core'
import { writeFileSync } from 'fs'
const browser = await puppeteer.launch({
  executablePath: 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  headless: true, args: ['--enable-unsafe-swiftshader', '--use-angle=swiftshader', '--no-sandbox'],
})
const page = await browser.newPage()
await page.setViewport({ width: 1600, height: 1000 })
await page.goto('http://localhost:5173', { waitUntil: 'networkidle2', timeout: 180000 })
await page.waitForFunction('window.__ready === true', { timeout: 180000 })
await page.evaluate(() => {
  window.__jump(0.8)
  window.__scene.parts.length = 0
  window.__scene.apply = () => {}
  window.__scene.scene.traverse((o) => { if (o.isPoints) o.visible = false })
})
await new Promise((r) => setTimeout(r, 900))
const shot1 = await page.screenshot({ encoding: 'base64' })
await page.evaluate(() => {
  window.__scene.scene.traverse((o) => {
    if (!o.isMesh) return
    const label = o.name.includes('|') ? o.name.split('|')[5] : o.name
    if (label.startsWith('frm_gableA')) o.visible = false
  })
})
await new Promise((r) => setTimeout(r, 300))
const shot2 = await page.screenshot({ encoding: 'base64' })
// restore + project in same camera state
const proj = await page.evaluate(() => {
  const THREE = window.__THREE
  const mgr = window.__scene
  mgr.scene.traverse((o) => {
    if (!o.isMesh) return
    const label = o.name.includes('|') ? o.name.split('|')[5] : o.name
    if (label.startsWith('frm_gableA')) o.visible = true
  })
  let cam = mgr.camera
  if (!cam) mgr.scene.traverse((o) => { if (o.isCamera && !cam) cam = o })
  cam.updateMatrixWorld()
  let mesh = null
  mgr.scene.traverse((o) => {
    if (o.isMesh && (o.name.includes('|') ? o.name.split('|')[5] : o.name) === 'frm_gableA') mesh = o
  })
  mesh.updateWorldMatrix(true, false)
  const pos = mesh.geometry.attributes.position
  const v = new THREE.Vector3()
  const pts = []
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i).applyMatrix4(mesh.matrixWorld).project(cam)
    pts.push([(v.x*0.5+0.5)*1600, (-v.y*0.5+0.5)*1000])
  }
  const cp = new THREE.Vector3().setFromMatrixPosition(cam.matrixWorld)
  return { pts, cam: cp.toArray().map(n=>+n.toFixed(2)) }
})
// compose: shot1 base, green=diff pixels, red=projected verts
const overlay = await page.evaluate(async (s1, s2, pts) => {
  const ld = (d) => new Promise((r) => { const i = new Image(); i.onload = () => r(i); i.src = 'data:image/png;base64,' + d })
  const ia = await ld(s1), ib = await ld(s2)
  const c = document.createElement('canvas'); c.width = 1600; c.height = 1000
  const g = c.getContext('2d')
  g.drawImage(ia, 0, 0)
  const da = g.getImageData(0, 0, 1600, 1000)
  const t = document.createElement('canvas'); t.width = 1600; t.height = 1000
  const gt = t.getContext('2d'); gt.drawImage(ib, 0, 0)
  const db = gt.getImageData(0, 0, 1600, 1000)
  let n = 0, minx=1e9,miny=1e9,maxx=-1,maxy=-1
  for (let y = 0; y < 1000; y++) for (let x = 0; x < 1600; x++) {
    const i = (y*1600+x)*4
    const d = Math.abs(da.data[i]-db.data[i])+Math.abs(da.data[i+1]-db.data[i+1])+Math.abs(da.data[i+2]-db.data[i+2])
    if (d > 90 && x < 1400 && y < 700) {
      n++
      if (x<minx)minx=x; if (x>maxx)maxx=x; if (y<miny)miny=y; if (y>maxy)maxy=y
      da.data[i]=0; da.data[i+1]=255; da.data[i+2]=0
    }
  }
  g.putImageData(da, 0, 0)
  g.fillStyle = 'rgba(255,0,0,0.95)'
  pts.forEach(([x, y]) => { g.beginPath(); g.arc(x, y, 2.5, 0, 7); g.fill() })
  return { diff: { n, bbox: [minx,miny,maxx,maxy] }, url: c.toDataURL('image/png') }
}, shot1, shot2, proj.pts)
console.log('camera', JSON.stringify(proj.cam))
console.log('diff bbox', JSON.stringify(overlay.diff))
writeFileSync('C:\\Users\\sarit\\AppData\\Local\\Temp\\opencode\\shots2\\onesession.png', Buffer.from(overlay.url.split(',')[1], 'base64'))
await browser.close()
