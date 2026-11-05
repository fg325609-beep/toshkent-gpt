# ToshkentGPT

Toshkentcha, koʻcha tilida («jigar», «brat») gaplashadigan AI yordamchi. Veb-ilova (PWA), Telegram bot va jonli ovozli suhbat — hammasi bitta Next.js loyihasida.

**Sayt:** https://toshkentgpt.uz · **Stack:** Next.js 16 (App Router) · React 19 · Tailwind 4 · Google Gemini · Upstash Redis · NextAuth (Google) · Vercel

---

## Nimalar qila oladi

| Imkoniyat | Qayerda | Izoh |
|---|---|---|
| Matnli suhbat (streaming, xotira) | Veb, Telegram | Gemini Interactions API, suhbat ipi `previous_interaction_id` orqali davom etadi; **avtomatik vositalar** — model o'zi Google'dan qidiradi va havolalarni o'qiydi (manbalar javob ostida), **fikrlash qisqacha mazmuni** ko'rsatiladi, suhbatga avtomatik nom |
| Rasm, **video, audio**, PDF, Word (.docx), Excel (.xlsx), matnli fayllarni tushunish | Veb, Telegram | Kichik fayllar inline; kattalari (**5 GB gacha**, multipart) brauzerdan Vercel Blob'ga, so'ng **oqim bilan** (xotirasiz) Gemini Files API orqali modelga (AI tahlili uchun Gemini chegarasi 2 GB) — video ko'riladi, audio eshitiladi |
| **Podkast → klip** (`/klip`, Telegram `/klip`) | Veb, Telegram, Max/Pro Max | Uzun video/YouTube (hajm chegarasiz) → Whisper transkript → Gemini hook'larni tanlaydi (soni avtomatik) → ffmpeg: 2 daqiqagacha kesish, **pauzalarni avtomatik olib tashlash**, **yuzga qarab 9:16 kadrlash** (ikki so'zlovchi — bo'lingan ekran), so'zma-so'z subtitr, hook sarlavha, brend/pul izohlari, **NVENC/crf 18 tiniq sifat**, loudnorm. Lokal worker'da bajariladi; tayyor bo'lgach Telegram'ga video keladi |
| `/rasm <tavsif>` — rasm chizish | Veb, Telegram | Tavsif avval inglizchaga oʻgiriladi; provayderlar: lokal worker → Gemini (Max/Pro Max) → Pollinations (bepul) |
| `/qidir <savol>` — internet qidiruv | Veb, Telegram | Gemini `googleSearch` vositasi |
| `/kod <masala>` — Python kodini ishga tushirish | Veb, Telegram | Gemini `codeExecution`, grafik ham qaytaradi |
| `/prezentatsiya <mavzu>` — PowerPoint | Veb, Telegram | `pptxgenjs` bilan haqiqiy `.pptx` |
| Ovoz bilan yozish (STT) va ovozda eshitish (TTS, MP3) | Veb | Gemini audio + Gemini TTS |
| Jonli ovozli suhbat (kayfiyatga moslashadi) | Veb | `/api/voice` — transkript + kayfiyat + javob bitta soʻrovda |
| AI video (rasm → video) | Veb, Max/Pro Max | Lokal worker (`local-worker/`) yoki fal.ai |
| «Sohaviy bilim» — kasbga oid hujjat yuklab, botni mutaxassisga aylantirish | Veb | `/mutaxassislik` |
| Tariflar (Lite / Pro / Max / Pro Max), bepul sinov, referal bonus | Veb, Telegram | Limitlar Redis'da, toʻlov tasdigʻi admin orqali |
| Admin panel (`/admin`) | Veb | Serverdan jonli: **tizim holati** (Gemini, Redis, Blob, worker, Telegram webhook), **AI foydalanish** statistikasi (kunlik, kanal, tur, model, xatolar %, javob vaqti), **xatolar jurnali**, **e'lon banneri / texnik ishlar / funksiya tugmachalari**, foydalanuvchilar, bloklash, toʻlov soʻrovlari, boshlangʻich sarlavha |
| Push bildirishnomalar, PWA, qorongʻu/yorugʻ mavzu | Veb | `public/sw.js`, Vercel Cron eslatmalari |
| Moderatsiya | Veb, Telegram | Nomaqbul til → ogohlantirish, 3 martadan keyin avto-blok + admin'ga xabar |

Telegram botdagi qoʻshimcha buyruqlar: `/yangi` (suhbatni boshidan boshlash), `/holat` (tarif va limit), `/yordam`. Javobdan keyin davom-savollar tugma sifatida chiqadi.

