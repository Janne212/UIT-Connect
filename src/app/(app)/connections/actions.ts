'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { requireRole } from '@/lib/auth/session';
import { zodErrorState } from '@/lib/errors';
import { formToObject } from '@/lib/validation/form';
import {
  attachmentRecordSchema, createConnectionSchema, endConnectionSchema, extendConnectionSchema, respondConnectionSchema,
} from '@/lib/validation/schemas';
import {
  createConnectionRequest, endConnection, extendConnection, recordAttachment, respondConnection,
} from '@/lib/services/connections';
import type { ActionState } from '@/types';

// ---------------------------------------------------------------- Chức năng 4: Gửi yêu cầu kết nối
// Gọi từ cửa sổ xác nhận. Trả về id để trình duyệt tải tệp proposal (nếu có) lên Storage
// theo đường dẫn {id}/..., gọi recordAttachmentAction, rồi chuyển tới trang theo dõi kết nối.
export async function createConnectionRequestAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const profile = await requireRole('student', 'company');
  const parsed = createConnectionSchema.safeParse(formToObject(formData));
  if (!parsed.success) return zodErrorState(parsed.error);
  const db = await createClient();
  const res = await createConnectionRequest(db, profile.id, parsed.data);
  if (res?.ok) revalidatePath('/connections');
  return res;
}

export async function recordAttachmentAction(input: {
  connectionId: string; kind: 'proposal' | 'deliverable'; storagePath: string; fileName: string; mimeType?: string; sizeBytes: number;
}): Promise<ActionState> {
  const profile = await requireRole('student', 'company');
  const parsed = attachmentRecordSchema.safeParse(input);
  if (!parsed.success) return zodErrorState(parsed.error);
  const db = await createClient();
  const res = await recordAttachment(db, profile.id, parsed.data);
  if (res?.ok) revalidatePath(`/connections/${parsed.data.connectionId}`);
  return res;
}

// Bên nhận: đồng ý / từ chối (kèm nội dung gửi kèm)
export async function respondConnectionAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireRole('student', 'company');
  const parsed = respondConnectionSchema.safeParse(formToObject(formData));
  if (!parsed.success) return zodErrorState(parsed.error);
  const db = await createClient();
  const res = await respondConnection(db, parsed.data);
  if (res?.ok) { revalidatePath(`/connections/${parsed.data.id}`); revalidatePath('/connections'); }
  return res;
}

// Doanh nghiệp: hoàn thành (điểm 1–5, nhận xét, link bàn giao) hoặc dừng (lý do)
export async function endConnectionAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const profile = await requireRole('company');
  const parsed = endConnectionSchema.safeParse(formToObject(formData));
  if (!parsed.success) return zodErrorState(parsed.error);
  const db = await createClient();
  const res = await endConnection(db, profile.id, parsed.data);
  if (res?.ok) { revalidatePath(`/connections/${parsed.data.id}`); revalidatePath('/connections'); }
  return res;
}

export async function extendConnectionAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireRole('company');
  const parsed = extendConnectionSchema.safeParse(formToObject(formData));
  if (!parsed.success) return zodErrorState(parsed.error);
  const db = await createClient();
  const res = await extendConnection(db, parsed.data);
  if (res?.ok) revalidatePath(`/connections/${parsed.data.id}`);
  return res;
}
