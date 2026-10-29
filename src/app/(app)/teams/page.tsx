import Link from 'next/link';
import { Suspense } from 'react';
import { requireRole } from '@/lib/auth/session';
import { createClient } from '@/lib/supabase/server';
import { listMyTeams } from '@/lib/queries/teams';
import { ActionForm, Field } from '@/components/forms/action-form';
import { Card, Empty, Loading, PageTitle } from '@/components/ui';
import { createTeamAction } from '../account-actions';

// Nhóm của tôi + tạo nhóm (người tạo tự động là nhóm trưởng)
export default function TeamsPage() {
  return <Suspense fallback={<Loading />}><Teams /></Suspense>;
}

async function Teams() {
  const profile = await requireRole('student');
  const teams = await listMyTeams(await createClient(), profile.id);
  return (
    <div className="grid gap-6 md:grid-cols-2">
      <section>
        <PageTitle>Nhóm của tôi</PageTitle>
        {teams.length === 0 ? <Empty>Bạn chưa thuộc nhóm nào</Empty> : (
          <div className="space-y-2">
            {teams.map((t) => (
              <Card key={t.id}>
                <Link href={`/teams/${t.id}`} className="font-medium underline">{t.name}</Link>
                <p className="text-xs text-gray-600">{t.my_role === 'leader' ? 'Nhóm trưởng' : 'Thành viên'}</p>
              </Card>
            ))}
          </div>
        )}
      </section>
      <section>
        <h2 className="mb-3 font-semibold">Tạo nhóm mới</h2>
        <ActionForm action={createTeamAction} submitLabel="Tạo nhóm">
          <Field label="Tên nhóm (2–100 ký tự)" name="name" required />
          <Field label="Mô tả" name="description" textarea />
        </ActionForm>
      </section>
    </div>
  );
}
