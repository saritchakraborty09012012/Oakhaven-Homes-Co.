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
  window.__scene.parts.length = 0
  window.__scene.apply = () => {}
  window.__scene.scene.traverse((o) => { if (o.isPoints) o.visible = false })
  // kill camera drift sources: zero parallax
  window.__scene.mouse = { x: 0, y: 0 }
})
async function shot(p) {
  await new Promise((r) => setTimeout(r, 600))
  await page.screenshot({ path: `C:\\Users\\sarit\\AppData\\Local\\Temp\\opencode\\shots2\\cmp_${p}.png` })
  console.log('saved', p)
}
await shot('base')
await page.evaluate(() => {
  window.__scene.scene.traverse((o) => {
    if (!o.isMesh) return
    const label = o.name.includes('|') ? o.name.split('|')[5] : o.name
    if (label.startsWith('frm_gableA')) o.visible = false
  })
})
await shot('nogA')
await browser.close()
