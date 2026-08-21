# Bu fayllarni qayerga qo'yish kerak

Loyihangiz papkasida (`toshkent-gpt/`) shu fayllarni **aynan shu joylashuvda** almashtiring:

- `src/app/page.js`               → almashtiring (yangi funksiyalar shu yerda)
- `src/app/globals.css`           → almashtiring (dark/light rang o'zgaruvchilari)
- `src/app/layout.js`             → almashtiring (mavzuni FOUC'siz yuklash uchun)
- `src/app/use-theme.js`          → YANGI fayl, qo'shing
- `src/app/markdown-message.js`   → almashtiring (kod bloklari ham temaga mos)
- `src/app/api/feedback/route.js` → YANGI fayl va papka, qo'shing
- `.env.example`                  → almashtiring (hujjat uchun, sirlar yo'q)

## Keyingi qadamlar

1. `.env.local` faylingizga (mahalliy, qo'lda) shularni qo'shing:
   
   TELEGRAM_BOT_TOKEN=8765397823:AAG5pg9Fxxo3rjFyFQKZyyA2SU-II5Y2zk0
   TELEGRAM_CHAT_ID=6660879147
   
2. Vercel'da bu ikkalasi allaqachon qo'shilgan — Redeploy qilingan bo'lsa tayyor.
3. `npm run dev` bilan mahalliy tekshiring:
   - Header'dagi 3-chiziqchali (☰) tugma → "Suhbatlar tarixi", "Yorugʻ/Qorongʻu rejim", "Shikoyat va takliflar" — barchasi shu menyu ichida
   - Tema tugmasi bosilganda butun sayt darhol oq/qora rejim orasida almashadi
   - "Shikoyat va takliflar" oynasida LinkedIn/Instagram/Telegram ikonkalari va forma bor — forma yuborilgach xabar Telegram botingizga keladi
4. `git add . && git commit -m "hamburger menu, dark/light mode, feedback section" && git push`

## Muhim: nima uchun oldin ishlamasligi mumkin edi
`lucide-react` kutubxonasining o'rnatilgan versiyasida (`1.31.0`) `Linkedin` va `Instagram`
ikonkalari olib tashlangan ekan (brend logotiplari kutubxonadan chiqarilgan). Shuning
uchun ularni alohida kichik SVG sifatida (`LinkedinGlyph`, `InstagramGlyph`) yozib qo'ydim —
paket versiyasidan qat'i nazar doim ishlaydi. Men bu holatni haqiqiy `next build`
orqali sinab, xatosiz kompilyatsiya bo'lishini tasdiqladim.
