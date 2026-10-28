import { app, BrowserWindow, ipcMain, dialog, shell } from 'electron'
import { join } from 'path'
import { store } from './store'
import { AgentRunner } from './agentRunner'
import type { AgentEvent } from '../shared/types'

const isDev = !app.isPackaged && !!process.env.ELECTRON_RENDERER_URL

let mainWindow: BrowserWindow | null = null
const chatWindows = new Map<string, BrowserWindow>()
const utilityWindows = new Map<string, BrowserWindow>()

function broadcast(channel: string, payload: unknown): void {
  for (const w of BrowserWindow.getAllWindows()) {
    if (!w.isDestroyed()) w.webContents.send(channel, payload)
  }
}

const runner = new AgentRunner((e: AgentEvent) => broadcast('agent:event', e))
store.onChange(s => broadcast('state:changed', s))

function createWindow(route: string, opts: Electron.BrowserWindowConstructorOptions): BrowserWindow {
  const win = new BrowserWindow({
    show: false,
    frame: false,
    backgroundColor: '#dfe9f7',
    autoHideMenuBar: true,
    icon: join(__dirname, '../../resources/icon.png'),
    ...opts,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false,
      contextIsolation: true
    }
  })
  win.once('ready-to-show', () => win.show())
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:/.test(url)) shell.openExternal(url)
    return { action: 'deny' }
  })
  if (isDev) win.loadURL(`${process.env.ELECTRON_RENDERER_URL}#${route}`)
  else win.loadFile(join(__dirname, '../renderer/index.html'), { hash: route })
  return win
}

function createMainWindow(): void {
  mainWindow = createWindow('/main', { width: 300, height: 620, minWidth: 260, minHeight: 420 })
  mainWindow.on('closed', () => { mainWindow = null })
}

function openChat(conversationId: string): void {
  const existing = chatWindows.get(conversationId)
  if (existing && !existing.isDestroyed()) { existing.focus(); return }
  const win = createWindow(`/chat/${conversationId}`, { width: 560, height: 520, minWidth: 420, minHeight: 360 })
  chatWindows.set(conversationId, win)
  win.on('closed', () => chatWindows.delete(conversationId))
}

function openUtility(route: 'connections' | 'settings' | 'agents'): void {
  const existing = utilityWindows.get(route)
  if (existing && !existing.isDestroyed()) { existing.focus(); return }
  const size = route === 'connections' ? { width: 620, height: 560 } : route === 'agents' ? { width: 640, height: 580 } : { width: 460, height: 520 }
  const win = createWindow(`/${route}`, { ...size, minWidth: 380, minHeight: 320 })
  utilityWindows.set(route, win)
  win.on('closed', () => utilityWindows.delete(route))
}

function shake(win: BrowserWindow): void {
  const [x, y] = win.getPosition()
  let i = 0
  const t = setInterval(() => {
    const dx = (i % 2 === 0 ? 1 : -1) * 8
    const dy = (i % 4 < 2 ? 1 : -1) * 6
    win.setPosition(x + dx, y + dy)
    if (++i > 10) { clearInterval(t); win.setPosition(x, y) }
  }, 40)
}

