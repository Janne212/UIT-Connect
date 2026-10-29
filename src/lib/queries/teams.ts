import type { DB } from '@/lib/db';

const MEMBER_PROFILE = 'profiles(id, full_name, avatar_url, headline, major, cohort)';

// Các nhóm mà người dùng là thành viên (kèm vai trò của họ trong nhóm)
export async function listMyTeams(db: DB, userId: string) {
  const { data, error } = await db
    .from('team_members')
    .select('member_role, joined_at, student_teams(id, name, description, avatar_url, created_at)')
    .eq('profile_id', userId)
    .order('joined_at', { ascending: false });
  if (error) throw error;
  return data
    .filter((r) => r.student_teams)
    .map((r) => ({ ...r.student_teams!, my_role: r.member_role }));
}

// Nhóm mà người dùng là nhóm trưởng (chỉ nhóm trưởng gửi/phản hồi yêu cầu kết nối)
export async function listMyLeaderTeams(db: DB, userId: string) {
  const teams = await listMyTeams(db, userId);
  return teams.filter((t) => t.my_role === 'leader');
}

export async function getTeam(db: DB, teamId: string) {
  const { data, error } = await db
    .from('student_teams')
    .select(`id, name, description, avatar_url, created_by, created_at,
             team_members(member_role, joined_at, ${MEMBER_PROFILE})`)
    .eq('id', teamId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

// Lịch sử hợp tác (đang thực hiện / hoàn thành / đã dừng) — "portfolio" của nhóm
export async function getTeamEngagements(db: DB, teamId: string) {
  const { data, error } = await db
    .from('v_team_engagements')
    .select('connection_id, problem_title, company_name, status, started_at, ended_at, end_reason, end_rating, end_feedback')
    .eq('team_id', teamId)
    .order('started_at', { ascending: false });
  if (error) throw error;
  return data;
}

// Sản phẩm đã duyệt của nhóm (doanh nghiệp xem; nhóm thấy cả bài chưa duyệt của mình qua RLS)
export async function listTeamItems(db: DB, teamId: string, onlyApproved = false) {
  let query = db
    .from('portfolio_items')
    .select('id, kind, title, parent_id, review_status, review_note, created_at')
    .eq('team_id', teamId)
    .is('deleted_at', null)
    .order('created_at', { ascending: false });
  if (onlyApproved) query = query.eq('review_status', 'approved');
  const { data, error } = await query;
  if (error) throw error;
  return data;
}

// Tìm sinh viên theo tên (có dấu hoặc không dấu) để thêm vào nhóm.
// rpc_search_students là SECURITY INVOKER: RLS + quyền cột vẫn áp dụng, không trả email.
export async function searchStudents(db: DB, keyword: string, excludeIds: string[] = []) {
  const q = keyword.trim();
  if (q.length < 2) return [];
  const { data, error } = await db.rpc('rpc_search_students', { p_query: q.slice(0, 100), p_limit: 20 });
  if (error) throw error;
  const excluded = new Set(excludeIds);
  return data.filter((p) => !excluded.has(p.id));
}

// Danh mục nhóm (doanh nghiệp duyệt để mời)
export async function listTeams(db: DB, page = 1, pageSize = 24) {
  const { data, error, count } = await db
    .from('student_teams')
    .select('id, name, description, avatar_url, created_at', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range((page - 1) * pageSize, page * pageSize - 1);
  if (error) throw error;
  return { rows: data, total: count ?? 0 };
}
