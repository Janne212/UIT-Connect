import Link from 'next/link';
import { Suspense } from 'react';
import { requireRole } from '@/lib/auth/session';
import { createClient } from '@/lib/supabase/server';
import { getTrackingBoard, TRACKING_STATUS_LABEL, type TrackingStatus } from '@/lib/queries/tracking';
import { formatDate } from '@/lib/utils';
import { Empty, Loading, PageTitle, StatusBadge } from '@/components/ui';

// Chức năng 5 — Bảng theo dõi trạng thái matching (chờ duyệt, hết hạn, chờ phản hồi, bị từ chối,
// đang thực hiện, đã dừng, đã hoàn thành). Mỗi người chỉ thấy dữ liệu của mình (RLS).
export default function ConnectionsPage(props: PageProps<'/connections'>) {
  return <Suspense fallback={<Loading />}><Board searchParams={props.searchParams} /></Suspense>;
}

const FILTERS = Object.keys(TRACKING_STATUS_LABEL) as TrackingStatus[];

async function Board({ searchParams }: { searchParams: PageProps<'/connections'>['searchParams'] }) {
  const profile = await requireRole();
  const sp = await searchParams;
  const status = FILTERS.includes(sp.status as TrackingStatus) ? (sp.status as TrackingStatus) : undefined;
  const rows = await getTrackingBoard(await createClient(), { id: profile.id, role: profile.role }, status);
  const created = typeof sp.created === 'string' ? sp.created : null;

  return (
    <>
      <PageTitle>Theo dõi kết nối</PageTitle>
      {created && <p role="status" className="mb-3 rounded bg-green-50 p-3 text-sm">Đã gửi bài, đang chờ giảng viên duyệt.</p>}
      <nav className="mb-4 flex flex-wrap gap-2 text-sm" aria-label="Lọc theo trạng thái">
        <Link href="/connections" className={!status ? 'font-semibold underline' : 'underline'}>Tất cả</Link>
        {FILTERS.map((s) => (
          <Link key={s} href={`/connections?status=${s}`} className={status === s ? 'font-semibold underline' : 'underline'}>{TRACKING_STATUS_LABEL[s]}</Link>
        ))}
      </nav>
      {rows.length === 0 ? <Empty>{status ? 'Không có mục nào ở trạng thái này' : 'Chưa có kết nối hay bài đăng nào cần theo dõi'}</Empty> : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm [&_td]:px-2 [&_td]:py-2 [&_th]:px-2">
            <thead><tr className="text-gray-600"><th>Nội dung</th><th>Trạng thái</th><th>Khởi tạo</th><th>Hạn</th><th>Kết thúc / phản hồi</th></tr></thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.key} className={`border-t ${r.id === created ? 'bg-green-50' : ''}`}>
                  <td>
                    <Link href={r.href} className="font-medium underline">{r.title}</Link>
                    {r.needsMyAction && <span className="ml-2 text-xs font-semibold text-red-700">Cần bạn xử lý</span>}
                    <div className="text-xs text-gray-600">{r.detail}</div>
                  </td>
                  <td><StatusBadge status={r.status} label={r.statusLabel} />{r.isOverdue && <span className="ml-1 text-xs text-red-700">quá hạn</span>}</td>
                  <td>{formatDate(r.createdAt)}</td>
                  <td>{formatDate(r.deadline)}</td>
                  <td>{formatDate(r.endedAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
