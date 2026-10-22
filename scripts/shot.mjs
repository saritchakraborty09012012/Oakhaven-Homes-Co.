import puppeteer from 'puppeteer-core'
import fs from 'node:fs'

const OUT = process.argv[2] || 'shots'
const URL = process.env.SHOT_URL || 'http://localhost:5173'
fs.mkdirSync(OUT, { recursive: true })

const browser = await puppeteer.launch({
  executablePath: 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  headless: true,
  args: [
    '--enable-unsafe-swiftshader',
    '--use-angle=swiftshader',
    '--disable-gpu-sandbox',
    '--no-sandbox',
    '--hide-scrollbars',
    '--window-size=1600,1000',
  ],
})

const page = await browser.newPage()
await page.setViewport({ width: 1600, height: 1000, deviceScaleFactor: 1 })
page.on('pageerror', (e) => console.log('PAGE EXC:', e.message))
page.on('console', (m) => {
  if (m.type() === 'error') console.log('PAGE ERR:', m.text())
})

console.log('opening', URL)
await page.goto(URL, { waitUntil: 'networkidle2', timeout: 180000 })
await page.waitForFunction('window.__ready === true', { timeout: 180000 })
console.log('scene ready')

const points = (process.argv[3] || '0,0.05,0.13,0.3,0.48,0.64,0.8,0.93,1.0')
  .split(',').map(Number)
for (const p of points) {
  await page.evaluate((pv) => {
    const max = document.documentElement.scrollHeight - window.innerHeight
    window.scrollTo(0, pv * max)
    if (window.__jump) window.__jump(pv)
    window.__scene.onProgress(window.__scene.dispP)
  }, p)
  await new Promise((r) => setTimeout(r, 1100))
  const name = `shot_${String(p).replace('.', '_')}.png`
  // headless paints DOM one frame late: first capture warms the compositor
  await page.screenshot({ path: `${OUT}/${name}` })
  await new Promise((r) => setTimeout(r, 250))
  await page.screenshot({ path: `${OUT}/${name}` })
  console.log('saved', name)
}

await browser.close()
console.log('done')
