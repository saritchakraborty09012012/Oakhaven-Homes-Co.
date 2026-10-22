import puppeteer from 'puppeteer-core'
import { writeFileSync } from 'fs'
const browser = await puppeteer.launch({
  executablePath: 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  headless: true,
  args: ['--enable-unsafe-swiftshader', '--use-angle=swiftshader', '--no-sandbox'],
})
const page = await browser.newPage()
await page.setViewport({ width: 1600, height: 1000 })
await page.goto('http://localhost:5173', { waitUntil: 'networkidle2', timeout: 180000 })
await page.waitForFunction('window.__ready === true', { timeout: 180000 })
const legend = await page.evaluate(() => {
  const THREE = window.__THREE
  window.__jump(0.8)
  window.__scene.parts.length = 0
  window.__scene.apply = () => {}
  // hide all DOM except canvas
  const canvas = document.querySelector('canvas')
  document.querySelectorAll('*').forEach((el) => {
    if (el === canvas || el.contains(canvas)) return
    el.style.visibility = 'hidden'
  })
  const idx = []
  const seen = new Map()
  let i = 0
  const mk = (hue) => new THREE.Color().setHSL(((hue % 360) + 360) % 360 / 360, 1.0, 0.5)
  window.__scene.scene.traverse((o) => {
    if (o.isPoints) { o.visible = false; return }
    if (!o.isMesh) return
    const label = o.name.includes('|') ? o.name.split('|')[5] : (o.name || '(unnamed)')
    let hue
    if (seen.has(label)) hue = seen.get(label)
    else { hue = (i * 137) % 360; i++; seen.set(label, hue); idx.push({ hue, label }) }
    o.material = new THREE.MeshBasicMaterial({ color: mk(hue), fog: false, side: THREE.DoubleSide })
  })
  return idx
})
writeFileSync('C:\\Users\\sarit\\AppData\\Local\\Temp\\opencode\\shots2\\id_legend.json', JSON.stringify(legend, null, 1))
await new Promise((r) => setTimeout(r, 300))
await page.screenshot({ path: 'C:\\Users\\sarit\\AppData\\Local\\Temp\\opencode\\shots2\\idbuf.png' })
console.log('legend entries:', legend.length)
await browser.close()
