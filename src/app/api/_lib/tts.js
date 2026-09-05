import lamejs from '@breezystack/lamejs';
 
// ============================================================
// Matnni ovozga aylantirish (TTS). Brauzerning o'zidagi (Web Speech API)
// ovozlar qurilmadan-qurilmaga farq qiladi va "Toshkent shevasi"ni
// kafolatlay olmaydi — shu sabab Gemini'ning maxsus ovoz modeli
// ishlatiladi: BARCHA foydalanuvchilar uchun BIR XIL, doimiy ovoz.
// ============================================================
 
const TTS_MODEL = process.env.GEMINI_TTS_MODEL || 'gemini-3.1-flash-tts-preview';
// Google'ning tayyor ovozlaridan biri — hech qachon o'zgarmaydi, shuning
// uchun har safar bir xil, tanish ovoz eshitiladi.
const VOICE_NAME = process.env.GEMINI_TTS_VOICE || 'Kore';
 
function parseSampleRate(mimeType) {
  const match = /rate=(\d+)/.exec(mimeType || '');
  return match ? Number(match[1]) : 24000;
}
 
/** Xom (raw) 16-bit PCM ma'lumotni (base64) haqiqiy MP3 fayl baytlariga aylantiradi. */
function pcmBase64ToMp3Buffer(base64Pcm, sampleRate) {
  const pcmBuffer = Buffer.from(base64Pcm, 'base64');
  const sampleCount = Math.floor(pcmBuffer.length / 2);
  const samples = new Int16Array(sampleCount);
  for (let i = 0; i < sampleCount; i++) {
    samples[i] = pcmBuffer.readInt16LE(i * 2);
  }
 
  const encoder = new lamejs.Mp3Encoder(1, sampleRate, 128);
  const chunks = [];
  const blockSize = 1152;
  for (let i = 0; i < samples.length; i += blockSize) {
    const chunk = samples.subarray(i, i + blockSize);
    const buf = encoder.encodeBuffer(chunk);
    if (buf.length > 0) chunks.push(Buffer.from(buf));
  }
  const end = encoder.flush();
  if (end.length > 0) chunks.push(Buffer.from(end));
 
  return Buffer.concat(chunks);
}
 
/**
 * Berilgan matnni Toshkentcha (koʻcha) shevasida, doimiy ovozda ovozga
 * aylantiradi va MP3 formatida (base64) qaytaradi.
 */
export async function generateSpeechMp3(ai, text) {
  // Gemini TTS "boshqariladigan" (controllable) — ya'ni matnning o'zida
  // uslub/shevani ko'rsatish orqali ohangni yo'naltirish mumkin.
  const styledPrompt = `Quyidagi matnni o'zbek tilida, samimiy Toshkent koʻcha shevasida, tabiiy va issiq ohangda, shoshilmasdan o'qib ber: ${text}`;
 
  const result = await ai.models.generateContent({
    model: TTS_MODEL,
    contents: styledPrompt,
    config: {
      responseModalities: ['AUDIO'],
      speechConfig: {
        voiceConfig: { prebuiltVoiceConfig: { voiceName: VOICE_NAME } },
      },
    },
  });
 
  const part = result?.candidates?.[0]?.content?.parts?.find((p) => p.inlineData?.data);
  if (!part) {
    throw new Error("Ovoz yaratib bo'lmadi — birozdan keyin qayta urinib ko'r.");
  }
 
  const sampleRate = parseSampleRate(part.inlineData.mimeType);
  const mp3Buffer = pcmBase64ToMp3Buffer(part.inlineData.data, sampleRate);
  return mp3Buffer.toString('base64');
}
 