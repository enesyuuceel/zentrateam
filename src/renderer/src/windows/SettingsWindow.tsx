import React from 'react'
import { useEffect, useState } from 'react'
import { TitleBar } from '../components/TitleBar'
import { useAppState } from '../components/useAppState'

const AVATARS = ['🙂', '😎', '🧑‍💻', '👩‍💻', '🦊', '🐱', '🐼', '🦁', '🐸', '🤖', '👾', '🎧', '⚡', '🌙', '☕']

export function SettingsWindow(): React.JSX.Element {
  const state = useAppState()
  const [name, setName] = useState('')
  const [pm, setPm] = useState('')
  const [avatar, setAvatar] = useState('🙂')
  const [key, setKey] = useState('')
  const [saved, setSaved] = useState<string | null>(null)

  useEffect(() => {
    if (!state) return
    setName(state.settings.displayName)
    setPm(state.settings.personalMessage)
    setAvatar(state.settings.avatar)
  }, [state?.settings.displayName, state?.settings.personalMessage, state?.settings.avatar])

  if (!state) return <div className="win"><TitleBar title="Ayarlar" /></div>
  const s = state.settings

  const flash = (t: string): void => { setSaved(t); setTimeout(() => setSaved(null), 2000) }

  const saveProfile = async (): Promise<void> => {
    await window.nudge.saveSettings({ displayName: name.trim() || 'Ben', personalMessage: pm, avatar })
    flash('Profil kaydedildi.')
  }
  const saveKey = async (): Promise<void> => {
    if (!key.trim()) return
    await window.nudge.setApiKey(key.trim())
    setKey('')
    flash('API anahtarı şifreli olarak kaydedildi.')
  }

  return (
    <div className="win">
      <TitleBar title="Ayarlar" showMax={false} />
      <div className="page">
        {saved && <div className="ok">{saved}</div>}

        <div className="card">
          <h3>Profilim</h3>
          <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
            <div className="avatar lg">{avatar}</div>
            <div style={{ flex: 1 }}>
              <div className="field"><label>Görünen ad</label><input value={name} onChange={e => setName(e.target.value)} /></div>
              <div className="field"><label>Kişisel ileti</label><input value={pm} onChange={e => setPm(e.target.value)} /></div>
              <div className="field"><label>Avatar</label>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                  {AVATARS.map(a => <button key={a} className="btn icon" style={{ borderColor: a === avatar ? 'var(--frame-1)' : undefined, background: a === avatar ? '#fff' : undefined }} onClick={() => setAvatar(a)}>{a}</button>)}
                </div>
              </div>
            </div>
          </div>
          <div className="actions"><button className="btn primary" onClick={saveProfile}>Kaydet</button></div>
        </div>

        <div className="card">
          <h3>Claude Hesabı</h3>
          {s.hasApiKey
            ? <div className="ok">API anahtarı kayıtlı. Ajanlar bu anahtarla çalışıyor.</div>
            : <p>Anahtar kayıtlı değil. Bu bilgisayarda Claude Code (<code>claude</code> komutu) ile oturum açıksa ajanlar o hesabı kullanır. Claude masaüstü uygulamasındaki giriş yeterli değildir. En kolayı: buraya bir Anthropic API anahtarı gir.</p>}
          <div className="field" style={{ marginTop: 8 }}>
            <label>Anthropic API anahtarı (sk-ant-…)</label>
            <input type="password" value={key} onChange={e => setKey(e.target.value)} placeholder="sk-ant-api03-…" />
          </div>
          <div className="actions">
            {s.hasApiKey && <button className="btn danger" onClick={async () => { await window.nudge.clearApiKey(); flash('Anahtar silindi.') }}>Anahtarı sil</button>}
            <button className="btn primary" onClick={saveKey} disabled={!key.trim()}>Anahtarı kaydet</button>
          </div>
        </div>

        <div className="card">
          <h3>Ajan İzinleri</h3>
          <div className="field">
            <label>Ajanlar dosya ve komut işlemlerinde</label>
            <select value={s.permissionMode} onChange={e => window.nudge.saveSettings({ permissionMode: e.target.value as typeof s.permissionMode })}>
              <option value="acceptEdits">Dosya düzenlemelerini otomatik kabul et (önerilen)</option>
              <option value="bypassPermissions">Her şeyi sormadan yap (tam otonom, dikkat)</option>
              <option value="default">Varsayılan (sorulması gereken işlemler reddedilir)</option>
            </select>
          </div>
          <div className="field" style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <div className={`switch ${s.sounds ? 'on' : ''}`} onClick={() => window.nudge.saveSettings({ sounds: !s.sounds })} />
            <label>Sesler (mesaj, dürtme, çevrimiçi)</label>
          </div>
        </div>

        <div className="card">
          <h3>Hakkında</h3>
          <p><b>Nudge</b> v0.1.0 · Ajan takımınla mesajlaşarak proje geliştir.</p>
          <p>Motor: Claude Agent SDK. Her sohbet penceresi bir proje klasörüne ve kalıcı bir oturuma bağlıdır; mesaj yazınca ajan kaldığı yerden devam eder.</p>
        </div>
      </div>
    </div>
  )
}
