import type { z } from 'zod';
import type { DB } from '@/lib/db';
import { ATTACHMENT_BUCKET } from '@/lib/constants';
import { mapDbError } from '@/lib/errors';
import { sqlNull } from '@/lib/utils';
import type {
  attachmentRecordSchema,
  createConnectionSchema,
  endConnectionSchema,
  extendConnectionSchema,
  respondConnectionSchema,
} from '@/lib/validation/schemas';
import type { ActionState } from '@/types';

// Gửi yêu cầu kết nối (cả hai chiều — RPC tự xác định chiều theo vai trò người gọi).
// Proposal dạng LIÊN KẾT được ghi ngay; proposal dạng TỆP do trình duyệt tải thẳng lên Storage sau khi
// có id kết nối, rồi gọi recordAttachment (đường dẫn Storage phải bắt đầu bằng id kết nối).
export async function createConnectionRequest(
  db: DB, userId: string, input: z.infer<typeof createConnectionSchema>,
): Promise<ActionState> {
  const { data: id, error } = await db.rpc('rpc_create_connection_request', {
    p_problem: input.problemId,
    p_team: input.teamId,
    p_item: sqlNull(input.itemId),
    p_message: sqlNull(input.message),
    p_ttl_days: input.ttlDays,
  });
  if (error) return { error: mapDbError(error) };

  if (input.attachmentUrl) {
    const att = await db.from('connection_attachments').insert({
      connection_id: id, kind: 'proposal', external_url: input.attachmentUrl, uploaded_by: userId,
    });
    if (att.error) {
      return { ok: true, id, error: `Đã gửi yêu cầu nhưng chưa lưu được liên kết đề xuất: ${mapDbError(att.error)}` };
    }
  }
  return { ok: true, id, message: 'Đã gửi yêu cầu kết nối' };
}

// Ghi dòng connection_attachments cho tệp đã tải lên bucket. RLS ca_insert kiểm tra người gọi thấy được kết nối.
export async function recordAttachment(db: DB, userId: string, input: z.infer<typeof attachmentRecordSchema>): Promise<ActionState> {
  if (!input.storagePath.startsWith(`${input.connectionId}/`)) {
    return { error: 'Đường dẫn tệp không khớp kết nối' };
  }
  const { data, error } = await db
    .from('connection_attachments')
    .insert({
      connection_id: input.connectionId,
      kind: input.kind,
      file_name: input.fileName,
      storage_path: input.storagePath,
      mime_type: input.mimeType ?? null,
      size_bytes: input.sizeBytes,
      uploaded_by: userId,
    })
    .select('id')
    .single();
  if (error) {
    // không để tệp mồ côi trong bucket khi không ghi được dòng tham chiếu
    await db.storage.from(ATTACHMENT_BUCKET).remove([input.storagePath]);
    return { error: mapDbError(error) };
  }
  return { ok: true, id: data.id, message: 'Đã đính kèm tệp' };
}

export async function respondConnection(db: DB, input: z.infer<typeof respondConnectionSchema>): Promise<ActionState> {
  const { error } = await db.rpc('rpc_respond_connection', {
    p_id: input.id,
    p_accept: input.decision === 'accept',
    p_message: sqlNull(input.message),
  });
  if (error) return { error: mapDbError(error) };
  return { ok: true, id: input.id, message: input.decision === 'accept' ? 'Đã đồng ý kết nối' : 'Đã từ chối yêu cầu' };
}

export async function endConnection(db: DB, userId: string, input: z.infer<typeof endConnectionSchema>): Promise<ActionState> {
  const { error } = await db.rpc('rpc_end_connection', {
    p_id: input.id,
    p_outcome: input.outcome,
    p_reason: sqlNull(input.reason),
    p_rating: sqlNull(input.outcome === 'completed' ? input.rating : undefined),
    p_feedback: sqlNull(input.outcome === 'completed' ? input.feedback : undefined),
  });
  if (error) return { error: mapDbError(error) };

  if (input.outcome === 'completed' && input.deliverableUrl) {
    const att = await db.from('connection_attachments').insert({
      connection_id: input.id, kind: 'deliverable', external_url: input.deliverableUrl, uploaded_by: userId,
    });
    if (att.error) return { ok: true, id: input.id, error: `Đã hoàn thành nhưng chưa lưu được liên kết bàn giao: ${mapDbError(att.error)}` };
  }
  return { ok: true, id: input.id, message: input.outcome === 'completed' ? 'Đã đánh dấu hoàn thành' : 'Đã dừng kết nối' };
}

export async function extendConnection(db: DB, input: z.infer<typeof extendConnectionSchema>): Promise<ActionState> {
  // Hạn mới tính đến cuối ngày đã chọn theo giờ Việt Nam
  const newEnd = new Date(`${input.newEnd}T23:59:59+07:00`).toISOString();
  const { error } = await db.rpc('rpc_extend_connection', { p_id: input.id, p_new_end: newEnd, p_reason: sqlNull(input.reason) });
  if (error) return { error: mapDbError(error) };
  return { ok: true, id: input.id, message: 'Đã gia hạn thời gian thực hiện' };
}
