import puppeteer from 'puppeteer-core'
const browser = await puppeteer.launch({
  executablePath: 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  headless: true, args: ['--enable-unsafe-swiftshader', '--use-angle=swiftshader', '--no-sandbox'],
})
const page = await browser.newPage()
await page.setViewport({ width: 1600, height: 1000 })
await page.goto('http://localhost:5173', { waitUntil: 'networkidle2', timeout: 180000 })
await page.waitForFunction('window.__ready === true', { timeout: 180000 })
const out = await page.evaluate(async () => {
  let ival = 0
  const iv = setInterval(() => ival++, 100)
  let raf = 0
  requestAnimationFrame(() => raf++)
  await new Promise((r) => setTimeout(r, 1200))
  clearInterval(iv)
  return { hidden: document.hidden, vis: document.visibilityState, ival, raf,
    applyRenders: window.__scene.apply.length }
})
console.log(JSON.stringify(out, null, 1))
await browser.close()
