import React from 'react'
import type { AppState, Agent } from '../../../shared/types'
import type { PresenceMap } from './useAppState'
import { baseName } from '../lib/format'
import { Avatar } from './Avatar'

interface Props {
  state: AppState
  presence: PresenceMap
  activeId: string | null
  onOpen: (id: string) => void
}

export function Sidebar({ state, presence, activeId, onOpen }: Props): React.JSX.Element {
  const { agents, conversations, settings } = state
  const teams = conversations.filter(c => c.kind === 'team')
  const directs = conversations.filter(c => c.kind === 'direct')
  const busyCount = agents.filter(a => presence[a.id]?.presence === 'busy').length

  const newTeam = async (): Promise<void> => {
    const c = await window.nudge.createConversation({ kind: 'team', projectPath: null, title: `Takım Odası ${teams.length + 1}` })
    onOpen(c.id)
  }
  // Ajana tıklayınca varsa mevcut sohbet açılır, yoksa bir tane oluşturulur
  const openDirect = async (a: Agent): Promise<void> => {
    const existing = directs.find(c => c.agentId === a.id)
    if (existing) { onOpen(existing.id); return }
    const n = directs.filter(c => c.agentId === a.id).length
    const c = await window.nudge.createConversation({ kind: 'direct', agentId: a.id, projectPath: null, title: n ? `${a.name} ${n + 1}` : undefined })
    onOpen(c.id)
  }
  const del = (e: React.MouseEvent, id: string, title: string): void => {
    e.stopPropagation()
    if (confirm(`"${title}" sohbeti silinsin mi?`)) window.nudge.deleteConversation(id)
  }

  return (
    <aside className="sidebar">
      <div className="top">
        <h1>Zentra<small>Agent Team</small></h1>
        <span className="sub">{busyCount ? `${busyCount} ajan çalışıyor` : `${agents.length} ajan hazır`}</span>
      </div>
      <div className="scroll">
        <div className="section">
          <div className="hd"><span>Takım odaları</span><button title="Yeni takım odası" onClick={newTeam}>+</button></div>
          {teams.length === 0 && <div className="item" onClick={newTeam} style={{ color: 'var(--muted)' }}><span className="ico team">+</span><span className="lbl">Takım odası aç</span></div>}
          {teams.map(c => (
            <div key={c.id} className={`item ${activeId === c.id ? 'active' : ''}`} onClick={() => onOpen(c.id)}>
              <span className="ico team">👥</span>
              <span className="lbl">{c.title}<small>{baseName(c.projectPath)}</small></span>
              <button className="x" onClick={e => del(e, c.id, c.title)}>×</button>
            </div>
          ))}
        </div>

        <div className="section">
          <div className="hd"><span>Sohbetler</span></div>
          {directs.length === 0 && <div className="item" style={{ color: 'var(--muted)', cursor: 'default' }}><span className="lbl">Bir ajana tıklayıp başla</span></div>}
          {directs.map(c => {
            const a = agents.find(x => x.id === c.agentId)
            const p = a ? presence[a.id]?.presence ?? 'online' : 'offline'
            return (
              <div key={c.id} className={`item ${activeId === c.id ? 'active' : ''}`} onClick={() => onOpen(c.id)}>
                <Avatar agent={a} size={24} />
                <span className="lbl">{c.title}<small>{baseName(c.projectPath)}</small></span>
                <span className={`dot ${p}`} />
                <button className="x" onClick={e => del(e, c.id, c.title)}>×</button>
              </div>
            )
          })}
        </div>

        <div className="section">
          <div className="hd"><span>Ajanlar</span></div>
          {agents.map(a => {
            const p = presence[a.id]?.presence ?? 'online'
            const st = presence[a.id]?.status
            return (
              <div key={a.id} className="item" onClick={() => openDirect(a)} title={`${a.name} ile sohbet`}>
                <Avatar agent={a} size={24} />
                <span className="lbl">{a.name}{a.isLead ? ' ·  lider' : ''}<small>{st ?? a.role}</small></span>
                <span className={`dot ${p}`} />
                <button className="plus" title="Sohbeti aç" onClick={e => { e.stopPropagation(); openDirect(a) }}>+</button>
              </div>
            )
          })}
        </div>
      </div>
      <div className="foot">
        <div className="av">{settings.avatar}</div>
        <div style={{ minWidth: 0 }}>
          <div className="nm">{settings.displayName}</div>
          <div className="st">{settings.hasApiKey || state.providers.length ? `${(settings.hasApiKey ? 1 : 0) + state.providers.length} sağlayıcı bağlı` : 'Hesap bağlı değil'}</div>
        </div>
      </div>
    </aside>
  )
}
