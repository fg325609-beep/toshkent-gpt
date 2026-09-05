import { getUserProfile, saveUserProfile } from './user-profile';
 
// ============================================================
// "Sohaviy bilim" (mutaxassislik) tizimi — foydalanuvchi o'z kasbini
// (masalan "Stomatologiya", "Yurist") va shu sohaga oid hujjat(lar)ni
// bersa, AI o'sha materialdan QISQA "yo'riqnoma" tuzadi va buni
// foydalanuvchi profiliga saqlaydi. Shu yo'riqnoma keyinchalik HAR BIR
// suhbatda tizim ko'rsatmasiga (system instruction) qo'shiladi — shunda
// bot o'sha soha bo'yicha maxsus tayyorlangan yordamchiga aylanadi,
// dasturchi HAR BIR SOHANI qo'lda o'rgatib o'tirishi shart emas.
// ============================================================
 
const MAX_SOURCE_CHARS = 15000; // Gemini'ga yuboriladigan xom matn chegarasi
 
export async function teachExpertise(ai, model, email, field, documentText) {
  const prompt = `Sen "${field}" sohasida ishlaydigan mutaxassisga AI yordamchi tayyorlayapsan.
 
${documentText?.trim() ? 'Quyida shu soha bo\'yicha material (hujjat) berilgan. Shu materialdan va soha nomidan' : 'Faqat soha nomidan'} foydalanib, QISQA (400-600 so'z) "yo'riqnoma" yoz — bu yo'riqnoma keyinchalik har bir suhbatda AI'ga ko'rsatma sifatida beriladi. Yo'riqnomada quyidagilar bo'lsin:
1. Shu soha odami odatda qanday ishlar/vazifalarni bajaradi
2. Qanday atamalar, hujjatlar, jarayonlar bilan ishlaydi
3. AI qanday yordam bera oladi (masalan: hujjat tahlili, maslahat, hisob-kitob, shablon tayyorlash)
 
Faqat yo'riqnomaning o'zini yoz (o'zbek tilida), boshqa hech qanday izoh yoki sarlavha qo'shma.
 
${documentText?.trim() ? `--- MATERIAL ---\n${documentText.slice(0, MAX_SOURCE_CHARS)}` : ''}`;
 
  const result = await ai.models.generateContent({ model, contents: prompt });
  const briefing = (result?.text || result?.candidates?.[0]?.content?.parts?.[0]?.text || '').trim();
 
  if (!briefing) {
    throw new Error("Yo'riqnoma tayyorlab bo'lmadi — birozdan keyin qayta urinib ko'ring.");
  }
 
  const profile = (await getUserProfile(email).catch(() => ({}))) || {};
  const mutaxassislik = { soha: field, bilim: briefing, updatedAt: new Date().toISOString() };
  const next = { ...profile, mutaxassislik };
  await saveUserProfile(email, next);
  return mutaxassislik;
}
 
export async function clearExpertise(email) {
  const profile = (await getUserProfile(email).catch(() => ({}))) || {};
  delete profile.mutaxassislik;
  await saveUserProfile(email, profile);
}
 