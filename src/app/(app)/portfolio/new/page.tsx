import Link from 'next/link';
import { Suspense } from 'react';
import { requireRole } from '@/lib/auth/session';
import { createClient } from '@/lib/supabase/server';
import { listLecturers, listTags } from '@/lib/queries/catalog';
import { getTeam, listMyTeams, listTeamItems } from '@/lib/queries/teams';
import { Empty, Loading, PageTitle } from '@/components/ui';
import { PortfolioItemForm, type TeamOption } from './item-form';

// Chức năng 2 — Tạo/Thêm project/product/paper (chỉ sinh viên; bài vào trạng thái Chờ duyệt)
export default function NewPortfolioItemPage() {
  return <Suspense fallback={<Loading />}><NewItem /></Suspense>;
}

async function NewItem() {
  const profile = await requireRole('student');
  const db = await createClient();
  const myTeams = await listMyTeams(db, profile.id);
  if (!myTeams.length) {
    return (
      <>
        <PageTitle>Thêm project / product / paper</PageTitle>
        <Empty>Bạn cần thuộc một nhóm trước khi đăng. <Link href="/teams" className="underline">Tạo hoặc xem nhóm</Link></Empty>
      </>
    );
  }
  const [tags, lecturers, teams] = await Promise.all([
    listTags(db),
    listLecturers(db),
    Promise.all(myTeams.map(async (t): Promise<TeamOption> => {
      const [detail, items] = await Promise.all([getTeam(db, t.id), listTeamItems(db, t.id)]);
      return {
        id: t.id,
        name: t.name,
        members: (detail?.team_members ?? []).flatMap((m) => (m.profiles ? [{ id: m.profiles.id, full_name: m.profiles.full_name }] : [])),
        projects: items.filter((i) => i.kind === 'project').map((i) => ({ id: i.id, title: i.title })),
      };
    })),
  ]);
  return (
    <>
      <PageTitle>Thêm project / product / paper</PageTitle>
      <div className="max-w-2xl"><PortfolioItemForm teams={teams} tags={tags} lecturers={lecturers} /></div>
    </>
  );
}
