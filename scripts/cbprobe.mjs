import puppeteer from 'puppeteer-core'
const browser = await puppeteer.launch({
  executablePath: 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  headless: true, args: ['--enable-unsafe-swiftshader', '--use-angle=swiftshader', '--no-sandbox'],
})
const page = await browser.newPage()
page.on('pageerror', (e) => console.log('PAGEERROR:', e.message.split('\n')[0]))
page.on('console', (m) => { if (m.type() === 'error') console.log('CONSOLE:', m.text().slice(0, 200)) })
await page.setViewport({ width: 1600, height: 1000 })
await page.goto('http://localhost:5173', { waitUntil: 'networkidle2', timeout: 180000 })
await page.waitForFunction('window.__ready === true', { timeout: 180000 })
await page.evaluate(() => {
  window.__calls = []
  const orig = window.__scene.onProgress
  window.__scene.onProgress = (p) => { window.__calls.push(p); return orig(p) }
  window.addEventListener('error', (e) => { window.__err = (window.__err || []) + '|' + e.message })
  window.__jump(0.64)
})
await new Promise((r) => setTimeout(r, 2000))
const out = await page.evaluate(() => {
  const bar = document.querySelector('div[class*="scaleX"], div[style*="scaleX"]')
  const hero = document.querySelector('h1')
  return {
    ready: window.__scene.ready,
    calls: window.__calls.length,
    last5: window.__calls.slice(-5),
    err: window.__err || null,
    barTransform: bar ? bar.style.transform : null,
    heroParentOpacity: hero ? getComputedStyle(hero.parentElement).opacity : null,
    heroParentCls: hero ? hero.parentElement.className.slice(0, 60) : null,
    goldNav: [...document.querySelectorAll('span')].filter((s) => s.className.includes('text-gold')).map((s) => s.textContent.trim()),
  }
})
console.log(JSON.stringify(out, null, 1))
await browser.close()
