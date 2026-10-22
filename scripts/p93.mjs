import puppeteer from 'puppeteer-core'
const browser = await puppeteer.launch({
  executablePath: 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  headless: true, args: ['--enable-unsafe-swiftshader', '--use-angle=swiftshader', '--no-sandbox', '--hide-scrollbars'],
})
const page = await browser.newPage()
await page.setViewport({ width: 1600, height: 1000 })
await page.goto('http://localhost:5173', { waitUntil: 'networkidle2', timeout: 180000 })
await page.waitForFunction('window.__ready === true', { timeout: 180000 })
await page.evaluate(() => {
  const max = document.documentElement.scrollHeight - window.innerHeight
  window.scrollTo(0, 0.93 * max)
  window.__jump(0.93)
  window.__scene.onProgress(window.__scene.dispP)
})
await new Promise((r) => setTimeout(r, 600))
const pre = await page.evaluate(() => {
  const max = document.documentElement.scrollHeight - window.innerHeight
  return {
    dispP: window.__scene.dispP, targetP: window.__scene.targetP,
    scrollRatio: window.scrollY / max,
    gold: [...document.querySelectorAll('span')].filter((s) => s.className.includes('text-gold')).map((s) => s.textContent.trim()),
    h: [...document.querySelectorAll('h1,h2')].map((e) => e.textContent.trim()).slice(0, 4),
  }
})
await page.screenshot({ path: 'C:/Users/sarit/AppData/Local/Temp/opencode/shots5/p93_test.png' })
const post = await page.evaluate(() => ({
  dispP: window.__scene.dispP, targetP: window.__scene.targetP,
  gold: [...document.querySelectorAll('span')].filter((s) => s.className.includes('text-gold')).map((s) => s.textContent.trim()),
}))
console.log(JSON.stringify({ pre, post }, null, 1))
await browser.close()
