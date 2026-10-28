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
  setProjectPath: (id, path) => ipcRenderer.invoke('conv:setProject', id, path),
  pickFolder: () => ipcRenderer.invoke('dialog:pickFolder'),
  sendMessage: (id, text) => ipcRenderer.invoke('chat:send', id, text),
  cancel: (id) => ipcRenderer.invoke('chat:cancel', id),
  resetSession: (id) => ipcRenderer.invoke('chat:reset', id),
  nudge: (id) => ipcRenderer.invoke('chat:nudge', id),
  saveAgent: (a) => ipcRenderer.invoke('agent:save', a),
  deleteAgent: (id) => ipcRenderer.invoke('agent:delete', id),
  saveConnection: (c) => ipcRenderer.invoke('conn:save', c),
  deleteConnection: (id) => ipcRenderer.invoke('conn:delete', id),
  openWindow: (route) => ipcRenderer.invoke('window:open', route),
  onEvent: (cb) => {
    const handler = (_: unknown, e: AgentEvent): void => cb(e)
    ipcRenderer.on('agent:event', handler)
    return () => ipcRenderer.removeListener('agent:event', handler)
  },
  onStateChanged: (cb) => {
    const handler = (_: unknown, s: AppState): void => cb(s)
    ipcRenderer.on('state:changed', handler)
    return () => ipcRenderer.removeListener('state:changed', handler)
  },
  windowControl: (action) => ipcRenderer.send('window:control', action)
}

contextBridge.exposeInMainWorld('nudge', api)
