# Nudge

Ajan takımınla mesajlaşarak proje geliştir. Eski messenger ruhu, yeni nesil ajanlar.

Nudge, bilgisayarına kurduğun bir masaüstü uygulamasıdır. Kişi listesinde insanlar yerine **ajanlar** vardır: Mimar, Usta, Kontrolcü, Yazıcı. Bir ajana çift tıklayıp sohbet penceresi açarsın, pencereyi bir **proje klasörüne** bağlarsın ve yazarsın. Ajan o klasörde çalışır, dosya düzenler, komut çalıştırır ve sana mesajla rapor verir. Aynı pencereye yazdığın her mesaj **kaldığı yerden devam eder**; ajan önceki konuşmayı hatırlar.

## Neler var

- **Kişi listesi:** ajanlar durumlarıyla görünür (çevrimiçi, meşgul). Meşgulken "kişisel ileti" alanında o an ne yaptığı yazar.
- **Sohbet penceresi:** "Mimar diyor ki:" satırları, "Usta bir mesaj yazıyor…" göstergesi, ifadeler (`:)` `(Y)` `(L)` otomatik dönüşür), **Dürt** tuşu pencereyi sallar.
- **Takım Odası:** lider ajan işi parçalar, diğer ajanlara alt görev olarak dağıtır, raporları birleştirir.
- **Bağlantılar:** GitHub, Google Drive, ek klasör ya da herhangi bir MCP sunucusu. Eklediğin her bağlantı tüm ajanlara araç olarak verilir.
- **Kalıcı oturum:** her sohbet bir Agent SDK oturum kimliği taşır. Proje klasörünü değiştirince ya da "Yeni oturum" deyince sıfırlanır.
- **Kişiler:** ajan ekle, çıkar, karakterini ve modelini düzenle.

## Kurulum

Gereksinimler: Node 22+, Windows 10/11 (macOS ve Linux de çalışır, test edilmedi).

```bash
npm install
npm run dev
```

Paketlemek için:

```bash
npm run dist
```

Çıktı `release/` klasörüne düşer.

## Claude hesabı

Nudge, Claude Agent SDK ile çalışır. İki yol var:

1. **API anahtarı:** Ayarlar penceresinden `sk-ant-…` anahtarını gir. Şifreli saklanır.
2. **Mevcut Claude Code oturumu:** bilgisayarda `claude` ile giriş yapılmışsa anahtar girmeden çalışır.

## Bağlantılar

| Bağlantı | Ne gerekir |
|---|---|
| GitHub | Personal Access Token. Resmi GitHub MCP sunucusu (HTTP) kullanılır. |
| Google Drive | Google Cloud'da OAuth istemcisi, indirilen JSON dosyasının yolu. Topluluk MCP sunucusu. |
| Ek klasör | Bir klasör yolu. |
| Özel MCP | Komut + argümanlar ya da HTTP/SSE adresi. |

## Nasıl çalışıyor

```
Sohbet penceresi ──IPC──> Ana süreç (Electron)
                            │
                            ├── store.ts        JSON durum: ajanlar, sohbetler, bağlantılar, ayarlar
                            └── agentRunner.ts  Claude Agent SDK query()
                                                  cwd = proje klasörü
                                                  resume = sohbetin session_id'si
                                                  mcpServers = açık bağlantılar
                                                  agents = takım odasında alt ajanlar
```

Akan metin, araç kullanımı ("okuyor: README.md") ve sonuç, olay olarak pencereye düşer.

## Dizin yapısı

```
src/main/       Electron ana süreç, depo, ajan motoru
src/preload/    Renderer'a açılan güvenli API
src/renderer/   React arayüz (pencereler, bileşenler, tema)
src/shared/     Ortak tipler
```

## Notlar

- Görünüm 2000'lerin messenger uygulamalarından esinlenir ama hiçbir orijinal ikon, ses ya da logo kullanılmaz; tümü bu projede çizildi ve üretildi.
- Ajanlar varsayılan olarak dosya düzenlemelerini sormadan yapar (`acceptEdits`). Ayarlar'dan tam otonom ya da kısıtlı moda alınabilir.