// --- IPC ---
ipcMain.handle('state:get', () => store.snapshot())
ipcMain.handle('presence:get', () => runner.getPresence())
ipcMain.handle('settings:save', (_e, patch) => store.saveSettings(patch))
ipcMain.handle('auth:setKey', (_e, key: string) => store.setApiKey(key))
ipcMain.handle('auth:clearKey', () => store.clearApiKey())
ipcMain.handle('chat:open', (_e, id: string) => openChat(id))
ipcMain.handle('conv:create', (_e, input) => store.createConversation(input))
ipcMain.handle('conv:delete', (_e, id: string) => {
  runner.cancel(id)
  chatWindows.get(id)?.close()
  store.deleteConversation(id)
})
ipcMain.handle('conv:setProject', (_e, id: string, path: string | null) => store.updateConversation(id, { projectPath: path, sessionId: null }))
ipcMain.handle('dialog:pickFolder', async (e) => {
  const win = BrowserWindow.fromWebContents(e.sender) ?? undefined
  const r = await dialog.showOpenDialog(win!, { properties: ['openDirectory', 'createDirectory'], title: 'Proje klasörünü seç' })
  return r.canceled ? null : r.filePaths[0]
})
ipcMain.handle('chat:send', (_e, id: string, text: string) => runner.send(id, text))
ipcMain.handle('chat:cancel', (_e, id: string) => runner.cancel(id))
ipcMain.handle('chat:reset', (_e, id: string) => {
  runner.cancel(id)
  store.updateConversation(id, { sessionId: null })
})
ipcMain.handle('chat:nudge', (_e, id: string) => {
  const win = chatWindows.get(id)
  if (win && !win.isDestroyed()) shake(win)
  broadcast('agent:event', { type: 'nudge', conversationId: id } satisfies AgentEvent)
})
ipcMain.handle('agent:save', (_e, a) => store.saveAgent(a))
ipcMain.handle('agent:delete', (_e, id: string) => store.deleteAgent(id))
ipcMain.handle('conn:save', (_e, c) => store.saveConnection(c))
ipcMain.handle('conn:delete', (_e, id: string) => store.deleteConnection(id))
ipcMain.handle('window:open', (_e, route) => openUtility(route))
ipcMain.on('window:control', (e, action: 'minimize' | 'close' | 'maximize') => {
  const win = BrowserWindow.fromWebContents(e.sender)
  if (!win) return
  if (action === 'minimize') win.minimize()
  else if (action === 'close') win.close()
  else win.isMaximized() ? win.unmaximize() : win.maximize()
})

// Geliştirme yardımcısı: NUDGE_SHOT=<klasör> verilirse pencereleri PNG olarak kaydedip çıkar.
async function screenshotMode(dir: string): Promise<void> {
  const { writeFileSync } = await import('fs')
  const wait = (ms: number): Promise<void> => new Promise(r => setTimeout(r, ms))
  const snap = async (win: BrowserWindow, name: string): Promise<void> => {
    await wait(1200)
    const img = await win.webContents.capturePage()
    writeFileSync(join(dir, `${name}.png`), img.toPNG())
  }
  if (!mainWindow) return
  await snap(mainWindow, 'main')
  const agent = store.agents[0]
  const demo = store.conversations.find(c => c.title === '__demo__') ?? store.createConversation({ kind: 'direct', agentId: agent.id, projectPath: 'C:\\Users\\Enes\\Desktop\\Nudge', title: '__demo__' })
  if (demo.messages.length === 0) {
    const now = Date.now()
    store.appendMessage(demo.id, { id: 'd1', from: 'me', text: 'Selam Mimar, README dosyasını gözden geçirip eksikleri yazar mısın? :)', at: now - 60000 })
    store.appendMessage(demo.id, {
      id: 'd2', from: 'agent', agentId: agent.id, at: now - 20000, costUsd: 0.042,
      text: 'Baktım. README kurulum adımlarını anlatıyor ama **bağlantılar** bölümü eksik.\n\nÖnerim:\n- "Bağlantılar" başlığı altında GitHub ve Google kurulumunu anlat\n- Ekran görüntüsü ekle\n\nİstersen Yazıcı\'ya devredebilirim.',
      activities: [{ tool: 'Read', detail: 'okuyor: README.md', at: now - 40000 }, { tool: 'Glob', detail: 'dosya arıyor: docs/**', at: now - 35000 }]
    })
  }
  openChat(demo.id)
  const chatWin = chatWindows.get(demo.id)
  if (chatWin) { await new Promise<void>(r => chatWin.once('ready-to-show', () => r())); await snap(chatWin, 'chat') }
  openUtility('connections')
  const cw = utilityWindows.get('connections')
  if (cw) { await new Promise<void>(r => cw.once('ready-to-show', () => r())); await snap(cw, 'connections') }
  store.deleteConversation(demo.id)
  app.quit()
}

app.whenReady().then(() => {
  createMainWindow()
  if (process.env.NUDGE_SHOT) mainWindow?.once('ready-to-show', () => { screenshotMode(process.env.NUDGE_SHOT!).catch(e => { console.error(e); app.quit() }) })
  app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createMainWindow() })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
