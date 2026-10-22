import puppeteer from 'puppeteer-core'
import { readFileSync, writeFileSync } from 'fs'
const baseB64 = readFileSync('C:\\Users\\sarit\\AppData\\Local\\Temp\\opencode\\shots2\\cmp_base.png').toString('base64')
const browser = await puppeteer.launch({
  executablePath: 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  headless: true, args: ['--enable-unsafe-swiftshader', '--use-angle=swiftshader', '--no-sandbox'],
})
const page = await browser.newPage()
await page.setViewport({ width: 1600, height: 1000 })
await page.goto('http://localhost:5173', { waitUntil: 'networkidle2', timeout: 180000 })
await page.waitForFunction('window.__ready === true', { timeout: 180000 })
const out = await page.evaluate(async (baseB64) => {
  const THREE = window.__THREE
  const mgr = window.__scene
  window.__jump(0.8)
  mgr.parts.length = 0; mgr.apply = () => {}
  mgr.scene.traverse((o) => { if (o.isPoints) o.visible = false })
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
  // load base screenshot
  const img = await new Promise((r) => { const i = new Image(); i.onload = () => r(i); i.src = 'data:image/png;base64,' + baseB64 })
  const c = document.createElement('canvas'); c.width = 1600; c.height = 1000
  const g = c.getContext('2d')
  g.drawImage(img, 0, 0)
  // draw projected verts
  g.fillStyle = 'rgba(255,0,0,0.9)'
  pts.forEach(([x, y]) => { g.beginPath(); g.arc(x, y, 2.2, 0, 7); g.fill() })
  // scan for the TAN stick pixels (230,212,180-ish) and mark green
  const d = g.getImageData(0, 0, 1600, 1000)
  let tan = { n: 0, minx: 1e9, miny: 1e9, maxx: -1, maxy: -1 }
  for (let y = 100; y < 500; y++) for (let x = 400; x < 1100; x++) {
    const i = (y*1600+x)*4
    const r = d.data[i], gg = d.data[i+1], b = d.data[i+2]
    if (r > 205 && r < 245 && gg > 190 && gg < 228 && b > 155 && b < 200 && r-b > 35 && r-b < 70) {
      tan.n++
      if (x<tan.minx)tan.minx=x; if (x>tan.maxx)tan.maxx=x
      if (y<tan.miny)tan.miny=y; if (y>tan.maxy)tan.maxy=y
      d.data[i]=0; d.data[i+1]=255; d.data[i+2]=0
    }
  }
  g.putImageData(d, 0, 0)
  return { tan, overlay: c.toDataURL('image/png') }
}, baseB64)
console.log('tan stick pixels:', JSON.stringify(out.tan))
writeFileSync('C:\\Users\\sarit\\AppData\\Local\\Temp\\opencode\\shots2\\overlay.png', Buffer.from(out.overlay.split(',')[1], 'base64'))
await browser.close()
