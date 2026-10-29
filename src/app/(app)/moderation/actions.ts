'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { requireRole } from '@/lib/auth/session';
import { zodErrorState } from '@/lib/errors';
import { formToObject } from '@/lib/validation/form';
import { reviewSchema } from '@/lib/validation/schemas';
import { submitReview } from '@/lib/services/moderation';
import type { ActionState } from '@/types';

// Giảng viên/điều phối duyệt hoặc từ chối (bắt buộc lý do) bài đăng đang chờ
export async function submitReviewAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireRole('lecturer', 'admin');
  const parsed = reviewSchema.safeParse(formToObject(formData));
  if (!parsed.success) return zodErrorState(parsed.error);
  const db = await createClient();
  const res = await submitReview(db, parsed.data);
  if (res?.ok) { revalidatePath('/moderation'); revalidatePath('/dashboard'); }
  return res;
}
