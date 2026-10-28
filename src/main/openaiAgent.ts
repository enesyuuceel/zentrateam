// Claude dışı sağlayıcılar için ajan motoru.
// OpenAI-uyumlu /chat/completions ile araç çağırma döngüsü; OpenAI, Gemini (OpenAI uç noktası),
// Ollama, OpenRouter ve her OpenAI-uyumlu sunucuda çalışır. Geçmiş sohbet başına dosyada tutulur.
import { existsSync, mkdirSync, readFileSync, writeFileSync, readdirSync, statSync } from 'fs'
import { join, resolve, isAbsolute, relative } from 'path'
import { spawn } from 'child_process'
import type { Provider, ToolActivity } from '../shared/types'

export interface OaiMessage {
  role: 'system' | 'user' | 'assistant' | 'tool'
  content: string | null
  tool_calls?: Array<{ id: string; type: 'function'; function: { name: string; arguments: string } }>
  tool_call_id?: string
}

export interface RunInput {
  provider: Provider
  apiKey?: string
  model: string
  system: string
  history: OaiMessage[]          // önceki turlar (system hariç)
  userText: string
  cwd: string | null
  allowCommands: boolean
  signal: AbortSignal
  onDelta: (t: string) => void
  onActivity: (a: ToolActivity) => void
}

export interface RunOutput {
  text: string
  history: OaiMessage[]
}

const MAX_TOOL_ROUNDS = 40
const MAX_FILE_CHARS = 60_000

const TOOLS = [
  { type: 'function', function: { name: 'list_dir', description: 'Bir klasörün içeriğini listeler (dosya ve alt klasörler).', parameters: { type: 'object', properties: { path: { type: 'string', description: 'Klasör yolu; proje köküne göre göreli ya da mutlak. Boş = proje kökü.' } } } } },
  { type: 'function', function: { name: 'read_file', description: 'Bir metin dosyasını okur.', parameters: { type: 'object', properties: { path: { type: 'string' } }, required: ['path'] } } },
  { type: 'function', function: { name: 'write_file', description: 'Dosyayı verilen içerikle oluşturur ya da tamamen üzerine yazar. Gerekirse klasörleri oluşturur.', parameters: { type: 'object', properties: { path: { type: 'string' }, content: { type: 'string' } }, required: ['path', 'content'] } } },
  { type: 'function', function: { name: 'edit_file', description: 'Dosyada old_text geçen ilk yeri new_text ile değiştirir. old_text dosyada birebir bulunmalı.', parameters: { type: 'object', properties: { path: { type: 'string' }, old_text: { type: 'string' }, new_text: { type: 'string' } }, required: ['path', 'old_text', 'new_text'] } } },
  { type: 'function', function: { name: 'search', description: 'Proje içinde metin arar (büyük/küçük harf duyarsız). Eşleşen dosya:satır listesini döner.', parameters: { type: 'object', properties: { query: { type: 'string' }, glob: { type: 'string', description: 'İsteğe bağlı uzantı filtresi, ör. .ts' } }, required: ['query'] } } },
  { type: 'function', function: { name: 'run_command', description: 'Proje klasöründe bir kabuk komutu çalıştırır (ör. npm test). 120 sn zaman aşımı. Çıktıyı döner.', parameters: { type: 'object', properties: { command: { type: 'string' } }, required: ['command'] } } }
]

const SKIP_DIRS = new Set(['node_modules', '.git', 'dist', 'out', 'build', 'release', '.next', 'bin', 'obj'])

function resolveIn(cwd: string | null, p: string | undefined): string {
  const base = cwd ?? process.cwd()
  const abs = !p ? base : isAbsolute(p) ? p : resolve(base, p)
  if (cwd) {
    const rel = relative(cwd, abs)
    if (rel.startsWith('..') || isAbsolute(rel)) throw new Error(`Proje klasörü dışına erişim engellendi: ${p}`)
  }
  return abs
}

function listDir(cwd: string | null, p?: string): string {
  const dir = resolveIn(cwd, p)
  if (!existsSync(dir)) return `Klasör yok: ${dir}`
  const entries = readdirSync(dir, { withFileTypes: true })
    .filter(e => !SKIP_DIRS.has(e.name))
    .map(e => (e.isDirectory() ? `${e.name}/` : e.name))
  return entries.join('\n') || '(boş)'
}

function search(cwd: string | null, query: string, ext?: string): string {
  const root = resolveIn(cwd, undefined)
  const q = query.toLowerCase()
  const hits: string[] = []
  const walk = (dir: string, depth: number): void => {
    if (depth > 8 || hits.length > 200) return
    for (const e of readdirSync(dir, { withFileTypes: true })) {
      if (SKIP_DIRS.has(e.name)) continue
      const full = join(dir, e.name)
      if (e.isDirectory()) { walk(full, depth + 1); continue }
      if (ext && !e.name.endsWith(ext)) continue
      let st
      try { st = statSync(full) } catch { continue }
      if (st.size > 1_500_000) continue
      let txt: string
      try { txt = readFileSync(full, 'utf8') } catch { continue }
      if (txt.includes('\u0000')) continue
      const lines = txt.split('\n')
      for (let i = 0; i < lines.length; i++) {
        if (lines[i].toLowerCase().includes(q)) {
          hits.push(`${relative(root, full)}:${i + 1}: ${lines[i].trim().slice(0, 160)}`)
          if (hits.length > 200) break
        }
      }
    }
  }
  walk(root, 0)
  return hits.join('\n') || 'Eşleşme yok.'
}

