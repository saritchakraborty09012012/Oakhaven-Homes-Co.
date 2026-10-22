import puppeteer from 'puppeteer-core'
const OUT = 'D:/SARIT/NOVEXA- NoirDemons/_shots'
const browser = await puppeteer.launch({
  executablePath: 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  headless: true, args: ['--no-sandbox', '--use-gl=angle', '--enable-unsafe-swiftshader']
})
const page = await browser.newPage()
await page.setViewport({ width: 1600, height: 1000 })
await page.goto('http://localhost:5173', { waitUntil: 'networkidle0', timeout: 120000 })
await page.waitForFunction('window.__ready === true', { timeout: 180000 })
await page.evaluate(() => {
  window.__jump(0.8)
  window.__scene.onProgress(window.__scene.dispP)
  window.__scene.onProgress(window.__scene.dispP)
  for (const pt of window.__scene.parts) {
    pt.mesh.visible = pt.mesh.name.includes('home_st_')
  }
})
await new Promise((r) => setTimeout(r, 500))
await page.screenshot({ path: `${OUT}/only_stone.png` })
console.log('saved only_stone')
await browser.close()
