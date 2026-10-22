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
  const THREE = window.__THREE
  window.__jump(0.8)
  window.__scene.parts.length = 0
  window.__scene.apply = () => {}
  const counts = {}
  const details = []
  const v = new THREE.Vector3()
  window.__scene.scene.traverse((o) => {
    if (!o.isMesh) return
    const label = o.name.includes('|') ? o.name.split('|')[5] : o.name
    counts[label] = (counts[label] || 0) + 1
    if (label.startsWith('frm_gableA') || label.startsWith('frm_gableWF') || label.startsWith('frm_gableWB')) {
      o.updateWorldMatrix(true, false)
      const bb = new THREE.Box3().setFromObject(o)
      details.push({
        label, meshName: o.name.slice(0, 90), visible: o.visible,
        parent: o.parent && o.parent.name ? o.parent.name.slice(0, 60) : '',
        min: [+bb.min.x.toFixed(2), +bb.min.y.toFixed(2), +bb.min.z.toFixed(2)],
        max: [+bb.max.x.toFixed(2), +bb.max.y.toFixed(2), +bb.max.z.toFixed(2)],
      })
    }
  })
  const dupes = Object.entries(counts).filter(([, c]) => c > 1)
  return { dupes, totalMeshes: Object.values(counts).reduce((a, b) => a + b, 0), labels: Object.keys(counts).length, details }
})
console.log(JSON.stringify(out, null, 1))
await browser.close()
