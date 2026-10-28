import React, { useState } from 'react'
import type { Agent, AppState } from '../../../shared/types'
import type { PresenceMap } from '../components/useAppState'
import { Avatar } from '../components/Avatar'
import { providerLabel } from '../lib/providers'

const AVATARS = ['📐', '🔧', '🧪', '📝', '🎨', '🛡️', '📊', '🚀', '🧠', '🔍', '🗄️', '🌐', '🤖', '🦉', '🐝']
const COLORS = ['#6d8cff', '#39d98a', '#f5b454', '#b784ff', '#ff6b9d', '#3ec5e0', '#9bd45a', '#ff8e5a']

const blank = (): Agent => ({ id: '', name: '', role: '', persona: '', avatar: '🤖', color: COLORS[0], provider: 'claude', model: 'sonnet', effort: 'medium', files: [] })
const fileName = (p: string): string => p.split(/[\\/]/).pop() ?? p

export function AgentsView({ state, presence, onOpen }: { state: AppState; presence: PresenceMap; onOpen: (id: string) => void }): React.JSX.Element {
  const [editing, setEditing] = useState<Agent | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const { agents, providers } = state

  const save = async (): Promise<void> => {
    if (!editing || !editing.name.trim()) return
    const a: Agent = { ...editing, id: editing.id || editing.name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-') }
    if (a.isLead) for (const o of agents) if (o.id !== a.id && o.isLead) await window.nudge.saveAgent({ ...o, isLead: false })
    await window.nudge.saveAgent(a)
    setEditing(null)
  }
  const chat = async (a: Agent): Promise<void> => {
    const existing = state.conversations.find(c => c.kind === 'direct' && c.agentId === a.id)
    if (existing) { onOpen(existing.id); return }
    const c = await window.nudge.createConversation({ kind: 'direct', agentId: a.id, projectPath: null })
    onOpen(c.id)
  }
  const importFile = async (): Promise<void> => {
    if (!editing) return
    const [p] = await window.nudge.pickFiles('text')
    if (!p) return
    try {
      const imp = await window.nudge.importAgentFile(p)
      setEditing({ ...editing, name: editing.name || imp.name || '', role: editing.role || imp.role || '', persona: imp.persona, personaFile: p })
    } catch (e) { setErr(e instanceof Error ? e.message : String(e)) }
  }
  const addFiles = async (): Promise<void> => {
    if (!editing) return
    const ps = await window.nudge.pickFiles('text')
    if (!ps.length) return
    setEditing({ ...editing, files: [...new Set([...(editing.files ?? []), ...ps])] })
  }
  const pickImage = async (): Promise<void> => {
    if (!editing) return
    const [p] = await window.nudge.pickFiles('image')
    if (!p) return
    try { setEditing({ ...editing, avatarImage: await window.nudge.readImageAsDataUrl(p) }) } catch (e) { setErr(e instanceof Error ? e.message : String(e)) }
  }

  return (
    <>
      <div className="page-head"><h2>Ajanlar</h2><span className="sub">Her ajanın adı, rolü, karakteri ve çalıştığı yapay zeka var</span></div>
      <div className="page">
        <div className="cards">
          <div className="card">
            {agents.map(a => {
              const p = presence[a.id]?.presence ?? 'online'
              return (
                <div key={a.id} className="list-row">
                  <Avatar agent={a} size={36} />
                  <div className="nm">
                    <b>{a.name}</b> {a.isLead && <span className="pill">lider</span>} <span className={`badge ${a.provider === 'claude' ? '' : 'alt'}`}>{providerLabel(a.provider, providers)} · {a.provider === 'claude' ? a.model : a.modelId || 'varsayılan model'}</span>
                    <small style={{ fontFamily: 'var(--font)' }}>{presence[a.id]?.status ?? a.role}{a.personaFile ? ` · 📄 ${fileName(a.personaFile)}` : ''}{a.files?.length ? ` · ${a.files.length} dosya` : ''}</small>
                  </div>
                  <span className={`dot ${p}`} />
                  <button className="btn sm" onClick={() => chat(a)}>Sohbet</button>
                  <button className="btn sm ghost" onClick={() => setEditing({ files: [], ...a })}>Düzenle</button>
                  <button className="btn sm ghost danger" disabled={agents.length <= 1} onClick={() => { if (confirm(`${a.name} takımdan çıkarılsın mı?`)) window.nudge.deleteAgent(a.id) }}>Çıkar</button>
                </div>
              )
            })}
            <div className="actions"><button className="btn primary" onClick={() => setEditing(blank())}>+ Yeni ajan</button></div>
          </div>

          {editing && (
            <div className="card">
              <h3>{editing.id ? `${editing.name} düzenleniyor` : 'Yeni ajan'}</h3>
              <p className="desc">Karakteri elle yaz ya da bir .md / .txt dosyasından yükle. Dosyaya bağlarsan Notepad'de düzenlediğin her değişiklik bir sonraki mesajda geçerli olur.</p>
              {err && <div className="notice" style={{ marginBottom: 10 }}>{err}</div>}

              <div style={{ display: 'flex', gap: 18, alignItems: 'flex-start' }}>
                <div style={{ textAlign: 'center' }}>
                  <Avatar agent={editing} size={88} />
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 8 }}>
                    <button className="btn sm" onClick={pickImage}>Logo yükle</button>
                    {editing.avatarImage && <button className="btn sm ghost" onClick={() => setEditing({ ...editing, avatarImage: null })}>Kaldır</button>}
                  </div>
                </div>
                <div style={{ flex: 1 }}>
                  <div className="row2">
                    <div className="field"><label>Ad</label><input value={editing.name} onChange={e => setEditing({ ...editing, name: e.target.value })} placeholder="Usta" /></div>
                    <div className="field"><label>Rol</label><input value={editing.role} onChange={e => setEditing({ ...editing, role: e.target.value })} placeholder="Geliştirici" /></div>
                  </div>
                  <div className="row2">
                    <div className="field"><label>Yapay zeka</label>
                      <select value={editing.provider} onChange={e => setEditing({ ...editing, provider: e.target.value })}>
                        <option value="claude">Claude (Anthropic)</option>
                        {providers.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                      </select>
                      {providers.length === 0 && <span className="help">Başka sağlayıcı eklemek için Ayarlar → Yapay zeka sağlayıcıları.</span>}
                    </div>
                    {editing.provider === 'claude' ? (
                      <div className="field"><label>Model</label>
                        <select value={editing.model} onChange={e => setEditing({ ...editing, model: e.target.value as Agent['model'] })}>
                          <option value="opus">Opus · en güçlü</option><option value="sonnet">Sonnet · dengeli</option><option value="haiku">Haiku · hızlı ve ucuz</option>
                        </select>
                      </div>
                    ) : (
                      <div className="field"><label>Model adı</label>
                        <input value={editing.modelId ?? ''} onChange={e => setEditing({ ...editing, modelId: e.target.value })} placeholder={providers.find(p => p.id === editing.provider)?.defaultModel || 'ör. gpt-4.1'} />
                        <span className="help">Boş bırakılırsa sağlayıcının varsayılan modeli.</span>
                      </div>
                    )}
                  </div>
                  {editing.provider === 'claude' && (
                    <div className="field"><label>Çaba</label>
                      <select value={editing.effort} onChange={e => setEditing({ ...editing, effort: e.target.value as Agent['effort'] })}>
                        <option value="low">düşük</option><option value="medium">orta</option><option value="high">yüksek</option><option value="xhigh">çok yüksek</option><option value="max">maksimum</option>
                      </select>
                    </div>
                  )}
                </div>
              </div>

              <div className="field" style={{ marginTop: 6 }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  Karakter ve görev tanımı
                  <button className="btn sm ghost" style={{ marginLeft: 'auto' }} onClick={importFile}>📄 Dosyadan yükle</button>
                </label>
                {editing.personaFile && (
                  <div className="file-row">
                    <span>📄</span><span className="p" title={editing.personaFile}>{editing.personaFile}</span>
                    <span className="pill">canlı bağlı</span>
                    <button className="x" title="Bağlantıyı kopar (metin kalır)" onClick={() => setEditing({ ...editing, personaFile: null })}>×</button>
                  </div>
                )}
                <textarea value={editing.persona} onChange={e => setEditing({ ...editing, persona: e.target.value })} placeholder="Sen … Şunları yaparsın … Şöyle rapor verirsin …" />
              </div>

              <div className="field">
                <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  Referans dosyaları
                  <button className="btn sm ghost" style={{ marginLeft: 'auto' }} onClick={addFiles}>+ Dosya ekle</button>
                </label>
                <span className="help">Kurallar, stil rehberi, örnek kod, ürün notları… İçerikleri her mesajda ajana verilir (toplam ~40 bin karakter).</span>
                <div className="file-list">
                  {(editing.files ?? []).map(f => (
                    <div key={f} className="file-row"><span>📎</span><span className="p" title={f}>{fileName(f)}</span><button className="x" onClick={() => setEditing({ ...editing, files: (editing.files ?? []).filter(x => x !== f) })}>×</button></div>
                  ))}
                </div>
              </div>

              <div className="row2">
                <div className="field"><label>Emoji</label>
                  <div className="avatar-pick">{AVATARS.map(v => <button key={v} className={v === editing.avatar ? 'on' : ''} onClick={() => setEditing({ ...editing, avatar: v })}>{v}</button>)}</div>
                </div>
                <div className="field"><label>Renk</label>
                  <div className="color-pick">{COLORS.map(c => <span key={c} className={c === editing.color ? 'on' : ''} style={{ background: c }} onClick={() => setEditing({ ...editing, color: c })} />)}</div>
                </div>
              </div>
              {editing.provider === 'claude' && (
                <div className="field" style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                  <div className={`switch ${editing.isLead ? 'on' : ''}`} onClick={() => setEditing({ ...editing, isLead: !editing.isLead })} />
                  <label>Takım odasında lider: işi böler ve diğer ajanlara dağıtır</label>
                </div>
              )}
              {editing.provider !== 'claude' && <div className="notice">Claude dışı ajanlar birebir sohbette çalışır; takım odası ve MCP bağlantıları şimdilik Claude ajanlarına özeldir.</div>}
              <div className="actions">
                <button className="btn ghost" onClick={() => { setEditing(null); setErr(null) }}>Vazgeç</button>
                <button className="btn primary" onClick={save} disabled={!editing.name.trim()}>Kaydet</button>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  )
}
