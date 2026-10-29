import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database';

// Mọi hàm trong lib/queries và lib/services nhận client (và id người gọi khi cần) làm tham số:
//  - trang/Server Action truyền client của lib/supabase/server.ts (mang phiên người dùng -> RLS áp dụng)
//    và profile.id lấy từ requireRole()
//  - bộ test tests/backend truyền client đăng nhập bằng từng tài khoản thử
// Id người gọi chỉ dùng để LỌC dữ liệu cho gọn; quyền thật vẫn do RLS/RPC kiểm tra bằng auth.uid().
export type DB = SupabaseClient<Database>;
