import React, { useEffect, useState } from 'react'
import type { AppState, Provider } from '../../../shared/types'
import { PROVIDER_PRESETS, presetFor, type ProviderPreset } from '../lib/providers'

const AVATARS = ['🙂', '😎', '🧑‍💻', '👩‍💻', '🦊', '🐱', '🐼', '🦁', '🐸', '🤖', '👾', '🎧', '⚡', '🌙', '☕']

export function SettingsView({ state }: { state: AppState }): React.JSX.Element {
  const s = state.settings
  const [name, setName] = useState(s.displayName)
  const [avatar, setAvatar] = useState(s.avatar)
  const [key, setKey] = useState('')
  const [toast, setToast] = useState<string | null>(null)
  const [editing, setEditing] = useState<{ p: Provider; preset: ProviderPreset; key: string } | null>(null)
  const [testResult, setTestResult] = useState<Record<string, string>>({})

  useEffect(() => { setName(s.displayName); setAvatar(s.avatar) }, [s.displayName, s.avatar])

  const flash = (t: string): void => { setToast(t); setTimeout(() => setToast(null), 2200) }
  const saveProfile = async (): Promise<void> => { await window.nudge.saveSettings({ displayName: name.trim() || 'Ben', avatar }); flash('Profil kaydedildi') }
  const saveKey = async (): Promise<void> => { if (!key.trim()) return; await window.nudge.setApiKey(key.trim()); setKey(''); flash('Anahtar şifreli olarak kaydedildi') }

  const startProvider = (preset: ProviderPreset): void => {
    setEditing({ preset, key: '', p: { id: '', kind: preset.kind, name: preset.title.replace(/ \(.+\)$/, ''), baseUrl: preset.baseUrl, defaultModel: preset.defaultModel, hasKey: false } })
  }
  const saveProvider = async (): Promise<void> => {
    if (!editing) return
    await window.nudge.saveProvider(editing.p, editing.key || undefined)
    setEditing(null)
    flash('Sağlayıcı kaydedildi')
  }
  const test = async (id: string): Promise<void> => {
    setTestResult(r => ({ ...r, [id]: 'deneniyor…' }))
    const r = await window.nudge.testProvider(id)
    setTestResult(x => ({ ...x, [id]: (r.ok ? '✅ ' : '❌ ') + r.message + (r.models?.length ? ` Örnek: ${r.models.slice(0, 4).join(', ')}` : '') }))
  }

  return (
    <>
      <div className="page-head"><h2>Ayarlar</h2></div>
      <div className="page">
        <div className="cards">
          <div className="card">
            <h3>Claude hesabı</h3>
            <p className="desc">Varsayılan ajanlar Claude Agent SDK ile çalışır. Takım odası ve MCP bağlantıları Claude gerektirir.</p>
            {s.hasApiKey
              ? <div className="ok-box">API anahtarı kayıtlı.</div>
              : <div className="notice">Anahtar yok. Terminalde <code>npm i -g @anthropic-ai/claude-code</code> ve <code>claude /login</code> ile oturum aç ya da aşağıya anahtar gir.</div>}
            <div className="field" style={{ marginTop: 12 }}>
              <label>Anthropic API anahtarı</label>
              <input type="password" value={key} onChange={e => setKey(e.target.value)} placeholder="sk-ant-api03-…" />
              <span className="help">console.anthropic.com → API Keys. Bu bilgisayarda şifreli saklanır.</span>
            </div>
            <div className="actions">
              {s.hasApiKey && <button className="btn ghost danger" onClick={async () => { await window.nudge.clearApiKey(); flash('Anahtar silindi') }}>Anahtarı sil</button>}
              <button className="btn primary" onClick={saveKey} disabled={!key.trim()}>Kaydet</button>
            </div>
          </div>

          <div className="card">
            <h3>Yapay zeka sağlayıcıları</h3>
            <p className="desc">Ajanları Claude dışında OpenAI, Gemini, Ollama, OpenRouter ya da herhangi bir OpenAI-uyumlu sunucuyla da çalıştırabilirsin. Ajan düzenlerken "Yapay zeka" alanından seçilir.</p>
            {state.providers.map(p => (
              <div key={p.id} className="list-row">
                <div className="ic">{presetFor(p).icon}</div>
                <div className="nm"><b>{p.name}</b> <span className="pill">{p.defaultModel || 'model yok'}</span>{p.hasKey ? '' : presetFor(p).needsKey ? <span className="pill" style={{ color: 'var(--amber)' }}>anahtar yok</span> : ''}
                  <small>{p.baseUrl}{testResult[p.id] ? ` — ${testResult[p.id]}` : ''}</small></div>
                <button className="btn sm ghost" onClick={() => test(p.id)}>Sına</button>
                <button className="btn sm ghost" onClick={() => setEditing({ p, preset: presetFor(p), key: '' })}>Düzenle</button>
                <button className="btn sm ghost danger" onClick={() => { if (confirm(`${p.name} silinsin mi? Bu sağlayıcıyı kullanan ajanlar Claude'a alınır.`)) window.nudge.deleteProvider(p.id) }}>Sil</button>
              </div>
            ))}
            {!editing && (
              <div className="preset-grid" style={{ marginTop: 12 }}>
                {PROVIDER_PRESETS.map(p => (
                  <button key={p.kind} className="preset" onClick={() => startProvider(p)}>
                    <span className="ic">{p.icon}</span><span><div className="t">{p.title}</div><div className="d">{p.desc}</div></span>
                  </button>
                ))}
              </div>
            )}
            {editing && (
              <div style={{ marginTop: 14, paddingTop: 14, borderTop: '1px solid var(--line)' }}>
                <h3>{editing.preset.icon} {editing.p.id ? editing.p.name : editing.preset.title}</h3>
                <p className="desc">{editing.preset.help}</p>
                <div className="row2">
                  <div className="field"><label>Ad</label><input value={editing.p.name} onChange={e => setEditing({ ...editing, p: { ...editing.p, name: e.target.value } })} /></div>
                  <div className="field"><label>Varsayılan model</label><input value={editing.p.defaultModel} onChange={e => setEditing({ ...editing, p: { ...editing.p, defaultModel: e.target.value } })} placeholder={editing.preset.defaultModel || 'model adı'} /></div>
                </div>
                <div className="field"><label>API adresi (OpenAI-uyumlu kök)</label><input value={editing.p.baseUrl} onChange={e => setEditing({ ...editing, p: { ...editing.p, baseUrl: e.target.value } })} /></div>
                <div className="field"><label>API anahtarı {editing.preset.needsKey ? '' : '(isteğe bağlı)'}</label>
                  <input type="password" value={editing.key} onChange={e => setEditing({ ...editing, key: e.target.value })} placeholder={editing.p.hasKey ? 'Kayıtlı. Değiştirmek için yeniden gir' : ''} />
                </div>
                <div className="actions">
                  <button className="btn ghost" onClick={() => setEditing(null)}>Vazgeç</button>
                  <button className="btn primary" onClick={saveProvider} disabled={!editing.p.name.trim() || !editing.p.baseUrl.trim()}>Kaydet</button>
                </div>
              </div>
            )}
          </div>

          <div className="card">
            <h3>Profil</h3>
            <div className="field"><label>Görünen ad</label><input value={name} onChange={e => setName(e.target.value)} /></div>
            <div className="field"><label>Avatar</label>
              <div className="avatar-pick">{AVATARS.map(a => <button key={a} className={a === avatar ? 'on' : ''} onClick={() => setAvatar(a)}>{a}</button>)}</div>
            </div>
            <div className="actions"><button className="btn primary" onClick={saveProfile}>Kaydet</button></div>
          </div>

          <div className="card">
            <h3>Ajan izinleri</h3>
            <p className="desc">Ajanların dosya ve komut işlemlerinde ne kadar serbest olduğu.</p>
            <div className="field">
              <select value={s.permissionMode} onChange={e => window.nudge.saveSettings({ permissionMode: e.target.value as typeof s.permissionMode })}>
                <option value="acceptEdits">Dosya düzenlemelerini otomatik kabul et (önerilen)</option>
                <option value="bypassPermissions">Tam otonom: her şeyi sormadan yap</option>
                <option value="default">Kısıtlı: komut çalıştırma ve onay gerektiren işlemler kapalı</option>
              </select>
            </div>
            <div className="field" style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <div className={`switch ${s.sounds ? 'on' : ''}`} onClick={() => window.nudge.saveSettings({ sounds: !s.sounds })} />
              <label>Sesler (yeni mesaj, dürtme)</label>
            </div>
          </div>

          <div className="card">
            <h3>Hakkında</h3>
            <p className="desc"><b>Zentra Studio</b> 0.3.0 · Ajan takımınla proje geliştirme. Her sohbet bir proje klasörüne ve kalıcı bir oturuma bağlıdır.</p>
          </div>
        </div>
      </div>
      {toast && <div className="toast">{toast}</div>}
    </>
  )
}
