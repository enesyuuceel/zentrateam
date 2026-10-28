import React, { useMemo, useState } from 'react'
import type { Agent, Conversation } from '../../../shared/types'
import { Avatar } from './Avatar'

interface Props {
  agents: Agent[]
  existing?: Conversation | null     // doluysa düzenleme
  onClose: () => void
  onSave: (input: { title: string; memberIds: string[]; leadId: string }) => Promise<void> | void
}

/** WhatsApp tarzı grup oluşturma: üyeleri seç, ada ve lidere karar ver. */
export function TeamDialog({ agents, existing, onClose, onSave }: Props): React.JSX.Element {
  const claudeAgents = agents.filter(a => a.provider === 'claude')
  const [step, setStep] = useState<1 | 2>(existing ? 2 : 1)
  const [q, setQ] = useState('')
  const [selected, setSelected] = useState<string[]>(existing?.memberIds ?? claudeAgents.map(a => a.id))
  const [title, setTitle] = useState(existing?.title ?? '')
  const [leadId, setLeadId] = useState<string>(existing?.leadId ?? claudeAgents.find(a => a.isLead)?.id ?? claudeAgents[0]?.id ?? '')

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase()
    return agents.filter(a => !s || a.name.toLowerCase().includes(s) || a.role.toLowerCase().includes(s))
  }, [agents, q])

  const toggle = (a: Agent): void => {
    if (a.provider !== 'claude') return
    setSelected(sel => sel.includes(a.id) ? sel.filter(x => x !== a.id) : [...sel, a.id])
  }
  const selectedAgents = selected.map(id => agents.find(a => a.id === id)).filter((a): a is Agent => !!a)
  const leadOk = selected.includes(leadId)
  const canNext = selected.length >= 1
  const canSave = canNext && leadOk && title.trim().length > 0

  const save = async (): Promise<void> => {
    if (!canSave) return
    await onSave({ title: title.trim(), memberIds: selected, leadId })
  }

  return (
    <div className="modal-bg" onMouseDown={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className="modal">
        <div className="modal-head">
          {step === 2 && !existing && <button className="ibtn" onClick={() => setStep(1)} title="Geri">←</button>}
          <div>
            <h3>{existing ? 'Takımı düzenle' : step === 1 ? 'Üyeleri seç' : 'Takım bilgileri'}</h3>
            <small>{step === 1 ? `${selected.length} / ${claudeAgents.length} seçildi` : `${selected.length} üye`}</small>
          </div>
          <button className="ibtn" onClick={onClose} title="Kapat">✕</button>
        </div>

        {step === 1 && (
          <>
            {selectedAgents.length > 0 && (
              <div className="chips">
                {selectedAgents.map(a => (
                  <span key={a.id} className="chip-member" onClick={() => toggle(a)} title="Çıkar">
                    <Avatar agent={a} size={20} /> {a.name} <b>×</b>
                  </span>
                ))}
              </div>
            )}
            <input className="search" autoFocus placeholder="Ajan ara…" value={q} onChange={e => setQ(e.target.value)} />
            <div className="member-list">
              {filtered.map(a => {
                const on = selected.includes(a.id)
                const disabled = a.provider !== 'claude'
                return (
                  <div key={a.id} className={`member ${on ? 'on' : ''} ${disabled ? 'disabled' : ''}`} onClick={() => toggle(a)} title={disabled ? 'Takım odası şimdilik Claude ajanlarıyla çalışır' : ''}>
                    <Avatar agent={a} size={36} />
                    <div className="nm"><b>{a.name}</b><small>{a.role}{disabled ? ' · Claude değil' : ''}</small></div>
                    <span className={`check ${on ? 'on' : ''}`}>{on ? '✓' : ''}</span>
                  </div>
                )
              })}
              {filtered.length === 0 && <div className="member" style={{ color: 'var(--muted)' }}>Eşleşen ajan yok.</div>}
            </div>
            <div className="modal-foot">
              <button className="btn ghost" onClick={onClose}>Vazgeç</button>
              <button className="btn primary" disabled={!canNext} onClick={() => { if (!title) setTitle(selectedAgents.slice(0, 3).map(a => a.name).join(', ')); setStep(2) }}>İleri →</button>
            </div>
          </>
        )}

        {step === 2 && (
          <>
            <div className="field" style={{ margin: '14px 16px 0' }}>
              <label>Takım adı</label>
              <input autoFocus value={title} onChange={e => setTitle(e.target.value)} placeholder="ör. Web sitesi yenileme" />
            </div>
            <div className="field" style={{ margin: '0 16px' }}>
              <label>Lider (işi böler ve dağıtır)</label>
              <div className="member-list" style={{ maxHeight: 220 }}>
                {selectedAgents.map(a => (
                  <div key={a.id} className={`member ${leadId === a.id ? 'on' : ''}`} onClick={() => setLeadId(a.id)}>
                    <Avatar agent={a} size={32} />
                    <div className="nm"><b>{a.name}</b><small>{a.role}</small></div>
                    <span className={`radio ${leadId === a.id ? 'on' : ''}`} />
                  </div>
                ))}
              </div>
              {existing && <span className="help">Üyeleri değiştirmek için <button className="link-btn" onClick={() => setStep(1)}>üye listesine dön</button>.</span>}
            </div>
            <div className="modal-foot">
              <button className="btn ghost" onClick={onClose}>Vazgeç</button>
              <button className="btn primary" disabled={!canSave} onClick={save}>{existing ? 'Kaydet' : 'Takımı oluştur'}</button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
