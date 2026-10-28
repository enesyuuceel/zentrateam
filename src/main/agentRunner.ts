// Ajan motoru. Her sohbet bir proje klasörüne ve kalıcı bir oturuma bağlıdır.
// provider 'claude' → Claude Agent SDK (resume ile oturum); diğerleri → OpenAI-uyumlu araç döngüsü (geçmiş dosyada).
import { query, type Options, type SDKMessage, type AgentDefinition, type McpServerConfig } from '@anthropic-ai/claude-agent-sdk'
import { randomUUID } from 'crypto'
import { existsSync, readFileSync } from 'fs'
import { basename } from 'path'
import { store } from './store'
import { loadHistory, runOpenAiAgent, saveHistory, type Subagent } from './openaiAgent'
import type { Agent, AgentEvent, ChatMessage, Connection, Conversation, Presence, ToolActivity } from '../shared/types'

type Emit = (e: AgentEvent) => void

const MODEL_IDS: Record<Agent['model'], string> = {
  opus: 'claude-opus-5-5',
  sonnet: 'claude-sonnet-5-5',
  haiku: 'claude-haiku-5-5'
}

const BASE_RULES = `
Kullanıcı seninle bir takım sohbeti penceresinden konuşuyor; cevapların sohbet mesajı gibi kısa ve Türkçe olsun.
Çalışma dizini bu sohbete bağlı proje klasörüdür. Dosya işlemlerini orada yap.
Bir iş bittiğinde ne yaptığını 3-6 satırda özetle; uzun kod bloklarını mesaja yapıştırma, dosyaya yaz ve dosya adını söyle.
Bir şey yapamıyorsan nedenini bir cümleyle söyle, yapabildiklerini bitir.`

const MAX_REF_CHARS = 40_000

/** Persona: dosya bağlıysa her çalıştırmada dosyadan okunur (Notepad'de düzenle, anında geçerli). */
export function resolvePersona(a: Agent): string {
  if (a.personaFile && existsSync(a.personaFile)) {
    try {
      const raw = readFileSync(a.personaFile, 'utf8')
      return stripFrontmatter(raw).trim() || a.persona
    } catch { /* dosya okunamazsa kayıtlı metin */ }
  }
  return a.persona
}

export function stripFrontmatter(s: string): string {
  const m = /^---\r?\n[\s\S]*?\r?\n---\r?\n?/.exec(s)
  return m ? s.slice(m[0].length) : s
}

function referenceFiles(a: Agent): string {
  const parts: string[] = []
  let budget = MAX_REF_CHARS
  for (const f of a.files ?? []) {
    if (!existsSync(f) || budget <= 0) continue
    try {
      let t = readFileSync(f, 'utf8')
      if (t.length > budget) t = t.slice(0, budget) + '\n…[kesildi]'
      budget -= t.length
      parts.push(`### ${basename(f)}\n${t}`)
    } catch { /* yoksay */ }
  }
  return parts.length ? `\n\nREFERANS DOSYALARIN (kullanıcı sana verdi, bunlara göre davran):\n${parts.join('\n\n')}` : ''
}

function agentPrompt(a: Agent): string {
  return `${BASE_RULES}\n\nSENİN ROLÜN (${a.name}, ${a.role}):\n${resolvePersona(a)}${referenceFiles(a)}`
}

function toolSummary(name: string, input: Record<string, unknown>): string {
  const p = (k: string): string => String(input[k] ?? '')
  switch (name) {
    case 'Read': return `okuyor: ${p('file_path')}`
    case 'Write': return `yazıyor: ${p('file_path')}`
    case 'Edit': return `düzenliyor: ${p('file_path')}`
    case 'Bash': return `komut çalıştırıyor: ${p('command').slice(0, 80)}`
    case 'Glob': return `dosya arıyor: ${p('pattern')}`
    case 'Grep': return `içerik arıyor: ${p('pattern')}`
    case 'WebSearch': return `webde arıyor: ${p('query')}`
    case 'WebFetch': return `sayfa okuyor: ${p('url')}`
    case 'Task': case 'Agent': return `görev veriyor: ${p('description') || p('subagent_type')}`
    default:
      if (name.startsWith('mcp__')) {
        const parts = name.split('__')
        return `${parts[1]} bağlantısını kullanıyor: ${parts.slice(2).join('.')}`
      }
      return `${name} aracını kullanıyor`
  }
}

function connectionToMcp(c: Connection): McpServerConfig {
  if (c.transport === 'http') return { type: 'http', url: c.url ?? '', headers: c.headers }
  if (c.transport === 'sse') return { type: 'sse', url: c.url ?? '', headers: c.headers }
  return { type: 'stdio', command: c.command ?? '', args: c.args ?? [], env: c.env }
}

