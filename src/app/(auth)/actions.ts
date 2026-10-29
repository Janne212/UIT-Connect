'use server';

import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getCurrentProfile } from '@/lib/auth/session';
import { upsertCompany } from '@/lib/services/accounts';
import { zodErrorState } from '@/lib/errors';
import { formToObject } from '@/lib/validation/form';
import { forgotPasswordSchema, loginSchema, registerSchema, resetPasswordSchema } from '@/lib/validation/schemas';
import type { ActionState } from '@/types';

// Chỉ chấp nhận đường dẫn nội bộ để tránh chuyển hướng ra ngoài site (open redirect)
function safeNext(value: FormDataEntryValue | null): string {
  const next = typeof value === 'string' ? value : '';
  return next.startsWith('/') && !next.startsWith('//') && !next.startsWith('/\\') ? next : '/dashboard';
}

// ---------------------------------------------------------------- Chức năng 1: Đăng nhập
export async function signIn(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = loginSchema.safeParse(formToObject(formData));
  if (!parsed.success) return zodErrorState(parsed.error);
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error) {
    if (error.code === 'email_not_confirmed') return { error: 'Tài khoản chưa xác nhận email. Hãy mở thư xác nhận rồi đăng nhập lại.' };
    if (error.code === 'user_banned') return { error: 'Tài khoản đã bị khóa. Hãy liên hệ quản trị viên.' };
    return { error: 'Email hoặc mật khẩu không đúng' }; // đúng câu trong acceptance criteria
  }
  // Điều hướng theo vai trò: /dashboard tự hiển thị dashboard quản lý (giảng viên) hoặc trang chủ (sv/dn)
  redirect(safeNext(formData.get('next')));
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect('/login');
}

// ---------------------------------------------------------------- Đăng ký (sinh viên hoặc doanh nghiệp)
export async function signUp(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = registerSchema.safeParse(formToObject(formData));
  if (!parsed.success) return zodErrorState(parsed.error);
  const input = parsed.data;

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email: input.email,
    password: input.password,
    options: {
      // trigger handle_new_user chỉ nhận role student|company; giá trị khác thành student
      data: { full_name: input.full_name, role: input.role },
      emailRedirectTo: `${process.env.NEXT_PUBLIC_SITE_URL}/auth/confirm`,
    },
  });
  if (error) {
    if (error.code === 'user_already_exists' || error.code === 'email_exists') return { error: 'Email đã được sử dụng', fieldErrors: { email: 'Email đã được sử dụng' } };
    if (error.code === 'weak_password') return { error: 'Mật khẩu quá yếu', fieldErrors: { password: 'Mật khẩu quá yếu' } };
    return { error: 'Không đăng ký được. Hãy kiểm tra lại thông tin.' };
  }
  // Khi bật "Confirm email", Supabase trả user không có identity cho email đã tồn tại (để không lộ email)
  if (data.user && data.user.identities?.length === 0) {
    return { error: 'Email đã được sử dụng', fieldErrors: { email: 'Email đã được sử dụng' } };
  }

  // Nếu Supabase tắt xác nhận email thì đã có phiên: lưu luôn phần hồ sơ còn lại của form đăng ký.
  // Nếu bật xác nhận email thì người dùng điền sau trong trang Hồ sơ / Hồ sơ doanh nghiệp.
  let note = '';
  if (data.session && data.user) {
    if (input.role === 'student' && (input.major || input.cohort)) {
      await supabase.from('profiles').update({ major: input.major ?? null, cohort: input.cohort ?? null }).eq('id', data.user.id);
    }
    if (input.role === 'company' && input.company) {
      const res = await upsertCompany(supabase, data.user.id, input.company);
      if (res?.error) note = '&company=failed';
    }
    // Acceptance criteria: đăng ký xong chuyển sang mục Đăng nhập
    await supabase.auth.signOut();
  }
  redirect(`/login?registered=${data.session ? '1' : 'confirm'}${note}`);
}

// ---------------------------------------------------------------- Quên / đặt lại mật khẩu
export async function requestPasswordReset(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = forgotPasswordSchema.safeParse(formToObject(formData));
  if (!parsed.success) return zodErrorState(parsed.error);
  const supabase = await createClient();
  await supabase.auth.resetPasswordForEmail(parsed.data.email, {
    redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL}/auth/confirm?next=/reset-password`,
  });
  // Luôn trả cùng một câu để không lộ email nào đã đăng ký
  return { ok: true, message: 'Nếu email đã đăng ký, bạn sẽ nhận được liên kết đặt lại mật khẩu.' };
}

export async function updatePassword(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const profile = await getCurrentProfile();
  if (!profile) return { error: 'Liên kết đặt lại mật khẩu đã hết hạn. Hãy yêu cầu lại.' };
  const parsed = resetPasswordSchema.safeParse(formToObject(formData));
  if (!parsed.success) return zodErrorState(parsed.error);
  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ password: parsed.data.password });
  if (error) return { error: error.code === 'same_password' ? 'Mật khẩu mới phải khác mật khẩu cũ' : 'Không đổi được mật khẩu, hãy thử lại' };
  await supabase.auth.signOut();
  redirect('/login?reset=1');
}
