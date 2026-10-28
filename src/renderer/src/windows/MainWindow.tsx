import React from 'react'
import { useEffect, useState } from 'react'
import { TitleBar } from '../components/TitleBar'
import { useAppState, usePresence } from '../components/useAppState'
import { baseName } from '../lib/format'
import { sounds } from '../lib/sounds'
import type { Agent, Conversation } from '../../../shared/types'

export function MainWindow(): React.JSX.Element {
  const state = useAppState()
  const presence = usePresence()
  const [closed, setClosed] = useState<Record<string, boolean>>({})
  const [editPm, setEditPm] = useState(false)
  const [pm, setPm] = useState('')

  useEffect(() => {
    if (state) setPm(state.settings.personalMessage)
  }, [state?.settings.personalMessage])

  // Yeni mesaj / dürtme geldiğinde ses
  useEffect(() => {
    return window.nudge.onEvent(e => {
      if (e.type === 'message' && e.message.from === 'agent') sounds.message()
      if (e.type === 'presence' && e.presence === 'online') sounds.online()
    })
  }, [])

  if (!state) return <div className="win"><TitleBar title="Nudge" /></div>

  const { agents, conversations, settings } = state
  const needsAuthHint = !settings.hasApiKey

  const toggle = (g: string): void => setClosed(c => ({ ...c, [g]: !c[g] }))

  const startDirect = async (a: Agent): Promise<void> => {
    // Aynı ajanla açık bir sohbet varsa onu aç, yoksa yeni oluştur
    const existing = conversations.find(c => c.kind === 'direct' && c.agentId === a.id)
    if (existing) { await window.nudge.openChat(existing.id); return }
    const conv = await window.nudge.createConversation({ kind: 'direct', agentId: a.id, projectPath: null })
    await window.nudge.openChat(conv.id)
  }

  const startTeam = async (): Promise<void> => {
    const conv = await window.nudge.createConversation({ kind: 'team', projectPath: null })
    await window.nudge.openChat(conv.id)
  }

  const savePm = async (): Promise<void> => {
    setEditPm(false)
    if (pm !== settings.personalMessage) await window.nudge.saveSettings({ personalMessage: pm })
  }

  const online = agents.filter(a => (presence[a.id]?.presence ?? 'online') !== 'offline').length

  return (
    <div className="win">
      <TitleBar title="Nudge" showMax={false} />
      <div className="menubar">
        <button onClick={() => window.nudge.openWindow('agents')}>Kişiler</button>
        <button onClick={() => window.nudge.openWindow('connections')}>Bağlantılar</button>
        <button onClick={() => window.nudge.openWindow('settings')}>Ayarlar</button>
      </div>

      <div className="me-card">
        <div className="avatar">{settings.avatar}</div>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div className="name"><span className="status-dot online" />{settings.displayName} <span style={{ color: 'var(--ink-soft)', fontWeight: 'normal' }}>(Çevrimiçi)</span></div>
          <div className="pm" onClick={() => setEditPm(true)} title="Kişisel iletini değiştir">
            {editPm
              ? <input autoFocus value={pm} onChange={e => setPm(e.target.value)} onBlur={savePm} onKeyDown={e => { if (e.key === 'Enter') savePm(); if (e.key === 'Escape') setEditPm(false) }} />
              : <span>&lt;{settings.personalMessage || 'Kişisel ileti gir'}&gt;</span>}
          </div>
        </div>
      </div>

      {needsAuthHint && (
        <div className="notice" style={{ margin: '6px 8px 0' }}>
          API anahtarı yok. Bilgisayarında Claude Code oturumu varsa çalışır; yoksa <button className="link" onClick={() => window.nudge.openWindow('settings')}>Ayarlar</button>'dan anahtar gir.
        </div>
      )}

      <div className="list">
        <div className={`group ${closed.agents ? 'closed' : ''}`}>
          <header onClick={() => toggle('agents')}><span className="tri" />Ajan Takımı ({online}/{agents.length})</header>
          <div className="items">
            {agents.map(a => {
              const p = presence[a.id]?.presence ?? 'online'
              const status = presence[a.id]?.status
              return (
                <div key={a.id} className={`contact ${p}`} onDoubleClick={() => startDirect(a)} title="Sohbet için çift tıkla">
                  <span className={`buddy ${p}`} />
                  <div className="avatar sm">{a.avatar}</div>
                  <div className="meta">
                    <span className="nm">{a.name}{a.isLead ? ' ★' : ''}</span>
                    <span className="pm">{status ?? a.role}</span>
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        <div className={`group ${closed.convs ? 'closed' : ''}`}>
          <header onClick={() => toggle('convs')}><span className="tri" />Sohbetler ({conversations.length})</header>
          <div className="items">
            {conversations.length === 0 && <div className="contact" style={{ color: 'var(--ink-soft)' }}>Henüz sohbet yok. Bir ajana çift tıkla.</div>}
            {conversations.map((c: Conversation) => {
              const a = c.agentId ? agents.find(x => x.id === c.agentId) : undefined
              return (
                <div key={c.id} className="contact" onDoubleClick={() => window.nudge.openChat(c.id)} title={c.projectPath ?? 'Proje seçilmedi'}>
                  <div className="avatar sm">{c.kind === 'team' ? '👥' : a?.avatar ?? '💬'}</div>
                  <div className="meta">
                    <span className="nm">{c.title}</span>
                    <span className="sub">📁 {baseName(c.projectPath)} · {c.messages.length} mesaj</span>
                  </div>
                  <button className="x" title="Sohbeti sil" onClick={e => { e.stopPropagation(); if (confirm(`"${c.title}" sohbeti silinsin mi?`)) window.nudge.deleteConversation(c.id) }}>×</button>
                </div>
              )
            })}
          </div>
        </div>
      </div>

      <div className="footer">
        <button className="btn primary" onClick={startTeam}>👥 Takım Odası Aç</button>
        <button className="btn" onClick={() => window.nudge.openWindow('connections')}>🔌 Bağlan</button>
      </div>
    </div>
  )
}
