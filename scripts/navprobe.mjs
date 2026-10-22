import puppeteer from 'puppeteer-core'
const browser = await puppeteer.launch({
  executablePath: 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  headless: true, args: ['--enable-unsafe-swiftshader', '--use-angle=swiftshader', '--no-sandbox'],
})
const page = await browser.newPage()
await page.setViewport({ width: 1600, height: 1000 })
await page.goto('http://localhost:5173', { waitUntil: 'networkidle2', timeout: 180000 })
await page.waitForFunction('window.__ready === true', { timeout: 180000 })
await page.evaluate(() => window.__jump(0.64))
await new Promise((r) => setTimeout(r, 1500))
const out = await page.evaluate(() => {
  const spans = [...document.querySelectorAll('span,div,button')].filter((el) =>
    ['PLAN','FOUNDATION','FRAMING','DRIED IN','EXTERIOR','HOME','WELCOME'].includes(el.textContent.trim()))
  const nav = spans.map((el) => ({
    t: el.textContent.trim(),
    gold: (el.className || '').toString().includes('gold'),
    cls: (el.className || '').toString().slice(0, 90),
  }))
  const captions = [...document.querySelectorAll('h1,h2,h3,p')].map((e) => e.textContent.trim()).filter((t) => t && t.length < 70).slice(0, 8)
  return { p: window.__scene.dispP, target: window.__scene.targetP, nav, captions }
})
console.log(JSON.stringify(out, null, 1))
await browser.close()
