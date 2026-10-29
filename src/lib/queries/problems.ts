import type { DB } from '@/lib/db';
import { PAGE_SIZE } from '@/lib/constants';
import { normalizeKeyword } from '@/lib/utils';
import type { SolveStatus } from '@/types';

export type ProblemSearch = { q?: string; tagIds?: number[]; onlyOpen?: boolean; page?: number; pageSize?: number };

const CARD_COLUMNS = `id, title, description, estimated_duration_days, solve_status, created_at, extra,
  companies(id, name, logo_url),
  problem_tags(tags(id, kind, name, slug))`;

export type ProblemCard = {
  id: string;
  title: string;
  description: string;
  estimated_duration_days: number;
  solve_status: SolveStatus;
  created_at: string;
  extra: Record<string, unknown>;
  companies: { id: string; name: string; logo_url: string | null } | null;
  problem_tags: { tags: { id: number; kind: 'field' | 'skill'; name: string; slug: string } | null }[];
};

// Danh sách bài toán ĐÃ DUYỆT, mới nhất trước; lọc theo lĩnh vực/kỹ năng và từ khóa (không dấu)
export async function searchProblems(db: DB, opts: ProblemSearch = {}) {
  const page = Math.max(opts.page ?? 1, 1);
  const size = opts.pageSize ?? PAGE_SIZE;
  const tagIds = opts.tagIds ?? [];
  const columns = tagIds.length ? `${CARD_COLUMNS}, tag_filter:problem_tags!inner(tag_id)` : CARD_COLUMNS;

  let query = db
    .from('business_problems')
    .select(columns, { count: 'exact' })
    .eq('review_status', 'approved')
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
    .range((page - 1) * size, page * size - 1);

  if (opts.onlyOpen) query = query.eq('solve_status', 'open');
  if (tagIds.length) query = query.in('tag_filter.tag_id', tagIds);
  const keyword = normalizeKeyword(opts.q);
  if (keyword) query = query.textSearch('search_tsv', keyword, { type: 'plain', config: 'simple' });

  const { data, error, count } = await query.overrideTypes<ProblemCard[], { merge: false }>();
  if (error) throw error;
  return { rows: data, total: count ?? 0, page, pageSize: size };
}

// Trang chi tiết bài toán: luôn kèm thông tin doanh nghiệp đăng (Requirement mục 3)
export async function getProblem(db: DB, id: string) {
  const { data, error } = await db
    .from('business_problems')
    .select(`id, title, description, expected_outcome, estimated_duration_days, extra, solve_status,
             review_status, review_note, review_submitted_at, review_expires_at, reviewed_at, deleted_at,
             company_id, created_at, updated_at,
             companies(id, owner_id, name, industry, size_range, website, description, logo_url, address, contact_email),
             problem_tags(tags(id, kind, name, slug))`)
    .eq('id', id)
    .maybeSingle();
  if (error) throw error;
  return data;
}

// Bài toán của doanh nghiệp đang đăng nhập (mọi trạng thái) — trang quản lý, bảng theo dõi, chọn bài toán để mời nhóm
export async function listCompanyProblems(db: DB, companyId: string, opts: { onlyOpenApproved?: boolean } = {}) {
  let query = db
    .from('business_problems')
    .select('id, title, solve_status, review_status, review_note, review_submitted_at, review_expires_at, reviewed_at, created_at')
    .eq('company_id', companyId)
    .is('deleted_at', null)
    .order('created_at', { ascending: false });
  if (opts.onlyOpenApproved) query = query.eq('review_status', 'approved').eq('solve_status', 'open');
  const { data, error } = await query;
  if (error) throw error;
  return data;
}