Interfeys (v2.4): harakatlanuvchi logotip (halqa, orbita, nur — splash, kirish, boshlanish, header, AI avatari «oʻylayotganda» tezlashadi), aurora fon, e'lon banneri, brend uslubidagi 404/xato/yuklanish sahifalari, har bir sahifa uchun OG/Twitter kartasi va dinamik `opengraph-image`. Interfeys (v2.3): toʻliq kenglikdagi AI javoblari, kod bloklarida sintaksis ranglari va yuklab olish, `/` buyruq avtotoʻldirish, bir nechta biriktirma (sudrab tashlash, Ctrl+V), yuklanish foizi, javob holati («Oʻylayapman…», «Video qayta ishlanmoqda…»), davom-savol tugmalari, rasm lightbox, suhbatlarni qadash/qayta nomlash va sana boʻyicha guruhlash, Esc — toʻxtatish, Ctrl+Shift+O — yangi suhbat.

---

## Ishga tushirish (lokal)

```bash
git clone https://github.com/fg325609-beep/toshkent-gpt.git
cd toshkent-gpt
npm install
cp .env.example .env.local   # va qiymatlarni to'ldiring (pastga qarang)
npm run dev                  # http://localhost:3000
```

Boshqa buyruqlar:

```bash
npm run build            # production build
npm run lint             # ESLint
npm run export:profiles  # foydalanuvchi profillarini ./data ga eksport (admin uchun)
```

### Minimal sozlamalar

Ishlashi uchun kamida shular kerak (`.env.local`):

