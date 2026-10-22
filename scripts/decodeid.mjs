import puppeteer from 'puppeteer-core'
import { readFileSync } from 'fs'
const b64 = readFileSync('C:\\Users\\sarit\\AppData\\Local\\Temp\\opencode\\shots2\\idbuf.png').toString('base64')
const legend = JSON.parse(readFileSync('C:\\Users\\sarit\\AppData\\Local\\Temp\\opencode\\shots2\\id_legend.json', 'utf8'))
const browser = await puppeteer.launch({
  executablePath: 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  headless: true, args: ['--no-sandbox'],
})
const page = await browser.newPage()
const pts = [
  ['A1',480,232],['A2',495,242],['A3',510,255],
  ['B1',780,270],['B2',795,282],['B3',810,292],
  ['W1',1275,340],['W2',1300,365],['W3',1335,400],
]
const res = await page.evaluate(async (b64, pts) => {
  const img = await new Promise((r) => { const i = new Image(); i.onload = () => r(i); i.src = 'data:image/png;base64,' + b64 })
  const c = document.createElement('canvas'); c.width = img.width; c.height = img.height
  const g = c.getContext('2d'); g.drawImage(img, 0, 0)
  return pts.map(([n, x, y]) => {
    const d = g.getImageData(x - 1, y - 1, 3, 3).data
    let r = 0, gg = 0, bb = 0, cnt = 0
    for (let i = 0; i < d.length; i += 4) { r += d[i]; gg += d[i+1]; bb += d[i+2]; cnt++ }
    r = r/cnt; gg = gg/cnt; bb = bb/cnt
    const mx = Math.max(r,gg,bb), mn = Math.min(r,gg,bb), dl = mx-mn
    let h = 0
    if (dl > 1) {
      if (mx === r) h = 60*(((gg-bb)/dl)%6)
      else if (mx === gg) h = 60*((bb-r)/dl+2)
      else h = 60*((r-gg)/dl+4)
    }
    return { n, rgb:[Math.round(r),Math.round(gg),Math.round(bb)], hue: +h.toFixed(1) }
  })
}, b64, pts)
res.forEach(s => {
  const matches = legend.filter(l => Math.abs(((l.hue - s.hue + 540) % 360) - 180) < 6).map(l => l.label)
  console.log(s.n, 'rgb=' + s.rgb, 'hue=' + s.hue, '->', matches.join(', ') || '(none)')
})
await browser.close()
