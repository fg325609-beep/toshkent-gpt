import { auth } from '@/auth';
import { isAdminEmail } from '../../_lib/admin';
 
// Admin sahifasi TO'LIQ yashirin bo'lishi kerak — admin bo'lmagan hech kim
// PIN kiritish oynasini ham ko'rmasligi lozim. Shu sabab sahifa ochilishidan
// OLDIN, mana shu tekshiruv chaqiriladi.
export async function GET() {
  const session = await auth();
  const email = session?.user?.email;
 
  const isAdmin = await isAdminEmail(email);
  return Response.json({ isAdmin });
}
 