| Oʻzgaruvchi | Nima uchun |
|---|---|
| `GEMINI_API_KEY` | Barcha AI funksiyalar |
| `AUTH_GOOGLE_ID`, `AUTH_GOOGLE_SECRET`, `AUTH_SECRET` | Google orqali kirish (kirish majburiy — aks holda API'ni istalgan odam sarflashi mumkin) |
| `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN` | Tariflar, limitlar, profil, Telegram bogʻlash, admin. Bo'lmasa ham ishlaydi — hamma Lite, hech narsa saqlanmaydi |
| `BLOB_READ_WRITE_TOKEN` | Katta fayl/video/audio yuklash (Vercel → Storage → Blob). Bo'lmasa faqat 3 MB gacha fayl ishlaydi |
| `LOCAL_VIDEO_URL`, `WORKER_TOKEN` | Lokal worker (rasm, AI video, Podkast → klip) |

Toʻliq roʻyxat va izohlar: [`.env.example`](./.env.example).

### Telegram bot

1. @BotFather'dan token oling → `TELEGRAM_BOT_TOKEN`, `TELEGRAM_BOT_USERNAME`.
2. Webhook'ni oʻrnating (`TELEGRAM_WEBHOOK_SECRET` ni albatta bering):
   ```bash
   curl "https://api.telegram.org/bot<TOKEN>/setWebhook" \
     -d "url=https://<sayt>/api/telegram/webhook" \
     -d "secret_token=<TELEGRAM_WEBHOOK_SECRET>"
   ```
3. Foydalanuvchi saytda **Sozlamalar → Telegram bilan bogʻlash** tugmasini bosadi — bot shu hisobning tarifi va profili bilan ishlaydi.

### Lokal worker (rasm/video/klip — bepul, oʻz kompyuteringizda)

`local-worker/README.md` ga qarang. Qisqacha: `python worker.py` → Cloudflare Tunnel → `LOCAL_VIDEO_URL`, `WORKER_TOKEN`, `IMAGE_PROVIDER=local`, `VIDEO_PROVIDER=local`. Podkast → klip uchun worker tomonida `GEMINI_API_KEY` (hook tanlash), `faster-whisper` (transkript) va `yt-dlp` (YouTube) kerak; NVIDIA kartada bir soatlik podkast ~5–10 daqiqada, CPU'da ancha sekin.

### Katta fayllar qanday ishlaydi

```
brauzer ──(token)──> /api/upload ──> Vercel Blob (5 GB gacha, multipart, serverdan o'tmaydi)
brauzer ──{url}──> /api/chat ──> _lib/attachments.js:
    rasm ≤ 7 MB      -> inline base64
    video/audio/katta -> Blob'dan OQIM -> Gemini Files API resumable upload (xotiraga olinmaydi)
                        -> {type:'video'|'audio'|'image'|'document', uri}
    PDF              -> matn (skanerlangan bo'lsa — hujjat sifatida modelga)
    DOCX/XLSX/matn   -> matn
```
Bir xil fayl qayta yuborilsa (masalan «qayta yozdirish»), Gemini'dagi nusxasi Redis keshidan olinadi.

---

## Loyiha tuzilishi

```
src/
  app/
    page.jsx                 # asosiy chat (butun holat shu yerda)
    layout.jsx               # meta, shriftlar, mavzu
    plans.js                 # tariflar konfiguratsiyasi (frontend + backend)
    admin/                   # admin paneli
    api/
      chat/route.js          # veb-chat: SSE streaming, buyruqlar, fayllar
      upload/route.js        # Vercel Blob client-upload tokeni (katta fayllar)
      clips/                 # Podkast → klip: worker'ga yuborish, holat, fayl proksi
      telegram/webhook/      # Telegram bot (chat bilan bir xil mantiq)
      voice/, stt/, tts/     # ovoz
      video-ai/, expertise/, referral/, plan/, profile/, admin/...
      _lib/
        ai-generation.js     # UMUMIY AI mantiq: tizim ko'rsatmasi, model/tarif,
                             # rasm (provayderlar), qidiruv, kod, taqdimot
        user-plan.js         # tariflar, limitlar, sinov oynalari
        user-profile.js      # Redis'dagi profil (+ AI o'rgangan faktlar)
        moderation.js        # nomaqbul til, bloklash
        telegram.js          # Telegram Bot API yordamchilari
        document-extract.js  # PDF/DOCX/XLSX -> matn
        attachments.js       # biriktirmalar: Blob -> inline / Gemini Files API
        redis.js, admin.js, push.js, tts.js, ai-video.js, ...
    klip/page.jsx            # Podkast → klip studiyasi
    (sahifalar: tariflar, sozlamalar, yordam, mutaxassislik, video-ai, ...)
  components/                # Header, Sidebar, ChatInput, MessageBubble, VoiceMode, ...
  lib/                       # brauzer tomonidagi sof yordamchilar (storage, session, files, upload, version)
  auth.js                    # NextAuth (Google, JWT)
local-worker/                # Python worker: rasm (Stable Diffusion) va video (SVD)
public/                      # ikonkalar, manifest, service worker
```

### Muhim dizayn qarorlari

- **Bitta AI mantiq — ikki kanal.** `_lib/ai-generation.js` ham veb-chat, ham Telegram tomonidan ishlatiladi: tizim koʻrsatmasi (sana/vaqt, profil faktlari, til, sohaviy bilim), tarifga qarab model va «oʻylash darajasi», rasm chizish provayderlari zanjiri.
- **Foydalanuvchi faqat serverda aniqlanadi.** Email sessiyadan olinadi; mijoz yuborgan profil/emailga ishonilmaydi (limitni chetlab oʻtish va prompt injection oldini olish uchun). AI oʻzi yozadigan `[[ESLA: kalit=qiymat]]` faktlari uzunlik va soni boʻyicha cheklangan, tizim maydonlarini (`onboarded`, `mutaxassislik`) oʻzgartira olmaydi.
- **Redis ishlamasa ham chat toʻxtamaydi** — hamma joyda «xatoga chidamli» (fallback Lite).
- **Streaming xavfsiz yopiladi** — foydalanuvchi «Toʻxtatish»ni bossa, Gemini oqimi ham toʻxtatiladi (token tejaladi), yopilgan oqimga yozish xato bermaydi.
- **Xatolarga chidamlilik** (`withRetry`, `friendlyAiError` — `_lib/ai-generation.js`): 429/5xx/tarmoq xatosida 2 marta qayta urinish, model topilmasa standart modelga tushish, vositalar xato bersa ularsiz, eski suhbat ipi eskirgan bo'lsa usiz; qisman kelgan javob yo'qotilmaydi; foydalanuvchiga texnik emas, tushunarli xabar.
- **Server-boshqaruvli sozlamalar** (`_lib/settings.js`, `/api/settings`): e'lon banneri, texnik ishlar rejimi (chat va Telegram 503 bilan to'xtaydi), funksiya tugmachalari (avto vositalar, davom-savollar, fikrlash, klip…) — admin paneldan, deploy'siz.
- **Telemetriya** (`_lib/stats.js`): faqat sonlar (kanal, tur, model, muvaffaqiyat, vaqt), xabar mazmuni saqlanmaydi; oxirgi 200 xato jurnali.
- **Telegram update dedup** — Telegram bir xil update'ni qayta yuborsa (uzoq javoblarda boʻladi), ikki marta javob berilmaydi.

---

## Deploy (Vercel)

1. Repozitoriyni Vercel'ga ulang, `.env.example`dagi oʻzgaruvchilarni Environment Variables'ga kiriting.
2. Marketplace'dan **Upstash for Redis** qoʻshing (env'lar oʻzi toʻldiriladi).
3. `vercel.json` da cron bor: har kuni 08:00 UTC `/api/cron/plan-reminders` (tarifi tugayotganlarga push). `CRON_SECRET` ni sozlang.
4. Request body ~4.5 MB bilan cheklangan — shuning uchun 3 MB dan katta fayllar va barcha video/audio Vercel Blob orqali yuklanadi (`BLOB_READ_WRITE_TOKEN`). `/api/chat` `maxDuration = 300` (Fluid compute) — katta video Gemini'da qayta ishlanguncha kutadi.

---

## Versiya va oʻzgarishlar

Joriy versiya va «Nimalar yangilandi?» roʻyxati: [`src/lib/version.js`](./src/lib/version.js). Yangi funksiya qoʻshilganda `APP_VERSION` oshiriladi — eski foydalanuvchilarga avtomatik oyna chiqadi.

Muallif: Farhod Gʻofurov.
