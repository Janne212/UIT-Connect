import type { EmailOtpType } from '@supabase/supabase-js';
import { NextResponse, type NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';

// Nhận liên kết trong email (xác nhận đăng ký, đặt lại mật khẩu), đổi token_hash thành phiên.
// Mẫu email Supabase: {{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=email
//                     (reset password: &type=recovery&next=/reset-password)
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const tokenHash = searchParams.get('token_hash');
  const type = searchParams.get('type') as EmailOtpType | null;
  const next = searchParams.get('next') ?? '/dashboard';
  const safeNext = next.startsWith('/') && !next.startsWith('//') && !next.startsWith('/\\') ? next : '/dashboard';

  if (tokenHash && type) {
    const supabase = await createClient();
    const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });
    if (!error) return NextResponse.redirect(new URL(safeNext, request.url));
  }
  // Liên kết sai hoặc hết hạn: quay về đăng nhập kèm lỗi để cho yêu cầu lại
  const target = type === 'recovery' ? '/forgot-password?error=expired' : '/login?error=confirm';
  return NextResponse.redirect(new URL(target, request.url));
}
