import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import type { Database } from '@/types/database';

// Đường dẫn không cần đăng nhập. Trang giới thiệu "/" công khai cho khách (Requirement nhóm 1).
const PUBLIC_PATHS = ['/login', '/register', '/forgot-password', '/auth', '/api/internal'];
const AUTH_ONLY_PAGES = ['/login', '/register', '/forgot-password'];

export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
        },
      },
    },
  );

  // getClaims() xác minh chữ ký JWT; không dùng getSession() trong mã server.
  const { data } = await supabase.auth.getClaims();
  const isLoggedIn = !!data?.claims;
  const path = request.nextUrl.pathname;
  const isPublic = path === '/' || PUBLIC_PATHS.some((p) => path === p || path.startsWith(p + '/'));

  if (!isLoggedIn && !isPublic) {
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    url.search = '';
    url.searchParams.set('next', path);
    return NextResponse.redirect(url);
  }
  if (isLoggedIn && (path === '/' || AUTH_ONLY_PAGES.includes(path))) {
    const url = request.nextUrl.clone();
    url.pathname = '/dashboard';
    url.search = '';
    return NextResponse.redirect(url);
  }
  return response;
}
