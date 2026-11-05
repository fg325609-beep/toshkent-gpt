# ToshkentGPT v2.4.0 — qanday o'rnatish

Bu papka — https://github.com/fg325609-beep/toshkent-gpt repozitoriysining
TO'LIQ yangilangan nusxasi (3 ta commit: v2.2.0, v2.3.0, v2.4.0). GitHub'ga
push huquqi bo'lmagani uchun zip qilib berildi. Build (`npm run build`) va
lint (`npm run lint`) toza o'tgan.

## 1-usul (eng oson): git patch — tarix saqlanadi
Repo papkangizda (main branchda, o'zgarishlar commit qilingan holda):

    git checkout -b v2.4.0
    git am _PATCH_2.2.0_dan_2.4.0_gacha.patch
    git push -u origin v2.4.0

Keyin GitHub'da Pull Request → Merge (yoki main'da `git am` qilib push).

## 2-usul: fayllarni almashtirish
Shu papkadagi hamma narsani (package.json, src/, public/, local-worker/,
README.md, .env.example, .gitignore) repo papkangizga ustma-ust ko'chiring:

    npm install
    npm run build
    git add -A && git commit -m "v2.4.0" && git push

## Vercel sozlamalari (Settings → Environment Variables)
MAJBURIY (yangi):
- BLOB_READ_WRITE_TOKEN — Vercel → Storage → Blob → Create → Connect to project
  (GB'lab video/audio yuklash shunga bog'liq; bo'lmasa 3 MB gacha ishlaydi)

Tavsiya etiladi:
- NEXT_PUBLIC_MAX_UPLOAD_MB=5120        (brauzerdan yuklash chegarasi, 5 GB)
- AUTO_TOOLS_PLANS=pro,max,promax       (bot o'zi internetdan qidiradi — qaysi tariflarda;
                                         Google Search grounding alohida narxlanadi)
- CLIPS_ALLOWED_PLANS=max,promax        (Podkast → klip kimga ochiq)
- GEMINI_TITLE_MODEL / GEMINI_VOICE_MODEL (ixtiyoriy)

Vercel → Settings → Functions: Fluid compute yoqilgan bo'lsin (chat 300 s gacha
ishlashi uchun — katta video Gemini'da qayta ishlanguncha kutadi).

## Lokal worker (Farhod kompyuterida) — Podkast → klip
    cd local-worker
    pip install -r requirements.txt     # faster-whisper, yt-dlp, opencv-python-headless (yuzga qarab kadrlash)
    set GEMINI_API_KEY=...               # hook tanlash (Windows: set, Linux/Mac: export)
    set WHISPER_MODEL=small              # NVIDIA bo'lsa medium yoki large-v3
    python worker.py

- NVIDIA karta bo'lsa NVENC o'zi aniqlanadi (tez va tiniq), yo'q bo'lsa libx264 crf 18.
- `python worker.py` ochilganda "Podkast → klip" qatorida ffmpeg/whisper/yt_dlp/
  gemini/nvenc/opencv holati ko'rinadi. Admin paneldagi "Tizim holati" ham shuni ko'rsatadi.
- Batafsil: local-worker/README.md → "Podkast → klip".

## Telegram bot — buyruqlar ro'yxati (@BotFather → /setcommands)
    rasm - Rasm chizish
    qidir - Internetdan qidirish
    kod - Kod yozib ishga tushirish
    prezentatsiya - PowerPoint tayyorlash
    klip - Podkastdan qisqa kliplar (YouTube havola)
    yangi - Suhbatni boshidan boshlash
    holat - Tarif va limit
    yordam - Yordam

## Admin panel (/admin) — endi serverdan jonli
- Tizim holati: Gemini, Redis, Blob, Worker, Telegram webhook, Auth, Push, Cron
- AI foydalanish: kunlik so'rovlar, xatolar %, javob vaqti, kanallar/turlar/modellar, top foydalanuvchilar
- Oxirgi xatolar: jurnal (mazmunsiz, faqat xato matni)
- Ilova sozlamalari: e'lon banneri (hamma ko'radi), texnik ishlar rejimi,
  funksiya tugmachalari (avto qidiruv, fikrlash, klip, video, rasm), yuklash chegarasi —
  deploy'siz, darhol kuchga kiradi.

## Deploy'dan keyin tekshirish (jonli kalitlar bilan sinalmagan joylar)
1. Chatga 1–2 GB video tashlang → "oqim bilan yuklanmoqda… / qayta ishlanmoqda…" → javob
2. Pro tarifda "bugun dollar kursi?" deb so'rang → javob ostida "Manbalar" chiqishi kerak
3. Admin → Tizim holati — hammasi yashil bo'lsin
4. /klip sahifasida qisqa YouTube havola bilan "avtomatik" klip yasang (worker yoqiq bo'lsin)
5. Telegram: /klip <havola>; rasm va PDF yuboring
6. Havolani Telegram/Instagram'ga tashlang — karta (rasm + tavsif) chiqishini tekshiring

Nimalar o'zgargani: README.md va src/lib/version.js (CHANGELOG).
