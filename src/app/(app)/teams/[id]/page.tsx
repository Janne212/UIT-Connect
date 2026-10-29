import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Suspense } from 'react';
import { z } from 'zod';
import { requireRole } from '@/lib/auth/session';
import { createClient } from '@/lib/supabase/server';
import { getTeam, getTeamEngagements, listTeamItems, searchStudents } from '@/lib/queries/teams';
import { getMyCompany } from '@/lib/queries/companies';
import { listCompanyProblems } from '@/lib/queries/problems';
import { getConnectionTtlOptions } from '@/lib/queries/catalog';
import { CONNECTION_STATUS_LABEL, ITEM_KIND_LABEL, REVIEW_STATUS_LABEL } from '@/lib/constants';
import { formatDate } from '@/lib/utils';
import { ActionForm } from '@/components/forms/action-form';
import { ConnectionRequestForm } from '@/components/connections/connection-request-form';
import { Card, Empty, Loading, PageTitle, StatusBadge } from '@/components/ui';
import { addTeamMemberAction, removeTeamMemberAction, transferLeaderAction } from '../../account-actions';

// Trang nhóm: thành viên, sản phẩm, lịch sử hợp tác; nhóm trưởng quản lý thành viên; doanh nghiệp mời nhóm
export default function TeamPage(props: PageProps<'/teams/[id]'>) {
  return <Suspense fallback={<Loading />}><TeamDetail params={props.params} searchParams={props.searchParams} /></Suspense>;
}

async function TeamDetail({ params, searchParams }: {
  params: PageProps<'/teams/[id]'>['params']; searchParams: PageProps<'/teams/[id]'>['searchParams'];
}) {
  const profile = await requireRole();
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();
  const sp = await searchParams;
  const db = await createClient();
  const team = await getTeam(db, id);
  if (!team) notFound();

  const me = team.team_members.find((m) => m.profiles?.id === profile.id);
  const isLeader = me?.member_role === 'leader';
  const [items, engagements] = await Promise.all([listTeamItems(db, id, !me), getTeamEngagements(db, id)]);
  const q = typeof sp.q === 'string' ? sp.q : '';
  const candidates = isLeader && q ? await searchStudents(db, q, team.team_members.flatMap((m) => (m.profiles ? [m.profiles.id] : []))) : [];

  let invite = null;
  if (profile.role === 'company') {
    const company = await getMyCompany(db, profile.id);
    const [problems, ttl] = await Promise.all([
      company ? listCompanyProblems(db, company.id, { onlyOpenApproved: true }) : Promise.resolve([]),
      getConnectionTtlOptions(db),
    ]);
    if (problems.length) {
      invite = <ConnectionRequestForm mode="company" teamId={team.id} problemOptions={problems.map((p) => ({ value: p.id, label: p.title }))}
        ttlOptions={ttl.options} defaultTtl={ttl.defaultDays} targetLabel={`Mời nhóm “${team.name}” giải quyết bài toán của bạn.`} />;
    }
  }

  return (
    <div className="space-y-6">
      <PageTitle actions={invite}>{team.name}</PageTitle>
      {team.description && <p className="whitespace-pre-line text-sm">{team.description}</p>}

      <section>
        <h2 className="mb-2 font-semibold">Thành viên ({team.team_members.length})</h2>
        <ul className="space-y-1 text-sm">
          {team.team_members.map((m) => m.profiles && (
            <li key={m.profiles.id} className="flex flex-wrap items-center gap-2">
              <span>{m.profiles.full_name}{m.member_role === 'leader' && ' (nhóm trưởng)'}</span>
              {m.profiles.major && <span className="text-gray-600">· {m.profiles.major} {m.profiles.cohort}</span>}
              {isLeader && m.member_role !== 'leader' && (
                <>
                  <ActionForm action={transferLeaderAction} submitLabel="Chuyển nhóm trưởng" className="inline">
                    <input type="hidden" name="teamId" value={team.id} /><input type="hidden" name="profileId" value={m.profiles.id} />
                  </ActionForm>
                  <ActionForm action={removeTeamMemberAction} submitLabel="Xóa khỏi nhóm" className="inline" danger>
                    <input type="hidden" name="teamId" value={team.id} /><input type="hidden" name="profileId" value={m.profiles.id} />
                  </ActionForm>
                </>
              )}
              {!isLeader && m.profiles.id === profile.id && (
                <ActionForm action={removeTeamMemberAction} submitLabel="Rời nhóm" className="inline" danger>
                  <input type="hidden" name="teamId" value={team.id} /><input type="hidden" name="profileId" value={m.profiles.id} />
                </ActionForm>
              )}
            </li>
          ))}
        </ul>
      </section>

      {isLeader && (
        <section>
          <h2 className="mb-2 font-semibold">Thêm thành viên</h2>
          <form className="mb-2 flex gap-2">
            <input name="q" defaultValue={q} aria-label="Tên sinh viên" placeholder="Tìm sinh viên theo tên (có/không dấu)" className="flex-1 rounded border px-3 py-2 text-sm" />
            <button className="rounded border px-4 text-sm">Tìm</button>
          </form>
          {q && candidates.length === 0 && <p className="text-sm text-gray-600">Không tìm thấy sinh viên phù hợp</p>}
          <ul className="space-y-1 text-sm">
            {candidates.map((c) => (
              <li key={c.id} className="flex items-center gap-2">
                <span>{c.full_name} {c.major && <span className="text-gray-600">· {c.major} {c.cohort}</span>}</span>
                <ActionForm action={addTeamMemberAction} submitLabel="Thêm" className="inline">
                  <input type="hidden" name="teamId" value={team.id} /><input type="hidden" name="profileId" value={c.id} />
                </ActionForm>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section>
        <h2 className="mb-2 font-semibold">Project / Product / Paper</h2>
        {items.length === 0 ? <Empty>Chưa có bài đăng</Empty> : (
          <ul className="space-y-1 text-sm">
            {items.map((i) => (
              <li key={i.id}>
                <Link href={`/portfolio/${i.id}`} className="underline">{i.title}</Link> <span className="text-gray-600">({ITEM_KIND_LABEL[i.kind]})</span>{' '}
                {me && <StatusBadge status={i.review_status} label={REVIEW_STATUS_LABEL[i.review_status]} />}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h2 className="mb-2 font-semibold">Lịch sử hợp tác</h2>
        {engagements.length === 0 ? <Empty>Chưa có hợp tác nào</Empty> : engagements.map((e) => (
          <Card key={e.connection_id}>
            <p className="font-medium">{e.problem_title} — {e.company_name}</p>
            <p className="text-xs text-gray-600">
              {e.status && <StatusBadge status={e.status} label={CONNECTION_STATUS_LABEL[e.status]} />} {formatDate(e.started_at)} – {formatDate(e.ended_at)}
              {e.end_rating && ` · Đánh giá ${e.end_rating}/5`}
            </p>
            {e.end_feedback && <p className="text-sm">“{e.end_feedback}”</p>}
            {e.end_reason && <p className="text-sm">Lý do dừng: {e.end_reason}</p>}
          </Card>
        ))}
      </section>
    </div>
  );
}
