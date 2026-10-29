import Link from 'next/link';
import { Suspense } from 'react';
import { requireRole, isStaff } from '@/lib/auth/session';
import { createClient } from '@/lib/supabase/server';
import { getStaffDashboard } from '@/lib/queries/dashboard';
import { getTrackingBoard } from '@/lib/queries/tracking';
import { searchPortfolio } from '@/lib/queries/portfolio';
import { searchProblems } from '@/lib/queries/problems';
import { CONNECTION_STATUS_LABEL, CONNECTION_STATUSES } from '@/lib/constants';
import { formatDate, formatDateTime } from '@/lib/utils';
import { Card, Empty, Loading, PageTitle, StatusBadge } from '@/components/ui';

// Điều hướng theo vai trò: giảng viên/admin -> Dashboard quản lý (chức năng 6); sinh viên/doanh nghiệp -> HomePage
export default function DashboardPage() {
  return <Suspense fallback={<Loading />}><Dashboard /></Suspense>;
}

async function Dashboard() {
  const profile = await requireRole();
  return isStaff(profile.role) ? <StaffDashboard /> : <HomePage role={profile.role as 'student' | 'company'} userId={profile.id} />;
}

// ---------------------------------------------------------------- Chức năng 6: Dashboard quản lý gv/điều phối
async function StaffDashboard() {
  const d = await getStaffDashboard(await createClient());
  return (
    <div className="space-y-6">
      <PageTitle actions={<Link href="/moderation" className="rounded bg-blue-700 px-3 py-2 text-sm text-white">Duyệt bài đăng</Link>}>
        Dashboard quản lý
      </PageTitle>

      <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Bài chờ duyệt" value={d.moderationCount.total} hint={`${d.moderationCount.portfolio} sản phẩm · ${d.moderationCount.problems} bài toán`} />
        <Stat label="Sắp hết hạn duyệt (≤ 1 ngày)" value={d.moderationCount.dueSoon} />
        <Stat label="Tổng kết nối" value={d.connectionStats.total} hint={`${d.connectionStats.overdue} quá hạn hoàn thành`} />
        <Stat label="TB phản hồi / thực hiện" value={`${d.connectionStats.avgResponseDays ?? '—'} / ${d.connectionStats.avgExecutionDays ?? '—'} ngày`} />
      </section>

      <section>
        <h2 className="mb-2 font-semibold">Kết nối theo trạng thái</h2>
        <ul className="flex flex-wrap gap-2 text-sm">
          {CONNECTION_STATUSES.map((s) => (
            <li key={s}><Link href={`/connections?status=${s}`}><StatusBadge status={s} label={`${CONNECTION_STATUS_LABEL[s]}: ${d.connectionStats.byStatus[s]}`} /></Link></li>
          ))}
        </ul>
      </section>

      <section>
        <h2 className="mb-2 font-semibold">Hàng đợi duyệt</h2>
        {d.moderation.length === 0 ? <Empty>Không có bài cần duyệt</Empty> : (
          <Table head={['Loại', 'Tiêu đề', 'Người đăng', 'Gửi duyệt', 'Đã chờ', 'Hạn duyệt']}>
            {d.moderation.map((m) => (
              <tr key={m.entity_id} className="border-t">
                <td>{m.entity_type === 'business_problem' ? 'Bài toán' : m.sub_type}</td>
                <td>{m.title}</td><td>{m.owner_name}</td><td>{formatDateTime(m.submitted_at)}</td>
                <td>{m.waiting_days} ngày</td>
                <td className={m.days_left <= 1 ? 'text-red-700' : ''}>{formatDate(m.expires_at)} ({m.days_left} ngày)</td>
              </tr>
            ))}
          </Table>
        )}
      </section>

      <section>
        <h2 className="mb-2 font-semibold">Các kết nối</h2>
        {d.connections.length === 0 ? <Empty>Chưa có kết nối nào</Empty> : (
          <Table head={['Bài toán', 'Nhóm ↔ Doanh nghiệp', 'Trạng thái', 'Khởi tạo', 'Hạn phản hồi', 'Bắt đầu', 'Dự kiến xong', 'Kết thúc']}>
            {d.connections.map((c) => (
              <tr key={c.id} className="border-t">
                <td><Link href={`/connections/${c.id}`} className="underline">{c.problem_title}</Link></td>
                <td>{c.team_name} ↔ {c.company_name}</td>
                <td>{c.status && <StatusBadge status={c.status} label={CONNECTION_STATUS_LABEL[c.status]} />}{c.is_overdue && <span className="ml-1 text-xs text-red-700">quá hạn</span>}</td>
                <td>{formatDate(c.created_at)}</td><td>{formatDate(c.expires_at)}</td><td>{formatDate(c.started_at)}</td>
                <td>{formatDate(c.expected_end_at)}</td><td>{formatDate(c.ended_at)}</td>
              </tr>
            ))}
          </Table>
        )}
      </section>

      <section>
        <h2 className="mb-2 font-semibold">Lĩnh vực doanh nghiệp quan tâm</h2>
        <Table head={['Lĩnh vực', 'Bài toán đã duyệt', 'Lời mời từ doanh nghiệp']}>
          {d.fieldInterest.map((f) => (
            <tr key={f.tag_id} className="border-t"><td>{f.field_name}</td><td>{f.approved_problems}</td><td>{f.company_initiated_requests}</td></tr>
          ))}
        </Table>
      </section>
    </div>
  );
}

