import React, { useEffect, useState } from 'react'
import type { AppState } from '../../../shared/types'

const AVATARS = ['🙂', '😎', '🧑‍💻', '👩‍💻', '🦊', '🐱', '🐼', '🦁', '🐸', '🤖', '👾', '🎧', '⚡', '🌙', '☕']

export function SettingsView({ state }: { state: AppState }): React.JSX.Element {
  const s = state.settings
  const [name, setName] = useState(s.displayName)
  const [avatar, setAvatar] = useState(s.avatar)
  const [key, setKey] = useState('')
  const [toast, setToast] = useState<string | null>(null)

  useEffect(() => { setName(s.displayName); setAvatar(s.avatar) }, [s.displayName, s.avatar])

  const flash = (t: string): void => { setToast(t); setTimeout(() => setToast(null), 2200) }
  const saveProfile = async (): Promise<void> => { await window.nudge.saveSettings({ displayName: name.trim() || 'Ben', avatar }); flash('Profil kaydedildi') }
  const saveKey = async (): Promise<void> => { if (!key.trim()) return; await window.nudge.setApiKey(key.trim()); setKey(''); flash('Anahtar şifreli olarak kaydedildi') }

  return (
    <>
      <div className="page-head"><h2>Ayarlar</h2></div>
      <div className="page">
        <div className="cards">
          <div className="card">
            <h3>Claude hesabı</h3>
            <p className="desc">Ajanlar Claude Agent SDK ile çalışır. Bir Anthropic API anahtarı gir; ya da bu bilgisayarda Claude Code (<code>claude</code> komutu) ile oturum açıksa anahtar gerekmez.</p>
            {s.hasApiKey
              ? <div className="ok-box">API anahtarı kayıtlı. Ajanlar bu anahtarla çalışıyor.</div>
              : <div className="notice">Anahtar yok. Claude masaüstü uygulamasındaki giriş yeterli değildir; terminalde <code>npm i -g @anthropic-ai/claude-code</code> ve <code>claude /login</code> ile oturum aç ya da aşağıya anahtar gir.</div>}
            <div className="field" style={{ marginTop: 12 }}>
              <label>Anthropic API anahtarı</label>
              <input type="password" value={key} onChange={e => setKey(e.target.value)} placeholder="sk-ant-api03-…" />
              <span className="help">console.anthropic.com → API Keys. Anahtar bu bilgisayarda şifreli saklanır.</span>
            </div>
            <div className="actions">
              {s.hasApiKey && <button className="btn ghost danger" onClick={async () => { await window.nudge.clearApiKey(); flash('Anahtar silindi') }}>Anahtarı sil</button>}
              <button className="btn primary" onClick={saveKey} disabled={!key.trim()}>Kaydet</button>
            </div>
          </div>

          <div className="card">
            <h3>Profil</h3>
            <p className="desc">Sohbetlerde senin adın ve avatarın.</p>
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
                <option value="default">Kısıtlı: onay gerektiren işlemler reddedilir</option>
              </select>
            </div>
            <div className="field" style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <div className={`switch ${s.sounds ? 'on' : ''}`} onClick={() => window.nudge.saveSettings({ sounds: !s.sounds })} />
              <label>Sesler (yeni mesaj, dürtme)</label>
            </div>
          </div>

          <div className="card">
            <h3>Hakkında</h3>
            <p className="desc"><b>Nudge</b> 0.2.0 · Ajan takımınla mesajlaşarak proje geliştir. Her sohbet bir proje klasörüne ve kalıcı bir oturuma bağlıdır.</p>
          </div>
        </div>
      </div>
      {toast && <div className="toast">{toast}</div>}
    </>
  )
}
