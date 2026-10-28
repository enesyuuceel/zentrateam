import React, { useState } from 'react'
import type { Agent, AppState } from '../../../shared/types'
import type { PresenceMap } from '../components/useAppState'

const AVATARS = ['📐', '🔧', '🧪', '📝', '🎨', '🛡️', '📊', '🚀', '🧠', '🔍', '🗄️', '🌐', '🤖', '🦉', '🐝']
const COLORS = ['#6d8cff', '#39d98a', '#f5b454', '#b784ff', '#ff6b9d', '#3ec5e0', '#9bd45a', '#ff8e5a']

const blank = (): Agent => ({ id: '', name: '', role: '', persona: '', avatar: '🤖', color: COLORS[0], model: 'sonnet', effort: 'medium' })

export function AgentsView({ state, presence, onOpen }: { state: AppState; presence: PresenceMap; onOpen: (id: string) => void }): React.JSX.Element {
  const [editing, setEditing] = useState<Agent | null>(null)
  const agents = state.agents

  const save = async (): Promise<void> => {
    if (!editing || !editing.name.trim()) return
    const a: Agent = { ...editing, id: editing.id || editing.name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-') }
    if (a.isLead) for (const o of agents) if (o.id !== a.id && o.isLead) await window.nudge.saveAgent({ ...o, isLead: false })
    await window.nudge.saveAgent(a)
    setEditing(null)
  }
  const chat = async (a: Agent): Promise<void> => {
    const c = await window.nudge.createConversation({ kind: 'direct', agentId: a.id, projectPath: null })
    onOpen(c.id)
  }

  return (
    <>
      <div className="page-head"><h2>Ajanlar</h2><span className="sub">Takımındaki her ajanın bir adı, rolü ve karakteri var</span></div>
      <div className="page">
        <div className="cards">
          <div className="card">
            {agents.map(a => {
              const p = presence[a.id]?.presence ?? 'online'
              return (
                <div key={a.id} className="list-row">
                  <div className="ic" style={{ background: a.color + '33' }}>{a.avatar}</div>
                  <div className="nm">
                    <b>{a.name}</b> {a.isLead && <span className="pill">lider</span>}
                    <small style={{ fontFamily: 'var(--font)' }}>{presence[a.id]?.status ?? a.role} · {a.model} · çaba {a.effort}</small>
                  </div>
                  <span className={`dot ${p}`} />
                  <button className="btn sm" onClick={() => chat(a)}>Sohbet</button>
                  <button className="btn sm ghost" onClick={() => setEditing({ ...a })}>Düzenle</button>
                  <button className="btn sm ghost danger" disabled={agents.length <= 1} onClick={() => { if (confirm(`${a.name} takımdan çıkarılsın mı?`)) window.nudge.deleteAgent(a.id) }}>Çıkar</button>
                </div>
              )
            })}
            <div className="actions"><button className="btn primary" onClick={() => setEditing(blank())}>+ Yeni ajan</button></div>
          </div>

          {editing && (
            <div className="card">
              <h3>{editing.id ? `${editing.name} düzenleniyor` : 'Yeni ajan'}</h3>
              <p className="desc">Karakter metni ajana sistem istemi olarak gider. Rolünü, nasıl çalıştığını ve nasıl rapor verdiğini yaz.</p>
              <div className="row2">
                <div className="field"><label>Ad</label><input value={editing.name} onChange={e => setEditing({ ...editing, name: e.target.value })} placeholder="Usta" /></div>
                <div className="field"><label>Rol</label><input value={editing.role} onChange={e => setEditing({ ...editing, role: e.target.value })} placeholder="Geliştirici" /></div>
              </div>
              <div className="row2">
                <div className="field"><label>Model</label>
                  <select value={editing.model} onChange={e => setEditing({ ...editing, model: e.target.value as Agent['model'] })}>
                    <option value="opus">Opus · en güçlü</option><option value="sonnet">Sonnet · dengeli</option><option value="haiku">Haiku · hızlı ve ucuz</option>
                  </select>
                </div>
                <div className="field"><label>Çaba</label>
                  <select value={editing.effort} onChange={e => setEditing({ ...editing, effort: e.target.value as Agent['effort'] })}>
                    <option value="low">düşük</option><option value="medium">orta</option><option value="high">yüksek</option><option value="xhigh">çok yüksek</option><option value="max">maksimum</option>
                  </select>
                </div>
              </div>
              <div className="field"><label>Karakter ve görev tanımı</label>
                <textarea value={editing.persona} onChange={e => setEditing({ ...editing, persona: e.target.value })} placeholder="Sen … Şunları yaparsın … Şöyle rapor verirsin …" />
              </div>
              <div className="row2">
                <div className="field"><label>Avatar</label>
                  <div className="avatar-pick">{AVATARS.map(v => <button key={v} className={v === editing.avatar ? 'on' : ''} onClick={() => setEditing({ ...editing, avatar: v })}>{v}</button>)}</div>
                </div>
                <div className="field"><label>Renk</label>
                  <div className="color-pick">{COLORS.map(c => <span key={c} className={c === editing.color ? 'on' : ''} style={{ background: c }} onClick={() => setEditing({ ...editing, color: c })} />)}</div>
                </div>
              </div>
              <div className="field" style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <div className={`switch ${editing.isLead ? 'on' : ''}`} onClick={() => setEditing({ ...editing, isLead: !editing.isLead })} />
                <label>Takım odasında lider: işi böler ve diğer ajanlara dağıtır</label>
              </div>
              <div className="actions">
                <button className="btn ghost" onClick={() => setEditing(null)}>Vazgeç</button>
                <button className="btn primary" onClick={save} disabled={!editing.name.trim()}>Kaydet</button>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  )
}
