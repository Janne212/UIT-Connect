import type { DB } from '@/lib/db';
import { CONNECTION_STATUS_LABEL, ITEM_KIND_LABEL, REVIEW_STATUS_LABEL } from '@/lib/constants';
import { listConnections } from '@/lib/queries/connections';
import { listItemsOfTeams } from '@/lib/queries/portfolio';
import { listCompanyProblems } from '@/lib/queries/problems';
import { getMyCompany } from '@/lib/queries/companies';
import { listMyTeams } from '@/lib/queries/teams';
import type { ConnectionStatus, ReviewStatus, Role } from '@/types';

// Bảng theo dõi trạng thái matching của sinh viên/nhóm và doanh nghiệp.
// Gộp hai nguồn trạng thái mà Task Description liệt kê chung một bảng:
//   - bài đăng của mình đang ở vòng kiểm duyệt: chờ duyệt / hết hạn duyệt / bị từ chối duyệt
//   - yêu cầu kết nối: chờ phản hồi / hết hạn phản hồi / bị từ chối / đang thực hiện / đã dừng / đã hoàn thành
export type TrackingStatus = ConnectionStatus | `review_${Exclude<ReviewStatus, 'approved'>}`;

export const TRACKING_STATUS_LABEL: Record<TrackingStatus, string> = {
  review_pending_review: REVIEW_STATUS_LABEL.pending_review,
  review_expired: REVIEW_STATUS_LABEL.expired,
  review_rejected: REVIEW_STATUS_LABEL.rejected,
  ...CONNECTION_STATUS_LABEL,
};

export type TrackingRow = {
  key: string;
  type: 'connection' | 'portfolio_item' | 'business_problem';
  id: string;
  title: string;
  detail: string;
  status: TrackingStatus;
  statusLabel: string;
  createdAt: string;
  deadline: string | null; // hạn duyệt / hạn phản hồi / hạn hoàn thành dự kiến
  endedAt: string | null;
  isOverdue: boolean;
  needsMyAction: boolean; // việc cần làm: phản hồi yêu cầu, gửi lại bài, cập nhật kết nối quá hạn
  href: string;
};

export async function getTrackingBoard(db: DB, user: { id: string; role: Role }, filter?: TrackingStatus) {
  const rows: TrackingRow[] = [];

  // 1) Bài đăng chưa được duyệt của mình
  if (user.role === 'student') {
    const teams = await listMyTeams(db, user.id);
    const leaderTeamIds = new Set(teams.filter((t) => t.my_role === 'leader').map((t) => t.id));
    const items = await listItemsOfTeams(db, teams.map((t) => t.id));
    for (const it of items) {
      if (it.review_status === 'approved') continue;
      const status = `review_${it.review_status}` as TrackingStatus;
      rows.push({
        key: `item-${it.id}`, type: 'portfolio_item', id: it.id, title: it.title,
        detail: `${ITEM_KIND_LABEL[it.kind]} · ${it.student_teams?.name ?? ''}`,
        status, statusLabel: TRACKING_STATUS_LABEL[status], createdAt: it.review_submitted_at,
        deadline: it.review_status === 'pending_review' ? it.review_expires_at : null,
        endedAt: it.reviewed_at, isOverdue: false,
        needsMyAction: it.review_status !== 'pending_review', href: `/portfolio/${it.id}`,
      });
    }
    await pushConnections(db, rows, (c) =>
      c.direction === 'company_to_team' && c.status === 'pending' && !!c.team_id && leaderTeamIds.has(c.team_id));
  } else if (user.role === 'company') {
    const company = await getMyCompany(db, user.id);
    if (company) {
      const problems = await listCompanyProblems(db, company.id);
      for (const p of problems) {
        if (p.review_status === 'approved') continue;
        const status = `review_${p.review_status}` as TrackingStatus;
        rows.push({
          key: `problem-${p.id}`, type: 'business_problem', id: p.id, title: p.title, detail: 'Bài toán',
          status, statusLabel: TRACKING_STATUS_LABEL[status], createdAt: p.review_submitted_at,
          deadline: p.review_status === 'pending_review' ? p.review_expires_at : null,
          endedAt: p.reviewed_at, isOverdue: false,
          needsMyAction: p.review_status !== 'pending_review', href: `/problems/${p.id}`,
        });
      }
    }
    await pushConnections(db, rows, (c) =>
      (c.direction === 'team_to_company' && c.status === 'pending') || (c.status === 'in_progress' && !!c.is_overdue));
  } else {
    await pushConnections(db, rows, () => false);
  }

  const filtered = filter ? rows.filter((r) => r.status === filter) : rows;
  return filtered.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

type ConnRow = Awaited<ReturnType<typeof listConnections>>[number];

async function pushConnections(db: DB, rows: TrackingRow[], needsAction: (c: ConnRow) => boolean) {
  const conns = await listConnections(db);
  for (const c of conns) {
    if (!c.id || !c.status) continue;
    const deadline = c.status === 'pending' ? c.expires_at : c.status === 'in_progress' ? c.expected_end_at : null;
    rows.push({
      key: `conn-${c.id}`, type: 'connection', id: c.id,
      title: c.problem_title ?? 'Bài toán',
      detail: `${c.direction === 'team_to_company' ? 'Nhóm gửi' : 'Doanh nghiệp mời'} · ${c.team_name ?? ''} ↔ ${c.company_name ?? ''}`,
      status: c.status, statusLabel: TRACKING_STATUS_LABEL[c.status], createdAt: c.created_at ?? '',
      deadline, endedAt: c.ended_at ?? c.responded_at, isOverdue: !!c.is_overdue,
      needsMyAction: needsAction(c), href: `/connections/${c.id}`,
    });
  }
}
