import puppeteer from 'puppeteer-core'
const browser = await puppeteer.launch({
  executablePath: 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  headless: true, args: ['--no-sandbox', '--use-gl=angle', '--enable-unsafe-swiftshader']
})
const page = await browser.newPage()
await page.setViewport({ width: 1600, height: 1000 })
await page.goto('http://localhost:5173', { waitUntil: 'networkidle0', timeout: 120000 })
await page.waitForFunction('window.__ready === true', { timeout: 180000 })
const out = await page.evaluate(() => {
  window.__jump(0.8)
  const sc = window.__scene
  sc.dispP = sc.targetP = 0.8
  const origApply = sc.apply.bind(sc)
  sc.apply = () => {}
  origApply(0.016, true)
  const THREE = window.__THREE
  const probe = (px, py) => {
    const ndc = new THREE.Vector2((px / 1600) * 2 - 1, -((py / 1000) * 2 - 1))
    const ray = new THREE.Raycaster()
    ray.setFromCamera(ndc, sc.camera)
    const box = new THREE.Box3()
    const hits = []
    for (const pt of sc.parts) {
      if (!pt.mesh.visible) continue
      box.setFromObject(pt.mesh)
      const t = ray.ray.intersectBox(box, new THREE.Vector3())
      if (t) {
        hits.push({ d: +ray.ray.origin.distanceTo(t).toFixed(2),
                    label: pt.mesh.name.split('|')[5] || pt.mesh.name })
      }
    }
    hits.sort((a, b) => a.d - b.d)
    return hits.slice(0, 8)
  }
  return {
    whiteBetweenWindows: probe(500, 680),
    whiteLower: probe(500, 730),
    grayStoneUnderWindow: probe(380, 710)
  }
})
console.log(JSON.stringify(out, null, 1))
await browser.close()
