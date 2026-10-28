export function fmtTime(ts: number): string {
  const d = new Date(ts)
  return d.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })
}

export function fmtDate(ts: number): string {
  const d = new Date(ts)
  return d.toLocaleDateString('tr-TR', { day: '2-digit', month: 'short' }) + ' ' + fmtTime(ts)
}

export function baseName(p: string | null): string {
  if (!p) return 'Proje seçilmedi'
  return p.replace(/[\\/]+$/, '').split(/[\\/]/).pop() ?? p
}

// Çok basit markdown: **kalın**, `kod`, satır sonu. Kod bloklarını <pre> yapar.
export function renderLite(text: string): string {
  const esc = (s: string): string => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  const parts = text.split(/```/)
  return parts.map((p, i) => {
    if (i % 2 === 1) {
      const body = p.replace(/^[a-zA-Z0-9_-]*\n/, '')
      return `<pre>${esc(body)}</pre>`
    }
    return esc(p)
      .replace(/\*\*(.+?)\*\*/g, '<b>$1</b>')
      .replace(/`([^`]+)`/g, '<code>$1</code>')
      .replace(/^- (.+)$/gm, '• $1')
      .replace(/\n/g, '<br/>')
  }).join('')
}
