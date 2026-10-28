// Ortak tipler: main, preload ve renderer arasında paylaşılır.

export type Presence = 'online' | 'busy' | 'away' | 'offline'

export interface Agent {
  id: string
  name: string            // Ekran adı (ör. "Mimar")
  role: string            // Kısa rol etiketi
  persona: string         // Sistem istemine eklenen kişilik/görev tanımı
  avatar: string          // Emoji ya da kısa metin
  color: string           // Kişi listesi renk vurgusu
  model: 'opus' | 'sonnet' | 'haiku'
  effort: 'low' | 'medium' | 'high' | 'xhigh' | 'max'
  isLead?: boolean        // Takım odasında lider
}

export interface ToolActivity {
  tool: string
  detail: string
  at: number
}

export interface ChatMessage {
  id: string
  from: 'me' | 'agent' | 'system'
  agentId?: string
  text: string
  at: number
  activities?: ToolActivity[]
  costUsd?: number
}

export interface Conversation {
  id: string
  kind: 'direct' | 'team'
  agentId?: string          // direct ise
  memberIds?: string[]      // team ise
  title: string
  projectPath: string | null
  sessionId: string | null   // Agent SDK oturumu; sohbet kaldığı yerden devam eder
  messages: ChatMessage[]
  createdAt: number
  updatedAt: number
}

export type ConnectionKind = 'github' | 'google' | 'filesystem' | 'custom'

export interface Connection {
  id: string
  kind: ConnectionKind
  name: string
  enabled: boolean
  transport: 'stdio' | 'http' | 'sse'
  command?: string
  args?: string[]
  env?: Record<string, string>
  url?: string
  headers?: Record<string, string>
}

export interface Settings {
  displayName: string
  personalMessage: string
  avatar: string
  permissionMode: 'acceptEdits' | 'bypassPermissions' | 'default'
  sounds: boolean
  hasApiKey: boolean
  authMode: 'apiKey' | 'claudeLogin'
}

export interface AppState {
  agents: Agent[]
  conversations: Conversation[]
  connections: Connection[]
  settings: Settings
}

// Renderer'a akan olaylar
export type AgentEvent =
  | { type: 'typing'; conversationId: string; agentId: string; on: boolean }
  | { type: 'delta'; conversationId: string; agentId: string; text: string }
  | { type: 'activity'; conversationId: string; agentId: string; activity: ToolActivity }
  | { type: 'message'; conversationId: string; message: ChatMessage }
  | { type: 'session'; conversationId: string; sessionId: string }
  | { type: 'presence'; agentId: string; presence: Presence; status?: string }
  | { type: 'error'; conversationId: string; error: string }
  | { type: 'nudge'; conversationId: string }

export interface NudgeApi {
  getState(): Promise<AppState>
  getPresence(): Promise<Record<string, { presence: Presence; status?: string }>>
  saveSettings(patch: Partial<Settings>): Promise<Settings>
  setApiKey(key: string): Promise<void>
  clearApiKey(): Promise<void>
  openChat(conversationId: string): Promise<void>
  createConversation(input: { kind: 'direct' | 'team'; agentId?: string; memberIds?: string[]; projectPath: string | null; title?: string }): Promise<Conversation>
  deleteConversation(id: string): Promise<void>
  setProjectPath(conversationId: string, path: string | null): Promise<Conversation>
  pickFolder(): Promise<string | null>
  sendMessage(conversationId: string, text: string): Promise<void>
  cancel(conversationId: string): Promise<void>
  resetSession(conversationId: string): Promise<void>
  nudge(conversationId: string): Promise<void>
  saveAgent(agent: Agent): Promise<Agent[]>
  deleteAgent(id: string): Promise<Agent[]>
  saveConnection(conn: Connection): Promise<Connection[]>
  deleteConnection(id: string): Promise<Connection[]>
  openWindow(route: 'connections' | 'settings' | 'agents'): Promise<void>
  onEvent(cb: (e: AgentEvent) => void): () => void
  onStateChanged(cb: (s: AppState) => void): () => void
  windowControl(action: 'minimize' | 'close' | 'maximize'): void
}
