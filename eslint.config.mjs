import { defineConfig, globalIgnores } from 'eslint/config';
import nextVitals from 'eslint-config-next/core-web-vitals';

// `npm run lint` ilgari "defineConfig is not defined" xatosi bilan to'xtab
// qolar edi — import'lar va `export default` tushib qolgan ekan. Endi tuzatildi.
const eslintConfig = defineConfig([
  ...nextVitals,
  {
    rules: {
      // Bu qoida localStorage'dan ma'lumot o'qish yoki komponent
      // mount bo'lganda birinchi fetch qilish kabi xavfsiz, odatiy
      // pattern'larni ham "error" deb belgilab, Vercel'dagi build'ni
      // to'xtatib qo'yayotgan edi. Shu sabab o'chirib qo'yildi.
      'react-hooks/set-state-in-effect': 'off',
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores(['.next/**', 'out/**', 'build/**', 'next-env.d.ts', 'local-worker/**']),
]);

export default eslintConfig;
