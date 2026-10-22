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
  window.__jump(0.93)
  window.__scene.parts.length = 0
  window.__scene.apply = () => {}
  const s = window.__scene
  return {
    glowMats: (s.glowMats || []).map((m) => ({
      name: m.name, type: m.type, i: m.emissiveIntensity,
      col: m.emissive && m.emissive.getHexString(), vis: m.visible,
      op: m.opacity, tr: m.transparent, side: m.side,
    })),
    bulbMats: (s.bulbMats || []).map((m) => ({ name: m.name, i: m.emissiveIntensity })),
    lantern: s.lanternA && s.lanternA.intensity,
    exposure: s.renderer.toneMappingExposure,
    glowParts: s.parts.filter((p) => (p.label || '').startsWith('glow')).map((p) => ({ l: p.label, vis: p.mesh.visible, mat: p.mesh.material.name })),
  }
})
console.log(JSON.stringify(out, null, 1))
await browser.close()
