import { app, BrowserWindow, ipcMain, dialog, shell } from 'electron'
import { join } from 'path'
import { store } from './store'
import { AgentRunner } from './agentRunner'
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
ipcMain.handle('conv:rename', (_e, id: string, title: string) => store.updateConversation(id, { title }))
ipcMain.handle('conv:setProject', (_e, id: string, path: string | null) => store.updateConversation(id, { projectPath: path, sessionId: null }))
ipcMain.handle('dialog:pickFolder', async () => {
  const r = await dialog.showOpenDialog(mainWindow!, { properties: ['openDirectory', 'createDirectory'], title: 'Proje klasörünü seç' })
  return r.canceled ? null : r.filePaths[0]
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

// Geliştirme yardımcısı: NUDGE_SHOT=<klasör> verilirse görünümleri PNG olarak kaydedip çıkar.
async function screenshotMode(dir: string): Promise<void> {
  const { writeFileSync } = await import('fs')
  const wait = (ms: number): Promise<void> => new Promise(r => setTimeout(r, ms))
  const snap = async (name: string): Promise<void> => {
    await wait(900)
    const img = await mainWindow!.webContents.capturePage()
    writeFileSync(join(dir, `${name}.png`), img.toPNG())
  }
  const agent = store.agents[0]
  const demo = store.createConversation({ kind: 'direct', agentId: agent.id, projectPath: 'C:\\Users\\Enes\\Desktop\\Nudge', title: '__demo__' })
  const now = Date.now()
  store.appendMessage(demo.id, { id: 'd1', from: 'me', text: 'Selam Mimar, README dosyasını gözden geçirip eksikleri yazar mısın?', at: now - 60000 })
  store.appendMessage(demo.id, {
    id: 'd2', from: 'agent', agentId: agent.id, at: now - 20000, costUsd: 0.042,
    text: 'Baktım. README kurulum adımlarını anlatıyor ama **Bağlantılar** bölümü eksik.\n\nÖnerim:\n- "Bağlantılar" başlığı altında GitHub ve Google kurulumunu anlat\n- Ekran görüntüsü ekle\n\nİstersen Yazıcı\'ya devredebilirim.',
    activities: [{ tool: 'Read', detail: 'okuyor: README.md', at: now - 40000 }, { tool: 'Glob', detail: 'dosya arıyor: docs/**', at: now - 35000 }]
  })
  store.appendMessage(demo.id, { id: 'd3', from: 'me', text: 'Evet, Yazıcı yazsın. Sen de package.json sürümünü 0.2.0 yap.', at: now - 5000 })
  send('nav', { view: 'chat', id: demo.id })
  await snap('chat')
  send('nav', { view: 'connections' })
  await snap('connections')
  send('nav', { view: 'agents' })
  await snap('agents')
  store.deleteConversation(demo.id)
  app.quit()
}

app.whenReady().then(() => {
  createMainWindow()
  if (process.env.NUDGE_SHOT) mainWindow?.webContents.once('did-finish-load', () => { setTimeout(() => screenshotMode(process.env.NUDGE_SHOT!).catch(e => { console.error(e); app.quit() }), 800) })
  app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createMainWindow() })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
