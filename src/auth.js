import NextAuth from 'next-auth';
import Google from 'next-auth/providers/google';

// JWT (stateless) sessiya — alohida ma'lumotlar bazasi shart emas.
// Google orqali kirgan foydalanuvchi ma'lumotlari (ism, email, rasm) token ichida saqlanadi.
export const { handlers, signIn, signOut, auth } = NextAuth({
  session: { strategy: 'jwt' },
  trustHost: true,
  providers: [
    Google({
      clientId: process.env.AUTH_GOOGLE_ID,
      clientSecret: process.env.AUTH_GOOGLE_SECRET,
    }),
  ],
});