export class AgentRunner {
  private emit: Emit
  private running = new Map<string, AbortController>()
  private presence = new Map<string, { presence: Presence; status?: string }>()

  constructor(emit: Emit) {
    this.emit = emit
    for (const a of store.agents) this.presence.set(a.id, { presence: 'online' })
  }

  getPresence(): Record<string, { presence: Presence; status?: string }> {
    const out: Record<string, { presence: Presence; status?: string }> = {}
    for (const a of store.agents) out[a.id] = this.presence.get(a.id) ?? { presence: 'online' }
    return out
  }

  private setPresence(agentId: string, presence: Presence, status?: string): void {
    this.presence.set(agentId, { presence, status })
    this.emit({ type: 'presence', agentId, presence, status })
  }

  cancel(conversationId: string): void {
    this.running.get(conversationId)?.abort()
  }

  private buildClaudeOptions(conv: Conversation, lead: Agent, abort: AbortController): Options {
    const settings = store.settings
    const apiKey = store.getApiKey()
    const env: Record<string, string | undefined> = { ...process.env }
    if (apiKey) env.ANTHROPIC_API_KEY = apiKey
    if (settings.anthropicWorkspaceId?.trim()) env.ANTHROPIC_CUSTOM_HEADERS = `anthropic-workspace-id: ${settings.anthropicWorkspaceId.trim()}`

    const mcpServers: Record<string, McpServerConfig> = {}
    for (const c of store.connections.filter(c => c.enabled)) {
      mcpServers[c.name.toLowerCase().replace(/[^a-z0-9]+/g, '_')] = connectionToMcp(c)
    }

    let agents: Record<string, AgentDefinition> | undefined
    let appendPrompt = agentPrompt(lead)

    if (conv.kind === 'team') {
      const members = (conv.memberIds ?? []).map(id => store.getAgent(id))
        .filter((a): a is Agent => !!a && a.id !== lead.id && a.provider === 'claude')
      agents = {}
      for (const m of members) {
        agents[m.id] = {
          description: `${m.name} (${m.role}). ${resolvePersona(m).split('.')[0]}.`,
          prompt: `${agentPrompt(m)}\nRaporunu "${m.name}:" diye başlayarak ver.`,
          model: m.model,
          effort: m.effort
        }
      }
      appendPrompt += `\n\nBu bir takım odası. Takım arkadaşların alt ajan olarak emrinde: ${members.map(m => `${m.name} (${m.id}: ${m.role})`).join(', ')}.
Büyük işleri parçala ve uygun ajana Agent aracıyla devret; küçük işleri kendin yap. Her alt ajanın raporunu kullanıcıya "**Ad:** özet" satırıyla ilet.`
    }

    return {
      cwd: conv.projectPath ?? undefined,
      resume: conv.sessionId ?? undefined,
      model: MODEL_IDS[lead.model],
      effort: lead.effort,
      systemPrompt: { type: 'preset', preset: 'claude_code', append: appendPrompt },
      permissionMode: settings.permissionMode,
      allowedTools: ['Read', 'Glob', 'Grep', 'WebSearch', 'WebFetch', 'Edit', 'Write', 'Bash', 'Agent', 'Task'],
      includePartialMessages: true,
      settingSources: ['project'],   // proje klasöründeki CLAUDE.md ve .claude/ kuralları ajana verilir
      mcpServers,
      agents,
      env,
      abortController: abort,
      stderr: (d: string) => console.error('[agent]', d.trim())
    }
  }

