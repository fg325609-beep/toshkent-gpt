import { extractText, getDocumentProxy } from 'unpdf';
import mammoth from 'mammoth';
import * as XLSX from 'xlsx';
 
// ============================================================
// Turli fayl turlaridan (PDF, Word, Excel) matn chiqarish — "Sohaviy
// bilim" (mutaxassislik) tizimi uchun ishlatiladi: foydalanuvchi o'z
// sohasiga oid hujjat yuklaganda, undan matn olib, AI'ga "o'rgatish"
// uchun ishlatiladi.
// ============================================================
export async function extractDocumentText(base64Data, filename) {
  const buffer = Buffer.from(base64Data, 'base64');
  const ext = (filename || '').toLowerCase().split('.').pop();
 
  if (ext === 'pdf') {
    const pdfDoc = await getDocumentProxy(new Uint8Array(buffer));
    const { text } = await extractText(pdfDoc, { mergePages: true });
    return (text || '').trim();
  }
 
  if (ext === 'docx') {
    const result = await mammoth.extractRawText({ buffer });
    return (result.value || '').trim();
  }
 
  if (ext === 'xlsx' || ext === 'xls') {
    const workbook = XLSX.read(buffer, { type: 'buffer' });
    let allText = '';
    for (const sheetName of workbook.SheetNames) {
      const sheet = workbook.Sheets[sheetName];
      allText += `--- ${sheetName} ---\n${XLSX.utils.sheet_to_csv(sheet)}\n`;
    }
    return allText.trim();
  }
 
  throw new Error("Bu fayl turini o'qiy olmayman — faqat PDF, DOCX yoki XLSX qo'llab-quvvatlanadi.");
}