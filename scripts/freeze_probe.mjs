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
  const sc = window.__scene
  sc.dispP = sc.targetP = 0.8
  const origApply = sc.apply.bind(sc)
  sc.apply = () => {}
  origApply(0.016, true)
  window.__vis = sc.parts.map((pt) => pt.mesh.visible)
})
const states = [
  ['nowrap', (n) => n.includes('dry_wr_')],
  ['nocasing', (n) => n.includes('ext_wincasing')],
  ['nodryin', (n) => n.includes('dry_in_')],
  ['nosiding', (n) => n.includes('ext_sd_')],
  ['nostone', (n) => n.includes('home_st_')],
  ['onlystone', (n) => !n.includes('home_st_')],
]
for (const [name, hideFn] of states) {
  await page.evaluate(({ hideFnSrc }) => {
    const hideFn = new Function('n', `return (${hideFnSrc})(n)`)
    const sc = window.__scene
    sc.parts.forEach((pt, i) => { pt.mesh.visible = window.__vis[i] ? !hideFn(pt.mesh.name) : false })
  }, { hideFnSrc: hideFn.toString() })
  await new Promise((r) => setTimeout(r, 300))
  await page.screenshot({ path: `${OUT}/frz_${name}.png` })
  console.log('saved', name)
}
await browser.close()
