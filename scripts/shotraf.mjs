import puppeteer from 'puppeteer-core'
const browser = await puppeteer.launch({
  executablePath: 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  headless: true, args: ['--enable-unsafe-swiftshader', '--use-angle=swiftshader', '--no-sandbox'],
})
const page = await browser.newPage()
await page.setViewport({ width: 1600, height: 1000 })
await page.goto('http://localhost:5173', { waitUntil: 'networkidle2', timeout: 180000 })
await page.waitForFunction('window.__ready === true', { timeout: 180000 })
await page.evaluate(() => {
  window.__st = { raf: 0, onP: [], lastP: null }
  const a = window.__scene.animate.bind(window.__scene)
  window.__scene.animate = () => { window.__st.raf++; a() }
  const op = window.__scene.onProgress
  window.__scene.onProgress = (p) => { window.__st.onP.push(p); return op(p) }
  window.__jump(0.64)
})
await page.screenshot({ path: 'C:/Users/sarit/AppData/Local/Temp/opencode/shots4/raf_test.png' })
await new Promise((r) => setTimeout(r, 800))
const out = await page.evaluate(() => ({
  raf: window.__st.raf,
  onPcount: window.__st.onP.length,
  onPtail: window.__st.onP.slice(-4),
  nav: [...document.querySelectorAll('span')].filter((s) => s.className.includes('text-gold')).map((s) => s.textContent.trim()),
  heroMounted: !!document.querySelector('h1'),
  captions: [...document.querySelectorAll('h1,h2,h3')].map((e) => e.textContent.trim()).slice(0, 5),
}))
console.log(JSON.stringify(out, null, 1))
await browser.close()


