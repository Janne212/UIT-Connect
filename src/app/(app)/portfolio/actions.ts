'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { requireRole } from '@/lib/auth/session';
import { zodErrorState } from '@/lib/errors';
import { formToObject } from '@/lib/validation/form';
import { contentRefSchema, portfolioItemSchema } from '@/lib/validation/schemas';
import { createPortfolioItem, deletePortfolioItem, resubmitContent, updatePortfolioItem } from '@/lib/services/portfolio';
import type { ActionState } from '@/types';

// ---------------------------------------------------------------- Chức năng 2: Tạo/Thêm project/product/paper
// Publish với form hợp lệ -> bài ở "Chờ duyệt" -> chuyển tới Bảng theo dõi (lọc Chờ duyệt)
export async function createPortfolioItemAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const profile = await requireRole('student');
  const parsed = portfolioItemSchema.safeParse(formToObject(formData, ['tag_ids']));
  if (!parsed.success) return zodErrorState(parsed.error);
  const db = await createClient();
  const res = await createPortfolioItem(db, profile.id, parsed.data);
  if (!res?.ok) return res;
  revalidatePath('/connections');
  redirect(`/connections?status=review_pending_review&created=${res.id}`);
}

export async function updatePortfolioItemAction(id: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireRole('student');
  const parsed = portfolioItemSchema.safeParse(formToObject(formData, ['tag_ids']));
  if (!parsed.success) return zodErrorState(parsed.error);
  const db = await createClient();
  const res = await updatePortfolioItem(db, id, parsed.data);
  if (res?.ok) revalidatePath(`/portfolio/${id}`);
  return res;
}

export async function deletePortfolioItemAction(id: string, _prev: ActionState, _formData: FormData): Promise<ActionState> {
  await requireRole('student');
  const db = await createClient();
  const res = await deletePortfolioItem(db, id);
  if (!res?.ok) return res;
  revalidatePath('/portfolio');
  redirect('/connections');
}

// Gửi lại bài bị từ chối / hết hạn duyệt (dùng chung cho bài toán)
export async function resubmitContentAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireRole('student', 'company');
  const parsed = contentRefSchema.safeParse(formToObject(formData));
  if (!parsed.success) return { error: 'Yêu cầu không hợp lệ' };
  const db = await createClient();
  const res = await resubmitContent(db, parsed.data.entity, parsed.data.id);
  if (res?.ok) {
    revalidatePath(parsed.data.entity === 'portfolio_item' ? `/portfolio/${parsed.data.id}` : `/problems/${parsed.data.id}`);
    revalidatePath('/connections');
  }
  return res;
}
