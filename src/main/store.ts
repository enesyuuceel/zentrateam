import { app, safeStorage } from 'electron'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs'
import { join } from 'path'
import { randomUUID } from 'crypto'
import type { Agent, AppState, ChatMessage, Connection, Conversation, Settings } from '../shared/types'

export const DEFAULT_AGENTS: Agent[] = [
  {
    id: 'mimar', name: 'Mimar', role: 'Takım lideri · Mimari', avatar: '📐', color: '#2e6fd1',
    model: 'opus', effort: 'high', isLead: true,
    persona: 'Sen takımın lideri ve yazılım mimarısın. İşi parçalara ayırır, planı yazar, alt ajanlara (Usta, Kontrolcü, Yazıcı) görev dağıtır ve sonucu birleştirirsin. Kullanıcıya Türkçe, kısa ve net rapor verirsin. Kod yazmak yerine önce yapıyı ve dosya planını belirlersin.'
  },
  {
    id: 'usta', name: 'Usta', role: 'Geliştirici', avatar: '🔧', color: '#1f9d55',
    model: 'opus', effort: 'high',
    persona: 'Sen kıdemli bir yazılım geliştiricisin. Verilen görevi doğrudan koda dökersin: dosya oluşturur, düzenler, derler, çalıştırır. Sonunda hangi dosyaları değiştirdiğini kısa bir liste olarak yazarsın. Türkçe yazarsın, kodu yormazsın.'
  },
  {
    id: 'kontrolcu', name: 'Kontrolcü', role: 'Test · Kalite', avatar: '🧪', color: '#c2410c',
    model: 'sonnet', effort: 'medium',
    persona: 'Sen test ve kalite mühendisisin. Yapılan değişikliği okur, test yazar veya çalıştırır, hataları ve riskleri bulursun. Raporun BAŞARILI / BAŞARISIZ / ENGELLİ formatında, kanıtlı ve Türkçe olur. Kodu kendin düzeltmezsin, bulguyu bildirirsin.'
  },
  {
    id: 'yazici', name: 'Yazıcı', role: 'Dokümantasyon', avatar: '📝', color: '#7c3aed',
    model: 'sonnet', effort: 'low',
    persona: 'Sen teknik yazarsın. README, değişiklik notu, kurulum rehberi ve kod içi açıklamaları yazarsın. Sade Türkçe, kısa cümleler, gereksiz süs yok.'
  }
]

const DEFAULT_SETTINGS: Settings = {
  displayName: 'Ben',
  personalMessage: 'Ajan takımımla proje yapıyorum 🚀',
  avatar: '🙂',
  permissionMode: 'acceptEdits',
  sounds: true,
  hasApiKey: false,
  authMode: 'claudeLogin'
}

interface Persisted extends AppState {
  encryptedApiKey?: string
}

class Store {
  private dir = app.getPath('userData')
  private file = join(this.dir, 'nudge-state.json')
  private data: Persisted
  private listeners = new Set<(s: AppState) => void>()

  constructor() {
    if (!existsSync(this.dir)) mkdirSync(this.dir, { recursive: true })
    this.data = this.load()
  }

  private load(): Persisted {
    try {
      if (existsSync(this.file)) {
        const raw = JSON.parse(readFileSync(this.file, 'utf8')) as Partial<Persisted>
        return {
          agents: raw.agents?.length ? raw.agents : DEFAULT_AGENTS,
          conversations: raw.conversations ?? [],
          connections: raw.connections ?? [],
          settings: { ...DEFAULT_SETTINGS, ...(raw.settings ?? {}), hasApiKey: !!raw.encryptedApiKey },
          encryptedApiKey: raw.encryptedApiKey
        }
      }
    } catch (e) {
      console.error('state load failed', e)
    }
    return { agents: DEFAULT_AGENTS, conversations: [], connections: [], settings: DEFAULT_SETTINGS }
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
    const { encryptedApiKey: _k, ...rest } = this.data
    return JSON.parse(JSON.stringify(rest))
  }

  // --- API anahtarı (safeStorage ile şifreli) ---
  setApiKey(key: string): void {
    if (!key) { this.clearApiKey(); return }
    const enc = safeStorage.isEncryptionAvailable()
      ? safeStorage.encryptString(key).toString('base64')
      : Buffer.from(key, 'utf8').toString('base64')
    this.data.encryptedApiKey = enc
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
    const enc = this.data.encryptedApiKey
    if (!enc) return undefined
    try {
      const buf = Buffer.from(enc, 'base64')
      return safeStorage.isEncryptionAvailable() ? safeStorage.decryptString(buf) : buf.toString('utf8')
    } catch { return undefined }
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
      memberIds: input.memberIds ?? (input.kind === 'team' ? this.data.agents.map(a => a.id) : undefined),
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