  async send(conversationId: string, text: string): Promise<void> {
    const conv = store.getConversation(conversationId)
    if (!conv) throw new Error('Sohbet bulunamadı')
    if (this.running.has(conversationId)) throw new Error('Bu sohbette ajan hâlâ çalışıyor. Önce bitmesini bekle ya da durdur.')

    const members = (conv.memberIds ?? []).map(id => store.getAgent(id)).filter((a): a is Agent => !!a)
    const lead = conv.kind === 'team'
      ? (conv.leadId ? store.getAgent(conv.leadId) : undefined) ?? members.find(a => a.isLead) ?? members[0]
      : store.getAgent(conv.agentId ?? '')
    if (!lead) throw new Error(conv.kind === 'team' ? 'Takım odasında üye yok. Başlıktaki üye avatarlarından ajan ekle.' : 'Ajan bulunamadı')

    const mine: ChatMessage = { id: randomUUID(), from: 'me', text, at: Date.now() }
    store.appendMessage(conversationId, mine)
    this.emit({ type: 'message', conversationId, message: mine })

    const abort = new AbortController()
    this.running.set(conversationId, abort)
    this.setPresence(lead.id, 'busy', conv.projectPath ? `${conv.title} üzerinde çalışıyor` : 'yazıyor…')
    this.emit({ type: 'typing', conversationId, agentId: lead.id, on: true })

    const activities: ToolActivity[] = []
    let buffer = ''
    let cost: number | undefined
    let finalText: string | null = null

    const flush = (): void => {
      const body = (finalText ?? buffer).trim()
      if (!body && activities.length === 0) return
      const msg: ChatMessage = {
        id: randomUUID(), from: 'agent', agentId: lead.id, text: body || '(sessizce bitirdi)', at: Date.now(),
        activities: activities.length ? [...activities] : undefined, costUsd: cost
      }
      store.appendMessage(conversationId, msg)
      this.emit({ type: 'message', conversationId, message: msg })
      buffer = ''; activities.length = 0; finalText = null
    }
    const sys = (t: string): void => {
      const m: ChatMessage = { id: randomUUID(), from: 'system', text: t, at: Date.now() }
      store.appendMessage(conversationId, m)
      this.emit({ type: 'message', conversationId, message: m })
    }

    try {
      if (lead.provider === 'claude') {
        await this.runClaude(conv, lead, text, abort, {
          onDelta: t => { buffer += t; this.emit({ type: 'delta', conversationId, agentId: lead.id, text: t }) },
          onActivity: a => { activities.push(a); this.emit({ type: 'activity', conversationId, agentId: lead.id, activity: a }); this.setPresence(lead.id, 'busy', a.detail) },
          onResult: (t, c) => { finalText = t; cost = c }
        })
      } else {
        await this.runOther(conv, lead, text, abort, {
          onDelta: t => { buffer += t; this.emit({ type: 'delta', conversationId, agentId: lead.id, text: t }) },
          onActivity: a => { activities.push(a); this.emit({ type: 'activity', conversationId, agentId: lead.id, activity: a }); this.setPresence(lead.id, 'busy', a.detail) },
          onResult: t => { finalText = t }
        })
      }
      flush()
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      if (abort.signal.aborted) {
        if (buffer) flush()
        sys('İşlem durduruldu.')
      } else {
        console.error('agent error', err)
        const hint = /api key|authentication|401|not logged in|login/i.test(msg)
          ? ' Hesap bağlı değil görünüyor: Ayarlar → Claude hesabı ya da Sağlayıcılar bölümünden anahtar gir.'
          : ''
        this.emit({ type: 'error', conversationId, error: msg + hint })
        sys(`Hata: ${msg}${hint}`)
      }
    } finally {
      this.running.delete(conversationId)
      this.emit({ type: 'typing', conversationId, agentId: lead.id, on: false })
      this.setPresence(lead.id, 'online')
    }
  }

  private async runClaude(
    conv: Conversation, lead: Agent, text: string, abort: AbortController,
    h: { onDelta: (t: string) => void; onActivity: (a: ToolActivity) => void; onResult: (t: string, cost?: number) => void }
  ): Promise<void> {
    const conversationId = conv.id
    let buffer = ''
    const q = query({ prompt: text, options: this.buildClaudeOptions(conv, lead, abort) })
    for await (const m of q as AsyncIterable<SDKMessage>) {
      if (m.type === 'system' && m.subtype === 'init') {
        if (m.session_id && m.session_id !== conv.sessionId) {
          store.updateConversation(conversationId, { sessionId: m.session_id })
          this.emit({ type: 'session', conversationId, sessionId: m.session_id })
        }
        continue
      }
      if (m.type === 'stream_event') {
        const ev = m.event as { type: string; delta?: { type: string; text?: string } }
        if (ev.type === 'content_block_delta' && ev.delta?.type === 'text_delta' && ev.delta.text && m.parent_tool_use_id === null) {
          buffer += ev.delta.text
          h.onDelta(ev.delta.text)
        }
        continue
      }
      if (m.type === 'assistant') {
        const blocks = (m.message.content ?? []) as Array<{ type: string; name?: string; input?: Record<string, unknown> }>
        for (const b of blocks) {
          if (b.type === 'tool_use' && b.name) h.onActivity({ tool: b.name, detail: toolSummary(b.name, b.input ?? {}), at: Date.now() })
        }
        continue
      }
      if (m.type === 'result') {
        if (m.subtype === 'success' && !m.is_error) h.onResult(m.result, m.total_cost_usd)
        else if (m.subtype === 'success') {
          const r = m.result || 'Bilinmeyen hata'
          const loginHint = /not logged in|login|api key|authentication/i.test(r)
            ? '\n\n🔑 Claude hesabına bağlanılamadı. Ayarlar → Claude hesabı bölümünden API anahtarı gir ya da bilgisayara Claude Code kurup `claude /login` yap.'
            : ''
          h.onResult(`⚠️ ${r}${loginHint}`, m.total_cost_usd)
        } else {
          const errs = 'errors' in m ? (m as { errors: string[] }).errors.join('; ') : (m as { subtype: string }).subtype
          h.onResult((buffer ? buffer + '\n\n' : '') + `⚠️ Tur hata ile bitti: ${errs}`, m.total_cost_usd)
        }
        if (m.session_id && m.session_id !== store.getConversation(conversationId)?.sessionId) {
          store.updateConversation(conversationId, { sessionId: m.session_id })
          this.emit({ type: 'session', conversationId, sessionId: m.session_id })
        }
      }
    }
  }

