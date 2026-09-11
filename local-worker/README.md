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