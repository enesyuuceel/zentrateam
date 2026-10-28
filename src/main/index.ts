import { app, BrowserWindow, ipcMain, dialog, shell } from 'electron'
import { join, extname, basename } from 'path'
import { readFileSync } from 'fs'
import { store } from './store'
import { AgentRunner, stripFrontmatter } from './agentRunner'
import { testProvider } from './openaiAgent'
import type { AgentEvent } from '../shared/types'

const isDev = !app.isPackaged && !!process.env.ELECTRON_RENDERER_URL

let mainWindow: BrowserWindow | null = null

function send(channel: string, payload: unknown): void {
  if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send(channel, payload)
}

const runner = new AgentRunner((e: AgentEvent) => send('agent:event', e))
store.onChange(s => send('state:changed', s))

function createMainWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1180,
    height: 760,
    minWidth: 900,
    minHeight: 600,
    show: false,
    frame: false,
    titleBarStyle: 'hidden',
    backgroundColor: '#0f1219',
    autoHideMenuBar: true,
    icon: join(__dirname, '../../resources/icon.png'),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false,
      contextIsolation: true
    }
  })
  mainWindow.once('ready-to-show', () => mainWindow?.show())
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:/.test(url)) shell.openExternal(url)
    return { action: 'deny' }
  })
  mainWindow.on('closed', () => { mainWindow = null })
  if (isDev) mainWindow.loadURL(process.env.ELECTRON_RENDERER_URL!)
  else mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
}

function shake(): void {
  const win = mainWindow
  if (!win || win.isDestroyed()) return
  const [x, y] = win.getPosition()
  let i = 0
  const t = setInterval(() => {
    win.setPosition(x + (i % 2 === 0 ? 1 : -1) * 6, y + (i % 4 < 2 ? 1 : -1) * 4)
    if (++i > 8) { clearInterval(t); win.setPosition(x, y) }
  }, 40)
}

