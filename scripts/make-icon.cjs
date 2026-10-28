// resources/logo.svg dosyasından resources/icon.png (256x256) üretir. Çalıştır: npx electron scripts/make-icon.cjs
const { app, BrowserWindow } = require('electron')
const { readFileSync, writeFileSync } = require('fs')
const { join } = require('path')

app.whenReady().then(async () => {
  const svg = readFileSync(join(__dirname, '..', 'resources', 'logo.svg'), 'utf8')
  const win = new BrowserWindow({ width: 256, height: 256, show: false, frame: false, transparent: true, webPreferences: { offscreen: true } })
  const html = `<html><body style="margin:0;background:transparent">${svg.replace('width="256" height="256"', 'width="256" height="256" style="display:block"')}</body></html>`
  await win.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(html))
  await new Promise(r => setTimeout(r, 400))
  const img = await win.webContents.capturePage({ x: 0, y: 0, width: 256, height: 256 })
  writeFileSync(join(__dirname, '..', 'resources', 'icon.png'), img.toPNG())
  console.log('icon.png yazıldı', img.getSize())
  app.quit()
})
