// Ajan motoru: Claude Agent SDK ile her sohbeti kalıcı bir oturuma bağlar.
// Bir sohbete yazılan her mesaj aynı session_id ile devam eder; ajan bağlamı hatırlar.
import { query, type Options, type SDKMessage, type AgentDefinition, type McpServerConfig } from '@anthropic-ai/claude-agent-sdk'
import { randomUUID } from 'crypto'
import { store } from './store'
import type { Agent, AgentEvent, ChatMessage, Connection, Conversation, Presence, ToolActivity } from '../shared/types'

type Emit = (e: AgentEvent) => void

const MODEL_IDS: Record<Agent['model'], string> = {
  opus: 'claude-opus-5-5',
  sonnet: 'claude-sonnet-5-5',
  haiku: 'claude-haiku-5-5'
}

const BASE_RULES = `
Bu uygulamanın adı Nudge. Kullanıcı seninle bir messenger penceresinden konuşuyor; cevapların sohbet mesajı gibi kısa ve Türkçe olsun.
Çalışma dizini bu sohbete bağlı proje klasörüdür. Dosya işlemlerini orada yap.
Bir iş bittiğinde ne yaptığını 3-6 satırda özetle; uzun kod bloklarını mesaja yapıştırma, dosyaya yaz ve dosya adını söyle.
Bir şey yapamıyorsan nedenini bir cümleyle söyle, yapabildiklerini bitir.`

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

  isRunning(conversationId: string): boolean {
    return this.running.has(conversationId)
  }

  cancel(conversationId: string): void {
    this.running.get(conversationId)?.abort()
  }

  private buildOptions(conv: Conversation, lead: Agent, abort: AbortController): Options {
    const settings = store.settings
    const apiKey = store.getApiKey()
    const env: Record<string, string | undefined> = { ...process.env }
    if (apiKey) env.ANTHROPIC_API_KEY = apiKey

    const mcpServers: Record<string, McpServerConfig> = {}
    for (const c of store.connections.filter(c => c.enabled)) {
      mcpServers[c.name.toLowerCase().replace(/[^a-z0-9]+/g, '_')] = connectionToMcp(c)
    }

    let agents: Record<string, AgentDefinition> | undefined
    let appendPrompt = `${BASE_RULES}\n\nSENİN ROLÜN (${lead.name}, ${lead.role}):\n${lead.persona}`

    if (conv.kind === 'team') {
      const members = (conv.memberIds ?? []).map(id => store.getAgent(id)).filter((a): a is Agent => !!a && a.id !== lead.id)
      agents = {}
      for (const m of members) {
        agents[m.id] = {
          description: `${m.name} (${m.role}). ${m.persona.split('.')[0]}.`,
          prompt: `${BASE_RULES}\n\nSENİN ROLÜN (${m.name}, ${m.role}):\n${m.persona}\nRaporunu "${m.name}:" diye başlayarak ver.`,
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
      settingSources: [],
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
    if (this.running.has(conversationId)) throw new Error('Bu sohbette ajan hâlâ çalışıyor. Önce bitmesini bekle ya da iptal et.')

    const lead = conv.kind === 'team'
      ? (conv.memberIds ?? []).map(id => store.getAgent(id)).find(a => a?.isLead) ?? store.getAgent(conv.memberIds?.[0] ?? '')
      : store.getAgent(conv.agentId ?? '')
    if (!lead) throw new Error('Ajan bulunamadı')

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

    const flush = (agentId: string): void => {
      const body = (finalText ?? buffer).trim()
      if (!body && activities.length === 0) return
      const msg: ChatMessage = {
        id: randomUUID(), from: 'agent', agentId, text: body || '(sessizce bitirdi)', at: Date.now(),
        activities: activities.length ? [...activities] : undefined, costUsd: cost
      }
      store.appendMessage(conversationId, msg)
      this.emit({ type: 'message', conversationId, message: msg })
      buffer = ''
      activities.length = 0
      finalText = null
    }

    try {
      const q = query({ prompt: text, options: this.buildOptions(conv, lead, abort) })
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
            this.emit({ type: 'delta', conversationId, agentId: lead.id, text: ev.delta.text })
          }
          continue
        }
        if (m.type === 'assistant') {
          const blocks = (m.message.content ?? []) as Array<{ type: string; name?: string; input?: Record<string, unknown>; text?: string }>
          for (const b of blocks) {
            if (b.type === 'tool_use' && b.name) {
              const act: ToolActivity = { tool: b.name, detail: toolSummary(b.name, b.input ?? {}), at: Date.now() }
              activities.push(act)
              const who = m.agent_id && m.parent_tool_use_id ? lead.id : lead.id
              this.emit({ type: 'activity', conversationId, agentId: who, activity: act })
              this.setPresence(lead.id, 'busy', act.detail)
            }
          }
          continue
        }
        if (m.type === 'result') {
          cost = m.total_cost_usd
          if (m.subtype === 'success' && !m.is_error) finalText = m.result
          else if (m.subtype === 'success') {
            const r = m.result || 'Bilinmeyen hata'
            const loginHint = /not logged in|login|api key|authentication/i.test(r)
              ? '\n\n🔑 Ajan Claude hesabına bağlanamadı. Ayarlar penceresinden bir Anthropic API anahtarı gir; ya da bilgisayara Claude Code kur ve `claude` ile giriş yap.'
              : ''
            finalText = `⚠️ ${r}${loginHint}`
          } else {
            const errs = 'errors' in m ? (m as { errors: string[] }).errors.join('; ') : (m as { subtype: string }).subtype
            finalText = (buffer ? buffer + '\n\n' : '') + `⚠️ Tur hata ile bitti: ${errs}`
          }
          if (m.session_id && m.session_id !== store.getConversation(conversationId)?.sessionId) {
            store.updateConversation(conversationId, { sessionId: m.session_id })
            this.emit({ type: 'session', conversationId, sessionId: m.session_id })
          }
        }
      }
      flush(lead.id)
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      if (abort.signal.aborted) {
        if (buffer) flush(lead.id)
        const sys: ChatMessage = { id: randomUUID(), from: 'system', text: 'İşlem iptal edildi.', at: Date.now() }
        store.appendMessage(conversationId, sys)
        this.emit({ type: 'message', conversationId, message: sys })
      } else {
        console.error('agent error', err)
        const hint = /api key|authentication|401|not logged in|login/i.test(msg)
          ? ' Giriş yapılmamış görünüyor: Ayarlar penceresinden API anahtarı gir ya da bilgisayarda `claude` ile oturum aç.'
          : ''
        this.emit({ type: 'error', conversationId, error: msg + hint })
        const sys: ChatMessage = { id: randomUUID(), from: 'system', text: `Hata: ${msg}${hint}`, at: Date.now() }
        store.appendMessage(conversationId, sys)
        this.emit({ type: 'message', conversationId, message: sys })
      }
    } finally {
      this.running.delete(conversationId)
      this.emit({ type: 'typing', conversationId, agentId: lead.id, on: false })
      this.setPresence(lead.id, 'online')
    }
  }
}
