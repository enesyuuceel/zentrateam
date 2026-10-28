// Ortak tipler: main, preload ve renderer arasında paylaşılır.

export type Presence = 'online' | 'busy' | 'away' | 'offline'

/** Yapay zeka sağlayıcısı. 'claude' yerleşiktir (Claude Agent SDK); diğerleri OpenAI-uyumlu API ile çalışır. */
export type ProviderKind = 'openai' | 'gemini' | 'groq' | 'ollama' | 'openrouter' | 'custom'

export interface Provider {
  id: string
  kind: ProviderKind
  name: string
  baseUrl: string          // OpenAI-uyumlu kök adres, ör. https://api.openai.com/v1
  defaultModel: string
  hasKey: boolean          // anahtar şifreli ayrı saklanır
}

export interface Agent {
  id: string
  name: string            // Ekran adı (ör. "Mimar")
  role: string            // Kısa rol etiketi
  persona: string         // Sistem istemine eklenen kişilik/görev tanımı
  personaFile?: string | null   // Doluysa persona her çalıştırmada bu dosyadan okunur (.md, .txt)
  files?: string[]        // Ajana verilen referans dosyaları (içerikleri sistem istemine eklenir)
  avatar: string          // Emoji
  avatarImage?: string | null   // data URL; doluysa emoji yerine gösterilir
  color: string
  provider: string        // 'claude' ya da Provider.id
  model: 'opus' | 'sonnet' | 'haiku'   // Claude için
  modelId?: string        // Diğer sağlayıcılar için model adı (ör. gpt-4.1, gemini-2.5-pro, llama3)
  effort: 'low' | 'medium' | 'high' | 'xhigh' | 'max'
  isLead?: boolean
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
  agentId?: string
  memberIds?: string[]
  leadId?: string          // takıma özel lider; yoksa isLead işaretli ajan
  title: string
  projectPath: string | null
  sessionId: string | null   // Claude: Agent SDK oturumu. Diğer sağlayıcılar: geçmiş dosyası anahtarı
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
  avatar: string
  permissionMode: 'acceptEdits' | 'bypassPermissions' | 'default'
  sounds: boolean
  hasApiKey: boolean       // Claude (Anthropic) anahtarı
  anthropicWorkspaceId?: string   // Anahtar çalışma alanına bağlı değilse gerekli (wrkspc_…)
  authMode: 'apiKey' | 'claudeLogin'
}

export interface AppState {
  agents: Agent[]
  conversations: Conversation[]
  connections: Connection[]
  providers: Provider[]
  settings: Settings
}

export type AgentEvent =
  | { type: 'typing'; conversationId: string; agentId: string; on: boolean }
  | { type: 'delta'; conversationId: string; agentId: string; text: string }
  | { type: 'activity'; conversationId: string; agentId: string; activity: ToolActivity }
  | { type: 'message'; conversationId: string; message: ChatMessage }
  | { type: 'session'; conversationId: string; sessionId: string }
  | { type: 'presence'; agentId: string; presence: Presence; status?: string }
  | { type: 'error'; conversationId: string; error: string }
  | { type: 'nudge'; conversationId: string }

export interface ClaudeSession {
  id: string
  title: string
  startedAt: string | null
  lastAt: string
  turns: number
  sizeKb: number
}

export interface AgentFileImport {
  path: string
  name?: string
  role?: string
  persona: string
}

export interface NudgeApi {
  getState(): Promise<AppState>
  getPresence(): Promise<Record<string, { presence: Presence; status?: string }>>
  saveSettings(patch: Partial<Settings>): Promise<Settings>
  setApiKey(key: string): Promise<void>
  clearApiKey(): Promise<void>
  openChat(conversationId: string): Promise<void>
  createConversation(input: { kind: 'direct' | 'team'; agentId?: string; memberIds?: string[]; leadId?: string; projectPath: string | null; title?: string }): Promise<Conversation>
  updateTeam(id: string, input: { title: string; memberIds: string[]; leadId: string }): Promise<Conversation>
  deleteConversation(id: string): Promise<void>
  renameConversation(id: string, title: string): Promise<Conversation>
  listClaudeSessions(projectPath: string): Promise<ClaudeSession[]>
  attachSession(conversationId: string, sessionId: string, title: string): Promise<Conversation>
  openPath(path: string): Promise<string>
  setProjectPath(conversationId: string, path: string | null): Promise<Conversation>
  pickFolder(): Promise<string | null>
  pickFiles(kind: 'text' | 'image'): Promise<string[]>
  importAgentFile(path: string): Promise<AgentFileImport>
  readImageAsDataUrl(path: string): Promise<string>
  sendMessage(conversationId: string, text: string): Promise<void>
  cancel(conversationId: string): Promise<void>
  resetSession(conversationId: string): Promise<void>
  nudge(conversationId: string): Promise<void>
  saveAgent(agent: Agent): Promise<Agent[]>
  deleteAgent(id: string): Promise<Agent[]>
  saveConnection(conn: Connection): Promise<Connection[]>
  deleteConnection(id: string): Promise<Connection[]>
  saveProvider(p: Provider, apiKey?: string): Promise<Provider[]>
  deleteProvider(id: string): Promise<Provider[]>
  useProviderForAll(id: string): Promise<Agent[]>
  testProvider(id: string): Promise<{ ok: boolean; message: string; models?: string[] }>
  openWindow(route: 'connections' | 'settings' | 'agents'): Promise<void>
  onEvent(cb: (e: AgentEvent) => void): () => void
  onNav(cb: (n: { view: string; id?: string }) => void): () => void
  onStateChanged(cb: (s: AppState) => void): () => void
  windowControl(action: 'minimize' | 'close' | 'maximize'): void
}
