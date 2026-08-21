/** @type {import('next').NextConfig} */
const nextConfig = {
  /* config options here */
  // O'CHIRILDI: React Compiler eksperimental xususiyat, va birinchi
  // muvaffaqiyatli state yangilanishidan keyin ba'zi tugmalar/menyular
  // "muzlab qolish" muammosiga sabab bo'layotgan edi (Sozlamalar menyusi
  // bir marta ishlagandan keyin qayta bosilmay qolishi). O'chirilgach,
  // React odatdagi (kompilyatorsiz) tarzda ishlaydi.
  // reactCompiler: true,
};

export default nextConfig;
