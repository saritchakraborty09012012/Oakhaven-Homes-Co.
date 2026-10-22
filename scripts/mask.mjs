import puppeteer from 'puppeteer-core'
import { readFileSync, writeFileSync } from 'fs'
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
  g.drawImage(ia, 0, 0); const da = g.getImageData(0, 0, c.width, c.height)
  g.clearRect(0, 0, c.width, c.height); g.drawImage(ib, 0, 0); const db = g.getImageData(0, 0, c.width, c.height)
  const mask = g.createImageData(c.width, c.height)
  const xsTop = [], xsBot = []
  const samples = []
  for (let y = 0; y < c.height; y++) for (let x = 0; x < c.width; x++) {
    const i = (y * c.width + x) * 4
    const d = Math.abs(da.data[i]-db.data[i]) + Math.abs(da.data[i+1]-db.data[i+1]) + Math.abs(da.data[i+2]-db.data[i+2])
    if (d > 90) {
      mask.data[i] = 255; mask.data[i+3] = 255
      if (y >= 175 && y <= 275) xsTop.push(x)
      if (y >= 775) xsBot.push(x)
      if (y >= 175 && y <= 275 && samples.length < 12 && Math.random() < 0.02)
        samples.push({ x, y,
          base: [da.data[i], da.data[i+1], da.data[i+2]],
          nogA: [db.data[i], db.data[i+1], db.data[i+2]] })
    } else { mask.data[i+3] = 255 }
  }
  const range = (arr) => arr.length ? [Math.min(...arr), Math.max(...arr), arr.length] : []
  const m2 = document.createElement('canvas'); m2.width = c.width; m2.height = c.height
  m2.getContext('2d').putImageData(mask, 0, 0)
  return { topX: range(xsTop), botX: range(xsBot), samples, mask: m2.toDataURL('image/png') }
}, A, B)
console.log('top changed x-range:', JSON.stringify(res.topX), ' bottom:', JSON.stringify(res.botX))
res.samples.forEach(s => console.log('px', s.x, s.y, 'base', s.base, '-> nogA', s.nogA))
writeFileSync('C:\\Users\\sarit\\AppData\\Local\\Temp\\opencode\\shots2\\diffmask.png', Buffer.from(res.mask.split(',')[1], 'base64'))
console.log('mask saved')
await browser.close()