// --- IPC ---
ipcMain.handle('state:get', () => store.snapshot())
ipcMain.handle('presence:get', () => runner.getPresence())
ipcMain.handle('settings:save', (_e, patch) => store.saveSettings(patch))
ipcMain.handle('auth:setKey', (_e, key: string) => store.setApiKey(key))
ipcMain.handle('auth:clearKey', () => store.clearApiKey())
ipcMain.handle('chat:open', (_e, id: string) => send('nav', { view: 'chat', id }))
ipcMain.handle('conv:create', (_e, input) => store.createConversation(input))
ipcMain.handle('conv:delete', (_e, id: string) => { runner.cancel(id); store.deleteConversation(id) })
ipcMain.handle('conv:updateTeam', (_e, id: string, input: { title: string; memberIds: string[]; leadId: string }) => {
  const c = store.getConversation(id)
  const leadChanged = c?.leadId !== input.leadId
  return store.updateConversation(id, { ...input, ...(leadChanged ? { sessionId: null } : {}) })
})
ipcMain.handle('conv:rename', (_e, id: string, title: string) => store.updateConversation(id, { title }))
ipcMain.handle('conv:setProject', (_e, id: string, path: string | null) => store.updateConversation(id, { projectPath: path, sessionId: null }))
ipcMain.handle('dialog:pickFolder', async () => {
  const r = await dialog.showOpenDialog(mainWindow!, { properties: ['openDirectory', 'createDirectory'], title: 'Proje klasörünü seç' })
  return r.canceled ? null : r.filePaths[0]
})
ipcMain.handle('dialog:pickFiles', async (_e, kind: 'text' | 'image') => {
  const filters = kind === 'image'
    ? [{ name: 'Görseller', extensions: ['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg'] }]
    : [{ name: 'Metin ve belge', extensions: ['md', 'txt', 'markdown', 'json', 'yaml', 'yml', 'csv'] }, { name: 'Tüm dosyalar', extensions: ['*'] }]
  const r = await dialog.showOpenDialog(mainWindow!, { properties: ['openFile', 'multiSelections'], filters })
  return r.canceled ? [] : r.filePaths
})
// Ajan tanımını .md/.txt dosyasından içe aktar: YAML ön bilgi (name/role/description) ve ilk başlık okunur.
ipcMain.handle('agent:importFile', (_e, p: string) => {
  const raw = readFileSync(p, 'utf8')
  const fm = /^---\r?\n([\s\S]*?)\r?\n---/.exec(raw)
  const meta: Record<string, string> = {}
  if (fm) {
    for (const line of fm[1].split(/\r?\n/)) {
      const i = line.indexOf(':')
      if (i > 0) meta[line.slice(0, i).trim().toLowerCase()] = line.slice(i + 1).trim().replace(/^["']|["']$/g, '')
    }
  }
  const body = stripFrontmatter(raw).trim()
  const h1 = /^#\s+(.+)$/m.exec(body)
  return { path: p, name: meta.name ?? h1?.[1] ?? basename(p, extname(p)), role: meta.role ?? meta.description, persona: body }
})
ipcMain.handle('file:imageDataUrl', (_e, p: string) => {
  const buf = readFileSync(p)
  if (buf.length > 2_000_000) throw new Error('Görsel 2 MB altında olmalı')
  const ext = extname(p).slice(1).toLowerCase()
  const mime = ext === 'svg' ? 'image/svg+xml' : ext === 'jpg' ? 'image/jpeg' : `image/${ext}`
  return `data:${mime};base64,${buf.toString('base64')}`
})
ipcMain.handle('provider:save', (_e, p, apiKey?: string) => store.saveProvider(p, apiKey))
ipcMain.handle('provider:delete', (_e, id: string) => store.deleteProvider(id))
ipcMain.handle('provider:test', (_e, id: string) => {
  const p = store.getProvider(id)
  if (!p) return { ok: false, message: 'Sağlayıcı bulunamadı' }
  return testProvider(p, store.getProviderKey(id))
})
ipcMain.handle('chat:send', (_e, id: string, text: string) => runner.send(id, text))
ipcMain.handle('chat:cancel', (_e, id: string) => runner.cancel(id))
ipcMain.handle('chat:reset', (_e, id: string) => { runner.cancel(id); store.updateConversation(id, { sessionId: null }) })
ipcMain.handle('chat:nudge', (_e, id: string) => { shake(); send('agent:event', { type: 'nudge', conversationId: id } satisfies AgentEvent) })
ipcMain.handle('agent:save', (_e, a) => store.saveAgent(a))
ipcMain.handle('agent:delete', (_e, id: string) => store.deleteAgent(id))
ipcMain.handle('conn:save', (_e, c) => store.saveConnection(c))
ipcMain.handle('conn:delete', (_e, id: string) => store.deleteConnection(id))
ipcMain.handle('window:open', (_e, route) => send('nav', { view: route }))
ipcMain.handle('shell:openPath', (_e, p: string) => shell.openPath(p))
ipcMain.on('window:control', (_e, action: 'minimize' | 'close' | 'maximize') => {
  const win = mainWindow
  if (!win) return
  if (action === 'minimize') win.minimize()
  else if (action === 'close') win.close()
  else win.isMaximized() ? win.unmaximize() : win.maximize()
})

// Geliştirme yardımcısı: ZENTRA_SHOT=<klasör> verilirse görünümleri PNG olarak kaydedip çıkar.
async function screenshotMode(dir: string): Promise<void> {
  const { writeFileSync } = await import('fs')
  const wait = (ms: number): Promise<void> => new Promise(r => setTimeout(r, ms))
  const snap = async (name: string): Promise<void> => {
    await wait(900)
    const img = await mainWindow!.webContents.capturePage()
    writeFileSync(join(dir, `${name}.png`), img.toPNG())
  }
  const A = (id: string): string => store.getAgent(id)?.id ?? store.agents[0].id
  const now = Date.now()
  const proj = ['C:', 'Projeler', 'zentra-web'].join('\\')
  store.saveSettings({ displayName: 'Enes', avatar: '🧑‍💻' })
  store.setApiKey('demo-key')
  store.saveProvider({ id: 'demo-ollama', kind: 'ollama', name: 'Ollama', baseUrl: 'http://localhost:11434/v1', defaultModel: 'llama3.1', hasKey: false })

  // Birebir sohbet: Usta ile
  const d1 = store.createConversation({ kind: 'direct', agentId: A('usta'), projectPath: proj })
  store.appendMessage(d1.id, { id: 'a1', from: 'me', text: 'Giriş sayfasına "Şifremi unuttum" akışı ekle. E-posta ile sıfırlama linki gitsin.', at: now - 540000 })
  store.appendMessage(d1.id, {
    id: 'a2', from: 'agent', agentId: A('usta'), at: now - 420000, costUsd: 0.183,
    text: 'Bitti. Yaptıklarım:\n- `src/pages/ForgotPassword.tsx` yeni sayfa, form ve doğrulama\n- `src/api/auth.ts` içine `requestReset(email)` eklendi\n- `server/routes/auth.js` → `/auth/reset` uç noktası, 15 dk geçerli token\n- Giriş sayfasına "Şifremi unuttum" bağlantısı\n\n`npm test` geçti (14/14). E-posta şablonu şimdilik düz metin, istersen Yazıcı güzelleştirsin.',
    activities: [
      { tool: 'Read', detail: 'okuyor: src/pages/Login.tsx', at: now - 500000 },
      { tool: 'Write', detail: 'yazıyor: src/pages/ForgotPassword.tsx', at: now - 480000 },
      { tool: 'Edit', detail: 'düzenliyor: src/api/auth.ts', at: now - 470000 },
      { tool: 'Edit', detail: 'düzenliyor: server/routes/auth.js', at: now - 460000 },
      { tool: 'Bash', detail: 'komut çalıştırıyor: npm test', at: now - 440000 }
    ]
  })
  store.appendMessage(d1.id, { id: 'a3', from: 'me', text: 'Süper. Token süresini 30 dakika yap ve sıfırlama sonrası otomatik giriş olsun.', at: now - 60000 })
  store.appendMessage(d1.id, {
    id: 'a4', from: 'agent', agentId: A('usta'), at: now - 20000, costUsd: 0.061,
    text: 'Tamam:\n- Token süresi 30 dk oldu (`TOKEN_TTL_MIN = 30`)\n- Başarılı sıfırlamada oturum açılıp `/dashboard`a yönlendiriliyor\n\nTestler yeşil.',
    activities: [{ tool: 'Edit', detail: 'düzenliyor: server/routes/auth.js', at: now - 40000 }, { tool: 'Edit', detail: 'düzenliyor: src/pages/ForgotPassword.tsx', at: now - 35000 }, { tool: 'Bash', detail: 'komut çalıştırıyor: npm test', at: now - 25000 }]
  })

  // Takım odası
  const t1 = store.createConversation({ kind: 'team', projectPath: proj, title: 'Ödeme sayfası yenileme', memberIds: [A('mimar'), A('usta'), A('kontrolcu'), A('yazici')], leadId: A('mimar') })
  store.appendMessage(t1.id, { id: 't1', from: 'me', text: 'Ödeme sayfasını yenileyelim: adım adım sihirbaz, kart ve havale seçeneği, mobilde düzgün görünsün.', at: now - 900000 })
  store.appendMessage(t1.id, {
    id: 't2', from: 'agent', agentId: A('mimar'), at: now - 300000, costUsd: 1.24,
    text: 'Planı 3 parçaya böldüm ve dağıttım.\n\n**Usta:** `Checkout` 3 adımlı sihirbaza dönüştürüldü (adres → ödeme → özet), kart ve havale bileşenleri eklendi, mobil düzen Tailwind ile çözüldü.\n**Kontrolcü:** 9 yeni test, BAŞARILI. Bir risk: havale seçeneğinde IBAN doğrulaması yok, Usta ekledi.\n**Yazıcı:** `docs/odeme-akisi.md` ve ekran görüntülü kısa rehber hazır.\n\nKalan: canlı ödeme sağlayıcısı anahtarı senden.',
    activities: [
      { tool: 'Agent', detail: 'görev veriyor: Usta · sihirbaz ve ödeme bileşenleri', at: now - 800000 },
      { tool: 'Agent', detail: 'görev veriyor: Kontrolcü · test ve risk analizi', at: now - 500000 },
      { tool: 'Agent', detail: 'görev veriyor: Yazıcı · dokümantasyon', at: now - 400000 }
    ]
  })

  const d2 = store.createConversation({ kind: 'direct', agentId: A('mimar'), projectPath: proj })
  store.appendMessage(d2.id, { id: 'm1', from: 'me', text: 'Projeyi tanı, eksikleri 5 maddede özetle.', at: now - 3600000 })
  store.appendMessage(d2.id, { id: 'm2', from: 'agent', agentId: A('mimar'), at: now - 3500000, text: '1. Test kapsamı düşük (%31)\n2. API hata yanıtları tutarsız\n3. Ortam değişkenleri belgelenmemiş\n4. Mobil kırılma noktaları eksik\n5. CI yok', activities: [{ tool: 'Glob', detail: 'dosya arıyor: **/*.ts', at: now - 3550000 }] })

  send('nav', { view: 'chat', id: d1.id })
  await snap('01-sohbet')
  send('nav', { view: 'chat', id: t1.id })
  await snap('02-takim-odasi')
  send('nav', { view: 'team-new' })
  await snap('03-takim-olustur')
  send('nav', { view: 'team-close' })
  send('nav', { view: 'agents' })
  await snap('04-ajanlar')
  send('nav', { view: 'settings' })
  await snap('05-ayarlar')
  send('nav', { view: 'connections' })
  await snap('06-baglantilar')
  app.quit()
}

app.whenReady().then(() => {
  createMainWindow()
  if (process.env.ZENTRA_SHOT) mainWindow?.webContents.once('did-finish-load', () => { setTimeout(() => screenshotMode(process.env.ZENTRA_SHOT!).catch(e => { console.error(e); app.quit() }), 800) })
  app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createMainWindow() })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
