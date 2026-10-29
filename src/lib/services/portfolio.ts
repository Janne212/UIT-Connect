import type { z } from 'zod';
import type { DB } from '@/lib/db';
import { mapDbError } from '@/lib/errors';
import type { portfolioItemSchema } from '@/lib/validation/schemas';
import type { ActionState } from '@/types';

export type PortfolioItemInput = z.infer<typeof portfolioItemSchema>;

function itemColumns(input: PortfolioItemInput) {
  return {
    title: input.title,
    summary: input.summary,
    source_url: input.source_url,
    cover_image_url: input.cover_image_url ?? null,
    started_on: input.started_on ?? null,
    finished_on: input.finished_on ?? null,
    paper_application: input.kind === 'paper' ? input.paper_application ?? null : null,
    advisor_id: input.kind === 'project' ? input.advisor_id ?? null : null,
  };
}

// Tạo project/product/paper. Trigger trg_item_insert luôn đặt pending_review + hạn duyệt, ghi đè created_by.
// Tag và thành viên ghi sau; nếu lỗi thì xóa bài vừa tạo (bài chưa duyệt nên policy cho xóa) để không để lại dữ liệu dở.
export async function createPortfolioItem(db: DB, userId: string, input: PortfolioItemInput): Promise<ActionState> {
  const { data, error } = await db
    .from('portfolio_items')
    .insert({
      ...itemColumns(input),
      team_id: input.team_id,
      kind: input.kind,
      parent_id: input.kind === 'project' ? null : input.parent_id ?? null,
      created_by: userId,
    })
    .select('id')
    .single();
  if (error) return { error: mapDbError(error) };

  const linkError = await replaceItemLinks(db, data.id, input);
  if (linkError) {
    await db.from('portfolio_items').delete().eq('id', data.id);
    return { error: linkError };
  }
  return { ok: true, id: data.id, message: 'Đã gửi bài, vui lòng chờ giảng viên duyệt' };
}

// Sửa nội dung (không đổi được loại, nhóm, project cha, trạng thái duyệt — guard trong DB chặn)
export async function updatePortfolioItem(db: DB, id: string, input: PortfolioItemInput): Promise<ActionState> {
  const { data, error } = await db
    .from('portfolio_items')
    .update(itemColumns(input))
    .eq('id', id)
    .select('id')
    .maybeSingle();
  if (error) return { error: mapDbError(error) };
  if (!data) return { error: 'Không tìm thấy bài hoặc bạn không có quyền sửa' };
  const linkError = await replaceItemLinks(db, id, input);
  if (linkError) return { error: linkError };
  return { ok: true, id, message: 'Đã lưu thay đổi' };
}

async function replaceItemLinks(db: DB, itemId: string, input: PortfolioItemInput): Promise<string | null> {
  const delTags = await db.from('item_tags').delete().eq('item_id', itemId);
  if (delTags.error) return mapDbError(delTags.error);
  if (input.tag_ids.length) {
    const { error } = await db.from('item_tags').insert([...new Set(input.tag_ids)].map((tag_id) => ({ item_id: itemId, tag_id })));
    if (error) return mapDbError(error);
  }
  const delMembers = await db.from('item_members').delete().eq('item_id', itemId);
  if (delMembers.error) return mapDbError(delMembers.error);
  const members = dedupeMembers(input.members);
  if (members.length) {
    const { error } = await db.from('item_members').insert(
      members.map((m) => ({ item_id: itemId, team_id: input.team_id, profile_id: m.profile_id, role_label: m.role_label ?? null })),
    );
    if (error) return error.code === '23503' ? 'Thành viên được chọn phải thuộc nhóm đăng bài' : mapDbError(error);
  }
  return null;
}

function dedupeMembers(members: PortfolioItemInput['members']) {
  const seen = new Map<string, PortfolioItemInput['members'][number]>();
  for (const m of members) seen.set(m.profile_id, m);
  return [...seen.values()];
}

// Xóa: bài chưa duyệt -> xóa cứng (policy items_delete); bài đã duyệt -> xóa mềm qua RPC
export async function deletePortfolioItem(db: DB, id: string): Promise<ActionState> {
  const { data: item, error } = await db.from('portfolio_items').select('id, review_status').eq('id', id).maybeSingle();
  if (error) return { error: mapDbError(error) };
  if (!item) return { error: 'Không tìm thấy bài' };
  if (item.review_status === 'approved') {
    const res = await db.rpc('rpc_soft_delete_content', { p_entity: 'portfolio_item', p_id: id });
    if (res.error) return { error: mapDbError(res.error) };
  } else {
    const res = await db.from('portfolio_items').delete().eq('id', id).select('id');
    if (res.error) return { error: mapDbError(res.error) };
    if (!res.data.length) return { error: 'Bạn không có quyền xóa bài này' };
  }
  return { ok: true, message: 'Đã xóa bài' };
}

export async function resubmitContent(db: DB, entity: 'portfolio_item' | 'business_problem', id: string): Promise<ActionState> {
  const { error } = await db.rpc('rpc_resubmit_content', { p_entity: entity, p_id: id });
  if (error) return { error: mapDbError(error) };
  return { ok: true, message: 'Đã gửi lại, vui lòng chờ duyệt' };
}
