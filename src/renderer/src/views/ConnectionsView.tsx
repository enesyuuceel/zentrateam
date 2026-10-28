import React, { useState } from 'react'
import type { AppState, Connection, ConnectionKind } from '../../../shared/types'

interface Preset {
  kind: ConnectionKind
  icon: string
  title: string
  desc: string
  build: () => Connection
  help: string
  secretLabel?: string
  secretType?: 'password' | 'text'
  secretApply?: (c: Connection, secret: string) => Connection
}

const PRESETS: Preset[] = [
  {
    kind: 'github', icon: '🐙', title: 'GitHub', desc: 'Repo, issue, PR, dosya okuma ve yazma',
    build: () => ({ id: '', kind: 'github', name: 'github', enabled: true, transport: 'http', url: 'https://api.githubcopilot.com/mcp/', headers: { Authorization: 'Bearer ' } }),
    help: 'GitHub → Settings → Developer settings → Personal access tokens. "repo" ve "read:org" yetkileri yeterli. Resmi GitHub MCP sunucusuna bağlanır.',
    secretLabel: 'Personal Access Token', secretType: 'password',
    secretApply: (c, s) => ({ ...c, headers: { Authorization: `Bearer ${s}` } })
  },
  {
    kind: 'google', icon: '🟢', title: 'Google Drive', desc: 'Drive dosyalarını arama ve okuma',
    build: () => ({ id: '', kind: 'google', name: 'gdrive', enabled: true, transport: 'stdio', command: 'npx', args: ['-y', '@modelcontextprotocol/server-gdrive'], env: { GDRIVE_CREDENTIALS_PATH: '' } }),
    help: 'Google Cloud Console\'da bir OAuth istemcisi oluştur, indirdiğin JSON dosyasının yolunu yaz. İlk kullanımda tarayıcıdan izin istenir.',
    secretLabel: 'OAuth kimlik dosyası yolu', secretType: 'text',
    secretApply: (c, s) => ({ ...c, env: { GDRIVE_CREDENTIALS_PATH: s } })
  },
  {
    kind: 'filesystem', icon: '🗂️', title: 'Ek klasör', desc: 'Proje dışında bir klasöre erişim',
    build: () => ({ id: '', kind: 'filesystem', name: 'files', enabled: true, transport: 'stdio', command: 'npx', args: ['-y', '@modelcontextprotocol/server-filesystem', ''] }),
    help: 'Ajanların proje klasörü dışında erişebileceği bir klasör (ör. ortak dokümanlar).',
    secretLabel: 'Klasör yolu', secretType: 'text',
    secretApply: (c, s) => ({ ...c, args: ['-y', '@modelcontextprotocol/server-filesystem', s] })
  },
  {
    kind: 'custom', icon: '🧩', title: 'Özel MCP', desc: 'Herhangi bir MCP sunucusu, komut ya da URL',
    build: () => ({ id: '', kind: 'custom', name: 'ozel', enabled: true, transport: 'stdio', command: 'npx', args: ['-y', ''] }),
    help: 'Komut tabanlı (stdio) ya da uzak (HTTP/SSE) bir MCP sunucusu. Ajanlar araçları "mcp__ad__arac" olarak görür.'
  }
]

