import { ImageIcon, Globe, Code2, Presentation } from 'lucide-react';
 
// ============================================================
// Maxsus buyruqlar — BITTA joyda saqlanadi, shunda bo'sh ekrandagi
// tugmalar ham, yozish qatoridagi "+" menyusi ham aynan bir xil
// ro'yxatni ko'rsatadi. Yangi buyruq qo'shsangiz, faqat shu yerga
// qo'shasiz — qolgan joylarda o'zi paydo bo'ladi.
// ============================================================
export const COMMANDS = [
  {
    id: 'rasm',
    short: 'Rasm',
    prefix: '/rasm ',
    icon: ImageIcon,
    label: 'Rasm yaratish',
    hint: 'Tavsifni yoz — chizib beraman',
    example: 'gitara chalayotgan mushuk',
  },
  {
    id: 'qidir',
    short: 'Qidiruv',
    prefix: '/qidir ',
    icon: Globe,
    label: 'Internetdan qidirish',
    hint: 'Eng soʻnggi maʼlumotni topib beraman',
    example: 'bugungi dollar kursi',
  },
  {
    id: 'kod',
    short: 'Kod',
    prefix: '/kod ',
    icon: Code2,
    label: 'Kod yozish',
    hint: 'Masalani ayt — kodini yozib beraman',
    example: 'fibonachchi ketma-ketligini chiz',
  },
  {
    id: 'prezentatsiya',
    short: 'Slayd',
    prefix: '/prezentatsiya ',
    icon: Presentation,
    label: 'Prezentatsiya',
    hint: 'Mavzu boʻyicha PowerPoint tayyorlayman',
    example: 'sunʼiy intellekt tarixi',
  },
];
 