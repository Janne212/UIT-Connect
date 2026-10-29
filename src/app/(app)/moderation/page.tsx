import Link from 'next/link';
import { Suspense } from 'react';
import { requireRole } from '@/lib/auth/session';
import { createClient } from '@/lib/supabase/server';
import { getStaffDashboard } from '@/lib/queries/dashboard';
import { formatDateTime } from '@/lib/utils';
import { ActionForm, Field } from '@/components/forms/action-form';
import { Card, Empty, Loading, PageTitle } from '@/components/ui';
import { submitReviewAction } from './actions';

// Duyệt bài đăng (giảng viên/điều phối, admin): sắp theo hạn duyệt, hiện số ngày còn lại
export default function ModerationPage() {
  return <Suspense fallback={<Loading />}><Queue /></Suspense>;
}

async function Queue() {
  await requireRole('lecturer', 'admin');
  const { moderation } = await getStaffDashboard(await createClient());
  return (
    <>
      <PageTitle>Duyệt bài đăng ({moderation.length})</PageTitle>
      {moderation.length === 0 ? <Empty>Không có bài cần duyệt</Empty> : (
        <div className="space-y-3">
          {moderation.map((m) => (
            <Card key={m.entity_id}>
              <p className="font-medium">
                <Link href={m.entity_type === 'business_problem' ? `/problems/${m.entity_id}` : `/portfolio/${m.entity_id}`} className="underline">{m.title}</Link>
                <span className="ml-2 text-xs text-gray-600">{m.entity_type === 'business_problem' ? 'Bài toán' : m.sub_type} · {m.owner_name}</span>
              </p>
              <p className="mb-2 text-xs text-gray-600">
                Gửi {formatDateTime(m.submitted_at)} · hạn duyệt {formatDateTime(m.expires_at)} ({m.days_left} ngày)
              </p>
              <ActionForm action={submitReviewAction} submitLabel="Xác nhận" className="flex flex-wrap items-end gap-3">
                <input type="hidden" name="entity" value={m.entity_type ?? ''} /><input type="hidden" name="id" value={m.entity_id ?? ''} />
                <fieldset className="flex gap-3 text-sm">
                  <legend className="sr-only">Quyết định</legend>
                  <label><input type="radio" name="decision" value="approve" /> Duyệt</label>
                  <label><input type="radio" name="decision" value="reject" /> Từ chối</label>
                </fieldset>
                <div className="min-w-64 flex-1"><Field label="Lý do (bắt buộc khi từ chối)" name="note" /></div>
              </ActionForm>
            </Card>
          ))}
        </div>
      )}
    </>
  );
}
