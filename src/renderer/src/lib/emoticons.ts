// Klasik kısayollar -> emoji. Yazarken :) gibi kısayollar otomatik dönüşür.
export const EMOTICONS: Array<{ code: string; emoji: string; label: string }> = [
  { code: ':)', emoji: '🙂', label: 'gülümseme' },
  { code: ':D', emoji: '😃', label: 'kocaman gülüş' },
  { code: ';)', emoji: '😉', label: 'göz kırpma' },
  { code: ':P', emoji: '😛', label: 'dil' },
  { code: ':(', emoji: '🙁', label: 'üzgün' },
  { code: ':O', emoji: '😮', label: 'şaşkın' },
  { code: '8-)', emoji: '😎', label: 'havalı' },
  { code: ':S', emoji: '😕', label: 'kafası karışık' },
  { code: ':|', emoji: '😐', label: 'nötr' },
  { code: ':\'(', emoji: '😢', label: 'ağlıyor' },
  { code: '(Y)', emoji: '👍', label: 'beğendim' },
  { code: '(N)', emoji: '👎', label: 'beğenmedim' },
  { code: '(L)', emoji: '❤️', label: 'kalp' },
  { code: '(K)', emoji: '😘', label: 'öpücük' },
  { code: '(F)', emoji: '🌹', label: 'gül' },
  { code: '(C)', emoji: '☕', label: 'kahve' },
  { code: '(B)', emoji: '🍺', label: 'bira' },
  { code: '(^)', emoji: '🎂', label: 'pasta' },
  { code: '(*)', emoji: '⭐', label: 'yıldız' },
  { code: '(I)', emoji: '💡', label: 'fikir' },
  { code: '(8)', emoji: '🎵', label: 'müzik' },
  { code: '(PC)', emoji: '💻', label: 'bilgisayar' },
  { code: '(CODE)', emoji: '👨‍💻', label: 'kod' },
  { code: '(BUG)', emoji: '🐛', label: 'hata' },
  { code: '(OK)', emoji: '✅', label: 'tamam' },
  { code: '(X)', emoji: '❌', label: 'olmadı' },
  { code: '(ZZ)', emoji: '😴', label: 'uyku' },
  { code: '(H)', emoji: '😎', label: 'güneş gözlüğü' },
  { code: '(S)', emoji: '🌙', label: 'ay' },
  { code: '(R)', emoji: '🌈', label: 'gökkuşağı' }
]

const sorted = [...EMOTICONS].sort((a, b) => b.code.length - a.code.length)

export function replaceEmoticons(text: string): string {
  let out = text
  for (const e of sorted) {
    const esc = e.code.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    out = out.replace(new RegExp(`(^|\\s)${esc}(?=\\s|$)`, 'g'), `$1${e.emoji}`)
  }
  return out
}
