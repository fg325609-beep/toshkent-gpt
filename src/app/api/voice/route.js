import { GoogleGenAI } from '@google/genai';
import { auth } from '@/auth';
import { getUserState, resolveEffectivePlan, getUsageWindow, recordUsage, saveUserState } from '../_lib/user-plan';
import { getUserProfile } from '../_lib/user-profile';
import { buildSystemInstruction } from '../_lib/ai-generation';
import { generateSpeechMp3 } from '../_lib/tts';
import { touchUser } from '../_lib/admin';
 
// ============================================================
// JONLI (ONLAYN) SUHBAT — ovozli rejim.
//
// Bitta so'rovda hamma narsa bajariladi, shunda javob TEZ keladi:
//   1) foydalanuvchining ovozi Gemini'ga yuboriladi;
//   2) model ayni paytda uchta ishni qiladi — aytilganini matnga o'giradi,
//      OHANGIDAN kayfiyatini (xursand, siqilgan, charchagan...) aniqlaydi
//      va o'sha kayfiyatga MOS javob yozadi;
//   3) javob matni kayfiyatga mos OHANGDA ovozga aylantiriladi.
//
// Muhimi: foydalanuvchi siqilib, xafa ohangda gapirsa — ko'cha tilidagi
// hazil-huzul TO'XTAYDI, AI sokin, mehribon va bosiq gapiradi.
// ============================================================
 
const API_KEY = process.env.GEMINI_API_KEY;
const MODEL = process.env.GEMINI_MODEL || 'gemini-3.6-flash';
 
// Kayfiyat -> ovoz ohangi. Til nomi oldiga qo'shiladi.
const MOOD_TONE = {
  sad: 'sokin, past va mehribon ohangda, shoshilmasdan, hamdardlik bilan',
  tired: 'yumshoq, xotirjam va sokin ohangda, shoshilmasdan',
  angry: 'xotirjam, bosiq va hurmat bilan, ovozini ko\'tarmasdan',
  happy: 'quvnoq, jonli va samimiy ohangda',
  neutral: 'samimiy, tabiiy va issiq ohangda',
};
 
const LANG_PREFIX = {
  uz: "o'zbek tilida",
  ru: 'rus tilida',
  en: 'ingliz tilida',
};
 
function buildVoicePrompt(systemInstruction) {
  return `${systemInstruction}
 
===== HOZIR SEN JONLI OVOZLI SUHBATDASAN =====
 
Foydalanuvchi senga GAPIRDI (yozmadi). Uning audiosi berilgan.
 
Quyidagilarni bajar:
1. Audioda aytilgan gapni aniq matnga o'gir.
2. Foydalanuvchi QAYSI TILDA gapirganini aniqla (o'zbek, rus, ingliz yoki boshqa) va javobni ham AYNAN SHU TILDA yoz.
3. Uning OVOZ OHANGIDAN va so'zlaridan kayfiyatini aniqla:
   - "sad" — xafa, siqilgan, yig'lamsiragan, ko'ngli to'lmagan
   - "tired" — charchagan, holsiz
   - "angry" — asabiy, jahli chiqqan
   - "happy" — xursand, kulib turgan, hazillashayotgan
   - "neutral" — oddiy, xotirjam
4. Javobni SHU KAYFIYATGA QARAB yoz:
   - "sad" yoki "tired" bo'lsa: ko'cha tilidagi hazil-mutoyibani, "jigar/brat/chotki" kabi so'zlarni va kulgili gaplarni MUTLAQO ISHLATMA. Sokin, mehribon, iliq va sodda gapir. Avval uning holatiga hamdard bo'l, keyin yumshoqlik bilan yordam taklif qil. Nasihat yog'dirma, ko'p savol berma — bitta, ehtiyotkor savol yetadi.
   - "angry" bo'lsa: bosiq va xotirjam bo'l, bahslashma, avval tushunganingni bildir.
   - "happy" yoki "neutral" bo'lsa: odatdagi samimiy Toshkentcha uslubingda gapir.
5. Javob OG'ZAKI eshitiladi — shuning uchun: qisqa yoz (2-4 gap), markdown, ro'yxat, kod bloki, emoji, yulduzcha yoki maxsus belgilar ISHLATMA. Faqat oddiy, gapiriladigan matn.
6. [[ESLA: ...]] kabi yashirin belgilarni bu rejimda umuman yozma.
 
Javobni FAQAT quyidagi JSON ko'rinishida qaytar:
{"transcript": "foydalanuvchi aytgan gap", "lang": "uz | ru | en | boshqa", "mood": "sad | tired | angry | happy | neutral", "reply": "sening javobing"}`;
}
 
