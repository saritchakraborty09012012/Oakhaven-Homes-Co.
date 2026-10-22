import puppeteer from 'puppeteer-core'
const browser = await puppeteer.launch({
  executablePath: 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  headless: true, args: ['--enable-unsafe-swiftshader', '--use-angle=swiftshader', '--no-sandbox'],
})
const page = await browser.newPage()
page.on('pageerror', (e) => console.log('PAGEERROR:', e.message.split('\n')[0]))
await page.setViewport({ width: 1600, height: 1000 })
await page.goto('http://localhost:5173', { waitUntil: 'networkidle2', timeout: 180000 })
await page.waitForFunction('window.__ready === true', { timeout: 180000 })
await page.evaluate(() => {
  const s = window.__scene
  window.__st = { apply: 0, composer: 0, onP: 0, errs: [] }
  const oa = s.apply.bind(s)
  s.apply = (...a) => { try { const r = oa(...a); window.__st.apply++; return r } catch (e) { window.__st.errs.push('apply: ' + e.message); throw e } }
  const oc = s.composer.render.bind(s.composer)
  s.composer.render = () => { try { oc(); window.__st.composer++ } catch (e) { window.__st.errs.push('composer: ' + e.message) } }
  const op = s.onProgress
  s.onProgress = (p) => { window.__st.onP++; return op(p) }
  const or = s.renderer.render.bind(s.renderer)
  s.renderer.render = (...a) => { try { return or(...a) } catch (e) { window.__st.errs.push('renderer: ' + e.message); throw e } }
  window.__jump(0.64)
})
await new Promise((r) => setTimeout(r, 2500))
const out = await page.evaluate(() => window.__st)
console.log(JSON.stringify(out, null, 1))
await browser.close()
