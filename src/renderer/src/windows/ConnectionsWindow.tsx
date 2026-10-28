import React from 'react'
import { useState } from 'react'
import { TitleBar } from '../components/TitleBar'
import { useAppState } from '../components/useAppState'
import type { Connection, ConnectionKind } from '../../../shared/types'

interface Preset {
  kind: ConnectionKind
  icon: string
  title: string
  desc: string
  build: () => Connection
  help: string
  secretLabel?: string
  secretApply?: (c: Connection, secret: string) => Connection
}

const PRESETS: Preset[] = [
  {
    kind: 'github', icon: '🐙', title: 'GitHub', desc: 'Repo, issue, PR, dosya okuma/yazma',
    build: () => ({ id: '', kind: 'github', name: 'github', enabled: true, transport: 'http', url: 'https://api.githubcopilot.com/mcp/', headers: { Authorization: 'Bearer ' } }),
    help: 'GitHub > Settings > Developer settings > Personal access tokens ile bir token oluştur (repo, read:org yetkileri yeter). Resmi GitHub MCP sunucusu kullanılır.',
    secretLabel: 'GitHub Personal Access Token',
    secretApply: (c, s) => ({ ...c, headers: { Authorization: `Bearer ${s}` } })
  },
  {
    kind: 'google', icon: '🟢', title: 'Google Drive', desc: 'Drive dosyalarını arama ve okuma',
    build: () => ({ id: '', kind: 'google', name: 'gdrive', enabled: true, transport: 'stdio', command: 'npx', args: ['-y', '@modelcontextprotocol/server-gdrive'], env: { GDRIVE_CREDENTIALS_PATH: '' } }),
    help: 'Google Cloud Console\'da bir OAuth istemcisi oluştur, indirdiğin JSON\'u bir klasöre koy ve yolunu aşağıya yaz. İlk çalıştırmada tarayıcıdan izin istenir. (Topluluk MCP sunucusu; Google resmi sunucu yayınladığında buradan değiştirilebilir.)',
    secretLabel: 'OAuth kimlik dosyası yolu (gcp-oauth.keys.json)',
    secretApply: (c, s) => ({ ...c, env: { GDRIVE_CREDENTIALS_PATH: s } })
  },
  {
    kind: 'filesystem', icon: '🗂️', title: 'Ek Klasör', desc: 'Proje dışında bir klasöre erişim',
    build: () => ({ id: '', kind: 'filesystem', name: 'files', enabled: true, transport: 'stdio', command: 'npx', args: ['-y', '@modelcontextprotocol/server-filesystem', ''] }),
    help: 'Ajanın proje klasörü dışında erişebileceği bir klasör yolu gir (ör. ortak dokümanlar).',
    secretLabel: 'Klasör yolu',
    secretApply: (c, s) => ({ ...c, args: ['-y', '@modelcontextprotocol/server-filesystem', s] })
  },
  {
    kind: 'custom', icon: '🧩', title: 'Özel MCP', desc: 'Herhangi bir MCP sunucusu (komut veya URL)',
    build: () => ({ id: '', kind: 'custom', name: 'ozel', enabled: true, transport: 'stdio', command: 'npx', args: ['-y', ''] }),
    help: 'Komut tabanlı (stdio) ya da uzak (http/sse) bir MCP sunucusu tanımla. Ajanlar bu sunucunun araçlarını mcp__ad__arac olarak görür.'
  }
]

