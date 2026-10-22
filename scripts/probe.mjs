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

await page.evaluate(() => {
  window.__jump(0.8)
  window.__scene.parts.length = 0 // freeze: apply() no longer touches meshes
  window.__scene.apply = () => {} // and skip everything else too
})

async function shot(name, hiddenPrefixes) {
  await page.evaluate((prefixes) => {
    const { scene } = window.__scene
    scene.traverse((o) => {
      if (!o.isMesh) return
      const label = o.name.includes('|') ? o.name.split('|')[5] : o.name
      o.visible = !prefixes.some((p) => label.startsWith(p))
    })
  }, hiddenPrefixes)
  await new Promise((r) => setTimeout(r, 400))
  await page.screenshot({
    path: `C:\\Users\\sarit\\AppData\\Local\\Temp\\opencode\\shots2\\h_${name}.png`,
    clip: { x: 400, y: 100, width: 1100, height: 400 },
  })
  console.log('saved', name)
}

await shot('gWF', ['frm_gableWF'])
await shot('gWB', ['frm_gableWB'])
const diag = await page.evaluate(() => {
  const THREE = window.__THREE
  const mgr = window.__scene
  const out = {}
  const v = new THREE.Vector3()
  mgr.scene.traverse((o) => {
    if (!o.isMesh) return
    const label = o.name.includes('|') ? o.name.split('|')[5] : o.name
    if (!label.startsWith('frm_gable')) return
    const pos = o.geometry.attributes.position
    const bb = new THREE.Box3()
    let far = { d: 0 }
    for (let i = 0; i < pos.count; i++) {
      v.fromBufferAttribute(pos, i).applyMatrix4(o.matrixWorld)
      bb.expandByPoint(v)
      // centroid distance as outlier heuristic
      const d = v.length()
      if (d > far.d) far = { d: +d.toFixed(2), p: [+v.x.toFixed(2), +v.y.toFixed(2), +v.z.toFixed(2)] }
    }
    out[label] = {
      min: [+bb.min.x.toFixed(2), +bb.min.y.toFixed(2), +bb.min.z.toFixed(2)],
      max: [+bb.max.x.toFixed(2), +bb.max.y.toFixed(2), +bb.max.z.toFixed(2)],
      far, verts: pos.count,
    }
  })
  return out
})
console.log(JSON.stringify(diag, null, 1))
await browser.close()
