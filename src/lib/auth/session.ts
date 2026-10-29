import 'server-only';
import { cache } from 'react';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import type { Role } from '@/types';

// Cột email của profiles bị khóa với client -> KHÔNG BAO GIỜ select('*') trên profiles.
export const PROFILE_COLUMNS =
  'id, role, full_name, avatar_url, headline, bio, major, cohort, is_active, created_at, updated_at' as const;

// Hồ sơ của người đang đăng nhập (cache theo request). null = chưa đăng nhập.
export const getCurrentProfile = cache(async () => {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const userId = data?.claims?.sub;
  if (!userId) return null;
  const { data: profile } = await supabase.from('profiles').select(PROFILE_COLUMNS).eq('id', userId).single();
  return profile;
});

// Điều hướng gọn gàng theo vai trò. Không thay thế RLS/RPC: nếu bị bỏ qua, database vẫn từ chối.
export async function requireRole(...roles: Role[]) {
  const profile = await getCurrentProfile();
  if (!profile) redirect('/login');
  if (!profile.is_active) redirect('/dashboard');
  if (roles.length > 0 && !roles.includes(profile.role)) redirect('/dashboard?error=forbidden');
  return profile;
}

export function isStaff(role: Role | undefined | null) {
  return role === 'lecturer' || role === 'admin';
}
