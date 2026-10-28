import type { Provider, ProviderKind } from '../../../shared/types'

export interface ProviderPreset {
  kind: ProviderKind
  icon: string
  title: string
  desc: string
  baseUrl: string
  defaultModel: string
  needsKey: boolean
  free: boolean          // ücretsiz kullanım katmanı var mı
  keyUrl?: string        // anahtarın alındığı sayfa
  help: string
}

export const PROVIDER_PRESETS: ProviderPreset[] = [
  { kind: 'gemini', icon: '✨', title: 'Google Gemini', desc: 'Ücretsiz katman · kart gerekmez', baseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai', defaultModel: 'gemini-2.5-flash', needsKey: true, free: true, keyUrl: 'https://aistudio.google.com/apikey', help: 'aistudio.google.com/apikey → "Create API key". Ücretsiz katmanda dakika/gün başına istek sınırı vardır; gemini-2.5-flash en cömert olanı.' },
  { kind: 'groq', icon: '⚡', title: 'Groq', desc: 'Ücretsiz katman · çok hızlı', baseUrl: 'https://api.groq.com/openai/v1', defaultModel: 'llama-3.3-70b-versatile', needsKey: true, free: true, keyUrl: 'https://console.groq.com/keys', help: 'console.groq.com/keys → "Create API Key". Açık modeller (Llama, Qwen) ücretsiz sınırlar dahilinde.' },
  { kind: 'ollama', icon: '🦙', title: 'Ollama (yerel)', desc: 'Tamamen ücretsiz · internetsiz', baseUrl: 'http://localhost:11434/v1', defaultModel: 'qwen2.5-coder:7b', needsKey: false, free: true, keyUrl: 'https://ollama.com/download', help: 'ollama.com kur, terminalde "ollama pull qwen2.5-coder:7b" çalıştır. Anahtar gerekmez, model bilgisayarında çalışır (8 GB+ RAM önerilir).' },
  { kind: 'openrouter', icon: '🔀', title: 'OpenRouter', desc: 'Ücretsiz modeller (":free") + yüzlercesi', baseUrl: 'https://openrouter.ai/api/v1', defaultModel: 'deepseek/deepseek-chat-v3-0324:free', needsKey: true, free: true, keyUrl: 'https://openrouter.ai/keys', help: 'openrouter.ai/keys. Adı ":free" ile biten modeller ücretsizdir (günlük sınırlı).' },
  { kind: 'openai', icon: '🟢', title: 'OpenAI', desc: 'GPT modelleri · ücretli', baseUrl: 'https://api.openai.com/v1', defaultModel: 'gpt-4.1', needsKey: true, free: false, keyUrl: 'https://platform.openai.com/api-keys', help: 'platform.openai.com → API keys' },
  { kind: 'custom', icon: '🧩', title: 'Özel (OpenAI-uyumlu)', desc: 'LM Studio, vLLM, Mistral…', baseUrl: 'http://localhost:1234/v1', defaultModel: '', needsKey: false, free: false, help: 'OpenAI /chat/completions uyumlu her sunucu.' }
]

export function presetFor(p: Provider | ProviderKind): ProviderPreset {
  const kind = typeof p === 'string' ? p : p.kind
  return PROVIDER_PRESETS.find(x => x.kind === kind) ?? PROVIDER_PRESETS[PROVIDER_PRESETS.length - 1]
}

export function providerLabel(id: string, providers: Provider[]): string {
  if (id === 'claude') return 'Claude'
  return providers.find(p => p.id === id)?.name ?? 'Sağlayıcı yok'
}
