import puppeteer from 'puppeteer-core'
import { readFileSync, writeFileSync } from 'fs'
const [inp, outp, y = '925', h = '60', x = '0', w = '1600'] = process.argv.slice(2)
const b64 = readFileSync(inp).toString('base64')
const browser = await puppeteer.launch({ executablePath: 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe', headless: true, args: ['--no-sandbox'] })
const page = await browser.newPage()
const out = await page.evaluate(async ({ b64, y, h, x, w }) => {
  const img = await new Promise((r) => { const i = new Image(); i.onload = () => r(i); i.src = 'data:image/png;base64,' + b64 })
  const c = document.createElement('canvas'); c.width = +w; c.height = +h
  const g = c.getContext('2d')
  g.drawImage(img, +x, +y, +w, +h, 0, 0, +w, +h)
  return c.toDataURL('image/png')
}, { b64, y, h, x, w })
writeFileSync(outp, Buffer.from(out.split(',')[1], 'base64'))
await browser.close()
