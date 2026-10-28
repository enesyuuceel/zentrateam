import { app, safeStorage } from 'electron'
import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs'
import { join } from 'path'
import { randomUUID } from 'crypto'
import type { Agent, AppState, ChatMessage, Connection, Conversation, Provider, Settings } from '../shared/types'

export const DEFAULT_AGENTS: Agent[] = [
  {
    id: 'mimar', name: 'Mimar', role: 'Takım lideri · Mimari', avatar: '📐', color: '#6d8cff',
    provider: 'claude', model: 'opus', effort: 'high', isLead: true,
    persona: 'Sen takımın lideri ve yazılım mimarısın. İşi parçalara ayırır, planı yazar, alt ajanlara (Usta, Kontrolcü, Yazıcı) görev dağıtır ve sonucu birleştirirsin. Kullanıcıya Türkçe, kısa ve net rapor verirsin. Kod yazmak yerine önce yapıyı ve dosya planını belirlersin.'
  },
  {
    id: 'usta', name: 'Usta', role: 'Geliştirici', avatar: '🔧', color: '#39d98a',
    provider: 'claude', model: 'opus', effort: 'high',
    persona: 'Sen kıdemli bir yazılım geliştiricisin. Verilen görevi doğrudan koda dökersin: dosya oluşturur, düzenler, derler, çalıştırır. Sonunda hangi dosyaları değiştirdiğini kısa bir liste olarak yazarsın. Türkçe yazarsın, kodu yormazsın.'
  },
  {
    id: 'kontrolcu', name: 'Kontrolcü', role: 'Test · Kalite', avatar: '🧪', color: '#f5b454',
    provider: 'claude', model: 'sonnet', effort: 'medium',
    persona: 'Sen test ve kalite mühendisisin. Yapılan değişikliği okur, test yazar veya çalıştırır, hataları ve riskleri bulursun. Raporun BAŞARILI / BAŞARISIZ / ENGELLİ formatında, kanıtlı ve Türkçe olur. Kodu kendin düzeltmezsin, bulguyu bildirirsin.'
  },
  {
    id: 'yazici', name: 'Yazıcı', role: 'Dokümantasyon', avatar: '📝', color: '#b784ff',
    provider: 'claude', model: 'sonnet', effort: 'low',
    persona: 'Sen teknik yazarsın. README, değişiklik notu, kurulum rehberi ve kod içi açıklamaları yazarsın. Sade Türkçe, kısa cümleler, gereksiz süs yok.'
  }
]

const DEFAULT_SETTINGS: Settings = {
  displayName: 'Ben',
  avatar: '🙂',
  permissionMode: 'acceptEdits',
  sounds: true,
  hasApiKey: false,
  authMode: 'claudeLogin'
}

interface Persisted extends AppState {
  encryptedApiKey?: string
  encryptedProviderKeys?: Record<string, string>
}

function enc(v: string): string {
  return safeStorage.isEncryptionAvailable() ? safeStorage.encryptString(v).toString('base64') : Buffer.from(v, 'utf8').toString('base64')
}
function dec(v: string): string | undefined {
  try {
    const buf = Buffer.from(v, 'base64')
    return safeStorage.isEncryptionAvailable() ? safeStorage.decryptString(buf) : buf.toString('utf8')
  } catch { return undefined }
}

class Store {
  private dir = app.getPath('userData')
  private file = join(this.dir, 'state.json')
  private data: Persisted
  private listeners = new Set<(s: AppState) => void>()

  constructor() {
    if (!existsSync(this.dir)) mkdirSync(this.dir, { recursive: true })
    this.migrateFromNudge()
    this.data = this.load()
  }

  /** Eski "nudge" sürümünden durum dosyasını taşır. */
  private migrateFromNudge(): void {
    if (existsSync(this.file)) return
    const candidates = [join(this.dir, 'nudge-state.json'), join(app.getPath('appData'), 'nudge', 'nudge-state.json')]
    for (const c of candidates) {
      if (existsSync(c)) { try { copyFileSync(c, this.file) } catch { /* yoksay */ } ; return }
    }
  }

  private load(): Persisted {
    try {
      if (existsSync(this.file)) {
        const raw = JSON.parse(readFileSync(this.file, 'utf8')) as Partial<Persisted>
        const agents = (raw.agents?.length ? raw.agents : DEFAULT_AGENTS).map(a => ({ ...a, provider: a.provider || 'claude' }))
        return {
          agents,
          conversations: raw.conversations ?? [],
          connections: raw.connections ?? [],
          providers: (raw.providers ?? []).map(p => ({ ...p, hasKey: !!raw.encryptedProviderKeys?.[p.id] })),
          settings: { ...DEFAULT_SETTINGS, ...(raw.settings ?? {}), hasApiKey: !!raw.encryptedApiKey },
          encryptedApiKey: raw.encryptedApiKey,
          encryptedProviderKeys: raw.encryptedProviderKeys ?? {}
        }
      }
    } catch (e) {
      console.error('state load failed', e)
    }
    return { agents: DEFAULT_AGENTS, conversations: [], connections: [], providers: [], settings: DEFAULT_SETTINGS, encryptedProviderKeys: {} }
  }

  private persist(): void {
    writeFileSync(this.file, JSON.stringify(this.data, null, 2), 'utf8')
    const snap = this.snapshot()
    for (const l of this.listeners) l(snap)
  }