export function ConnectionsWindow(): React.JSX.Element {
  const state = useAppState()
  const [editing, setEditing] = useState<{ conn: Connection; preset: Preset } | null>(null)
  const [secret, setSecret] = useState('')

  if (!state) return <div className="win"><TitleBar title="Bağlantılar" /></div>
  const conns = state.connections

  const startPreset = (p: Preset): void => { setEditing({ conn: p.build(), preset: p }); setSecret('') }
  const edit = (c: Connection): void => {
    const p = PRESETS.find(x => x.kind === c.kind) ?? PRESETS[3]
    setEditing({ conn: c, preset: p }); setSecret('')
  }
  const save = async (): Promise<void> => {
    if (!editing) return
    let c = editing.conn
    if (editing.preset.secretApply && secret) c = editing.preset.secretApply(c, secret)
    c = { ...c, name: c.name.trim().toLowerCase().replace(/[^a-z0-9_-]+/g, '_') || 'baglanti' }
    await window.nudge.saveConnection(c)
    setEditing(null)
  }
  const toggle = (c: Connection): void => { window.nudge.saveConnection({ ...c, enabled: !c.enabled }) }

  const kindIcon = (k: ConnectionKind): string => PRESETS.find(p => p.kind === k)?.icon ?? '🧩'

  return (
    <div className="win">
      <TitleBar title="Bağlantılar" />
      <div className="page">
        <div className="card">
          <h3>Bağlı hesaplar ve araçlar</h3>
          <p>Burada eklediğin her bağlantı, tüm ajanlara MCP aracı olarak verilir. Kapatınca ajanlar o aracı görmez.</p>
          {conns.length === 0 && <p style={{ fontStyle: 'italic' }}>Henüz bağlantı yok.</p>}
          {conns.map(c => (
            <div key={c.id} className="conn-row">
              <span style={{ fontSize: 18 }}>{kindIcon(c.kind)}</span>
              <div className="nm"><b>{c.name}</b><div className="kind">{c.transport === 'stdio' ? `${c.command} ${(c.args ?? []).join(' ')}` : c.url}</div></div>
              <div className={`switch ${c.enabled ? 'on' : ''}`} onClick={() => toggle(c)} title={c.enabled ? 'Açık' : 'Kapalı'} />
              <button className="btn" onClick={() => edit(c)}>Düzenle</button>
              <button className="btn danger" onClick={() => { if (confirm(`"${c.name}" bağlantısı silinsin mi?`)) window.nudge.deleteConnection(c.id) }}>Sil</button>
            </div>
          ))}
        </div>

        {!editing && (
          <div className="card">
            <h3>Yeni bağlantı ekle</h3>
            <div className="preset-grid">
              {PRESETS.map(p => (
                <button key={p.kind} className="preset" onClick={() => startPreset(p)}>
                  <span className="ic">{p.icon}</span>
                  <span><div className="t">{p.title}</div><div className="d">{p.desc}</div></span>
                </button>
              ))}
            </div>
          </div>
        )}

        {editing && (
          <div className="card">
            <h3>{editing.preset.icon} {editing.preset.title}</h3>
            <div className="notice" style={{ marginBottom: 8 }}>{editing.preset.help}</div>
            <div className="field"><label>Ad (ajanların göreceği kısa ad)</label><input value={editing.conn.name} onChange={e => setEditing({ ...editing, conn: { ...editing.conn, name: e.target.value } })} /></div>
            {editing.preset.secretLabel && (
              <div className="field"><label>{editing.preset.secretLabel}</label>
                <input type={editing.preset.kind === 'github' ? 'password' : 'text'} value={secret} onChange={e => setSecret(e.target.value)} placeholder={editing.conn.id ? '(değiştirmek için yeniden gir)' : ''} />
              </div>
            )}
            {editing.preset.kind === 'custom' && (
              <>
                <div className="field"><label>Taşıma</label>
                  <select value={editing.conn.transport} onChange={e => setEditing({ ...editing, conn: { ...editing.conn, transport: e.target.value as Connection['transport'] } })}>
                    <option value="stdio">Komut (stdio)</option><option value="http">HTTP</option><option value="sse">SSE</option>
                  </select>
                </div>
                {editing.conn.transport === 'stdio' ? (
                  <div className="row2">
                    <div className="field"><label>Komut</label><input value={editing.conn.command ?? ''} onChange={e => setEditing({ ...editing, conn: { ...editing.conn, command: e.target.value } })} /></div>
                    <div className="field"><label>Argümanlar (boşlukla ayır)</label><input value={(editing.conn.args ?? []).join(' ')} onChange={e => setEditing({ ...editing, conn: { ...editing.conn, args: e.target.value.split(/\s+/).filter(Boolean) } })} /></div>
                  </div>
                ) : (
                  <div className="field"><label>URL</label><input value={editing.conn.url ?? ''} onChange={e => setEditing({ ...editing, conn: { ...editing.conn, url: e.target.value } })} /></div>
                )}
                <div className="field"><label>Ortam değişkenleri / başlıklar (KEY=VALUE, satır satır)</label>
                  <textarea
                    value={Object.entries(editing.conn.transport === 'stdio' ? editing.conn.env ?? {} : editing.conn.headers ?? {}).map(([k, v]) => `${k}=${v}`).join('\n')}
                    onChange={e => {
                      const obj: Record<string, string> = {}
                      for (const line of e.target.value.split('\n')) { const i = line.indexOf('='); if (i > 0) obj[line.slice(0, i).trim()] = line.slice(i + 1).trim() }
                      setEditing({ ...editing, conn: editing.conn.transport === 'stdio' ? { ...editing.conn, env: obj } : { ...editing.conn, headers: obj } })
                    }} />
                </div>
              </>
            )}
            <div className="actions">
              <button className="btn" onClick={() => setEditing(null)}>Vazgeç</button>
              <button className="btn primary" onClick={save}>Kaydet</button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
