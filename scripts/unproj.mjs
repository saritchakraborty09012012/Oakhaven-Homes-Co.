import puppeteer from 'puppeteer-core'
const browser = await puppeteer.launch({
  executablePath: 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  headless: true, args: ['--enable-unsafe-swiftshader', '--use-angle=swiftshader', '--no-sandbox'],
})
const page = await browser.newPage()
await page.setViewport({ width: 1600, height: 1000 })
await page.goto('http://localhost:5173', { waitUntil: 'networkidle2', timeout: 180000 })
await page.waitForFunction('window.__ready === true', { timeout: 180000 })
const res = await page.evaluate(() => {
  const THREE = window.__THREE
  const mgr = window.__scene
  window.__jump(0.8)
  mgr.parts.length = 0; mgr.apply = () => {}
  mgr.scene.traverse((o) => { if (o.isPoints) o.visible = false })
  let cam = mgr.camera
  if (!cam) mgr.scene.traverse((o) => { if (o.isCamera && !cam) cam = o })
  cam.updateMatrixWorld()
  // 1) project gableA verts
  let mesh = null
  mgr.scene.traverse((o) => {
    if (o.isMesh && (o.name.includes('|') ? o.name.split('|')[5] : o.name) === 'frm_gableA') mesh = o
  })
  mesh.updateWorldMatrix(true, false)
  const pos = mesh.geometry.attributes.position
  const v = new THREE.Vector3()
  let minx=1e9,miny=1e9,maxx=-1,maxy=-1
  const hull = []
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i).applyMatrix4(mesh.matrixWorld).project(cam)
    const sx=(v.x*0.5+0.5)*1600, sy=(-v.y*0.5+0.5)*1000
    minx=Math.min(minx,sx);maxx=Math.max(maxx,sx);miny=Math.min(miny,sy);maxy=Math.max(maxy,sy)
    if (i % 8 === 0) hull.push([Math.round(sx), Math.round(sy)])
  }
  // 2) unproject stick screen points to world; intersect z=0 plane (gable plane, three coords)
  const un = (sx, sy, zNdc) => {
    const p = new THREE.Vector3((sx/1600)*2-1, -(sy/1000)*2+1, zNdc).unproject(cam)
    return p
  }
  const rayAt = (sx, sy) => {
    const a = un(sx, sy, -1), b = un(sx, sy, 1)
    return { o: a.toArray().map(n=>+n.toFixed(2)), d: b.sub(a).toArray().map(n=>+n.toFixed(2)) }
  }
  const isect = (r, axis, val) => {
    // axis: 0=x,1=y,2=z
    const t = (val - r.o[axis]) / r.d[axis]
    if (!isFinite(t)) return null
    return [0,1,2].map(i => +(r.o[i] + t*r.d[i]).toFixed(2))
  }
  const r1 = rayAt(670, 268), r2 = rayAt(715, 183)
  // camera pos
  const cp = new THREE.Vector3().setFromMatrixPosition(cam.matrixWorld)
  return {
    gableA_screen_bbox: [Math.round(minx), Math.round(miny), Math.round(maxx), Math.round(maxy)],
    sample_verts: hull.slice(0, 24),
    cam: cp.toArray().map(n=>+n.toFixed(2)),
    stick1_ray: r1, stick2_ray: r2,
    stick1_on_gableplane: isect(r1, 2, 0), stick2_on_gableplane: isect(r2, 2, 0),
    stick1_on_gableback: isect(r1, 2, -9), stick2_on_gableback: isect(r2, 2, -9),
  }
})
console.log(JSON.stringify(res, null, 1))
await browser.close()
