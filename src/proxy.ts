import type { NextRequest } from 'next/server';
import { updateSession } from '@/lib/supabase/proxy';

// Next.js 16: proxy.ts thay cho middleware.ts. Làm mới phiên và đưa người chưa đăng nhập về /login.
// Không phải chốt chặn bảo mật duy nhất: quyền thật nằm ở RLS và RPC trong database.
export async function proxy(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|images/).*)'],
};
