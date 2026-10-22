import puppeteer from 'puppeteer-core'
import { readFileSync } from 'fs'
const load = (p) => readFileSync(p).toString('base64')
const A = load('C:\\Users\\sarit\\AppData\\Local\\Temp\\opencode\\shots2\\cmp_base.png')
const B = load('C:\\Users\\sarit\\AppData\\Local\\Temp\\opencode\\shots2\\cmp_nogA.png')
const browser = await puppeteer.launch({ executablePath: 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe', headless: true, args: ['--no-sandbox'] })
const page = await browser.newPage()
const res = await page.evaluate(async (a, b) => {
  const ld = (d) => new Promise((r) => { const i = new Image(); i.onload = () => r(i); i.src = 'data:image/png;base64,' + d })
  const ia = await ld(a), ib = await ld(b)
  const c = document.createElement('canvas'); c.width = ia.width; c.height = ia.height
  const g = c.getContext('2d')
  g.drawImage(ia, 0, 0); const da = g.getImageData(0, 0, c.width, c.height).data
  g.clearRect(0, 0, c.width, c.height); g.drawImage(ib, 0, 0); const db = g.getImageData(0, 0, c.width, c.height).data
  let n = 0; let minx = 1e9, miny = 1e9, maxx = -1, maxy = -1
  const rows = {}
  for (let y = 0; y < c.height; y++) for (let x = 0; x < c.width; x++) {
    const i = (y * c.width + x) * 4
    const d = Math.abs(da[i]-db[i]) + Math.abs(da[i+1]-db[i+1]) + Math.abs(da[i+2]-db[i+2])
    if (d > 90) { n++; if (x<minx)minx=x; if (x>maxx)maxx=x; if (y<miny)miny=y; if (y>maxy)maxy=y
      rows[Math.floor(y/25)] = (rows[Math.floor(y/25)]||0)+1 }
  }
  return { n, bbox: [minx, miny, maxx, maxy], rows }
}, A, B)
console.log(JSON.stringify(res))
await browser.close()
