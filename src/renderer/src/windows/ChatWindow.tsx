import React from 'react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { TitleBar } from '../components/TitleBar'
import { useAppState, usePresence } from '../components/useAppState'
import { EMOTICONS, replaceEmoticons } from '../lib/emoticons'
import { baseName, fmtTime, renderLite } from '../lib/format'
import { sounds } from '../lib/sounds'
import type { ChatMessage, ToolActivity } from '../../../shared/types'

export function ChatWindow({ conversationId }: { conversationId: string }): React.JSX.Element {
  const state = useAppState()
  const presence = usePresence()
  const [draft, setDraft] = useState('')
  const [typing, setTyping] = useState(false)
  const [live, setLive] = useState('')                  // akan metin
  const [liveActs, setLiveActs] = useState<ToolActivity[]>([])
  const [emo, setEmo] = useState(false)
  const [shaking, setShaking] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const logRef = useRef<HTMLDivElement>(null)
  const taRef = useRef<HTMLTextAreaElement>(null)

  const conv = state?.conversations.find(c => c.id === conversationId)
  const agents = state?.agents ?? []
  const lead = useMemo(() => {
    if (!conv) return undefined
    if (conv.kind === 'direct') return agents.find(a => a.id === conv.agentId)
    return (conv.memberIds ?? []).map(id => agents.find(a => a.id === id)).find(a => a?.isLead) ?? agents.find(a => a.id === conv.memberIds?.[0])
  }, [conv, agents])

  useEffect(() => {
    return window.nudge.onEvent(e => {
      if ('conversationId' in e && e.conversationId !== conversationId) return
      switch (e.type) {
        case 'typing': setTyping(e.on); if (!e.on) { setLive(''); setLiveActs([]) } break
        case 'delta': setLive(t => t + e.text); break
        case 'activity': setLiveActs(a => [...a, e.activity]); break
        case 'message': if (e.message.from === 'agent') sounds.message(); setLive(''); setLiveActs([]); break
        case 'error': setError(e.error); sounds.error(); break
        case 'nudge': setShaking(true); sounds.nudge(); setTimeout(() => setShaking(false), 600); break
      }
    })
  }, [conversationId])

  useEffect(() => {
    const el = logRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [conv?.messages.length, live, liveActs.length, typing])

  useEffect(() => {
    if (conv) document.title = `${conv.title} - Sohbet`
  }, [conv?.title])

  if (!state || !conv) return <div className="win"><TitleBar title="Sohbet" /></div>

  const busy = typing
  const leadPresence = lead ? presence[lead.id] : undefined

  const send = async (): Promise<void> => {
    const text = replaceEmoticons(draft.trim())
    if (!text || busy) return
    if (!conv.projectPath) {
      const ok = confirm('Bu sohbete bağlı bir proje klasörü yok. Ajan nerede çalışacak?\n\nTamam: klasör seç · İptal: klasörsüz devam et')
      if (ok) { const p = await window.nudge.pickFolder(); if (p) await window.nudge.setProjectPath(conv.id, p) }
    }
    setDraft('')
    setError(null)
    sounds.send()
    try { await window.nudge.sendMessage(conv.id, text) } catch (e) { setError(e instanceof Error ? e.message : String(e)) }
    taRef.current?.focus()
  }

  const pickProject = async (): Promise<void> => {
    const p = await window.nudge.pickFolder()
    if (!p) return
    if (conv.sessionId && !confirm('Proje klasörü değişince ajanın hafızası (oturum) sıfırlanır. Devam edilsin mi?')) return
    await window.nudge.setProjectPath(conv.id, p)
  }

  const reset = async (): Promise<void> => {
    if (!confirm('Ajanın bu sohbetteki hafızası silinsin mi? Mesaj geçmişi kalır, ajan sıfırdan başlar.')) return
    await window.nudge.resetSession(conv.id)
  }

  const nudge = (): void => { window.nudge.nudge(conv.id) }

  const insertEmo = (emoji: string): void => {
    setDraft(d => d + (d && !d.endsWith(' ') ? ' ' : '') + emoji + ' ')
    setEmo(false)
    taRef.current?.focus()
  }

  const nameOf = (m: ChatMessage): string =>
    m.from === 'me' ? state.settings.displayName : agents.find(a => a.id === m.agentId)?.name ?? lead?.name ?? 'Ajan'

  const title = conv.kind === 'team'
    ? `Takım Odası (${(conv.memberIds ?? []).map(id => agents.find(a => a.id === id)?.name).filter(Boolean).join(', ')})`
    : `${lead?.name ?? conv.title} - Sohbet`

  return (
    <div className={`win ${shaking ? 'shake' : ''}`}>
      <TitleBar title={title} />
      <div className="menubar">
        <button onClick={pickProject}>Proje Klasörü</button>
        <button onClick={reset}>Yeni Oturum</button>
        <button onClick={() => window.nudge.openWindow('connections')}>Bağlantılar</button>
        <button onClick={() => { if (conv.projectPath) navigator.clipboard.writeText(conv.projectPath) }} title="Klasör yolunu kopyala">Yolu Kopyala</button>
      </div>

      <div className="chat">
        <div className="head">
          <div className="avatar">{conv.kind === 'team' ? '👥' : lead?.avatar}</div>
          <div className="who">
            <div className="nm">
              <span className={`status-dot ${leadPresence?.presence ?? 'online'}`} />
              {conv.kind === 'team' ? 'Takım Odası' : lead?.name}
              <span style={{ fontWeight: 'normal', color: 'var(--ink-soft)' }}>
                {conv.kind === 'team' ? `· lider ${lead?.name ?? ''}` : `· ${lead?.role ?? ''}`}
              </span>
            </div>
            <div className="pm">&lt;{leadPresence?.status ?? (busy ? 'bir şeyler yapıyor…' : lead?.persona.split('.')[0])}&gt;</div>
          </div>
          <div className="proj" title={conv.projectPath ?? ''}>
            📁 <span className="path" onClick={pickProject} style={{ cursor: 'pointer' }}>{baseName(conv.projectPath)}</span>
          </div>
        </div>

        <div className="log" ref={logRef}>
          {conv.messages.length === 0 && (
            <div className="msg system"><div className="body">
              {conv.kind === 'team'
                ? `Takım odasına hoş geldin. Lider ${lead?.name} işi bölüp ${(conv.memberIds ?? []).filter(id => id !== lead?.id).map(id => agents.find(a => a.id === id)?.name).filter(Boolean).join(', ')} ekibine dağıtır. Ne yapılacağını yaz.`
                : `${lead?.name} ile sohbet başladı. Proje klasörünü seç, sonra ne istediğini yaz. Aynı pencerede yazdığın her mesaj kaldığı yerden devam eder.`}
            </div></div>
          )}
          {conv.messages.map(m => (
            <div key={m.id} className={`msg ${m.from}`}>
              {m.from !== 'system' && <div className="hdr"><span className="time">{fmtTime(m.at)}</span><b>{nameOf(m)}</b> diyor ki:</div>}
              <div className="body" dangerouslySetInnerHTML={{ __html: renderLite(m.text) }} />
              {m.activities && m.activities.length > 0 && (
                <div className="acts">{m.activities.slice(-8).map((a, i) => <span key={i}>{a.detail}</span>)}{m.activities.length > 8 && <span>… toplam {m.activities.length} işlem</span>}</div>
              )}
              {m.costUsd !== undefined && m.costUsd > 0 && <div className="cost">≈ ${m.costUsd.toFixed(3)}</div>}
            </div>
          ))}
          {(live || liveActs.length > 0) && (
            <div className="msg agent">
              <div className="hdr"><b>{lead?.name}</b> yazıyor…</div>
              {live && <div className="body" dangerouslySetInnerHTML={{ __html: renderLite(live) }} />}
              {liveActs.length > 0 && <div className="acts">{liveActs.slice(-5).map((a, i) => <span key={i}>{a.detail}</span>)}</div>}
            </div>
          )}
          {error && <div className="msg system"><div className="body" style={{ color: 'var(--red)' }}>{error}</div></div>}
        </div>

        <div className="side">
          <div>
            <div className="avatar lg">{conv.kind === 'team' ? '👥' : lead?.avatar}</div>
            <div className="tag">{lead?.name}</div>
          </div>
          <div>
            <div className="avatar lg">{state.settings.avatar}</div>
            <div className="tag">{state.settings.displayName}</div>
          </div>
        </div>

        <div className="composer" style={{ position: 'relative' }}>
          <div className="typing">
            {busy
              ? <><span>{lead?.name} {liveActs.length ? liveActs[liveActs.length - 1].detail : 'bir mesaj yazıyor'}</span><span className="dots"><span>.</span><span>.</span><span>.</span></span></>
              : <span>{conv.sessionId ? 'Oturum sürüyor, ajan önceki mesajları hatırlıyor.' : 'Yeni oturum. İlk mesajla başlar.'}</span>}
          </div>
          {emo && (
            <div className="emo-pop">
              {EMOTICONS.map(e => <button key={e.code} title={`${e.label} ${e.code}`} onClick={() => insertEmo(e.emoji)}>{e.emoji}</button>)}
            </div>
          )}
          <div className="toolbar">
            <button className="btn icon" title="İfadeler" onClick={() => setEmo(v => !v)}>🙂</button>
            <button className="btn icon" title="Dürt! Ajanın dikkatini çek" onClick={nudge}>📣</button>
            <span className="sep" />
            <button className="btn icon" title="Proje klasörü seç" onClick={pickProject}>📁</button>
            <span className="sep" />
            {busy
              ? <button className="btn danger" onClick={() => window.nudge.cancel(conv.id)}>■ Durdur</button>
              : <button className="btn" onClick={reset} title="Ajanın hafızasını sıfırla">↺ Yeni oturum</button>}
          </div>
          <textarea
            ref={taRef}
            value={draft}
            placeholder={busy ? 'Ajan çalışıyor, bitince yaz…' : 'Mesajını yaz… (Enter gönderir, Shift+Enter satır)'}
            onChange={e => setDraft(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() } }}
            disabled={busy}
          />
          <div className="row">
            <span className="hint">:) ;) (Y) (L) gibi kısayollar otomatik ifadeye dönüşür</span>
            <button className="btn primary" onClick={send} disabled={busy || !draft.trim()}>Gönder</button>
          </div>
        </div>
      </div>
    </div>
  )
}
