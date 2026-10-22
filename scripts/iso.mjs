import puppeteer from 'puppeteer-core'
import { writeFileSync } from 'fs'
const browser = await puppeteer.launch({
  executablePath: 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  headless: true, args: ['--enable-unsafe-swiftshader', '--use-angle=swiftshader', '--no-sandbox'],
})
const page = await browser.newPage()
await page.setViewport({ width: 1600, height: 1000 })
await page.goto('http://localhost:5173', { waitUntil: 'networkidle2', timeout: 180000 })
await page.waitForFunction('window.__ready === true', { timeout: 180000 })
await page.evaluate(() => {
  window.__jump(0.93)
  window.__scene.parts.length = 0
  window.__scene.apply = () => {}
  window.__scene.scene.traverse((o) => { if (o.isPoints) o.visible = false })
})
async function iso(name, keep) {
  await page.evaluate((keep) => {
    window.__scene.scene.traverse((o) => {
      if (!o.isMesh) return
      const label = o.name.includes('|') ? o.name.split('|')[5] : o.name
      o.visible = keep.some((k) => label === k || label.startsWith(k))
    })
  }, keep)
  await new Promise((r) => setTimeout(r, 250))
  const b64 = await page.screenshot({ encoding: 'base64' })
  writeFileSync(`C:\\Users\\sarit\\AppData\\Local\\Temp\\opencode\\shots3\\iso_${name}.png`, Buffer.from(b64, 'base64'))
  console.log('saved', name)
}
await iso('door', ['ext_doorwood', 'glow_doorglass', 'ext_doorhandle'])
await iso('wall', ['ext_sd_f1_front_b', 'home_st_f1_front_b', 'frm_f1_front_b'])
await browser.close()
