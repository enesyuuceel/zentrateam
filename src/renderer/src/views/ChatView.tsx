import React, { useEffect, useMemo, useRef, useState } from 'react'
import type { AppState, ChatMessage, Conversation, ToolActivity } from '../../../shared/types'
import type { PresenceMap } from '../components/useAppState'
import { baseName, fmtTime, renderLite } from '../lib/format'
import { sounds } from '../lib/sounds'
import { Avatar } from '../components/Avatar'
import { SessionPicker } from '../components/SessionPicker'

interface Props {
  state: AppState
  presence: PresenceMap
  conversationId: string | null
  onOpen: (id: string) => void
  onEditTeam: (conv: Conversation) => void
}

const SUGGESTIONS = [
  { t: 'Projeyi tanı', d: 'Klasörü incele, ne olduğunu ve eksikleri 5 maddede özetle.' },
  { t: 'Yeni özellik', d: 'Şu özelliği ekle: … (dosyaları oluştur, derle, çalıştır)' },
  { t: 'Hata bul', d: 'Şu hatayı araştır ve düzelt: …' },
  { t: 'README yaz', d: 'Projeye kurulum ve kullanım anlatan bir README yaz.' }
]

export function ChatView({ state, presence, conversationId, onOpen, onEditTeam }: Props): React.JSX.Element {
  const conv = state.conversations.find(c => c.id === conversationId)
  const agents = state.agents
  const [draft, setDraft] = useState('')
  const [busy, setBusy] = useState(false)
  const [live, setLive] = useState('')
  const [liveActs, setLiveActs] = useState<ToolActivity[]>([])
  const [error, setError] = useState<string | null>(null)
  const [editTitle, setEditTitle] = useState<string | null>(null)
  const [pickSession, setPickSession] = useState(false)
  const logRef = useRef<HTMLDivElement>(null)
  const taRef = useRef<HTMLTextAreaElement>(null)

  const lead = useMemo(() => {
    if (!conv) return undefined
    if (conv.kind === 'direct') return agents.find(a => a.id === conv.agentId)
    return (conv.leadId ? agents.find(a => a.id === conv.leadId) : undefined) ?? (conv.memberIds ?? []).map(id => agents.find(a => a.id === id)).find(a => a?.isLead) ?? agents.find(a => a.id === conv.memberIds?.[0])
  }, [conv, agents])

  useEffect(() => {
    setBusy(false); setLive(''); setLiveActs([]); setError(null); setEditTitle(null); setPickSession(false)
    if (!conversationId) return
    return window.nudge.onEvent(e => {
      if (!('conversationId' in e) || e.conversationId !== conversationId) return
      switch (e.type) {
        case 'typing': setBusy(e.on); if (!e.on) { setLive(''); setLiveActs([]) } break
        case 'delta': setLive(t => t + e.text); break
        case 'activity': setLiveActs(a => [...a, e.activity]); break
        case 'message': setLive(''); setLiveActs([]); break
        case 'error': setError(e.error); sounds.error(); break
      }
    })
  }, [conversationId])

  useEffect(() => {
    const el = logRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [conv?.messages.length, live, liveActs.length, busy, conversationId])

  useEffect(() => {
    const ta = taRef.current
    if (!ta) return
    ta.style.height = 'auto'
    ta.style.height = Math.min(220, ta.scrollHeight) + 'px'
  }, [draft])

  if (!conv) {
    return (
      <div className="empty">
        <div className="big">👋</div>
        <h2>Takımınla çalışmaya başla</h2>
        <p>Soldan bir ajan seç ya da takım odası aç. Her sohbet bir proje klasörüne bağlanır; yazdığın her mesaj kaldığı yerden devam eder.</p>
        <div className="grid">
          {agents.slice(0, 4).map(a => (
            <button key={a.id} onClick={async () => { const c = await window.nudge.createConversation({ kind: 'direct', agentId: a.id, projectPath: null }); onOpen(c.id) }}>
              <b>{a.avatar} {a.name}</b>{a.role}
            </button>
          ))}
        </div>
      </div>
    )
  }

  const send = async (text?: string): Promise<void> => {
    const t = (text ?? draft).trim()
    if (!t || busy) return
    if (!conv.projectPath) {
      const p = await window.nudge.pickFolder()
      if (!p) return
      await window.nudge.setProjectPath(conv.id, p)
    }
    setDraft(''); setError(null); sounds.send()
    try { await window.nudge.sendMessage(conv.id, t) } catch (e) { setError(e instanceof Error ? e.message : String(e)) }
    taRef.current?.focus()
  }

  const pickProject = async (): Promise<void> => {
    const p = await window.nudge.pickFolder()
    if (!p) return
    if (conv.sessionId && !confirm('Klasör değişince ajanın bu sohbetteki hafızası sıfırlanır. Devam edilsin mi?')) return
    await window.nudge.setProjectPath(conv.id, p)
  }
  const reset = async (): Promise<void> => {
    if (!confirm('Ajanın hafızası sıfırlansın mı? Mesaj geçmişi kalır, ajan sıfırdan başlar.')) return
    await window.nudge.resetSession(conv.id)
  }
  const saveTitle = async (): Promise<void> => {
    if (editTitle && editTitle.trim() && editTitle !== conv.title) await window.nudge.renameConversation(conv.id, editTitle.trim())
    setEditTitle(null)
  }

  const nameOf = (m: ChatMessage): { name: string; role: string; avatar: string; color?: string } => {
    if (m.from === 'me') return { name: state.settings.displayName, role: '', avatar: state.settings.avatar }
    const a = agents.find(x => x.id === m.agentId) ?? lead
    return { name: a?.name ?? 'Ajan', role: a?.role ?? '', avatar: a?.avatar ?? '🤖', color: a?.color }
  }

  const leadP = lead ? presence[lead.id] : undefined
  const members = (conv.memberIds ?? []).map(id => agents.find(a => a.id === id)).filter(Boolean)

  // Gün ayraçları
  let lastDay = ''
  const rows: React.ReactNode[] = []
  for (const m of conv.messages) {
    const day = new Date(m.at).toLocaleDateString('tr-TR', { day: 'numeric', month: 'long' })
    if (day !== lastDay) { rows.push(<div key={'d' + m.at} className="day"><span>{day}</span></div>); lastDay = day }
    if (m.from === 'system') {
      const isErr = /^Hata:|⚠️/.test(m.text)
      rows.push(<div key={m.id} className="m system"><div className={`body ${isErr ? 'err' : ''}`} dangerouslySetInnerHTML={{ __html: renderLite(m.text) }} /></div>)
      continue
    }
    const who = nameOf(m)
    rows.push(
      <div key={m.id} className={`m ${m.from}`}>
        {m.from === 'me' ? <div className="av">{who.avatar}</div> : <Avatar agent={agents.find(x => x.id === m.agentId) ?? lead} size={36} />}
        <div>
          <div className="hd"><b>{who.name}</b>{who.role && <span className="role">{who.role}</span>}<time>{fmtTime(m.at)}</time></div>
          <div className="body" dangerouslySetInnerHTML={{ __html: renderLite(m.text) }} />
          {m.activities && m.activities.length > 0 && (
            <details className="steps">
              <summary>⚙ {m.activities.length} adım</summary>
              <div className="ls">{m.activities.map((a, i) => <span key={i}><i>{a.tool}</i>{a.detail}</span>)}</div>
            </details>
          )}
          {m.costUsd !== undefined && m.costUsd > 0 && <div className="cost">≈ ${m.costUsd.toFixed(3)}</div>}
        </div>
      </div>
    )
  }

  return (
    <>
      {pickSession && conv.projectPath && (
        <SessionPicker
          projectPath={conv.projectPath}
          onClose={() => setPickSession(false)}
          onPick={async s => {
            if (conv.sessionId && !confirm('Bu sohbetin mevcut ajan hafızası seçilen Claude Code sohbetiyle değiştirilecek. Devam edilsin mi?')) return
            await window.nudge.attachSession(conv.id, s.id, s.title)
            setPickSession(false)
          }}
        />
      )}
      <div className="chat-head">
        {conv.kind === 'team' ? <div className="av team">👥</div> : <Avatar agent={lead} size={32} />}
        <div className="ttl">
          <div className="t">
            {editTitle !== null
              ? <input autoFocus value={editTitle} onChange={e => setEditTitle(e.target.value)} onBlur={saveTitle} onKeyDown={e => { if (e.key === 'Enter') saveTitle(); if (e.key === 'Escape') setEditTitle(null) }} />
              : <span onDoubleClick={() => setEditTitle(conv.title)} title="Yeniden adlandırmak için çift tıkla">{conv.title}</span>}
            <span className={`dot ${leadP?.presence ?? 'online'}`} />
          </div>
          <div className="s">
            {conv.kind === 'team'
              ? `${members.map(a => a!.name).join(' · ')} · lider ${lead?.name ?? '?'}`
              : (leadP?.status ?? lead?.role)}
          </div>
        </div>
        {conv.kind === 'team' && (
          <div className="members" title="Üyeleri düzenle" onClick={() => onEditTeam(conv)}>
            {members.slice(0, 5).map(a => <Avatar key={a!.id} agent={a} size={26} />)}
            {members.length > 5 && <span className="pill">+{members.length - 5}</span>}
          </div>
        )}
        <span className={`chip ${conv.projectPath ? '' : 'warn'}`} onClick={pickProject} title={conv.projectPath ?? 'Proje klasörü seç'}>📁 {baseName(conv.projectPath)}</span>
        <span className={`chip muted ${conv.sessionId ? 'ok' : ''}`} title={conv.sessionId ? 'Ajan önceki mesajları hatırlıyor' : 'İlk mesajla oturum açılır'}>{conv.sessionId ? '● oturum sürüyor' : '○ yeni oturum'}</span>
        {conv.projectPath && lead?.provider === 'claude' && <button className="ibtn" title="Bu projenin Claude Code sohbet geçmişini bağla" onClick={() => setPickSession(true)}>📜</button>}
        <button className="ibtn" title="Ajanın hafızasını sıfırla" onClick={reset}>↺</button>
        {conv.projectPath && <button className="ibtn" title="Klasörü aç" onClick={() => window.nudge.openPath(conv.projectPath!)}>↗</button>}
      </div>

      <div className="messages" ref={logRef}>
        {conv.messages.length === 0 && !busy && (
          <div className="empty" style={{ padding: '30px 0' }}>
            <div className="big">{conv.kind === 'team' ? '👥' : <Avatar agent={lead} size={64} />}</div>
            <h2>{conv.kind === 'team' ? 'Takım odası' : lead?.name}</h2>
            <p>{conv.kind === 'team'
              ? `${lead?.name} işi bölüp ${members.filter(a => a!.id !== lead?.id).map(a => a!.name).join(', ')} ekibine dağıtır.`
              : lead?.persona.split('.').slice(0, 2).join('.') + '.'}</p>
            <div className="grid">
              {SUGGESTIONS.map(s => <button key={s.t} onClick={() => setDraft(s.d)}><b>{s.t}</b>{s.d}</button>)}
              {conv.projectPath && lead?.provider === 'claude' && <button onClick={() => setPickSession(true)}><b>📜 Geçmişi bağla</b>Bu projede daha önce Claude Code ile yaptığın sohbetten devam et.</button>}
            </div>
          </div>
        )}
        {rows}
        {busy && (
          <div className="live">
            {live && (
              <div className="m agent">
                <Avatar agent={lead} size={36} />
                <div><div className="hd"><b>{lead?.name}</b><span className="role">yazıyor</span></div><div className="body" dangerouslySetInnerHTML={{ __html: renderLite(live) }} /></div>
              </div>
            )}
            <div className="status">
              <span className="dots"><span /><span /><span /></span>
              <span>{lead?.name} {liveActs.length ? liveActs[liveActs.length - 1].detail : 'düşünüyor'}</span>
              {liveActs.length > 1 && <span style={{ color: 'var(--muted-2)' }}>· {liveActs.length} adım</span>}
            </div>
          </div>
        )}
        {error && <div className="m system"><div className="body err">{error}</div></div>}
      </div>

      <div className="composer">
        <div className="box">
          <textarea
            ref={taRef}
            value={draft}
            rows={1}
            placeholder={busy ? `${lead?.name} çalışıyor…` : `${conv.kind === 'team' ? 'Takıma' : lead?.name + "'a"} bir görev yaz`}
            onChange={e => setDraft(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() } }}
          />
          <div className="bar">
            <button className="ibtn" title="Proje klasörü" onClick={pickProject}>📁</button>
            <button className="ibtn" title="Dürt" onClick={() => window.nudge.nudge(conv.id)}>👋</button>
            <span className="hint">Enter gönderir · Shift+Enter yeni satır{conv.projectPath ? '' : ' · ilk gönderimde klasör sorulur'}</span>
            {busy
              ? <button className="send stop" title="Durdur" onClick={() => window.nudge.cancel(conv.id)}>■</button>
              : <button className="send" title="Gönder" onClick={() => send()} disabled={!draft.trim()}>➤</button>}
          </div>
        </div>
      </div>
    </>
  )
}
