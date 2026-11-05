ToshkentGPT — Lokal video worker

Bu dastur sizning kompyuteringizda ishlaydi va rasmdan video yasaydi. Hech qanday API kalit, obuna yoki oylik to'lov kerak emas.

Nima uchun bu foydali

Dastur o'zi uskunani aniqlaydi va imkoniyatga qarab sozlanadi:

Uskuna	Qanday ishlaydi	Sifat	Taxminiy vaqt
Faqat CPU (i5-12400F)	ishlaydi	past (8 kadr, 320px)	1–6 soat
RX 550 4GB (DirectML)	ishlaydi	past (8 kadr, 320px)	20–90 daqiqa
RTX 3060 8GB	ishlaydi	o'rta (14 kadr, 576px)	3–8 daqiqa
RTX 5090 32GB	ishlaydi	eng yuqori (25 kadr, 1024px)	1–2 daqiqa

Ya'ni: bugun sizdagi uskunada ishga tushadi (sekin), kelajakda RTX 5090 qo'ysangiz — hech narsani o'zgartirmasdan to'liq quvvatga o'tadi.

O'rnatish
1. Python o'rnating

Python 3.10 yoki 3.11 kerak (DirectML 3.12+ ni qo'llab-quvvatlamaydi). python.org dan yuklab oling, o'rnatishda "Add Python to PATH" ni belgilang.

2. Kutubxonalarni o'rnating

PowerShell'ni shu papkada oching va o'zingizga mos buyruqni bajaring:

Hozirgi kompyuteringiz uchun (AMD RX 550, Windows):

powershell
pip install torch torchvision
pip install torch-directml
pip install -r requirements.txt

Kelajakda RTX 5090 olsangiz:

powershell
pip uninstall torch-directml -y
pip install torch torchvision --index-url https://download.pytorch.org/whl/cu124
pip install -r requirements.txt
3. Ishga tushiring
powershell
python worker.py

Birinchi ishga tushirishda model yuklab olinadi (~10 GB, internetga bog'liq ravishda 15–60 daqiqa). Keyingi safar darhol ishga tushadi.

Ekranda quyidagicha yozuv chiqishi kerak:

============================================================
  Uskuna : AMD Radeon RX 550  (directml)
  Daraja : low  —  8 kadr, 320px, 12 qadam
============================================================
4. Tekshiring

Brauzerda oching: http://localhost:8188/health Agar JSON ma'lumot chiqsa — worker ishlayapti.

Saytga ulash

Sayt (Vercel) bulutda, worker esa uyingizdagi kompyuterda. Ularni bog'lash uchun Cloudflare Tunnel ishlatiladi (bepul):

powershell
winget install --id Cloudflare.cloudflared
cloudflared tunnel --url http://localhost:8188

U sizga shunday manzil beradi: https://tasodifiy-nom.trycloudflare.com

Shu manzilni Vercel'ga qo'shing:

LOCAL_VIDEO_URL=https://tasodifiy-nom.trycloudflare.com
WORKER_TOKEN=ozingiz-oylab-topgan-parol
VIDEO_PROVIDER=local

Xuddi shu WORKER_TOKEN ni worker ishga tushirishdan oldin ham o'rnating:

powershell
$env:WORKER_TOKEN="ozingiz-oylab-topgan-parol"
python worker.py
Muhim eslatmalar
Kompyuter yoqiq turishi kerak. O'chgan bo'lsa, video funksiyasi ishlamaydi.
Bepul Cloudflare tunnel manzili har safar o'zgaradi. Doimiy manzil kerak bo'lsa, Cloudflare'da bepul hisob ochib, nomli tunnel yaratish mumkin.
Birinchi video eng sekin bo'ladi (model xotiraga yuklanadi). Keyingilari tezroq.
Xotira yetmasa xato chiqishi mumkin — bunda worker.py dagi pick_tier funksiyasida "low" darajaning frames va size qiymatlarini kamaytiring.
Rasm generatsiyasi (lokal, bepul)

Worker rasm ham chiza oladi. Bu video'dan ancha yengil — RX 550 (4GB) da haqiqatan ishlaydi, bitta rasm 1-3 daqiqa oladi.

Standart model: stabilityai/sd-turbo (~2.5 GB, 4 qadamda chizadi — tez).

Boshqa model xohlasangiz, ishga tushirishdan oldin:

powershell
$env:IMAGE_MODEL="stabilityai/stable-diffusion-2-1-base"
python worker.py
Saytga ulash

.env.local va Vercel'ga qo'shing:

IMAGE_PROVIDER=local

Shunda /rasm buyrug'i Pollinations o'rniga sizning kompyuteringizda ishlaydi.

Uskuna	O'lcham	Vaqt
CPU	512px	3-10 daqiqa
RX 550 4GB	512px	1-3 daqiqa
RTX 5090	1024px	~2 soniya

Podkast → klip (Opus Clip uslubida)

Worker uzun podkast yoki videoni oladi va undan tayyor qisqa kliplar (Reels/Shorts/TikTok) yasaydi:

1. Manbani yuklab oladi — to'g'ridan-to'g'ri fayl havolasi (saytga yuklangan mp4/mp3/m4a, Vercel Blob) yoki YouTube havolasi (yt-dlp, ≤1080p). Fayl oqim bo'lib (bo'lak-bo'lak) yoziladi — 8 GB gacha (CLIPS_MAX_SOURCE_MB), ya'ni ko'p soatlik podkast ham bo'laveradi.
2. Nutqni matnga aylantiradi (faster-whisper), har bir so'zning vaqti bilan. Uzun yozuvda holat (progress) har ~30 soniya audio uchun yangilanib turadi, taxminiy qolgan vaqt bilan.
3. Gemini eng kuchli "hook" joylarni tanlaydi (kutilmagan da'vo, raqam, hikoya, qarama-qarshi fikr). Gemini 429/5xx yoki timeout bersa 2 marta qayta uriniladi; baribir bo'lmasa — nutq eng zich joylarni o'zi tanlaydi. clip_count = 0 bo'lsa klip soni avtomatik: har ~8 daqiqa nutqqa 1 klip (2..8).
4. Pauzalarni o'zi kesadi ("jump-cut"): so'zlar orasidagi 0.9 s dan uzun sukutlar 0.25 s gacha qisqartiriladi (chegaralar haqiqiy audio balandligi bo'yicha aniqlanadi — nutq boshi/oxiri kesilmaydi). Subtitr va sarlavha vaqtlari yangi vaqtga qayta hisoblanadi, shuning uchun sinxron buzilmaydi. Klipda nechchi soniya kesilgani statusda ko'rinadi (removed_pause_seconds).
5. Aqlli kesish (smart crop): 9:16 va 1:1 uchun kadr yuzga qarab markazlanadi (OpenCV, har ~1.5 soniyada bitta kadr tekshiriladi). Ikki so'zlovchi aniq ajralib tursa (masalan ikki kamera yoki keng kadr) 9:16 da ekran ikkiga bo'linadi: yuqorida bir so'zlovchi, pastda ikkinchisi (layout: auto). OpenCV bo'lmasa kadr markazdan kesiladi.
6. ffmpeg yuqori sifatda kodlaydi: NVIDIA karta bo'lsa NVENC (GPU, bir necha barobar tez), bo'lmasa libx264 CRF 18 (preset medium); lanczos bilan o'lchash, manba kadr tezligi saqlanadi (24..60), H.264 High, yuv420p, faststart. Ovoz: AAC 192k 48 kHz, balandlik EBU R128 bo'yicha tekislanadi (−16 LUFS) — hamma klip bir xil balandlikda. So'zma-so'z sinxron subtitr (aytilayotgan so'z oltin rangda), birinchi 2.5 soniyada sarlavha, brend nomi / pul summasi aytilganda kichik "callout". Audio-only manba (mp3) uchun yumshoq gradient fon va o'rtada klip sarlavhasi.
7. Natija: klip_1.mp4, klip_2.mp4 ... va har biri uchun rasm (thumbnail, 1080x1920). Bitta klip xato bersa, qolganlari baribir tayyorlanadi — sabab statusdagi "warnings" ro'yxatida.

O'rnatish

Kutubxonalar requirements.txt ichida (faster-whisper, yt-dlp, requests, opencv-python-headless). ffmpeg imageio-ffmpeg bilan birga keladi — alohida o'rnatish shart emas.

powershell
pip install -r requirements.txt

Whisper modeli birinchi ishga tushirishda o'zi yuklab olinadi (small ≈ 500 MB). NVIDIA karta bo'lsa (CUDA) transkripsiya 10-20 barobar tez — 1 soatlik podkast 1-2 daqiqada; faqat CPU'da (i5-12400F) 1 soatlik podkast 15-40 daqiqa oladi. CPU sekin bo'lsa WHISPER_MODEL=base yoki tiny qo'ying (sifat pastroq, lekin tez).

NVIDIA tavsiyasi: kodlash (montaj) ham NVIDIA kartada ancha tez — worker ishga tushganda NVENC bor-yo'qligini o'zi tekshiradi (1 kadrli sinov) va bor bo'lsa avtomatik ishlatadi (/health → clips.nvenc: true). Faqat CPU'da 1 daqiqalik 1080x1920 klip "high" sifatda 1-3 daqiqa kodlanadi; tezroq kerak bo'lsa quality: "fast" yuboring yoki $env:CLIPS_QUALITY="fast" qo'ying.

OpenCV (smart crop) ixtiyoriy: o'rnatilmagan bo'lsa worker ishlayveradi, faqat kadr markazdan kesiladi (/health → clips.opencv). opencv-python-headless 4.x bilan Haar yuz detektori offline keladi; 5.x o'rnatilgan bo'lsa worker YuNet modelini (~230 KB) CLIPS_MODELS_DIR ga bir marta yuklab oladi.

Sozlamalar (ishga tushirishdan oldin PowerShell'da):

powershell
$env:WORKER_TOKEN="ozingiz-oylab-topgan-parol"   # sayt bilan umumiy parol
$env:GEMINI_API_KEY="AIza..."                    # hook tanlash uchun (ixtiyoriy, lekin tavsiya etiladi)
$env:GEMINI_MODEL="gemini-3.6-flash"             # standart
$env:WHISPER_MODEL="small"                       # tiny | base | small | medium | large-v3
$env:WHISPER_DEVICE="auto"                       # auto | cpu | cuda
$env:CLIPS_DIR=".\clips"                         # natijalar papkasi
$env:CLIPS_TTL_HOURS="24"                        # eski kliplar necha soatdan keyin o'chirilsin
$env:CLIPS_MAX_SOURCE_MB="8192"                  # manba fayl maksimal hajmi (MB)
$env:CLIPS_QUALITY="high"                        # standart sifat: fast | high | max
$env:CLIPS_NVENC="auto"                          # "0" — NVIDIA NVENC'ni o'chirish (CPU bilan kodlash)
$env:CLIPS_MODELS_DIR=".\models"                 # yuz detektori modeli (faqat OpenCV 5.x da kerak)
python worker.py

Endpointlar

POST /clips/submit — JSON: {"token", "source_url", "max_clip_seconds": 120, "clip_count": 3, "aspect": "9:16", "subtitles": true, "language": "auto", "brand_terms": ["InFran", "500 mln"], "instructions": "...", "quality": "high", "remove_pauses": true, "pause_threshold": 0.9, "pause_keep": 0.25, "smart_crop": true, "layout": "auto"} → {"requestId"}.
  source_url — fayl havolasi yoki YouTube; max_clip_seconds 15..180; clip_count 1..8 yoki 0 = avtomatik (har ~8 daqiqa nutqqa 1 klip, 2..8); aspect 9:16 | 16:9 | 1:1; language uz | ru | en | auto; brand_terms — aytilganda ekranda chiqadigan brend/pul iboralari; instructions — Gemini'ga yetkaziladigan istaklar.
  quality — fast (veryfast/CRF 22, NVENC p1) | high (medium/CRF 18, NVENC p5 cq 19 — standart) | max (slow/CRF 16, NVENC p7 cq 17); remove_pauses — uzun sukutlarni kesish (standart true); pause_threshold — shundan uzun sukut kesiladi (soniya, 0.3..5); pause_keep — kesilgan sukutdan shuncha qoldiriladi (soniya); smart_crop — kadrni yuzga qarab markazlash (standart true); layout — auto (ikki so'zlovchi aniq bo'lsa split) | single (doim bitta kadr) | split (doim ikkiga bo'lingan ekran, 9:16).
  Yangi maydonlarni yubormasangiz ham bo'ladi — standart qiymatlar ishlaydi (eski sayt versiyasi bilan mos).
GET /clips/status/{requestId} → {"state": pending|done|error, "stage", "progress": 0-100, "duration", "transcript_preview", "clip_count", "warnings": [...], "clips": [{"index", "filename", "title", "hook", "start", "end", "duration", "source_duration", "removed_pause_seconds", "layout", "url", "thumbnail_url", "reason"}]}.
  duration (klip ichida) — TAYYOR klipning davomiyligi (pauzalar kesilgandan keyin); source_duration — manbadagi asl uzunligi; removed_pause_seconds — qancha sukut kesilgani; layout — single | split; warnings — to'xtatmaydigan muammolar (masalan bitta klip montaj qilinmadi, OpenCV yo'q).
GET /clips/file/{requestId}/klip_1.mp4 (yoki .jpg) — tayyor faylni beradi (brauzerda oldinga/orqaga surish ishlaydi).
POST /clips/cancel/{requestId} — vazifani bekor qilish (JSON: {"token"}).
GET /health — "clips" bo'limi: {"ffmpeg", "whisper", "yt_dlp", "gemini", "whisper_model", "whisper_device", "nvenc", "opencv", "quality_default", "max_source_mb"} — nimalar tayyorligini ko'rsatadi.

Saytdagi /klip sahifasi aynan shu endpointlardan foydalanadi: podkastni yuklaysiz yoki YouTube havolasini qo'yasiz, worker kliplarni tayyorlaydi, sahifada ko'rib yuklab olasiz.

Eslatmalar
Kliplar CLIPS_DIR papkasida saqlanadi va CLIPS_TTL_HOURS dan keyin avtomatik o'chiriladi — keraklisini o'z vaqtida yuklab oling.
Subtitr shrifti Arial (Windows'da bor). Linux'da bo'lmasa libass o'xshash shriftni o'zi tanlaydi.
YouTube ba'zan yuklab olishni cheklaydi — bunda videoni avval yuklab olib, faylni saytga yuklash ishonchliroq.
Pauza kesish fon musiqasi baland yozuvlarda kamroq ishlaydi (jim joy topilmaydi) — bu xavfsiz: kesilmaydi, lekin klip buzilmaydi. Kerak bo'lmasa remove_pauses: false yuboring.
Split (ikkiga bo'lingan) ekran faqat 9:16 uchun; 1:1 va 16:9 da single ishlatiladi.

### Telegram orqali (/klip)

Telegram botda `/klip <YouTube havola>` yuborilsa, sayt worker'ga `callback_url` (`https://<sayt>/api/clips/callback`) va `callback_token` (= `WORKER_TOKEN`) bilan vazifa beradi. Worker tugagach shu manzilga `POST` qiladi (`X-Worker-Token` sarlavhasi bilan) — sayt tayyor kliplarni o'sha Telegram chatiga video sifatida yuboradi (50 MB gacha). Veb-sahifa (`/klip`) uchun callback kerak emas — u holatni o'zi so'rab turadi.
