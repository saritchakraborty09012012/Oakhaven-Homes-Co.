import puppeteer from 'puppeteer-core'
const browser = await puppeteer.launch({
  executablePath: 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  headless: true, args: ['--enable-unsafe-swiftshader', '--use-angle=swiftshader', '--no-sandbox'],
})
const page = await browser.newPage()
await page.setViewport({ width: 1600, height: 1000 })
await page.goto('http://localhost:5173', { waitUntil: 'networkidle2', timeout: 180000 })
await page.waitForFunction('window.__ready === true', { timeout: 180000 })
const out = await page.evaluate(() => {
  const THREE = window.__THREE
  const mgr = window.__scene
  window.__jump(0.8)
  mgr.parts.length = 0; mgr.apply = () => {}
  let mesh = null
  mgr.scene.traverse((o) => {
    if (o.isMesh && (o.name.includes('|') ? o.name.split('|')[5] : o.name) === 'frm_gableA') mesh = o
  })
  mesh.updateWorldMatrix(true, false)
  const u0 = -6.5, u1 = -1.5, zb = 6.42, zpk = 9.12, peak = -4
  const ztop = (x) => x <= peak ? zb + (x-u0)/(peak-u0)*(zpk-zb) : zb + (u1-x)/(u1-peak)*(zpk-zb)
  const pos = mesh.geometry.attributes.position
  const v = new THREE.Vector3()
  const bad = []
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i).applyMatrix4(mesh.matrixWorld)
    const inTri = v.x >= u0-0.15 && v.x <= u1+0.15 && v.y >= zb-0.2 && v.y <= zpk+0.25 && Math.abs(v.z) <= 0.12
    const belowRake = v.y <= ztop(v.x) + 0.09
    if (!inTri || !belowRake)
      bad.push({ i, p: [+v.x.toFixed(3), +v.y.toFixed(3), +v.z.toFixed(3)], inTri, over: +(v.y - ztop(v.x)).toFixed(3) })
  }
  return { total: pos.count, badCount: bad.length, bad: bad.slice(0, 60) }
})
console.log('verts total', out.total, 'bad', out.badCount)
out.bad.forEach(b => console.log(JSON.stringify(b)))
await browser.close()
