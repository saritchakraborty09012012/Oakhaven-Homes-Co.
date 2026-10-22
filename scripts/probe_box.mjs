import puppeteer from 'puppeteer-core'
const OUT = process.argv[2] || 'D:/SARIT/NOVEXA- NoirDemons/_shots'
const browser = await puppeteer.launch({
  executablePath: 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  headless: true, args: ['--no-sandbox', '--use-gl=angle', '--enable-unsafe-swiftshader']
})
const page = await browser.newPage()
await page.setViewport({ width: 1600, height: 1000 })
page.on('console', (m) => console.log('[pg]', m.text()))
await page.goto('http://localhost:5173', { waitUntil: 'networkidle0', timeout: 120000 })
await page.waitForFunction('window.__ready === true', { timeout: 180000 })
const info = await page.evaluate(() => {
  window.__jump(1.0)
  const THREE = window.__THREE
  const box = new THREE.Box3()
  const hits = []
  for (const pt of window.__scene.parts) {
    const m = pt.mesh
    if (!m.visible) continue
    box.setFromObject(m)
    // three-coords probe point: through-door dark object approx x0, y1.5, z-3.5
    if (box.containsPoint(new THREE.Vector3(0, 1.5, -3.5)) ||
        box.containsPoint(new THREE.Vector3(0.3, 1.6, -4.5)) ||
        box.containsPoint(new THREE.Vector3(-0.3, 1.7, -2.5))) {
      hits.push({
        label: m.name.split('|')[5],
        min: box.min.toArray().map((v) => +v.toFixed(2)),
        max: box.max.toArray().map((v) => +v.toFixed(2))
      })
    }
  }
  return hits
})
console.log(JSON.stringify(info, null, 1))
await browser.close()
