import type { z } from 'zod';
import type { DB } from '@/lib/db';
import { mapDbError } from '@/lib/errors';
import { sqlNull } from '@/lib/utils';
import type { reviewSchema } from '@/lib/validation/schemas';
import type { ActionState } from '@/types';

// Giảng viên/điều phối duyệt hoặc từ chối bài đăng (RPC ghi người xử lý, thời gian, lý do; bài đã xử lý không xử lý lại)
export async function submitReview(db: DB, input: z.infer<typeof reviewSchema>): Promise<ActionState> {
  const { error } = await db.rpc('rpc_submit_review', {
    p_entity: input.entity,
    p_id: input.id,
    p_approve: input.decision === 'approve',
    p_note: sqlNull(input.note),
  });
  if (error) return { error: mapDbError(error) };
  return { ok: true, id: input.id, message: input.decision === 'approve' ? 'Đã duyệt bài' : 'Đã từ chối bài' };
}

export async function markNotificationsRead(db: DB, ids: string[] | 'all'): Promise<ActionState> {
  // Client chỉ được cập nhật cột read_at (quyền theo cột); RLS chỉ cho thông báo của mình
  let query = db.from('notifications').update({ read_at: new Date().toISOString() }).is('read_at', null);
  if (ids !== 'all') query = query.in('id', ids);
  const { error } = await query;
  if (error) return { error: mapDbError(error) };
  return { ok: true };
}
