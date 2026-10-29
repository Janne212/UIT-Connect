import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Suspense } from 'react';
import { z } from 'zod';
import { requireRole } from '@/lib/auth/session';
import { createClient } from '@/lib/supabase/server';
import { getProblem } from '@/lib/queries/problems';
import { getConnectionTtlOptions } from '@/lib/queries/catalog';
import { listMyLeaderTeams, listTeamItems } from '@/lib/queries/teams';
import { REVIEW_STATUS_LABEL, SOLVE_STATUS_LABEL } from '@/lib/constants';
import { formatDate } from '@/lib/utils';
import { ActionForm } from '@/components/forms/action-form';
import { ConnectionRequestForm } from '@/components/connections/connection-request-form';
import { Card, KeyValue, Loading, PageTitle, StatusBadge, TagList } from '@/components/ui';
import { deleteProblemAction } from '../actions';
import { resubmitContentAction } from '../../portfolio/actions';

const EXTRA_LABEL: Record<string, string> = {
  background: 'Bối cảnh', constraints: 'Ràng buộc kỹ thuật', tech_requirements: 'Yêu cầu công nghệ',
  compensation: 'Quyền lợi / kinh phí', collaboration_mode: 'Hình thức làm việc', preferred_team_size: 'Quy mô nhóm mong muốn',
};

// Chức năng 8 — Trang thông tin chi tiết bài toán (luôn kèm doanh nghiệp đăng).
// Sinh viên (nhóm trưởng) có "Tạo kết nối"; doanh nghiệp chỉ xem; chủ bài thấy trạng thái duyệt, gửi lại, xóa.
export default function ProblemPage(props: PageProps<'/problems/[id]'>) {
  return <Suspense fallback={<Loading />}><ProblemDetail params={props.params} /></Suspense>;
}

async function ProblemDetail({ params }: { params: PageProps<'/problems/[id]'>['params'] }) {
  const profile = await requireRole();
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();
  const db = await createClient();
  const problem = await getProblem(db, id);
  if (!problem) notFound();
  const company = problem.companies;
  const isOwner = company?.owner_id === profile.id;
  const extra = (problem.extra ?? {}) as Record<string, unknown>;

  let connect = null;
  if (profile.role === 'student' && problem.review_status === 'approved' && problem.solve_status === 'open' && !problem.deleted_at) {
    const teams = await listMyLeaderTeams(db, profile.id);
    if (teams.length) {
      const [ttl, itemLists] = await Promise.all([
        getConnectionTtlOptions(db),
        Promise.all(teams.map((t) => listTeamItems(db, t.id, true).then((items) => items.map((i) => ({ ...i, team: t.name }))))),
      ]);
      connect = (
        <ConnectionRequestForm mode="student" problemId={problem.id}
          teamOptions={teams.map((t) => ({ value: t.id, label: t.name }))}
          itemOptions={itemLists.flat().map((i) => ({ value: i.id, label: `${i.title} (${i.team})` }))}
          ttlOptions={ttl.options} defaultTtl={ttl.defaultDays}
          targetLabel={`Gửi yêu cầu thực hiện bài toán “${problem.title}” tới ${company?.name}.`} />
      );
    } else {
      connect = <p className="text-sm text-gray-600">Chỉ nhóm trưởng mới gửi được yêu cầu kết nối. <Link href="/teams" className="underline">Nhóm của tôi</Link></p>;
    }
  }

  return (
    <div className="space-y-5">
      <PageTitle actions={connect}>{problem.title}</PageTitle>
      <div className="flex flex-wrap items-center gap-2">
        <StatusBadge status={problem.solve_status} label={SOLVE_STATUS_LABEL[problem.solve_status]} />
        {(isOwner || problem.review_status !== 'approved') && <StatusBadge status={problem.review_status} label={REVIEW_STATUS_LABEL[problem.review_status]} />}
        <TagList tags={problem.problem_tags} />
      </div>
      {isOwner && problem.review_status === 'rejected' && <p className="rounded bg-red-50 p-3 text-sm">Lý do từ chối: {problem.review_note}</p>}

      <Card>
        <h2 className="mb-1 font-semibold">Mô tả vấn đề</h2>
        <p className="mb-3 whitespace-pre-line text-sm">{problem.description}</p>
        <h2 className="mb-1 font-semibold">Kết quả kỳ vọng</h2>
        <p className="mb-3 whitespace-pre-line text-sm">{problem.expected_outcome}</p>
        <KeyValue items={[
          ['Ước lượng thời gian', `${problem.estimated_duration_days} ngày`],
          ['Ngày đăng', formatDate(problem.created_at)],
          ...Object.entries(extra).filter(([, v]) => v !== null && v !== '').map(([k, v]) => [EXTRA_LABEL[k] ?? k, String(v)] as [string, string]),
        ]} />
      </Card>

      {company && (
        <Card>
          <h2 className="mb-2 font-semibold">Doanh nghiệp đăng: {company.name}</h2>
          <KeyValue items={[
            ['Lĩnh vực hoạt động', company.industry],
            ['Quy mô', company.size_range],
            ['Website', company.website && <a href={company.website} target="_blank" rel="noopener noreferrer" className="underline">{company.website}</a>],
            ['Địa chỉ', company.address],
            ['Giới thiệu', company.description],
          ]} />
        </Card>
      )}

      {isOwner && !problem.deleted_at && (
        <section className="flex flex-wrap gap-4">
          {(problem.review_status === 'rejected' || problem.review_status === 'expired') && (
            <ActionForm action={resubmitContentAction} submitLabel="Gửi lại để duyệt">
              <input type="hidden" name="entity" value="business_problem" /><input type="hidden" name="id" value={problem.id} />
            </ActionForm>
          )}
          <ActionForm action={deleteProblemAction.bind(null, problem.id)} submitLabel="Xóa bài toán" danger />
        </section>
      )}
    </div>
  );
}
