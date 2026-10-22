import puppeteer from 'puppeteer-core'
import { readFileSync } from 'fs'
const A = 'C:\\Users\\sarit\\AppData\\Local\\Temp\\opencode\\shots2\\h_ff.png'
const B = 'C:\\Users\\sarit\\AppData\\Local\\Temp\\opencode\\shots2\\h_gA.png'
const b64a = readFileSync(A).toString('base64')
const b64b = readFileSync(B).toString('base64')
const browser = await puppeteer.launch({
  executablePath: 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  headless: true,
  args: ['--enable-unsafe-swiftshader', '--use-angle=swiftshader', '--no-sandbox'],
})
const page = await browser.newPage()
await page.goto('http://localhost:5173', { waitUntil: 'domcontentloaded' })
const res = await page.evaluate(async (a, b) => {
  const load = (d) => new Promise((r) => { const i = new Image(); i.onload = () => r(i); i.src = 'data:image/png;base64,' + d })
  const ia = await load(a), ib = await load(b)
  const c = document.createElement('canvas'); c.width = ia.width; c.height = ia.height
  const g = c.getContext('2d')
  g.drawImage(ia, 0, 0); const da = g.getImageData(0, 0, c.width, c.height).data
  g.clearRect(0, 0, c.width, c.height)
  g.drawImage(ib, 0, 0); const db = g.getImageData(0, 0, c.width, c.height).data
  // cluster changed pixels coarsely: 20x20 cells
  const cells = new Map()
  for (let y = 0; y < c.height; y++) for (let x = 0; x < c.width; x++) {
    const i = (y * c.width + x) * 4
    const d = Math.abs(da[i]-db[i]) + Math.abs(da[i+1]-db[i+1]) + Math.abs(da[i+2]-db[i+2])
    if (d > 60) { const k = (Math.floor(x/25)*1000 + Math.floor(y/25)); cells.set(k, (cells.get(k)||0)+1) }
  }
  const out = [...cells.entries()].map(([k, n]) => ({ cell: [k%1000*25, Math.floor(k/1000)*25], n })).filter(o => o.n > 6)
  out.sort((p, q) => q.n - p.n)
  // also project gableA world bbox corners
  return { size: [c.width, c.height], changed: out.slice(0, 40), totalCells: cells.size }
}, b64a, b64b)
console.log(JSON.stringify(res, null, 1))
await browser.close()
