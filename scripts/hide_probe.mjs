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

const groups = [
  ['A_nowrap', ['dry_wr_']],
  ['B_nocasing', ['ext_wincasing']],
  ['C_nodryin', ['dry_in_']],
  ['D_nostone', ['home_st_']],
]
for (const [name, prefixes] of groups) {
  await page.evaluate((prefixes) => {
    window.__jump(0.8)
    window.__scene.onProgress(window.__scene.dispP)
    // first restore everything visible per apply(), then hide test groups
    window.__scene.onProgress(window.__scene.dispP)
    for (const pt of window.__scene.parts) {
      for (const pre of prefixes) {
        if (pt.mesh.name.includes(pre)) { pt.mesh.visible = false }
      }
    }
  }, prefixes)
  await new Promise((r) => setTimeout(r, 400))
  await page.screenshot({ path: `${OUT}/hid_${name}.png` })
  console.log('saved', name)
}
await browser.close()
