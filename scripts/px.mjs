import puppeteer from 'puppeteer-core'
import { readFileSync } from 'fs'
const b64 = readFileSync('C:\\Users\\sarit\\AppData\\Local\\Temp\\opencode\\shots3\\shot_0_93.png').toString('base64')
const browser = await puppeteer.launch({ executablePath: 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe', headless: true, args: ['--no-sandbox'] })
const page = await browser.newPage()
const res = await page.evaluate(async (b64) => {
  const img = await new Promise((r) => { const i = new Image(); i.onload = () => r(i); i.src = 'data:image/png;base64,' + b64 })
  const c = document.createElement('canvas'); c.width = img.width; c.height = img.height
  const g = c.getContext('2d'); g.drawImage(img, 0, 0)
  const pts = {
    porchWinL: [450, 650], porchWinR: [1160, 640], doorGlass: [790, 640],
    doorGlass2: [850, 600], lanternL: [565, 632], lanternR: [1075, 617],
    wingWin: [1320, 430], siding: [700, 450], sky: [800, 100],
  }
  const out = {}
  for (const [k, [x, y]] of Object.entries(pts)) {
    const d = g.getImageData(x - 2, y - 2, 5, 5).data
    let r = 0, gg = 0, b = 0, n = 0
    for (let i = 0; i < d.length; i += 4) { r += d[i]; gg += d[i+1]; b += d[i+2]; n++ }
    out[k] = [Math.round(r/n), Math.round(gg/n), Math.round(b/n)]
  }
  return out
}, b64)
console.log(JSON.stringify(res, null, 1))
await browser.close()
