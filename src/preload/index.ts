import { contextBridge, ipcRenderer } from 'electron'
import type { AgentEvent, AppState, NudgeApi } from '../shared/types'

const api: NudgeApi = {
  getState: () => ipcRenderer.invoke('state:get'),
  getPresence: () => ipcRenderer.invoke('presence:get'),
  saveSettings: (patch) => ipcRenderer.invoke('settings:save', patch),
  setApiKey: (key) => ipcRenderer.invoke('auth:setKey', key),
  clearApiKey: () => ipcRenderer.invoke('auth:clearKey'),
  openChat: (id) => ipcRenderer.invoke('chat:open', id),
  createConversation: (input) => ipcRenderer.invoke('conv:create', input),
  deleteConversation: (id) => ipcRenderer.invoke('conv:delete', id),
  updateTeam: (id, input) => ipcRenderer.invoke('conv:updateTeam', id, input),
  renameConversation: (id, title) => ipcRenderer.invoke('conv:rename', id, title),
  listClaudeSessions: (p) => ipcRenderer.invoke('claude:sessions', p),
  attachSession: (id, sessionId, title) => ipcRenderer.invoke('conv:attachSession', id, sessionId, title),
  openPath: (p) => ipcRenderer.invoke('shell:openPath', p),
  setProjectPath: (id, path) => ipcRenderer.invoke('conv:setProject', id, path),
  pickFolder: () => ipcRenderer.invoke('dialog:pickFolder'),
  pickFiles: (kind) => ipcRenderer.invoke('dialog:pickFiles', kind),
  importAgentFile: (p) => ipcRenderer.invoke('agent:importFile', p),
  readImageAsDataUrl: (p) => ipcRenderer.invoke('file:imageDataUrl', p),
  sendMessage: (id, text) => ipcRenderer.invoke('chat:send', id, text),
  cancel: (id) => ipcRenderer.invoke('chat:cancel', id),
  resetSession: (id) => ipcRenderer.invoke('chat:reset', id),
  nudge: (id) => ipcRenderer.invoke('chat:nudge', id),
  saveAgent: (a) => ipcRenderer.invoke('agent:save', a),
  deleteAgent: (id) => ipcRenderer.invoke('agent:delete', id),
  saveConnection: (c) => ipcRenderer.invoke('conn:save', c),
  deleteConnection: (id) => ipcRenderer.invoke('conn:delete', id),
  saveProvider: (p, apiKey) => ipcRenderer.invoke('provider:save', p, apiKey),
  deleteProvider: (id) => ipcRenderer.invoke('provider:delete', id),
  testProvider: (id) => ipcRenderer.invoke('provider:test', id),
  openWindow: (route) => ipcRenderer.invoke('window:open', route),
  onEvent: (cb) => {
    const handler = (_: unknown, e: AgentEvent): void => cb(e)
    ipcRenderer.on('agent:event', handler)
    return () => ipcRenderer.removeListener('agent:event', handler)
  },
  onNav: (cb) => {
    const handler = (_: unknown, n: { view: string; id?: string }): void => cb(n)
    ipcRenderer.on('nav', handler)
    return () => ipcRenderer.removeListener('nav', handler)
  },
  onStateChanged: (cb) => {
    const handler = (_: unknown, s: AppState): void => cb(s)
    ipcRenderer.on('state:changed', handler)
    return () => ipcRenderer.removeListener('state:changed', handler)
  },
  windowControl: (action) => ipcRenderer.send('window:control', action)
}

contextBridge.exposeInMainWorld('nudge', api)
