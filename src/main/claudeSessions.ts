// Claude Code'un bu bilgisayarda kaydettiği sohbetleri (transcript) proje klasörüne göre listeler.
// Konum: ~/.claude/projects/<kodlanmış-yol>/<sessionId>.jsonl — Agent SDK aynı oturumu "resume" edebilir.
import { existsSync, readdirSync, statSync, createReadStream } from 'fs'
import { createInterface } from 'readline'
import { homedir } from 'os'
import { join } from 'path'
import type { ClaudeSession } from '../shared/types'

/** Claude Code yol kodlaması: alfanümerik olmayan her karakter '-' olur. */
export function encodeProjectPath(p: string): string {
  return p.replace(/[^A-Za-z0-9]/g, '-')
}

export function claudeProjectsDir(): string {
  return join(process.env.CLAUDE_CONFIG_DIR || join(homedir(), '.claude'), 'projects')
}

async function summarize(file: string): Promise<{ title: string; startedAt: string | null; turns: number }> {
  let title = ''
  let startedAt: string | null = null
  let turns = 0
  const rl = createInterface({ input: createReadStream(file, { encoding: 'utf8' }) })
  for await (const line of rl) {
    if (!line) continue
    let j: { type?: string; timestamp?: string; message?: { role?: string; content?: unknown } }
    try { j = JSON.parse(line) } catch { continue }
    if (j.type !== 'user') continue
    const c = j.message?.content
    let text = ''
    if (typeof c === 'string') text = c
    else if (Array.isArray(c)) text = c.filter((x): x is { type: string; text: string } => !!x && typeof x === 'object' && (x as { type?: string }).type === 'text').map(x => x.text).join(' ')
    if (!text.trim() || text.startsWith('<')) continue   // tool_result ve sistem gürültüsü
    turns++
    if (!title) { title = text.replace(/\s+/g, ' ').trim().slice(0, 120); startedAt = j.timestamp ?? null }
  }
  return { title: title || '(başlıksız sohbet)', startedAt, turns }
}

export async function listClaudeSessions(projectPath: string): Promise<ClaudeSession[]> {
  const dir = join(claudeProjectsDir(), encodeProjectPath(projectPath))
  if (!existsSync(dir)) return []
  const files = readdirSync(dir).filter(f => f.endsWith('.jsonl'))
  const out: ClaudeSession[] = []
  for (const f of files) {
    const full = join(dir, f)
    let st
    try { st = statSync(full) } catch { continue }
    if (st.size < 200) continue
    try {
      const s = await summarize(full)
      if (s.turns === 0) continue
      out.push({ id: f.replace(/\.jsonl$/, ''), title: s.title, startedAt: s.startedAt, lastAt: st.mtime.toISOString(), turns: s.turns, sizeKb: Math.round(st.size / 1024) })
    } catch { /* bozuk dosya */ }
  }
  return out.sort((a, b) => b.lastAt.localeCompare(a.lastAt))
}

/**
 * Claude Code transkriptini, Claude dışı ajanların kullandığı OpenAI-uyumlu geçmişe çevirir.
 * Yalnızca metin alınır (araç çağrıları atlanır), ardışık aynı roller birleştirilir, son kısım bütçeye sığdırılır.
 */
export async function transcriptToHistory(projectPath: string, sessionId: string, maxChars = 120_000): Promise<Array<{ role: 'user' | 'assistant'; content: string }>> {
  const file = join(claudeProjectsDir(), encodeProjectPath(projectPath), `${sessionId}.jsonl`)
  if (!existsSync(file)) return []
  const msgs: Array<{ role: 'user' | 'assistant'; content: string }> = []
  const push = (role: 'user' | 'assistant', text: string): void => {
    const t = text.trim()
    if (!t) return
    const last = msgs[msgs.length - 1]
    if (last && last.role === role) last.content += '\n\n' + t
    else msgs.push({ role, content: t })
  }
  const rl = createInterface({ input: createReadStream(file, { encoding: 'utf8' }) })
  for await (const line of rl) {
    if (!line) continue
    let j: { type?: string; message?: { role?: string; content?: unknown } }
    try { j = JSON.parse(line) } catch { continue }
    if (j.type !== 'user' && j.type !== 'assistant') continue
    const c = j.message?.content
    let text = ''
    if (typeof c === 'string') text = c
    else if (Array.isArray(c)) text = c.filter((x): x is { type: string; text: string } => !!x && typeof x === 'object' && (x as { type?: string }).type === 'text').map(x => x.text).join('\n')
    if (!text.trim() || text.startsWith('<')) continue
    push(j.type, text.length > 6000 ? text.slice(0, 6000) + '\n…[kısaltıldı]' : text)
  }
  // Bütçeye sığdır: sondan geriye
  let total = 0
  let i = msgs.length
  while (i > 0 && total + msgs[i - 1].content.length <= maxChars) { total += msgs[i - 1].content.length; i-- }
  const kept = msgs.slice(i)
  if (kept.length && kept[0].role === 'assistant') kept.unshift({ role: 'user', content: '(önceki mesajlar)' })
  if (i > 0) kept.unshift({ role: 'user', content: `[Aktarılan Claude Code sohbeti. Daha eski ${i} mesaj yer kısıtı nedeniyle alınmadı; bu bağlamla devam et.]` }, { role: 'assistant', content: 'Anladım, aktarılan konuşmayı okudum; kaldığımız yerden devam ediyorum.' })
  return kept
}
