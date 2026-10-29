import 'server-only';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { connection } from 'next/server';
import type { Database } from '@/types/database';

// Supabase client chạy trên server (Server Component, Server Action, Route Handler).
// Mang phiên của người dùng qua cookie nên RLS và RPC kiểm tra đúng người gọi.
export async function createClient() {
  // Next.js 16 (cacheComponents): supabase-js đọc Date.now() khi nạp phiên. connection() báo cho Next
  // đây là dữ liệu theo request, tránh lỗi "unstable value Date.now() while prerendering".
  await connection();
  const cookieStore = await cookies();
  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
          } catch {
            // Server Component không ghi được cookie; src/proxy.ts đã làm mới phiên trước đó.
          }
        },
      },
    },
  );
}