// ---------------------------------------------------------------- HomePage sinh viên / doanh nghiệp
async function HomePage({ role, userId }: { role: 'student' | 'company'; userId: string }) {
  const db = await createClient();
  const [board, problems, items] = await Promise.all([
    getTrackingBoard(db, { id: userId, role }),
    searchProblems(db, { pageSize: 5 }),
    searchPortfolio(db, { pageSize: 5 }),
  ]);
  const todo = board.filter((r) => r.needsMyAction);
  return (
    <div className="space-y-6">
      <PageTitle actions={
        role === 'student'
          ? <Link href="/portfolio/new" className="rounded bg-blue-700 px-3 py-2 text-sm text-white">Thêm project/product/paper</Link>
          : <Link href="/problems/new" className="rounded bg-blue-700 px-3 py-2 text-sm text-white">Thêm bài toán/vấn đề</Link>
      }>Trang chủ</PageTitle>

      <form action="/search" className="flex gap-2">
        <input name="q" aria-label="Tìm bài toán hoặc sản phẩm" placeholder="Tìm bài toán, sản phẩm…" className="flex-1 rounded border px-3 py-2 text-sm" />
        <button className="rounded border px-4 text-sm">Tìm</button>
      </form>

      <section>
        <h2 className="mb-2 font-semibold">Việc cần làm ({todo.length})</h2>
        {todo.length === 0 ? <Empty>Không có việc cần làm</Empty> : (
          <ul className="space-y-1 text-sm">
            {todo.map((r) => <li key={r.key}><StatusBadge status={r.status} label={r.statusLabel} /> <Link href={r.href} className="underline">{r.title}</Link> <span className="text-gray-600">· {r.detail}</span></li>)}
          </ul>
        )}
        <Link href="/connections" className="mt-2 inline-block text-sm underline">Mở bảng theo dõi →</Link>
      </section>

      <div className="grid gap-6 md:grid-cols-2">
        <section>
          <h2 className="mb-2 font-semibold"><Link href="/problems">Bài toán mới</Link></h2>
          {problems.rows.length === 0 ? <Empty>Chưa có bài toán nào</Empty> : problems.rows.map((p) => (
            <Card key={p.id}><Link href={`/problems/${p.id}`} className="font-medium underline">{p.title}</Link>
              <p className="text-xs text-gray-600">{p.companies?.name} · {formatDate(p.created_at)}</p></Card>
          ))}
        </section>
        <section>
          <h2 className="mb-2 font-semibold"><Link href="/portfolio">Project/Product/Paper mới</Link></h2>
          {items.rows.length === 0 ? <Empty>Chưa có sản phẩm nào</Empty> : items.rows.map((i) => (
            <Card key={i.id}><Link href={`/portfolio/${i.id}`} className="font-medium underline">{i.title}</Link>
              <p className="text-xs text-gray-600">{i.kind} · {i.student_teams?.name} · {formatDate(i.created_at)}</p></Card>
          ))}
        </section>
      </div>
    </div>
  );
}

function Stat({ label, value, hint }: { label: string; value: number | string; hint?: string }) {
  return (
    <Card>
      <p className="text-xs text-gray-600">{label}</p>
      <p className="text-2xl font-semibold">{value}</p>
      {hint && <p className="text-xs text-gray-600">{hint}</p>}
    </Card>
  );
}

function Table({ head, children }: { head: string[]; children: React.ReactNode }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-sm [&_td]:px-2 [&_td]:py-1 [&_th]:px-2 [&_th]:py-1">
        <thead><tr>{head.map((h) => <th key={h} className="font-medium text-gray-600">{h}</th>)}</tr></thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  );
}
