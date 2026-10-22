import puppeteer from 'puppeteer-core'
const browser = await puppeteer.launch({
  executablePath: 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  headless: true, args: ['--enable-unsafe-swiftshader', '--use-angle=swiftshader', '--no-sandbox', '--hide-scrollbars'],
})
const page = await browser.newPage()
await page.setViewport({ width: 1600, height: 1000 })
await page.goto('http://localhost:5173', { waitUntil: 'networkidle2', timeout: 180000 })
await page.waitForFunction('window.__ready === true', { timeout: 180000 })
for (const pv of [0.64, 0.93]) {
  await page.evaluate((p) => {
    const max = document.documentElement.scrollHeight - window.innerHeight
    window.scrollTo(0, p * max)
    if (window.__jump) window.__jump(p)
    window.__scene.onProgress(window.__scene.dispP)
  }, pv)
  await new Promise((r) => setTimeout(r, 900))
  const tag = String(pv).replace('.', '_')
  await page.screenshot({ path: `C:/Users/sarit/AppData/Local/Temp/opencode/shots5/dbl_${tag}_a.png` })
  await new Promise((r) => setTimeout(r, 300))
  await page.screenshot({ path: `C:/Users/sarit/AppData/Local/Temp/opencode/shots5/dbl_${tag}_b.png` })
}
await browser.close()