  onChange(cb: (s: AppState) => void): () => void {
    this.listeners.add(cb)
    return () => this.listeners.delete(cb)
  }

  snapshot(): AppState {
    const { encryptedApiKey: _k, encryptedProviderKeys: _p, ...rest } = this.data
    return JSON.parse(JSON.stringify(rest))
  }

  get userDataDir(): string { return this.dir }

  // --- Claude anahtarı ---
  setApiKey(key: string): void {
    if (!key) { this.clearApiKey(); return }
    this.data.encryptedApiKey = enc(key)
    this.data.settings.hasApiKey = true
    this.data.settings.authMode = 'apiKey'
    this.persist()
  }
  clearApiKey(): void {
    delete this.data.encryptedApiKey
    this.data.settings.hasApiKey = false
    this.data.settings.authMode = 'claudeLogin'
    this.persist()
  }
  getApiKey(): string | undefined {
    return this.data.encryptedApiKey ? dec(this.data.encryptedApiKey) : undefined
  }

  // --- Sağlayıcılar ---
  get providers(): Provider[] { return this.data.providers }
  getProvider(id: string): Provider | undefined { return this.data.providers.find(p => p.id === id) }
  getProviderKey(id: string): string | undefined {
    const v = this.data.encryptedProviderKeys?.[id]
    return v ? dec(v) : undefined
  }
  saveProvider(p: Provider, apiKey?: string): Provider[] {
    const id = p.id || randomUUID()
    this.data.encryptedProviderKeys ??= {}
    if (apiKey !== undefined && apiKey !== '') this.data.encryptedProviderKeys[id] = enc(apiKey)
    const hasKey = !!this.data.encryptedProviderKeys[id]
    const next: Provider = { ...p, id, hasKey }
    const i = this.data.providers.findIndex(x => x.id === id)
    if (i >= 0) this.data.providers[i] = next
    else this.data.providers.push(next)
    this.persist()
    return this.data.providers
  }
  deleteProvider(id: string): Provider[] {
    this.data.providers = this.data.providers.filter(p => p.id !== id)
    if (this.data.encryptedProviderKeys) delete this.data.encryptedProviderKeys[id]
    for (const a of this.data.agents) if (a.provider === id) a.provider = 'claude'
    this.persist()
    return this.data.providers
  }

  // --- Ayarlar ---
  get settings(): Settings { return this.data.settings }
  saveSettings(patch: Partial<Settings>): Settings {
    const { hasApiKey: _h, ...safe } = patch
    this.data.settings = { ...this.data.settings, ...safe }
    this.persist()
    return this.data.settings
  }

  // --- Ajanlar ---
  get agents(): Agent[] { return this.data.agents }
  getAgent(id: string): Agent | undefined { return this.data.agents.find(a => a.id === id) }
  saveAgent(agent: Agent): Agent[] {
    const i = this.data.agents.findIndex(a => a.id === agent.id)
    if (i >= 0) this.data.agents[i] = agent
    else this.data.agents.push({ ...agent, id: agent.id || randomUUID() })
    this.persist()
    return this.data.agents
  }
  deleteAgent(id: string): Agent[] {
    this.data.agents = this.data.agents.filter(a => a.id !== id)
    this.persist()
    return this.data.agents
  }

  // --- Sohbetler ---
  get conversations(): Conversation[] { return this.data.conversations }
  getConversation(id: string): Conversation | undefined { return this.data.conversations.find(c => c.id === id) }
  createConversation(input: { kind: 'direct' | 'team'; agentId?: string; memberIds?: string[]; projectPath: string | null; title?: string }): Conversation {
    const now = Date.now()
    const agent = input.agentId ? this.getAgent(input.agentId) : undefined
    const conv: Conversation = {
      id: randomUUID(),
      kind: input.kind,
      agentId: input.agentId,
      memberIds: input.memberIds ?? (input.kind === 'team' ? this.data.agents.filter(a => a.provider === 'claude').map(a => a.id) : undefined),
      title: input.title ?? (input.kind === 'team' ? 'Takım Odası' : agent?.name ?? 'Sohbet'),
      projectPath: input.projectPath,
      sessionId: null,
      messages: [],
      createdAt: now,
      updatedAt: now
    }
    this.data.conversations.unshift(conv)
    this.persist()
    return conv
  }
  updateConversation(id: string, patch: Partial<Conversation>): Conversation {
    const c = this.getConversation(id)
    if (!c) throw new Error('Sohbet bulunamadı')
    Object.assign(c, patch, { updatedAt: Date.now() })
    this.persist()
    return c
  }
  appendMessage(id: string, msg: ChatMessage): void {
    const c = this.getConversation(id)
    if (!c) return
    c.messages.push(msg)
    c.updatedAt = Date.now()
    this.persist()
  }
  deleteConversation(id: string): void {
    this.data.conversations = this.data.conversations.filter(c => c.id !== id)
    this.persist()
  }

  // --- Bağlantılar (MCP) ---
  get connections(): Connection[] { return this.data.connections }
  saveConnection(conn: Connection): Connection[] {
    const i = this.data.connections.findIndex(c => c.id === conn.id)
    if (i >= 0) this.data.connections[i] = conn
    else this.data.connections.push({ ...conn, id: conn.id || randomUUID() })
    this.persist()
    return this.data.connections
  }
  deleteConnection(id: string): Connection[] {
    this.data.connections = this.data.connections.filter(c => c.id !== id)
    this.persist()
    return this.data.connections
  }
}

export const store = new Store()
