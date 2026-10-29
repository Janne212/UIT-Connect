import 'server-only';
import { createClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database';

// Client bằng secret key, BỎ QUA RLS. Chỉ dùng phía server sau khi đã requireRole('admin')
// (trang quản trị) hoặc trong dispatcher email có CRON_SECRET. Không import vào Client Component.
// Giai đoạn 1 chưa dùng; để sẵn cho giai đoạn 2 (admin/users, gửi email).
export function createAdminClient() {
  const key = process.env.SUPABASE_SECRET_KEY;
  if (!key) throw new Error('Thiếu biến môi trường SUPABASE_SECRET_KEY');
  return createClient<Database>(process.env.NEXT_PUBLIC_SUPABASE_URL!, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
