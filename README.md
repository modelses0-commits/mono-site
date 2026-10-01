# MONO — Render ücretsiz kurulum

Bu paket, gönderilen MONO projesinin Render için düzenlenmiş sürümüdür.
Teknoloji: Node.js yerleşik HTTP sunucusu, HTML/CSS/JavaScript, Python tabanlı yt-dlp ve sistem FFmpeg/ffprobe. Veritabanı ve ön yüz derleme adımı yoktur. Başlatma komutu `node server.mjs` (veya `npm start`).

## Render'a yükle

1. ZIP'i aç. `mono-render` klasörünün **içindeki dosyaları** yeni bir GitHub deposunun köküne yükle. Dockerfile ve render.yaml en üstte olmalı; ZIP'in kendisini yükleme. Gizli `.gitignore` ve `.dockerignore` dosyalarını da ekle.
2. [Render](https://dashboard.render.com)'da **New → Web Service** seç ve GitHub deposunu bağla.
3. **Language/Runtime: Docker**, **Instance Type: Free** seç. Root Directory boş, Dockerfile Path `./Dockerfile`, Docker Build Context `.` olsun. Dosyaları bir alt klasöre yüklediysen Root Directory'yi o klasöre ayarla.
4. Docker kullanıldığı için ayrı Build Command veya Start Command yazma. Docker Command alanı boş kalabilir; Dockerfile içindeki `CMD ["node", "server.mjs"]` çalışır. Health Check Path alanını `/api/health` yap.
5. Deploy/Create Web Service'e bas. Docker, FFmpeg ve ffprobe'ı Debian deposundan; yt-dlp'yi requirements.txt içindeki sürümle PyPI'dan kurar. Windows `.exe` dosyaları veya node_modules yüklemene gerek yok.
6. Verilen `https://...onrender.com` adresini aç. `/api/health` adresinde `ready: true` görmelisin. Sana ait kısa bir dosyayla dönüştürmeyi dene. Kendi/izinli YouTube videosunu ayrıca test et.

Alternatif: **New → Blueprint** üzerinden aynı depoyu seç. `render.yaml` Docker, Free plan ve sağlık kontrolünü tanımlar. Önceki oluşturduğun servis varsa ayrıca Blueprint oluşturma; ikinci servis açılır.

## Satın aldığın domaini bağla

1. Servisin **Settings → Custom Domains → Add Custom Domain** bölümüne domainini yaz.
2. Domain sağlayıcında Render'ın bu domain için gösterdiği DNS kayıtlarını uygula; tüm nameserver'ları değiştirmek zorunda değilsin. E-posta kayıtlarını koru. Render yönlendirmesiyle çakışan eski web A/CNAME ve AAAA kayıtlarını düzelt. Sabit bir IP'yi bu rehberden kopyalamak yerine panelin güncel talimatlarını kullan.
3. Render'da **Verify** seç; HTTPS sertifikasının hazırlanmasını bekle.
4. Servisin **Environment** bölümüne `PUBLIC_ORIGIN` ekle. Örneğin `https://alanadim.com,https://www.alanadim.com` yaz. Protokol dahil, sondaki `/` olmadan, virgülle ayır. Gerçek domainlerini kullan. Ardından değişikliği kaydedip yeniden dağıt.
5. Kendi domaininde hem yükleme hem indirmeyi tekrar dene. Domain açılıp işlem başlatırken “İzin verilmeyen kaynak” çıkıyorsa PUBLIC_ORIGIN değeri tarayıcıdaki adresle eşleşmiyordur.

Render'ın kendi adresi, otomatik sağlanan `RENDER_EXTERNAL_URL` sayesinde izinlidir. HTTP Host veya istemcinin gönderdiği proxy başlıklarına göre otomatik origin izni verilmez.

## Sınırlar ve geçici dosyalar

- Yüklenen dosya: en fazla **100 MB** (100.000.000 bayt), medya süresi: en fazla **10 dakika**.
- Aynı anda sunucunun tamamında **tek işlem**; varsayılan video kalitesi **480p**. Diğer kalite ve format seçenekleri korunmuştur fakat yüksek kalite ücretsiz işlemcide zaman aşımına uğrayabilir.
- Alt süreç başına en fazla **10 dakika**; Linux'ta zaman aşımında süreç grubu sonlandırılır. Çok adımlı işlem toplamda daha uzun sürebilir.
- Dönüştürülmüş çıkış yaklaşık **200 MB** ile sınırlandırılır. yt-dlp indirme başına 100 MB sınırı kullanır; ses/video ayrı indirilebilir. İndirme sırasında toplam geçici boyut 300 MB'ı aşarsa işlem durdurulur; kontrol iki saniyede bir yapıldığından kısa süreli aşım mümkündür.
- Hazır dosyalar 30 dakika sonra, dakikalık temizlikte silinir; hatalı işlem dosyaları hemen temizlenir. Toplam geçici depolama 600 MB'ı aşarsa veya boş disk alanı 400 MB'ın altına düşerse yeni işler reddedilir. İndirme bağlantısını başkalarıyla paylaşma; bağlantıyı bilen kişi dosyayı alabilir.
- Yeniden dağıtım, yeniden başlama veya Render'ın uykuya geçmesi dosyaları ve işlem kayıtlarını kaybettirir. Dosyayı hazır olduğunda cihazına kaydet.

## İzinli kullanım

Yalnızca sana ait veya indirme/dönüştürme iznin bulunan içerikleri işle; kaynak platformun koşullarına uy. Arayüzdeki izin onayı API'de de aranır. Bu onay telif hakkı veya izin durumunu otomatik doğrulamaz.

API yalnızca tanınan YouTube alan adlarındaki tek video bağlantısını kabul eder ve standart YouTube watch URL'sine dönüştürür; rastgele URL, playlist ve canlı yayın indirilmez. Çerez, hesap parolası, proxy veya erişim kısıtlamasını aşmaya yönelik ayar eklenmedi. Yüklenen dosyalar FFmpeg'e kabuk komutu oluşturmadan aktarılır; dosya dönüştürmede ağ protokolleri ve playlist formatları engellenir. Docker servisi root olmayan kullanıcıyla çalışır.

## Ücretsiz planın gerçek sınırları

Render ücretsiz Web Service, 15 dakika trafik almazsa uyur. İlk açılış gecikebilir. Çalışma saati, bant genişliği ve derleme kotası vardır; yüksek dış ağ trafiği ücretsiz servisin askıya alınmasına neden olabilir. Ödeme yöntemi ekli ise bazı kota aşımları ücret doğurabilir; Billing/Usage ve harcama sınırlarını kontrol et. Bu paket sınırsız ücretsiz, yüksek trafikli indirme hizmeti garantisi vermez.

YouTube, sunucu IP'sinden gelen istekleri reddedebilir. Site açılıp YouTube indirmesinin başarısız olması ayrı bir konudur; hata, daha fazla hosting yapılandırmasıyla her zaman çözülemez. Özel/kısıtlı videoların doğrulamasını aşmaya çalışma.

## Yerel çalıştırma ve doğrulama

Docker kurulu bir bilgisayarda proje klasöründen:

```sh
docker build -t mono-render .
docker run --rm -p 4317:10000 -e PUBLIC_ORIGIN=http://localhost:4317 mono-render
```

`http://localhost:4317` adresini aç. Container dışında Node.js 22+, yt-dlp, FFmpeg ve ffprobe kurulmuşsa `npm start` kullanılabilir; Linux'ta FFmpeg klasörü varsayılan `/usr/bin` olur. Farklı yollar için `YTDLP_PATH`, `FFMPEG_PATH`, `FFPROBE_PATH` ve `FFMPEG_DIR` ortam değişkenlerini ayarla. Node tarafında npm bağımlılığı yoktur.

Test: `npm test` veya `node --test tests/*.test.mjs`. Testler sağlık kontrolü, domain/origin doğrulaması, izin onayı, URL denetimi, boyut/süre/eşzamanlılık sınırları ve 12 formatta gerçek dönüşümü kapsar. YouTube'a dış istek göndermez. Tests klasörü Docker imajına kopyalanmaz.

yt-dlp bozulursa resmi sürümleri kontrol et; requirements.txt içindeki sabit sürümü güncelleyip yeniden dağıt. Çalışırken kendiliğinden güncelleme veya internetten JavaScript indirme seçeneği etkinleştirilmedi. `yt-dlp[default]` gerekli EJS bileşenini kurar, JavaScript çalışma ortamı mevcut Node.js'dir.

## Yapılan değişiklikler

Dockerfile, render.yaml, requirements.txt, runtime.mjs, koruyucu sınırlar ve entegrasyon testleri eklendi. package.json düzeltildi. Sunucu `0.0.0.0:$PORT` üzerinde dinler. Sunucudaki ve arayüzdeki localhost engelleri kaldırıldı. Windows'a bağlı setup/başlatıcı ve eski yerel kullanım rehberleri yerine bu rehber kullanılır. Eski Git geçmişi, node_modules, Windows araçları ve önceden indirilmiş medya ZIP'e alınmadı; arayüzün tasarımı korunmuştur.

## Resmî kaynaklar

- [Render Web Services / port ayarı](https://render.com/docs/web-services)
- [Docker on Render](https://render.com/docs/docker)
- [Render ücretsiz planı](https://render.com/docs/free)
- [Domain ve HTTPS](https://render.com/docs/custom-domains)
- [Blueprint yapılandırması](https://render.com/docs/blueprint-spec)
- [yt-dlp kurulum ve bağımlılıklar](https://github.com/yt-dlp/yt-dlp#installation)

Hazırlama tarihi: 1 Ekim 2026. Yerel test sonucu TEST-SONUCU.md dosyasındadır.
