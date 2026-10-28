import type { Provider, ProviderKind } from '../../../shared/types'

export interface ProviderPreset {
  kind: ProviderKind
  icon: string
  title: string
  desc: string
  baseUrl: string
  defaultModel: string
  needsKey: boolean
  help: string
}

export const PROVIDER_PRESETS: ProviderPreset[] = [
  { kind: 'openai', icon: '🟢', title: 'OpenAI', desc: 'GPT modelleri', baseUrl: 'https://api.openai.com/v1', defaultModel: 'gpt-4.1', needsKey: true, help: 'platform.openai.com → API keys' },
  { kind: 'gemini', icon: '✨', title: 'Google Gemini', desc: 'Gemini modelleri', baseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai', defaultModel: 'gemini-2.5-pro', needsKey: true, help: 'aistudio.google.com → Get API key' },
  { kind: 'ollama', icon: '🦙', title: 'Ollama (yerel)', desc: 'Bilgisayarındaki açık modeller', baseUrl: 'http://localhost:11434/v1', defaultModel: 'llama3.1', needsKey: false, help: 'ollama.com kur, "ollama pull llama3.1" çalıştır. Anahtar gerekmez.' },
  { kind: 'openrouter', icon: '🔀', title: 'OpenRouter', desc: 'Tek anahtarla yüzlerce model', baseUrl: 'https://openrouter.ai/api/v1', defaultModel: 'anthropic/claude-sonnet-4.5', needsKey: true, help: 'openrouter.ai → Keys' },
  { kind: 'custom', icon: '🧩', title: 'Özel (OpenAI-uyumlu)', desc: 'LM Studio, vLLM, Groq, Mistral…', baseUrl: 'http://localhost:1234/v1', defaultModel: '', needsKey: false, help: 'OpenAI /chat/completions uyumlu her sunucu.' }
]

export function presetFor(p: Provider | ProviderKind): ProviderPreset {
  const kind = typeof p === 'string' ? p : p.kind
  return PROVIDER_PRESETS.find(x => x.kind === kind) ?? PROVIDER_PRESETS[4]
}

export function providerLabel(id: string, providers: Provider[]): string {
  if (id === 'claude') return 'Claude'
  return providers.find(p => p.id === id)?.name ?? 'Sağlayıcı yok'
}
