import puppeteer from 'puppeteer-core'
import { readFileSync } from 'fs'
const b64 = readFileSync('C:\\Users\\sarit\\AppData\\Local\\Temp\\opencode\\shots2\\idbuf.png').toString('base64')
const browser = await puppeteer.launch({
  executablePath: 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  headless: true, args: ['--no-sandbox'],
})
const page = await browser.newPage()
const res = await page.evaluate(async (b64) => {
  const img = await new Promise((r) => { const i = new Image(); i.onload = () => r(i); i.src = 'data:image/png;base64,' + b64 })
  const c = document.createElement('canvas'); c.width = img.width; c.height = img.height
  const g = c.getContext('2d'); g.drawImage(img, 0, 0)
  const d = g.getImageData(0, 0, c.width, c.height).data
  const cells = new Map()
  const hues = new Map()
  for (let y = 0; y < c.height; y++) for (let x = 0; x < c.width; x++) {
    const i = (y * c.width + x) * 4
    const r = d[i], gg = d[i+1], b = d[i+2]
    const mx = Math.max(r,gg,b), mn = Math.min(r,gg,b), dl = mx-mn
    if (dl < 40) continue
    let h = 0
    if (mx === r) h = 60*(((gg-b)/dl)%6)
    else if (mx === gg) h = 60*((b-r)/dl+2)
    else h = 60*((r-gg)/dl+4)
    h = (h+360)%360
    if (h < 40 || h > 70) continue
    if (mx < 140) continue
    const k = Math.floor(x/40) + ',' + Math.floor(y/40)
    cells.set(k, (cells.get(k)||0)+1)
    hues.set(k, (hues.get(k)||[]).concat(Math.round(h)))
  }
  const out = [...cells.entries()].map(([k, n]) => ({ cell: k, n, hues: hues.get(k).slice(0,5) })).filter(o => o.n >= 4)
  out.sort((a,b)=>b.n-a.n)
  return { size:[c.width,c.height], out: out.slice(0,60) }
}, b64)
console.log('image', res.size)
res.out.forEach(o => console.log(JSON.stringify(o)))
await browser.close()