function runCommand(cwd: string | null, command: string, signal: AbortSignal): Promise<string> {
  return new Promise(res => {
    const shell = process.platform === 'win32' ? 'powershell.exe' : '/bin/sh'
    const args = process.platform === 'win32' ? ['-NoProfile', '-NonInteractive', '-Command', command] : ['-c', command]
    const child = spawn(shell, args, { cwd: cwd ?? process.cwd(), windowsHide: true })
    let out = ''
    const cap = (d: Buffer): void => { if (out.length < 40_000) out += d.toString() }
    child.stdout.on('data', cap)
    child.stderr.on('data', cap)
    const t = setTimeout(() => { child.kill(); out += '\n[zaman aşımı: 120 sn]' }, 120_000)
    const onAbort = (): void => { child.kill() }
    signal.addEventListener('abort', onAbort, { once: true })
    child.on('close', code => { clearTimeout(t); signal.removeEventListener('abort', onAbort); res(`${out.trim()}\n[çıkış kodu ${code}]`) })
    child.on('error', e => { clearTimeout(t); res(`Komut başlatılamadı: ${e.message}`) })
  })
}

async function execTool(name: string, argsJson: string, input: RunInput): Promise<string> {
  let a: Record<string, string> = {}
  try { a = JSON.parse(argsJson || '{}') } catch { return 'Hata: araç argümanları geçersiz JSON' }
  try {
    switch (name) {
      case 'list_dir': return listDir(input.cwd, a.path)
      case 'read_file': {
        const p = resolveIn(input.cwd, a.path)
        if (!existsSync(p)) return `Dosya yok: ${a.path}`
        const t = readFileSync(p, 'utf8')
        return t.length > MAX_FILE_CHARS ? t.slice(0, MAX_FILE_CHARS) + `\n…[kesildi, toplam ${t.length} karakter]` : t
      }
      case 'write_file': {
        const p = resolveIn(input.cwd, a.path)
        mkdirSync(join(p, '..'), { recursive: true })
        writeFileSync(p, a.content ?? '', 'utf8')
        return `Yazıldı: ${a.path} (${(a.content ?? '').length} karakter)`
      }
      case 'edit_file': {
        const p = resolveIn(input.cwd, a.path)
        if (!existsSync(p)) return `Dosya yok: ${a.path}`
        const t = readFileSync(p, 'utf8')
        if (!t.includes(a.old_text)) return 'Hata: old_text dosyada bulunamadı. Önce read_file ile dosyayı oku ve birebir metni ver.'
        writeFileSync(p, t.replace(a.old_text, a.new_text ?? ''), 'utf8')
        return `Düzenlendi: ${a.path}`
      }
      case 'search': return search(input.cwd, a.query, a.glob)
      case 'run_command':
        if (!input.allowCommands) return 'Komut çalıştırma bu ajan için kapalı (Ayarlar → Ajan izinleri → Kısıtlı).'
        return await runCommand(input.cwd, a.command, input.signal)
      default: return `Bilinmeyen araç: ${name}`
    }
  } catch (e) {
    return `Hata: ${e instanceof Error ? e.message : String(e)}`
  }
}

function summarize(name: string, argsJson: string): string {
  let a: Record<string, string> = {}
  try { a = JSON.parse(argsJson || '{}') } catch { /* */ }
  switch (name) {
    case 'list_dir': return `listeliyor: ${a.path || '.'}`
    case 'read_file': return `okuyor: ${a.path}`
    case 'write_file': return `yazıyor: ${a.path}`
    case 'edit_file': return `düzenliyor: ${a.path}`
    case 'search': return `arıyor: ${a.query}`
    case 'run_command': return `komut çalıştırıyor: ${(a.command ?? '').slice(0, 80)}`
    default: return `${name} aracını kullanıyor`
  }
}

interface StreamResult {
  content: string
  toolCalls: Array<{ id: string; name: string; args: string }>
}

