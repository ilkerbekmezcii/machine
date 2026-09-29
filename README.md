# Kodcu — AI Kodlama Ajanı

Ollama Cloud modelleriyle konuşan, GitHub'a commit atabilen ve Vercel'de yeniden
dağıtım tetikleyebilen, beyaz temalı basit bir kodlama ajanı.
Web uygulaması + Android (Capacitor) projesi olarak hazırlandı.

## İçindekiler
- `www/` — uygulamanın tamamı (tek sayfa, framework yok): `index.html`, `app.js`
- `android/` — Capacitor ile oluşturulmuş native Android projesi
- `.github/workflows/build-apk.yml` — her `main` push'unda otomatik **debug APK**
  üreten iş akışı (çıktıyı GitHub Actions artifact olarak sunar, repoya commit edilmez)
- `capacitor.config.json` — uygulama kimliği (`com.kodcu.aiagent`) ve ayarları

## 1. Web sürümünü çalıştır
`www/` klasörü framework'süz statik dosyalardan oluşur, doğrudan sunulabilir:
```
npx serve www
```
Ayarlar sekmesinden Ollama Cloud API anahtarını gir (ollama.com → Settings → API keys),
GitHub ve Vercel sekmelerinden ilgili token'ları ekle.

> **Not — CORS:** Ollama Cloud, GitHub ve Vercel API'leri tarayıcıdan doğrudan
> çağrılıyor. GitHub ve Vercel bunu destekler; Ollama Cloud tarayıcıdan isteği
> reddederse (CORS), isteği kendi ufak bir proxy'nden (ör. tek satırlık bir
> Vercel/Cloudflare Function) geçirmen gerekir — `app.js` içindeki `callOllama`
> fonksiyonunda `host` değerini o proxy adresine çevirmen yeterli.

## 2. APK derleme

### A) GitHub Actions (kurulum gerektirmez)
1. Depoyu `ilkerbekmezcii/machine` olarak push'la.
2. `.github/workflows/build-apk.yml` her `main` push'unda otomatik debug APK derler.
3. **Actions** sekmesi → son çalışma → **Artifacts** → `kodcu-debug-apk` dosyasını indir.
   İçinde `app-debug.apk` var, telefonuna kurabilirsin (bilinmeyen kaynaklara izin vermen gerekebilir).

### B) Android Studio
1. [Android Studio](https://developer.android.com/studio) kur.
2. `android/` klasörünü Android Studio ile aç (Gradle senkronizasyonunu bekle).
3. `Build → Build Bundle(s) / APK(s) → Build APK(s)`.
4. Çıktı: `android/app/build/outputs/apk/debug/app-debug.apk`
5. **Yayın (imzalı) sürüm** için `Build → Generate Signed Bundle / APK` adımını kullan
   ve kendi anahtar deponu (keystore) oluştur.

Komut satırından:
```
npm install
npx cap sync android
cd android
./gradlew assembleDebug        # debug APK
./gradlew assembleRelease      # imzasız release APK (imzalamak gerekir)
```

## 3. Vercel'e dağıtma
`www/` klasörü statik dosyalardan oluştuğu için doğrudan Vercel'e
bağlanabilir (Root Directory: `www`, Build Command: yok, Output: `.`).
Uygulamanın kendi **Vercel** sekmesi ise zaten bağlı bir projeyi yeniden
dağıtmak (redeploy) içindir.

## Güvenlik notu
Tüm API anahtarları (Ollama, GitHub, Vercel) yalnızca cihazının
`localStorage`'ında tutulur; hiçbir üçüncü sunucuya gönderilmez.
"Tüm yerel verileri temizle" butonu Ayarlar sekmesinde mevcuttur.
