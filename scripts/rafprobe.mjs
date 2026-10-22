import puppeteer from 'puppeteer-core'
const browser = await puppeteer.launch({
  executablePath: 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  headless: true, args: ['--enable-unsafe-swiftshader', '--use-angle=swiftshader', '--no-sandbox'],
})
const page = await browser.newPage()
page.on('pageerror', (e) => console.log('PAGEERROR:', e.message.slice(0, 300)))
await page.setViewport({ width: 1600, height: 1000 })
await page.goto('http://localhost:5173', { waitUntil: 'networkidle2', timeout: 180000 })
await page.waitForFunction('window.__ready === true', { timeout: 180000 })
const out = await page.evaluate(async () => {
  let raf = 0
  const tick = () => { raf++; requestAnimationFrame(tick) }
  requestAnimationFrame(tick)
  const a = window.__scene.animate
  let anim = 0
  window.__scene.animate = (...args) => { anim++; return a(...args) }
  await new Promise((r) => setTimeout(r, 1500))
  return { raf, anim, rafId: window.__scene.raf, ready: window.__scene.ready, dispP: window.__scene.dispP }
})
console.log(JSON.stringify(out, null, 1))
await browser.close()