export function ConnectionsView({ state }: { state: AppState }): React.JSX.Element {
  const [editing, setEditing] = useState<{ conn: Connection; preset: Preset } | null>(null)
  const [secret, setSecret] = useState('')
  const conns = state.connections

  const startPreset = (p: Preset): void => { setEditing({ conn: p.build(), preset: p }); setSecret('') }
  const edit = (c: Connection): void => { setEditing({ conn: c, preset: PRESETS.find(x => x.kind === c.kind) ?? PRESETS[3] }); setSecret('') }
  const save = async (): Promise<void> => {
    if (!editing) return
    let c = editing.conn
    if (editing.preset.secretApply && secret) c = editing.preset.secretApply(c, secret)
    c = { ...c, name: c.name.trim().toLowerCase().replace(/[^a-z0-9_-]+/g, '_') || 'baglanti' }
    await window.nudge.saveConnection(c)
    setEditing(null)
  }
  const icon = (k: ConnectionKind): string => PRESETS.find(p => p.kind === k)?.icon ?? '🧩'
  const kv = (o: Record<string, string> | undefined): string => Object.entries(o ?? {}).map(([k, v]) => `${k}=${v}`).join('\n')
  const parseKv = (s: string): Record<string, string> => {
    const o: Record<string, string> = {}
    for (const line of s.split('\n')) { const i = line.indexOf('='); if (i > 0) o[line.slice(0, i).trim()] = line.slice(i + 1).trim() }
    return o
  }

  return (
    <>
      <div className="page-head"><h2>Bağlantılar</h2><span className="sub">Eklediğin her bağlantı tüm ajanlara araç olarak verilir</span></div>
      <div className="page">
        <div className="cards">
          <div className="card">
            <h3>Bağlı</h3>
            <p className="desc">Kapatınca ajanlar o aracı görmez. Token ve anahtarlar bu bilgisayarda saklanır.</p>
            {conns.length === 0 && <p className="desc" style={{ fontStyle: 'italic' }}>Henüz bağlantı yok.</p>}
            {conns.map(c => (
              <div key={c.id} className="list-row">
                <div className="ic">{icon(c.kind)}</div>
                <div className="nm"><b>{c.name}</b><small>{c.transport === 'stdio' ? `${c.command} ${(c.args ?? []).join(' ')}` : c.url}</small></div>
                <span className="pill">{c.transport}</span>
                <div className={`switch ${c.enabled ? 'on' : ''}`} onClick={() => window.nudge.saveConnection({ ...c, enabled: !c.enabled })} />
                <button className="btn sm ghost" onClick={() => edit(c)}>Düzenle</button>
                <button className="btn sm ghost danger" onClick={() => { if (confirm(`"${c.name}" silinsin mi?`)) window.nudge.deleteConnection(c.id) }}>Sil</button>
              </div>
            ))}
          </div>

          {!editing && (
            <div className="card">
              <h3>Yeni bağlantı</h3>
              <p className="desc">Bir hizmet seç.</p>
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
              <p className="desc">{editing.preset.help}</p>
              <div className="field"><label>Ad</label><input value={editing.conn.name} onChange={e => setEditing({ ...editing, conn: { ...editing.conn, name: e.target.value } })} /><span className="help">Ajanların göreceği kısa ad, örn. github</span></div>
              {editing.preset.secretLabel && (
                <div className="field"><label>{editing.preset.secretLabel}</label>
                  <input type={editing.preset.secretType} value={secret} onChange={e => setSecret(e.target.value)} placeholder={editing.conn.id ? 'Değiştirmek için yeniden gir' : ''} />
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
                      <div className="field"><label>Argümanlar</label><input value={(editing.conn.args ?? []).join(' ')} onChange={e => setEditing({ ...editing, conn: { ...editing.conn, args: e.target.value.split(/\s+/).filter(Boolean) } })} /></div>
                    </div>
                  ) : (
                    <div className="field"><label>URL</label><input value={editing.conn.url ?? ''} onChange={e => setEditing({ ...editing, conn: { ...editing.conn, url: e.target.value } })} /></div>
                  )}
                  <div className="field"><label>{editing.conn.transport === 'stdio' ? 'Ortam değişkenleri' : 'HTTP başlıkları'} (KEY=VALUE, satır satır)</label>
                    <textarea value={kv(editing.conn.transport === 'stdio' ? editing.conn.env : editing.conn.headers)}
                      onChange={e => setEditing({ ...editing, conn: editing.conn.transport === 'stdio' ? { ...editing.conn, env: parseKv(e.target.value) } : { ...editing.conn, headers: parseKv(e.target.value) } })} />
                  </div>
                </>
              )}
              <div className="actions">
                <button className="btn ghost" onClick={() => setEditing(null)}>Vazgeç</button>
                <button className="btn primary" onClick={save}>Kaydet</button>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  )
}