export async function POST(req) {
  const session = await auth();
  const email = session?.user?.email;
  if (!email) {
    return Response.json({ error: 'Kirish talab qilinadi.' }, { status: 401 });
  }
  if (!API_KEY) {
    return Response.json({ error: 'Server sozlanmagan.' }, { status: 500 });
  }
 
  const body = await req.json().catch(() => null);
  const audioBase64 = body?.audio;
  const mimeType = body?.mimeType || 'audio/webm';
  const history = Array.isArray(body?.history) ? body.history.slice(-8) : [];
 
  if (!audioBase64) {
    return Response.json({ error: 'Audio topilmadi.' }, { status: 400 });
  }
 
  touchUser(email, { name: session.user.name, image: session.user.image }).catch(() => {});
 
  // --- Tarif limiti (chatdagi bilan bir xil hisob) ---
  const userState = await getUserState(email);
  const effectivePlan = resolveEffectivePlan(userState);
  const { plan, mode } = effectivePlan;
 
  if (mode === 'downgraded') {
    return Response.json(
      {
        error: `${effectivePlan.wantedPlan?.name || 'Tarifingiz'} vaqti tugadi.`,
        requiresUpgrade: true,
        suggestedPlan: effectivePlan.wantedPlan?.id || 'pro',
      },
      { status: 402 }
    );
  }
 
  const cooldownHours = mode === 'trial' ? plan?.trial?.cooldownHours : undefined;
  const usageLimit = mode === 'trial' ? plan?.trial?.limit : plan?.dailyLimit;
 
  if (plan && typeof usageLimit === 'number') {
    const win = getUsageWindow(userState, cooldownHours);
    if (win.count >= usageLimit) {
      return Response.json(
        {
          error: `"${plan.name}" limitiga (${usageLimit} xabar) yetdingiz.`,
          requiresUpgrade: plan.id !== 'promax',
          suggestedPlan: plan.id === 'lite' ? 'pro' : plan.id === 'pro' ? 'max' : 'promax',
        },
        { status: 402 }
      );
    }
  }
 
  try {
    const ai = new GoogleGenAI({ apiKey: API_KEY });
    const profile = (await getUserProfile(email).catch(() => null)) || {};
    const systemInstruction = buildVoicePrompt(buildSystemInstruction(profile, profile?.til));
 
    // Oldingi gaplar — suhbat uzilib qolmasligi uchun.
    const contents = [];
    for (const turn of history) {
      if (!turn?.text) continue;
      contents.push({
        role: turn.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: String(turn.text).slice(0, 1200) }],
      });
    }
    contents.push({
      role: 'user',
      parts: [{ inlineData: { mimeType, data: audioBase64 } }],
    });
 
    const result = await ai.models.generateContent({
      model: MODEL,
      contents,
      config: {
        systemInstruction,
        responseMimeType: 'application/json',
        temperature: 0.8,
      },
    });
 
    const raw = (result?.text || result?.candidates?.[0]?.content?.parts?.[0]?.text || '').trim();
 
    let parsed = null;
    try {
      parsed = JSON.parse(raw);
    } catch {
      // Ba'zan model JSON'ni matn ichiga o'rab yuborishi mumkin — qutqarib olamiz.
      const match = raw.match(/\{[\s\S]*\}/);
      if (match) {
        try {
          parsed = JSON.parse(match[0]);
        } catch {}
      }
    }
 
    const transcript = (parsed?.transcript || '').trim();
    const reply = (parsed?.reply || '').trim();
    const mood = MOOD_TONE[parsed?.mood] ? parsed.mood : 'neutral';
    const lang = LANG_PREFIX[parsed?.lang] ? parsed.lang : 'uz';
 
    // Hech narsa aytilmagan bo'lsa (shovqin, jimlik) — limitni sarflamaymiz.
    if (!transcript && !reply) {
      return Response.json({ empty: true, transcript: '', reply: '', mood, audio: null });
    }
 
    // Ovoz: til + kayfiyatga mos ohang.
    let audio = null;
    try {
      const style = `${LANG_PREFIX[lang]}, ${MOOD_TONE[mood]}`;
      audio = await generateSpeechMp3(ai, reply.slice(0, 1200), style);
    } catch (err) {
      // Ovoz chiqmasa ham javob MATNI ko'rinadi — suhbat to'xtab qolmaydi.
      console.error('Jonli suhbat — ovoz yaratishda xato:', err?.message || err);
    }
 
    // Limitni faqat haqiqiy javob bo'lganda sarflaymiz.
    let planPayload = null;
    if (plan && typeof usageLimit === 'number') {
      recordUsage(userState, cooldownHours);
      saveUserState(email, userState).catch((err) => console.error('Limit saqlashda xato:', err));
      const win = getUsageWindow(userState, cooldownHours);
      planPayload = {
        id: plan.id,
        name: plan.name,
        mode,
        limit: usageLimit,
        used: win.count,
        remaining: Math.max(0, usageLimit - win.count),
        resetAt: win.unlockAt || null,
      };
    }
 
    return Response.json({ transcript, reply, mood, lang, audio, plan: planPayload });
  } catch (err) {
    console.error('Jonli suhbat xatosi:', err);
    return Response.json({ error: "Javob olib bo'lmadi — birozdan keyin qayta urinib ko'ring." }, { status: 500 });
  }
}
 