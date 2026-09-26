# Kodcu — AI Kodlama Ajanı

Ollama Cloud modelleriyle konuşan, GitHub'a commit atabilen ve Vercel'de
yeniden dağıtım tetikleyebilen, beyaz temalı basit bir kodlama ajanı.
Web uygulaması + Android (Capacitor) projesi olarak hazırlandı.

## İçindekiler
- `www/` — uygulamanın tamamı (tek sayfa, framework yok): `index.html`, `app.js`
- `android/` — Capacitor ile oluşturulmuş native Android projesi
- `.github/workflows/build-apk.yml` — GitHub'a her push'ta otomatik **debug APK** üreten iş akışı
- `capacitor.config.json` — uygulama kimliği (`com.kodcu.aiagent`) ve ayarları

## 1. Web sürümünü dene
`www/index.html` dosyasını doğrudan bir tarayıcıda açabilir ya da basit bir
sunucuyla servis edebilirsin:
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

## 2. APK'ya dönüştürme — neden burada bitiremedim
Bu ortamda (Claude'un çalıştığı sanal makine) yalnızca npm/GitHub gibi
sınırlı adreslere erişim var; Android derlemesi için gereken
**Gradle dağıtımı (services.gradle.org)** ve **Google'ın Maven deposu
(dl.google.com)** bu ortamdan erişilebilir değil. Bu yüzden gerçek `.apk`
dosyasını burada üretemedim — proje %100 hazır, son derleme adımı senin
tarafında (veya GitHub'da otomatik) yapılıyor. İki seçenek var:

### A) En kolayı — GitHub Actions ile otomatik derleme (kurulum gerektirmez)
1. Bu klasörü GitHub'daki bir depoya it (aşağıdaki "GitHub'a gönder" adımlarına bak).
2. Depo, `.github/workflows/build-apk.yml` sayesinde her `main` dalına push'ta
   otomatik olarak bir **debug APK** derler.
3. GitHub deposunda **Actions** sekmesi → son çalışma → **Artifacts** →
   `kodcu-debug-apk` dosyasını indir. İçinde `app-debug.apk` var, telefonuna
   kurabilirsin (bilinmeyen kaynaklara izin vermen gerekebilir).

### B) Kendi bilgisayarında Android Studio ile
1. [Android Studio](https://developer.android.com/studio) kur.
2. Bu klasörü aç → `android/` klasörünü Android Studio ile aç (Gradle
   senkronizasyonunu bekle, internet gerekir).
3. `Build → Build Bundle(s) / APK(s) → Build APK(s)`.
4. Üretilen dosya: `android/app/build/outputs/apk/debug/app-debug.apk`
5. **Yayın (imzalı) sürüm** için `Build → Generate Signed Bundle / APK`
   adımını kullan ve kendi anahtar deponu (keystore) oluştur.

Komut satırından (internet olan bir makinede):
```
npm install
npx cap sync android
cd android
./gradlew assembleDebug        # debug APK
./gradlew assembleRelease      # imzasız release APK (imzalamak gerekir)
```

## 3. GitHub'a gönderme (uygulamanın kendi GitHub sekmesiyle de yapılabilir)
```
git init
git add .
git commit -m "Kodcu AI kodlama ajanı"
git branch -M main
git remote add origin https://github.com/<kullanici-adin>/<depo-adin>.git
git push -u origin main
```

## 4. Vercel'e dağıtma (web sürümünü barındırmak istersen)
`www/` klasörü statik dosyalardan oluştuğu için doğrudan Vercel'e
bağlanabilir (Root Directory: `www`, Build Command: yok, Output: `.`).
Uygulamanın kendi **Vercel** sekmesi ise zaten bağlı bir projeyi yeniden
dağıtmak (redeploy) içindir.

## Güvenlik notu
Tüm API anahtarları (Ollama, GitHub, Vercel) yalnızca cihazının
`localStorage`'ında tutulur; hiçbir üçüncü sunucuya gönderilmez.
"Tüm yerel verileri temizle" butonu Ayarlar sekmesinde mevcuttur.
