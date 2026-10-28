// Orijinal messenger seslerini kopyalamıyoruz; WebAudio ile kendi kısa jeneriklerimizi üretiyoruz.
let ctx: AudioContext | null = null
function ac(): AudioContext {
  if (!ctx) ctx = new AudioContext()
  return ctx
}

function tone(freq: number, start: number, dur: number, type: OscillatorType = 'sine', gain = 0.12): void {
  const a = ac()
  const o = a.createOscillator()
  const g = a.createGain()
  o.type = type
  o.frequency.value = freq
  g.gain.setValueAtTime(0, a.currentTime + start)
  g.gain.linearRampToValueAtTime(gain, a.currentTime + start + 0.01)
  g.gain.exponentialRampToValueAtTime(0.0001, a.currentTime + start + dur)
  o.connect(g).connect(a.destination)
  o.start(a.currentTime + start)
  o.stop(a.currentTime + start + dur + 0.02)
}

let enabled = true
export function setSoundsEnabled(v: boolean): void { enabled = v }

export const sounds = {
  // Yeni mesaj: iki notalı kısa "ding"
  message(): void { if (!enabled) return; tone(880, 0, 0.12); tone(1174, 0.09, 0.18) },
  // Kişi çevrimiçi oldu: yükselen üçlü
  online(): void { if (!enabled) return; tone(523, 0, 0.1); tone(659, 0.08, 0.1); tone(784, 0.16, 0.16) },
  // Dürtme: titreşimli kalın vızıltı
  nudge(): void {
    if (!enabled) return
    for (let i = 0; i < 6; i++) tone(i % 2 ? 180 : 140, i * 0.07, 0.08, 'square', 0.08)
  },
  // Gönder: tık
  send(): void { if (!enabled) return; tone(1500, 0, 0.04, 'triangle', 0.06) },
  // Hata
  error(): void { if (!enabled) return; tone(220, 0, 0.25, 'sawtooth', 0.07) }
}
