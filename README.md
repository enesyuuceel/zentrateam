# Zentra Agent Team

Ajan takımınla mesajlaşarak proje geliştir. Claude, OpenAI, Gemini, Ollama ve her OpenAI-uyumlu model tek masaüstünde.

Zentra Agent Team bilgisayarına kurduğun bir masaüstü uygulamasıdır. Sol tarafta **ajanlar** vardır (Mimar, Usta, Kontrolcü, Yazıcı ya da senin tanımladıkların). Bir ajana tıklayıp sohbeti açarsın, sohbeti bir **proje klasörüne** bağlarsın ve yazarsın. Ajan o klasörde çalışır: dosya okur, yazar, düzenler, komut çalıştırır ve sana mesajla rapor verir. Aynı sohbete yazdığın her mesaj **kaldığı yerden devam eder**.

## Neler var

- **Çoklu yapay zeka:** Her ajan ayrı bir sağlayıcıda çalışabilir. Claude (Agent SDK), OpenAI, Google Gemini, Ollama (yerel), OpenRouter ya da herhangi bir OpenAI-uyumlu sunucu (LM Studio, vLLM, Groq…).
- **Dosyadan ajan:** Ajanın karakterini bir `.md` / `.txt` dosyasından yükle. Dosyaya "canlı bağlı" kalır; Notepad'de düzenlediğin her değişiklik bir sonraki mesajda geçerli olur. YAML ön bilgi (`name`, `role`/`description`) okunur.
- **Referans dosyaları:** Ajana kural, stil rehberi, örnek kod gibi dosyalar ekle; içerikleri her mesajda ajana verilir.
- **Kendi logosu:** Ajana PNG/JPG/SVG logo yükle.
- **Takım Odası:** Lider ajan işi böler, diğer Claude ajanlarına alt görev olarak dağıtır, raporları birleştirir.
- **Bağlantılar (MCP):** GitHub, Google Drive, ek klasör, özel MCP. Claude ajanlarına araç olarak verilir.
- **Kalıcı oturum:** Claude ajanlarında Agent SDK oturumu, diğerlerinde yerel geçmiş dosyası. Proje klasörü değişince ya da "yeni oturum" deyince sıfırlanır.
- **Tek sohbet:** Ajana tıklayınca mevcut sohbet açılır; yeni bir tane için yanındaki **+**.

## Kurulum

Gereksinimler: Node 22+, Windows 10/11 (macOS ve Linux de çalışır, test edilmedi).

```bash
npm install
npm run dev
```

Kurulum paketi (setup.exe) için:

```bash
npm run dist
```

Çıktı `release/Zentra-Agent-Team-Setup-<sürüm>.exe`. İmzalama, SmartScreen ve dağıtım adımları için [docs/KURULUM-PAKETI.md](docs/KURULUM-PAKETI.md).

## Hesap bağlama

| Sağlayıcı | Ne gerekir |
|---|---|
| Claude | Ayarlar → Claude hesabı → Anthropic API anahtarı. Ya da bilgisayarda `claude /login` ile açılmış Claude Code oturumu. |
| OpenAI | Ayarlar → Yapay zeka sağlayıcıları → OpenAI → API anahtarı |
| Google Gemini | AI Studio anahtarı. OpenAI-uyumlu uç nokta kullanılır. |
| Ollama | `ollama pull llama3.1` sonrası anahtarsız çalışır. |
| OpenRouter | openrouter.ai anahtarı, model adı `sağlayıcı/model` biçiminde. |
| Özel | OpenAI `/chat/completions` uyumlu her sunucu adresi. |

Anahtarlar bu bilgisayarda Electron safeStorage ile şifreli saklanır.

## Nasıl çalışıyor

```
Arayüz (React) ──IPC──> Ana süreç (Electron)
                          ├── store.ts        JSON durum: ajanlar, sohbetler, bağlantılar, sağlayıcılar, ayarlar
                          ├── agentRunner.ts  Sohbeti ajanın sağlayıcısına göre yönlendirir
                          │     ├── claude  → Claude Agent SDK query() · cwd, resume, mcpServers, alt ajanlar
                          │     └── diğer   → openaiAgent.ts
                          └── openaiAgent.ts  OpenAI-uyumlu araç döngüsü: list_dir, read_file, write_file,
                                              edit_file, search, run_command · geçmiş userData/sessions/
```

Akan metin, araç kullanımı ("okuyor: README.md") ve sonuç, olay olarak arayüze düşer.

## Dizin yapısı

```
src/main/       Electron ana süreç, depo, ajan motorları
src/preload/    Renderer'a açılan güvenli API
src/renderer/   React arayüz (görünümler, bileşenler, tema)
src/shared/     Ortak tipler
resources/      Logo (SVG) ve uygulama ikonu
scripts/        make-icon.cjs: SVG'den icon.png üretir
```

## Sınırlar

- Takım odası ve MCP bağlantıları şimdilik Claude ajanlarına özeldir. Diğer sağlayıcılar birebir sohbette tam araç setiyle çalışır.
- Claude dışı ajanların geçmişi son 60 mesajla sınırlı tutulur.
