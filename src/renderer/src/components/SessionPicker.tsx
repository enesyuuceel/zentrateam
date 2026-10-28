import React, { useEffect, useState } from 'react'
import type { ClaudeSession } from '../../../shared/types'
import { fmtDate } from '../lib/format'

interface Props {
  projectPath: string
  onClose: () => void
  onPick: (s: ClaudeSession) => Promise<void> | void
}

/** Projenin bu bilgisayardaki Claude Code sohbetlerini listeler; seçilen oturum sohbete bağlanır. */
export function SessionPicker({ projectPath, onClose, onPick }: Props): React.JSX.Element {
  const [list, setList] = useState<ClaudeSession[] | null>(null)
  const [q, setQ] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => { window.nudge.listClaudeSessions(projectPath).then(setList).catch(() => setList([])) }, [projectPath])

  const shown = (list ?? []).filter(s => !q.trim() || s.title.toLowerCase().includes(q.trim().toLowerCase()))

  return (
    <div className="modal-bg" onMouseDown={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className="modal" style={{ width: 560 }}>
        <div className="modal-head">
          <div>
            <h3>Claude Code geçmişini bağla</h3>
            <small>{projectPath}</small>
          </div>
          <button className="ibtn" onClick={onClose} title="Kapat">✕</button>
        </div>
        <input className="search" autoFocus placeholder="Sohbet ara…" value={q} onChange={e => setQ(e.target.value)} />
        <div className="member-list" style={{ maxHeight: 400 }}>
          {list === null && <div className="member" style={{ color: 'var(--muted)' }}>Sohbetler okunuyor…</div>}
          {list !== null && shown.length === 0 && (
            <div className="member" style={{ color: 'var(--muted)', display: 'block' }}>
              Bu klasör için kayıtlı Claude Code sohbeti bulunamadı.
              <div style={{ fontSize: 11.5, marginTop: 4 }}>Claude Code (terminal ya da masaüstü uygulaması) bu klasörde çalıştıysa sohbetleri burada görünür.</div>
            </div>
          )}
          {shown.map(s => (
            <div key={s.id} className="member" onClick={async () => { if (busy) return; setBusy(true); await onPick(s); setBusy(false) }}>
              <span style={{ fontSize: 20 }}>📜</span>
              <div className="nm">
                <b style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 420 }}>{s.title}</b>
                <small>{s.turns} mesaj · son: {fmtDate(Date.parse(s.lastAt))}{s.startedAt ? ` · başlangıç: ${fmtDate(Date.parse(s.startedAt))}` : ''} · {s.sizeKb} KB</small>
              </div>
              <span className="pill">bağla</span>
            </div>
          ))}
        </div>
        <div className="modal-foot">
          <span style={{ flex: 1, color: 'var(--muted)', fontSize: 11.5, alignSelf: 'center' }}>Bağlanan sohbetin tüm bağlamı ajana geçer; bu sohbetteki mesaj geçmişin olduğu gibi kalır.</span>
          <button className="btn ghost" onClick={onClose}>Kapat</button>
        </div>
      </div>
    </div>
  )
}
