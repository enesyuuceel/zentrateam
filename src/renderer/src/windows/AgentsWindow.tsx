import React from 'react'
import { useState } from 'react'
import { TitleBar } from '../components/TitleBar'
import { useAppState } from '../components/useAppState'
import type { Agent } from '../../../shared/types'

const AVATARS = ['📐', '🔧', '🧪', '📝', '🎨', '🛡️', '📊', '🚀', '🧠', '🔍', '🗄️', '🌐', '🤖', '🦉', '🐝']
const COLORS = ['#2e6fd1', '#1f9d55', '#c2410c', '#7c3aed', '#be185d', '#0e7490', '#4d7c0f', '#b45309']

const blank = (): Agent => ({ id: '', name: '', role: '', persona: '', avatar: '🤖', color: COLORS[0], model: 'sonnet', effort: 'medium' })

export function AgentsWindow(): React.JSX.Element {
  const state = useAppState()
  const [editing, setEditing] = useState<Agent | null>(null)

  if (!state) return <div className="win"><TitleBar title="Kişiler" /></div>
  const agents = state.agents

  const save = async (): Promise<void> => {
    if (!editing || !editing.name.trim()) return
    const a: Agent = { ...editing, id: editing.id || editing.name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-') }
    if (a.isLead) for (const o of agents) if (o.id !== a.id && o.isLead) await window.nudge.saveAgent({ ...o, isLead: false })
    await window.nudge.saveAgent(a)
    setEditing(null)
  }

  return (
    <div className="win">
      <TitleBar title="Kişiler - Ajan Takımı" />
      <div className="page">
        <div className="card">
          <h3>Takımın</h3>
          <p>Her ajan bir kişidir: adı, rolü ve karakteri var. ★ işaretli ajan takım odasında liderdir, işi dağıtır.</p>
          {agents.map(a => (
            <div key={a.id} className="conn-row">
              <div className="avatar sm" style={{ borderColor: a.color }}>{a.avatar}</div>
              <div className="nm"><b>{a.name}</b>{a.isLead ? ' ★' : ''}<div className="kind">{a.role} · {a.model} · çaba: {a.effort}</div></div>
              <button className="btn" onClick={() => setEditing({ ...a })}>Düzenle</button>
              <button className="btn danger" disabled={agents.length <= 1} onClick={() => { if (confirm(`${a.name} takımdan çıkarılsın mı?`)) window.nudge.deleteAgent(a.id) }}>Çıkar</button>
            </div>
          ))}
          <div className="actions" style={{ marginTop: 8 }}><button className="btn primary" onClick={() => setEditing(blank())}>+ Yeni ajan ekle</button></div>
        </div>

        {editing && (
          <div className="card">
            <h3>{editing.id ? `${editing.name} düzenleniyor` : 'Yeni ajan'}</h3>
            <div style={{ display: 'flex', gap: 12 }}>
              <div>
                <div className="avatar lg" style={{ borderColor: editing.color }}>{editing.avatar}</div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 2, marginTop: 6, width: 130 }}>
                  {AVATARS.map(v => <button key={v} className="btn icon" style={{ padding: '1px 3px', background: v === editing.avatar ? '#fff' : undefined }} onClick={() => setEditing({ ...editing, avatar: v })}>{v}</button>)}
                </div>
                <div style={{ display: 'flex', gap: 3, marginTop: 6, flexWrap: 'wrap', width: 130 }}>
                  {COLORS.map(c => <span key={c} onClick={() => setEditing({ ...editing, color: c })} style={{ width: 16, height: 16, borderRadius: 3, background: c, cursor: 'pointer', outline: c === editing.color ? '2px solid #000' : 'none' }} />)}
                </div>
              </div>
              <div style={{ flex: 1 }}>
                <div className="row2">
                  <div className="field"><label>Ad</label><input value={editing.name} onChange={e => setEditing({ ...editing, name: e.target.value })} /></div>
                  <div className="field"><label>Rol</label><input value={editing.role} onChange={e => setEditing({ ...editing, role: e.target.value })} placeholder="Geliştirici, Tasarımcı…" /></div>
                </div>
                <div className="row2">
                  <div className="field"><label>Model</label>
                    <select value={editing.model} onChange={e => setEditing({ ...editing, model: e.target.value as Agent['model'] })}>
                      <option value="opus">Opus (en güçlü)</option><option value="sonnet">Sonnet (dengeli)</option><option value="haiku">Haiku (hızlı, ucuz)</option>
                    </select>
                  </div>
                  <div className="field"><label>Çaba</label>
                    <select value={editing.effort} onChange={e => setEditing({ ...editing, effort: e.target.value as Agent['effort'] })}>
                      <option value="low">düşük</option><option value="medium">orta</option><option value="high">yüksek</option><option value="xhigh">çok yüksek</option><option value="max">maksimum</option>
                    </select>
                  </div>
                </div>
                <div className="field"><label>Karakter ve görev tanımı (ajana sistem istemi olarak gider)</label>
                  <textarea value={editing.persona} onChange={e => setEditing({ ...editing, persona: e.target.value })} placeholder="Sen … Şunları yaparsın … Şöyle yazarsın …" />
                </div>
                <div className="field" style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <div className={`switch ${editing.isLead ? 'on' : ''}`} onClick={() => setEditing({ ...editing, isLead: !editing.isLead })} />
                  <label>Takım odasında lider (işi dağıtan)</label>
                </div>
              </div>
            </div>
            <div className="actions">
              <button className="btn" onClick={() => setEditing(null)}>Vazgeç</button>
              <button className="btn primary" onClick={save} disabled={!editing.name.trim()}>Kaydet</button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
