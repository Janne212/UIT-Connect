import Link from 'next/link';
import { Suspense } from 'react';
import { requireRole } from '@/lib/auth/session';
import { createClient } from '@/lib/supabase/server';
import { listNotifications } from '@/lib/queries/notifications';
import { formatDateTime } from '@/lib/utils';
import { ActionForm } from '@/components/forms/action-form';
import { Empty, Loading, PageTitle } from '@/components/ui';
import { markNotificationsReadAction } from '../account-actions';

// Thông báo trong app (mỗi dòng cũng là hàng đợi email cho giai đoạn sau)
export default function NotificationsPage() {
  return <Suspense fallback={<Loading />}><Notifications /></Suspense>;
}

async function Notifications() {
  await requireRole();
  const rows = await listNotifications(await createClient());
  const unread = rows.filter((n) => !n.read_at).length;
  return (
    <>
      <PageTitle actions={unread > 0 && <ActionForm action={markNotificationsReadAction} submitLabel="Đánh dấu tất cả đã đọc" />}>
        Thông báo
      </PageTitle>
      {rows.length === 0 ? <Empty>Chưa có thông báo</Empty> : (
        <ul className="divide-y text-sm">
          {rows.map((n) => (
            <li key={n.id} className={`py-2 ${n.read_at ? '' : 'font-medium'}`}>
              {n.link_path ? <Link href={n.link_path} className="underline">{n.title}</Link> : n.title}
              {n.body && <p className="font-normal text-gray-700">{n.body}</p>}
              <p className="text-xs font-normal text-gray-500">{formatDateTime(n.created_at)}</p>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