  private resolveOther(a: Agent): { provider: NonNullable<ReturnType<typeof store.getProvider>>; apiKey?: string; model: string } {
    const provider = store.getProvider(a.provider)
    if (!provider) throw new Error(`"${a.name}" ajanının sağlayıcısı bulunamadı. Ayarlar → Yapay zeka sağlayıcıları bölümünden ekle ya da ajanı başka sağlayıcıya al.`)
    const apiKey = store.getProviderKey(provider.id)
    if (!apiKey && provider.kind !== 'ollama' && provider.kind !== 'custom') throw new Error(`${provider.name} için API anahtarı girilmemiş (Ayarlar → Yapay zeka sağlayıcıları).`)
    const model = a.modelId?.trim() || provider.defaultModel
    if (!model) throw new Error(`${provider.name} için model adı belirtilmemiş.`)
    return { provider, apiKey, model }
  }

  private async runOther(
    conv: Conversation, lead: Agent, text: string, abort: AbortController,
    h: { onDelta: (t: string) => void; onActivity: (a: ToolActivity) => void; onResult: (t: string) => void }
  ): Promise<void> {
    const { provider, apiKey, model } = this.resolveOther(lead)

    // Takım odası: Claude dışı lider, diğer Claude dışı üyelere "delegate" aracıyla görev verir
    const subagents: Subagent[] = []
    if (conv.kind === 'team') {
      for (const m of (conv.memberIds ?? []).map(id => store.getAgent(id)).filter((a): a is Agent => !!a && a.id !== lead.id)) {
        if (m.provider === 'claude') continue
        try {
          const r = this.resolveOther(m)
          subagents.push({ id: m.id, name: m.name, role: m.role, system: `${agentPrompt(m)}\n\nAraçların: list_dir, read_file, write_file, edit_file, search, run_command. Görevi yap, sonunda kısa rapor ver.${conv.projectPath ? `\nProje kökü: ${conv.projectPath}` : ''}`, ...r })
        } catch { /* yapılandırılmamış üye atlanır */ }
      }
    }

    const key = conv.sessionId ?? randomUUID()
    if (!conv.sessionId) {
      store.updateConversation(conv.id, { sessionId: key })
      this.emit({ type: 'session', conversationId: conv.id, sessionId: key })
    }
    const history = loadHistory(store.userDataDir, key)
    const teamNote = subagents.length
      ? `\n\nBu bir takım odası, sen lidersin. Takım arkadaşların: ${subagents.map(s => `${s.name} (agent_id: ${s.id}, ${s.role})`).join('; ')}. Büyük işi parçala, uygun parçayı "delegate" aracıyla devret, raporları kullanıcıya "**Ad:** özet" satırlarıyla ilet. Küçük işleri kendin yap.`
      : ''
    const system = `${agentPrompt(lead)}\n\nAraçların var: list_dir, read_file, write_file, edit_file, search, run_command${subagents.length ? ', delegate' : ''}. Dosya yolları proje köküne göredir. Bir dosyayı değiştirmeden önce oku.${conv.projectPath ? `\nProje kökü: ${conv.projectPath}` : '\nProje klasörü seçilmedi; dosya işlemi yapma, sadece cevap ver.'}${teamNote}`

    const out = await runOpenAiAgent({
      provider, apiKey, model, system, history, userText: text, subagents,
      cwd: conv.projectPath,
      allowCommands: store.settings.permissionMode !== 'default',
      signal: abort.signal,
      onDelta: h.onDelta,
      onActivity: h.onActivity
    })
    saveHistory(store.userDataDir, key, out.history)
    h.onResult(out.text)
  }
}
