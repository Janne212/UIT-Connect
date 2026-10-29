'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { requireRole } from '@/lib/auth/session';
import { zodErrorState } from '@/lib/errors';
import { formToObject } from '@/lib/validation/form';
import { problemSchema } from '@/lib/validation/schemas';
import { createProblem, deleteProblem, updateProblem } from '@/lib/services/problems';
import type { ActionState } from '@/types';

// ---------------------------------------------------------------- Chức năng 3: Tạo/Thêm bài toán doanh nghiệp
export async function createProblemAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const profile = await requireRole('company');
  const parsed = problemSchema.safeParse(formToObject(formData, ['tag_ids']));
  if (!parsed.success) return zodErrorState(parsed.error);
  const db = await createClient();
  const res = await createProblem(db, profile.id, parsed.data);
  if (!res?.ok) return res;
  revalidatePath('/connections');
  redirect(`/connections?status=review_pending_review&created=${res.id}`);
}

export async function updateProblemAction(id: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireRole('company');
  const parsed = problemSchema.safeParse(formToObject(formData, ['tag_ids']));
  if (!parsed.success) return zodErrorState(parsed.error);
  const db = await createClient();
  const res = await updateProblem(db, id, parsed.data);
  if (res?.ok) revalidatePath(`/problems/${id}`);
  return res;
}

export async function deleteProblemAction(id: string, _prev: ActionState, _formData: FormData): Promise<ActionState> {
  await requireRole('company');
  const db = await createClient();
  const res = await deleteProblem(db, id);
  if (!res?.ok) return res;
  revalidatePath('/problems');
  redirect('/connections');
}
