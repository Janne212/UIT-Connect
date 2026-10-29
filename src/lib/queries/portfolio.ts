import type { DB } from '@/lib/db';
import { PAGE_SIZE } from '@/lib/constants';
import { normalizeKeyword } from '@/lib/utils';
import type { ItemKind } from '@/types';

export type PortfolioSearch = { q?: string; kind?: ItemKind; tagIds?: number[]; page?: number; pageSize?: number };

const CARD_COLUMNS = `id, kind, title, summary, cover_image_url, source_url, team_id, created_at,
  student_teams(id, name),
  item_tags(tags(id, kind, name, slug))`;

// Danh mục project/product/paper ĐÃ DUYỆT, mới nhất trước; lọc theo loại, lĩnh vực/kỹ năng (tag) và từ khóa.
// Nhiều tag: lấy bài có ÍT NHẤT MỘT tag đã chọn.
export async function searchPortfolio(db: DB, opts: PortfolioSearch = {}) {
  const page = Math.max(opts.page ?? 1, 1);
  const size = opts.pageSize ?? PAGE_SIZE;
  const tagIds = opts.tagIds ?? [];
  const columns = tagIds.length ? `${CARD_COLUMNS}, tag_filter:item_tags!inner(tag_id)` : CARD_COLUMNS;

  let query = db
    .from('portfolio_items')
    .select(columns, { count: 'exact' })
    .eq('review_status', 'approved')
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
    .range((page - 1) * size, page * size - 1);

  if (opts.kind) query = query.eq('kind', opts.kind);
  if (tagIds.length) query = query.in('tag_filter.tag_id', tagIds);
  const keyword = normalizeKeyword(opts.q);
  if (keyword) query = query.textSearch('search_tsv', keyword, { type: 'plain', config: 'simple' });

  const { data, error, count } = await query.overrideTypes<PortfolioCard[], { merge: false }>();
  if (error) throw error;
  return { rows: data, total: count ?? 0, page, pageSize: size };
}

export type PortfolioCard = {
  id: string;
  kind: ItemKind;
  title: string;
  summary: string;
  cover_image_url: string | null;
  source_url: string;
  team_id: string;
  created_at: string;
  student_teams: { id: string; name: string } | null;
  item_tags: { tags: { id: number; kind: 'field' | 'skill'; name: string; slug: string } | null }[];
};

// Trang chi tiết project/product/paper: luôn kèm nhóm và danh sách thành viên (Requirement mục 3)
export async function getPortfolioItem(db: DB, id: string) {
  const { data, error } = await db
    .from('portfolio_items')
    .select(`id, kind, title, summary, source_url, cover_image_url, started_on, finished_on, paper_application,
             parent_id, team_id, review_status, review_note, review_submitted_at, review_expires_at, reviewed_at,
             deleted_at, created_by, created_at, updated_at,
             advisor:profiles!portfolio_items_advisor_id_fkey(id, full_name, headline),
             student_teams(id, name, description,
               team_members(member_role, profiles(id, full_name, avatar_url, headline, major, cohort))),
             item_tags(tags(id, kind, name, slug)),
             item_members(profile_id, role_label)`)
    .eq('id', id)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;

  // project cha (nếu là product/paper) và các product/paper con (nếu là project); RLS tự lọc bài chưa duyệt
  const [parent, children] = await Promise.all([
    data.parent_id
      ? db.from('portfolio_items').select('id, kind, title').eq('id', data.parent_id).maybeSingle()
      : Promise.resolve({ data: null, error: null }),
    data.kind === 'project'
      ? db.from('portfolio_items').select('id, kind, title, review_status').eq('parent_id', id).is('deleted_at', null)
      : Promise.resolve({ data: [], error: null }),
  ]);
  return { ...data, parent: parent.data, children: children.data ?? [] };
}

// Bài của các nhóm mình (mọi trạng thái kiểm duyệt) — dùng cho bảng theo dõi và trang quản lý
export async function listItemsOfTeams(db: DB, teamIds: string[]) {
  if (!teamIds.length) return [];
  const { data, error } = await db
    .from('portfolio_items')
    .select('id, kind, title, team_id, review_status, review_note, review_submitted_at, review_expires_at, reviewed_at, created_at, student_teams(name)')
    .in('team_id', teamIds)
    .is('deleted_at', null)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data;
}
