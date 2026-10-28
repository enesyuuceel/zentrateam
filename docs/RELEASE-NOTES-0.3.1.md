# Zentra Agent Team 0.3.1

Ajan takımınla mesajlaşarak proje geliştir. Claude, OpenAI, Gemini, Ollama ve OpenRouter tek masaüstünde.

## Görünüm

![Takım odası](https://raw.githubusercontent.com/enesyuuceel/zentrateam/main/docs/screenshots/02-takim-odasi.png)

![Birebir sohbet](https://raw.githubusercontent.com/enesyuuceel/zentrateam/main/docs/screenshots/01-sohbet.png)

![Takım oluşturma](https://raw.githubusercontent.com/enesyuuceel/zentrateam/main/docs/screenshots/03-takim-olustur.png)

## Kurulum
1. `Zentra-Agent-Team-Setup-0.3.1.exe` dosyasını indir ve çalıştır.
2. Windows "bilgisayarınızı korudu" uyarısı verirse **Ek bilgi → Yine de çalıştır**. Dosya henüz dijital imzalı değil; doğrulamak için SHA-256 özetini `SHA256SUMS.txt` ile karşılaştır:
   `Get-FileHash .\Zentra-Agent-Team-Setup-0.3.1.exe`
3. Uygulamayı aç, Ayarlar'dan bir yapay zeka hesabı bağla (Claude anahtarı ya da OpenAI / Gemini / Ollama / OpenRouter).

## Bu sürümde
- Çoklu sağlayıcı: her ajan farklı yapay zekada çalışabilir
- Ajan tanımını .md dosyasından yükleme, referans dosyaları, ajana özel logo
- WhatsApp tarzı takım oluşturma: üye seç, ad ver, lider belirle
- Kalıcı oturumlar: her sohbet kaldığı yerden devam eder
- GitHub, Google Drive ve özel MCP bağlantıları (Claude ajanları)

## Bilinenler
- Takım odası ve MCP bağlantıları şimdilik Claude ajanlarına özel
- Otomatik güncelleme yok; yeni sürüm üstüne kurulur