async function streamCompletion(input: RunInput, messages: OaiMessage[]): Promise<StreamResult> {
  const url = input.provider.baseUrl.replace(/\/+$/, '') + '/chat/completions'
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (input.apiKey) headers.Authorization = `Bearer ${input.apiKey}`
  if (input.provider.kind === 'openrouter') { headers['HTTP-Referer'] = 'https://zentraengine.com'; headers['X-Title'] = 'Zentra Agent Team' }

  const res = await fetch(url, {
    method: 'POST',
    headers,
    signal: input.signal,
    body: JSON.stringify({ model: input.model, messages, tools: TOOLS, stream: true })
  })
  if (!res.ok || !res.body) {
    const body = await res.text().catch(() => '')
    throw new Error(`${input.provider.name} ${res.status}: ${body.slice(0, 400) || res.statusText}`)
  }

  const reader = res.body.getReader()
  const dec = new TextDecoder()
  let buf = ''
  let content = ''
  const calls = new Map<number, { id: string; name: string; args: string }>()

  const handle = (line: string): void => {
    if (!line.startsWith('data:')) return
    const data = line.slice(5).trim()
    if (!data || data === '[DONE]') return
    let j: { choices?: Array<{ delta?: { content?: string; tool_calls?: Array<{ index: number; id?: string; function?: { name?: string; arguments?: string } }> } }>; error?: { message?: string } }
    try { j = JSON.parse(data) } catch { return }
    if (j.error?.message) throw new Error(j.error.message)
    const d = j.choices?.[0]?.delta
    if (!d) return
    if (d.content) { content += d.content; input.onDelta(d.content) }
    for (const tc of d.tool_calls ?? []) {
      const cur = calls.get(tc.index) ?? { id: '', name: '', args: '' }
      if (tc.id) cur.id = tc.id
      if (tc.function?.name) cur.name += tc.function.name
      if (tc.function?.arguments) cur.args += tc.function.arguments
      calls.set(tc.index, cur)
    }
  }

  while (true) {
    const { value, done } = await reader.read()
    if (done) break
    buf += dec.decode(value, { stream: true })
    let i: number
    while ((i = buf.indexOf('\n')) >= 0) {
      const line = buf.slice(0, i).trim()
      buf = buf.slice(i + 1)
      handle(line)
    }
  }
  if (buf.trim()) handle(buf.trim())

  return { content, toolCalls: [...calls.values()].map((c, i) => ({ ...c, id: c.id || `call_${i}` })) }
}

export async function runOpenAiAgent(input: RunInput): Promise<RunOutput> {
  const history: OaiMessage[] = [...input.history, { role: 'user', content: input.userText }]
  let finalText = ''

  for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
    const messages: OaiMessage[] = [{ role: 'system', content: input.system }, ...history]
    const r = await streamCompletion(input, messages)
    if (r.toolCalls.length === 0) {
      finalText = r.content
      history.push({ role: 'assistant', content: r.content })
      break
    }
    history.push({
      role: 'assistant',
      content: r.content || null,
      tool_calls: r.toolCalls.map(c => ({ id: c.id, type: 'function', function: { name: c.name, arguments: c.args } }))
    })
    for (const c of r.toolCalls) {
      if (input.signal.aborted) throw new Error('aborted')
      input.onActivity({ tool: c.name, detail: summarize(c.name, c.args), at: Date.now() })
      const out = await execTool(c.name, c.args, input)
      history.push({ role: 'tool', content: out, tool_call_id: c.id })
    }
    if (round === MAX_TOOL_ROUNDS - 1) finalText = (r.content || '') + '\n\n⚠️ Araç çağrısı sınırına ulaşıldı, iş yarım kalmış olabilir.'
  }
  return { text: finalText, history }
}

/** Sağlayıcı bağlantısını dener ve model listesini çeker. */
export async function testProvider(provider: Provider, apiKey?: string): Promise<{ ok: boolean; message: string; models?: string[] }> {
  try {
    const headers: Record<string, string> = {}
    if (apiKey) headers.Authorization = `Bearer ${apiKey}`
    const res = await fetch(provider.baseUrl.replace(/\/+$/, '') + '/models', { headers, signal: AbortSignal.timeout(15_000) })
    if (!res.ok) return { ok: false, message: `${res.status} ${res.statusText}: ${(await res.text()).slice(0, 200)}` }
    const j = (await res.json()) as { data?: Array<{ id: string }>; models?: Array<{ name: string }> }
    const models = (j.data ?? []).map(m => m.id).concat((j.models ?? []).map(m => m.name)).slice(0, 200)
    return { ok: true, message: `Bağlantı başarılı, ${models.length} model.`, models }
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : String(e) }
  }
}

// --- Geçmiş dosyaları ---
export function historyPath(userData: string, key: string): string {
  const dir = join(userData, 'sessions')
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
  return join(dir, `${key}.json`)
}
export function loadHistory(userData: string, key: string): OaiMessage[] {
  const p = historyPath(userData, key)
  if (!existsSync(p)) return []
  try { return JSON.parse(readFileSync(p, 'utf8')) as OaiMessage[] } catch { return [] }
}
export function saveHistory(userData: string, key: string, h: OaiMessage[]): void {
  // Bağlamı sınırlı tut: son 60 mesaj
  writeFileSync(historyPath(userData, key), JSON.stringify(h.slice(-60), null, 1), 'utf8')
}
