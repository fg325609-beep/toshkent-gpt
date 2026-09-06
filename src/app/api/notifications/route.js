import { auth } from '@/auth';
import { getNotificationHistory } from '../_lib/push';
 
export async function GET() {
  const session = await auth();
  if (!session?.user?.email) {
    return Response.json({ error: 'Kirish talab qilinadi.' }, { status: 401 });
  }
 
  const notifications = await getNotificationHistory(30);
  return Response.json({ notifications });
}
 