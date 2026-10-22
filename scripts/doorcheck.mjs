import puppeteer from 'puppeteer-core'
const browser = await puppeteer.launch({
  executablePath: 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  headless: true, args: ['--enable-unsafe-swiftshader', '--use-angle=swiftshader', '--no-sandbox'],
})
const page = await browser.newPage()
await page.setViewport({ width: 1600, height: 1000 })
await page.goto('http://localhost:5173', { waitUntil: 'networkidle2', timeout: 180000 })
await page.waitForFunction('window.__ready === true', { timeout: 180000 })
const out = await page.evaluate(() => {
  const mgr = window.__scene
  const report = (p) => {
    const m = p.mesh
    return {
      label: p.label, stage: p.stage, anim: p.anim, order: p.order,
      t: p.t !== undefined ? +p.t.toFixed(3) : undefined,
      vis: m.visible, scale: [+m.scale.x.toFixed(3), +m.scale.y.toFixed(3), +m.scale.z.toFixed(3)],
      pos: [+m.position.x.toFixed(2), +m.position.y.toFixed(2), +m.position.z.toFixed(2)],
      op: m.material && m.material.opacity, tr: m.material && m.material.transparent,
    }
  }
  const find = (l) => mgr.parts.filter((p) => p.label === l).map(report)
  return {
    p: mgr.dispP,
    doorwood: find('ext_doorwood'),
    doorglass: find('glow_doorglass'),
    handle: find('ext_doorhandle'),
    lantern0: find('ext_lantern_0'),
    bulb0: find('glow_lantern_0'),
    casing: find('ext_wincasing_0'),
    keys: Object.keys(mgr.parts[0] || {}),
    at093: (window.__jump(0.93), mgr.parts.filter((p) => ['ext_doorwood','glow_doorglass','ext_doorhandle','ext_lantern_0','glow_lantern_0'].includes(p.label)).map(report)),
  }
})
console.log(JSON.stringify(out, null, 1))
await browser.close()
