import type { DB } from '@/lib/db';
import { ATTACHMENT_BUCKET } from '@/lib/constants';
import type { ConnectionStatus } from '@/types';

const LIST_COLUMNS =
  'id, status, direction, team_name, company_name, problem_title, item_title, created_at, expires_at, responded_at, started_at, expected_end_at, ended_at, response_days, execution_days, is_overdue, problem_id, team_id, item_id, requested_by, company_id';

// Kết nối người xem được phép thấy (view security_invoker -> RLS cr_read: các bên liên quan + staff)
export async function listConnections(db: DB, opts: { status?: ConnectionStatus[]; limit?: number } = {}) {
  let query = db.from('v_connection_dashboard').select(LIST_COLUMNS).order('created_at', { ascending: false });
  if (opts.status?.length) query = query.in('status', opts.status);
  if (opts.limit) query = query.limit(opts.limit);
  const { data, error } = await query;
  if (error) throw error;
  return data;
}

// Chi tiết một kết nối kèm bài toán, doanh nghiệp, nhóm, sản phẩm cầu nối, tệp đính kèm, lịch sử gia hạn
export async function getConnection(db: DB, id: string) {
  const { data, error } = await db
    .from('connection_requests')
    .select(`id, problem_id, team_id, item_id, direction, requested_by, message, status, expires_at,
             responded_by, responded_at, response_message, started_at, expected_end_at, ended_at,
             end_reason, end_rating, end_feedback, created_at, updated_at,
             business_problems(id, title, estimated_duration_days, solve_status,
               companies(id, owner_id, name, contact_email, phone, website)),
             student_teams(id, name, team_members(member_role, profiles(id, full_name, avatar_url))),
             portfolio_items!fk_cr_item(id, kind, title),
             connection_attachments(id, kind, file_name, storage_path, mime_type, size_bytes, external_url, uploaded_by, created_at),
             connection_extensions(id, previous_end_at, new_end_at, reason, created_at)`)
    .eq('id', id)
    .maybeSingle();
  if (error) throw error;
  return data;
}

// Kênh liên hệ ngoài của đối tác: RLS (app.can_view_contacts) chỉ trả dòng khi kết nối đang thực hiện / đã hoàn thành
export async function getPartnerContacts(db: DB, profileIds: string[]) {
  if (!profileIds.length) return [];
  const { data, error } = await db
    .from('profile_contacts')
    .select('profile_id, email, phone, zalo, other_url')
    .in('profile_id', profileIds);
  if (error) throw error;
  return data;
}

// Link tải tệp đính kèm có hạn (bucket private; policy storage chỉ cho các bên của kết nối)
export async function getAttachmentSignedUrl(db: DB, storagePath: string, expiresInSeconds = 120) {
  const { data, error } = await db.storage.from(ATTACHMENT_BUCKET).createSignedUrl(storagePath, expiresInSeconds);
  if (error) throw error;
  return data.signedUrl;
}
