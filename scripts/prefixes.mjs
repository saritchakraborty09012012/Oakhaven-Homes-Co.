import puppeteer from 'puppeteer-core'
const browser = await puppeteer.launch({
  executablePath: 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  headless: true,
  args: ['--enable-unsafe-swiftshader', '--use-angle=swiftshader', '--no-sandbox'],
})
const page = await browser.newPage()
await page.setViewport({ width: 1600, height: 1000 })
await page.goto('http://localhost:5173', { waitUntil: 'networkidle2', timeout: 180000 })
await page.waitForFunction('window.__ready === true', { timeout: 180000 })
const out = await page.evaluate(() => {
  const labels = new Set()
  const parts = window.__scene.parts || []
  parts.forEach(p => labels.add(p.label || p.name || JSON.stringify(Object.keys(p))))
  const meshLabels = new Set()
  window.__scene.scene.traverse(o => {
    if (!o.isMesh) return
    const l = o.name.includes('|') ? o.name.split('|')[5] : o.name
    meshLabels.add(l)
  })
  const all = [...new Set([...labels, ...meshLabels])].sort()
  const prefixes = {}
  all.forEach(l => {
    const m = l.match(/^([a-z]+_[a-z]+|glow_[a-z]+|ext_[a-z]+|dry_[a-z]+|home_[a-z]+|env_[a-z]+|bp_[a-z]+|site_[a-z]+)/)
    const p = m ? m[1] : (l.split('_').slice(0,2).join('_') || '(empty)')
    prefixes[p] = (prefixes[p]||0)+1
  })
  return { count: all.length, prefixes, sample: all.slice(0, 400) }
})
console.log('total labels:', out.count)
console.log(JSON.stringify(out.prefixes, null, 1))
await browser.close()
