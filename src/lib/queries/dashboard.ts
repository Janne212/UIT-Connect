import type { DB } from '@/lib/db';
import { CONNECTION_STATUSES } from '@/lib/constants';
import type { ConnectionStatus } from '@/types';

// Dashboard quản lý của giảng viên / điều phối (và admin).
// Các view có security_invoker nên chỉ staff mới thấy toàn bộ; sinh viên/doanh nghiệp gọi vào chỉ thấy phần của mình.
export async function getStaffDashboard(db: DB) {
  const [queue, connections, fields] = await Promise.all([
    db.from('v_moderation_queue').select('entity_type, entity_id, sub_type, title, owner_name, submitted_at, expires_at')
      .order('expires_at', { ascending: true }),
    db.from('v_connection_dashboard')
      .select('id, status, direction, team_name, company_name, problem_title, item_title, created_at, expires_at, responded_at, started_at, expected_end_at, ended_at, response_days, execution_days, is_overdue')
      .order('created_at', { ascending: false }),
    db.from('v_field_interest').select('tag_id, field_name, approved_problems, company_initiated_requests')
      .order('approved_problems', { ascending: false }),
  ]);
  if (queue.error) throw queue.error;
  if (connections.error) throw connections.error;
  if (fields.error) throw fields.error;

  const now = Date.now();
  const moderation = queue.data.map((q) => {
    const expires = q.expires_at ? new Date(q.expires_at).getTime() : now;
    const waited = q.submitted_at ? (now - new Date(q.submitted_at).getTime()) / 86_400_000 : 0;
    return {
      ...q,
      waiting_days: Math.floor(waited),
      days_left: Math.ceil((expires - now) / 86_400_000),
    };
  });

  const byStatus = Object.fromEntries(CONNECTION_STATUSES.map((s) => [s, 0])) as Record<ConnectionStatus, number>;
  let responseSum = 0, responseN = 0, execSum = 0, execN = 0;
  for (const c of connections.data) {
    if (c.status) byStatus[c.status] += 1;
    if (c.response_days != null) { responseSum += c.response_days; responseN += 1; }
    if (c.execution_days != null) { execSum += c.execution_days; execN += 1; }
  }

  return {
    moderation,
    moderationCount: {
      total: moderation.length,
      portfolio: moderation.filter((m) => m.entity_type === 'portfolio_item').length,
      problems: moderation.filter((m) => m.entity_type === 'business_problem').length,
      dueSoon: moderation.filter((m) => m.days_left <= 1).length,
    },
    connections: connections.data,
    connectionStats: {
      total: connections.data.length,
      byStatus,
      overdue: connections.data.filter((c) => c.is_overdue).length,
      avgResponseDays: responseN ? Math.round((responseSum / responseN) * 10) / 10 : null,
      avgExecutionDays: execN ? Math.round((execSum / execN) * 10) / 10 : null,
    },
    fieldInterest: fields.data,
  };
}
