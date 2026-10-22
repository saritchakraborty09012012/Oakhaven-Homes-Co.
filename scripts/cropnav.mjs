import puppeteer from 'puppeteer-core'
import { readFileSync, writeFileSync } from 'fs'
const b64 = readFileSync('C:\\Users\\sarit\\AppData\\Local\\Temp\\opencode\\shots4\\shot_0_64.png').toString('base64')
const browser = await puppeteer.launch({ executablePath: 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe', headless: true, args: ['--no-sandbox'] })
const page = await browser.newPage()
const out = await page.evaluate(async (b64) => {
  const img = await new Promise((r) => { const i = new Image(); i.onload = () => r(i); i.src = 'data:image/png;base64,' + b64 })
  const c = document.createElement('canvas'); c.width = 1600; c.height = 70
  const g = c.getContext('2d')
  g.drawImage(img, 0, 925, 1600, 60, 0, 0, 1600, 60)
  return c.toDataURL('image/png')
}, b64)
writeFileSync('C:\\Users\\sarit\\AppData\\Local\\Temp\\opencode\\shots4\\nav64.png', Buffer.from(out.split(',')[1], 'base64'))
await browser.close()
