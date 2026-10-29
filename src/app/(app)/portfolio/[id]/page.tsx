import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Suspense } from 'react';
import { z } from 'zod';
import { requireRole } from '@/lib/auth/session';
import { createClient } from '@/lib/supabase/server';
import { getPortfolioItem } from '@/lib/queries/portfolio';
import { getMyCompany } from '@/lib/queries/companies';
import { listCompanyProblems } from '@/lib/queries/problems';
import { getConnectionTtlOptions } from '@/lib/queries/catalog';
import { ITEM_KIND_LABEL, REVIEW_STATUS_LABEL } from '@/lib/constants';
import { formatDate } from '@/lib/utils';
import { ActionForm } from '@/components/forms/action-form';
import { ConnectionRequestForm } from '@/components/connections/connection-request-form';
import { Card, KeyValue, Loading, PageTitle, StatusBadge, TagList } from '@/components/ui';
import { deletePortfolioItemAction, resubmitContentAction } from '../actions';

// Chức năng 7 — Trang thông tin chi tiết project/product/paper (kèm nhóm và thành viên).
// Doanh nghiệp có nút "Tạo kết nối"; sinh viên chỉ xem; nhóm sở hữu thấy trạng thái duyệt, gửi lại, xóa.
export default function PortfolioItemPage(props: PageProps<'/portfolio/[id]'>) {
  return <Suspense fallback={<Loading />}><ItemDetail params={props.params} /></Suspense>;
}

async function ItemDetail({ params }: { params: PageProps<'/portfolio/[id]'>['params'] }) {
  const profile = await requireRole();
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();
  const db = await createClient();
  const item = await getPortfolioItem(db, id);
  if (!item) notFound(); // RLS trả 0 dòng (chưa duyệt / không có quyền) cũng về 404, không lộ sự tồn tại

  const members = item.student_teams?.team_members ?? [];
  const isMember = members.some((m) => m.profiles?.id === profile.id);
  const roleLabels = new Map(item.item_members.map((m) => [m.profile_id, m.role_label]));

  let connect = null;
  if (profile.role === 'company' && item.review_status === 'approved' && !item.deleted_at) {
    const company = await getMyCompany(db, profile.id);
    const [problems, ttl] = await Promise.all([
      company ? listCompanyProblems(db, company.id, { onlyOpenApproved: true }) : Promise.resolve([]),
      getConnectionTtlOptions(db),
    ]);
    connect = problems.length
      ? <ConnectionRequestForm mode="company" teamId={item.team_id} itemId={item.id}
          problemOptions={problems.map((p) => ({ value: p.id, label: p.title }))}
          ttlOptions={ttl.options} defaultTtl={ttl.defaultDays}
          targetLabel={`Mời nhóm “${item.student_teams?.name}” (sản phẩm “${item.title}”) giải quyết bài toán của bạn.`} />
      : <p className="text-sm text-gray-600">Bạn cần có bài toán đã duyệt và đang mở để gửi lời mời. <Link href="/problems/new" className="underline">Đăng bài toán</Link></p>;
  }

  return (
    <div className="space-y-5">
      <PageTitle actions={connect}>{item.title}</PageTitle>
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <StatusBadge status="open" label={ITEM_KIND_LABEL[item.kind]} />
        {isMember && <StatusBadge status={item.review_status} label={REVIEW_STATUS_LABEL[item.review_status]} />}
        <TagList tags={item.item_tags} />
      </div>
      {isMember && item.review_status === 'rejected' && <p className="rounded bg-red-50 p-3 text-sm">Lý do từ chối: {item.review_note}</p>}

      <Card>
        <p className="mb-3 whitespace-pre-line text-sm">{item.summary}</p>
        <KeyValue items={[
          ['Liên kết nguồn', <a key="s" href={item.source_url} target="_blank" rel="noopener noreferrer" className="underline">{item.source_url}</a>],
          ['Thời gian', `${formatDate(item.started_on)} – ${item.finished_on ? formatDate(item.finished_on) : 'đang thực hiện'}`],
          ['Ngày đăng', formatDate(item.created_at)],
          ...(item.parent ? [['Thuộc project', <Link key="p" href={`/portfolio/${item.parent.id}`} className="underline">{item.parent.title}</Link>] as [string, React.ReactNode]] : []),
          ...(item.advisor ? [['Giảng viên hướng dẫn', item.advisor.full_name] as [string, React.ReactNode]] : []),
          ...(item.paper_application ? [['Ứng dụng thực tiễn', item.paper_application] as [string, React.ReactNode]] : []),
        ]} />
      </Card>

      {item.children.length > 0 && (
        <section>
          <h2 className="mb-1 font-semibold">Product / paper thuộc project</h2>
          <ul className="list-disc pl-5 text-sm">{item.children.map((c) => <li key={c.id}><Link href={`/portfolio/${c.id}`} className="underline">{c.title}</Link> ({c.kind})</li>)}</ul>
        </section>
      )}

      <section>
        <h2 className="mb-1 font-semibold">Nhóm thực hiện: <Link href={`/teams/${item.team_id}`} className="underline">{item.student_teams?.name}</Link></h2>
        <ul className="text-sm">
          {members.map((m) => m.profiles && (
            <li key={m.profiles.id}>
              {m.profiles.full_name}{m.member_role === 'leader' && ' (nhóm trưởng)'}
              {roleLabels.get(m.profiles.id) && <span className="text-gray-600"> — {roleLabels.get(m.profiles.id)}</span>}
              {m.profiles.major && <span className="text-gray-600"> · {m.profiles.major} {m.profiles.cohort}</span>}
            </li>
          ))}
        </ul>
      </section>

      {isMember && !item.deleted_at && (
        <section className="flex flex-wrap gap-4">
          {(item.review_status === 'rejected' || item.review_status === 'expired') && (
            <ActionForm action={resubmitContentAction} submitLabel="Gửi lại để duyệt">
              <input type="hidden" name="entity" value="portfolio_item" /><input type="hidden" name="id" value={item.id} />
            </ActionForm>
          )}
          <ActionForm action={deletePortfolioItemAction.bind(null, item.id)} submitLabel="Xóa bài đăng" danger />
        </section>
      )}
    </div>
  );
}
