# Kurulum paketi ve güvenli dağıtım

## Paketi üretmek

```bash
npm run dist
```

Çıktı: `release/Zentra-Agent-Team-Setup-<sürüm>.exe` (NSIS kurulum sihirbazı, x64).
Kullanıcı kurulum klasörünü seçebilir, masaüstü ve Başlat menüsü kısayolu oluşur, yönetici hakkı gerekmez (kullanıcı profiline kurulur).

Özet dosyası için:

```bash
npm run checksum
```

`release/SHA256SUMS.txt` üretilir. İndirme sayfasında bu özeti yayınla; kullanıcı PowerShell'de `Get-FileHash .\Zentra-Agent-Team-Setup-0.3.1.exe` ile karşılaştırabilir.

## "Güvenli dosya" ne demek, ne gerekiyor

Windows, indirilen bir .exe'yi **dijital imza** ve **itibar** üzerinden değerlendirir. İmzasız dosyada SmartScreen "Windows bilgisayarınızı korudu" uyarısı verir; kullanıcı "Ek bilgi → Yine de çalıştır" demek zorunda kalır. Bunu kaldırmanın tek yolu kod imzalama sertifikasıdır. Üç seçenek:

| Seçenek | Maliyet | Sonuç |
|---|---|---|
| **Azure Trusted Signing** (önerilen) | ~10 $/ay | SmartScreen uyarısı kısa sürede kalkar, donanım anahtarı gerekmez. Şirket doğrulaması ister (vergi no, adres). |
| OV kod imzalama sertifikası (Sectigo, DigiCert, GlobalSign) | ~200–400 $/yıl | İmzalı; SmartScreen itibarı zamanla, indirme sayısıyla oluşur. |
| EV kod imzalama sertifikası | ~300–600 $/yıl + USB anahtar | SmartScreen itibarı anında. |

Sertifika alındıktan sonra kod tarafında yapılacak **ek iş yok**; electron-builder aşağıdaki ortam değişkenlerini görünce kurulumu, uygulamayı ve kaldırıcıyı otomatik imzalar.

### Azure Trusted Signing ile imzalama

`package.json` → `build.win` altına:

```json
"azureSignOptions": {
  "publisherName": "Zentra Engine",
  "endpoint": "https://weu.codesigning.azure.net",
  "certificateProfileName": "zentra-public",
  "codeSigningAccountName": "zentra-signing"
}
```

Ortam değişkenleri (Azure hizmet sorumlusu): `AZURE_TENANT_ID`, `AZURE_CLIENT_ID`, `AZURE_CLIENT_SECRET`. Sonra `npm run dist`.

### PFX (OV/EV) sertifikayla imzalama

```powershell
$env:WIN_CSC_LINK = "C:\sertifika\zentra.pfx"
$env:WIN_CSC_KEY_PASSWORD = "parola"
npm run dist
```

EV sertifikalar USB anahtarda olduğu için `WIN_CSC_LINK` yerine `signtoolOptions.certificateSubjectName` kullanılır; electron-builder belgelerinde "Code Signing → Windows" başlığı.

## Antivirüs yanlış alarmı

Electron uygulamaları nadiren bazı antivirüslerde yanlış pozitif verir. Azaltmak için:

- İmzala (yukarıdaki).
- Dosyayı VirusTotal'a yükleyip sonucu indirme sayfasında paylaş.
- Yanlış alarm veren üreticiye (Microsoft, Avast, Kaspersky…) "false positive" başvurusu yap; genelde 1–3 gün içinde düzelir.

## Kullanıcının bilgisayarında ne olur

- Kurulum `%LOCALAPPDATA%\Programs\Zentra Agent Team` altına yapılır.
- Ayarlar, ajanlar, sohbetler ve şifreli anahtarlar `%APPDATA%\Zentra Agent Team` altında saklanır. Kaldırınca bu veri silinmez (`deleteAppDataOnUninstall: false`).
- Ajanlar Claude Agent SDK'nın paketle gelen `claude.exe` ikilisini kullanır; ayrıca Claude Code kurulması gerekmez.
- Uygulama internete yalnızca seçilen yapay zeka sağlayıcılarına ve eklenen MCP bağlantılarına çıkar; telemetri yoktur.
- Otomatik güncelleme yoktur; yeni sürüm için yeni setup indirilir ve üzerine kurulur.

## Sürüm çıkarma listesi

1. `package.json` sürümünü artır.
2. `npm run dist` → `npm run checksum`.
3. İmzalıysa `Get-AuthenticodeSignature release\*.exe` → `Valid`.
4. Temiz bir Windows'ta (ya da sanal makinede) kur, aç, bir ajanla sohbet et.
5. setup.exe + SHA256SUMS.txt'yi yayınla (GitHub Releases ya da site).
