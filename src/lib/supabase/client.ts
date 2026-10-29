import { createBrowserClient } from '@supabase/ssr';
import type { Database } from '@/types/database';

// Supabase client chạy trong trình duyệt. Chỉ dùng cho việc bắt buộc ở trình duyệt:
// tải tệp đính kèm thẳng lên Storage (tránh giới hạn kích thước body của Server Action/Vercel).
export function createClient() {
  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
  );
}
