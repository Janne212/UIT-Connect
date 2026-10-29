import Link from 'next/link';
import { Suspense } from 'react';
import { getCurrentProfile } from '@/lib/auth/session';
import { createClient } from '@/lib/supabase/server';
import { countUnreadNotifications } from '@/lib/queries/notifications';
import { ROLE_LABEL } from '@/lib/constants';
import { Loading } from '@/components/ui';
import { signOut } from '../(auth)/actions';
import type { Role } from '@/types';

// Khung sau đăng nhập. Phiên đọc lúc request nên nằm sau <Suspense> (Next.js 16 cacheComponents).
// Menu chỉ để dẫn đường; quyền thật do RLS/RPC và requireRole() trong từng Server Action.
export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-full flex-col">
      <Suspense fallback={<Loading />}>
        <Shell>{children}</Shell>
      </Suspense>
    </div>
  );
}

const MENU: Record<Role, Array<[string, string]>> = {
  student: [['/dashboard', 'Trang chủ'], ['/search', 'Tìm kiếm'], ['/problems', 'Bài toán'], ['/portfolio', 'Project/Product/Paper'],
    ['/teams', 'Nhóm của tôi'], ['/connections', 'Theo dõi kết nối'], ['/profile', 'Hồ sơ']],
  company: [['/dashboard', 'Trang chủ'], ['/search', 'Tìm kiếm'], ['/portfolio', 'Sản phẩm sinh viên'], ['/problems', 'Bài toán'],
    ['/company', 'Hồ sơ doanh nghiệp'], ['/connections', 'Theo dõi kết nối'], ['/profile', 'Hồ sơ']],
  lecturer: [['/dashboard', 'Dashboard quản lý'], ['/moderation', 'Duyệt bài đăng'], ['/connections', 'Các kết nối'],
    ['/search', 'Tìm kiếm'], ['/profile', 'Hồ sơ']],
  admin: [['/dashboard', 'Dashboard quản lý'], ['/moderation', 'Duyệt bài đăng'], ['/connections', 'Các kết nối'],
    ['/search', 'Tìm kiếm'], ['/profile', 'Hồ sơ']],
};

async function Shell({ children }: { children: React.ReactNode }) {
  const profile = await getCurrentProfile();
  if (!profile) {
    // proxy.ts thường đã chuyển hướng; đây là lớp dự phòng (vd phiên hết hạn giữa chừng)
    return <main className="p-6"><Link href="/login" className="underline">Đăng nhập lại</Link></main>;
  }
  if (!profile.is_active) {
    return (
      <main className="mx-auto max-w-md p-6 text-center">
        <h1 className="text-lg font-semibold">Tài khoản đã bị khóa</h1>
        <p className="my-3 text-sm text-gray-600">Hãy liên hệ quản trị viên để được hỗ trợ.</p>
        <form action={signOut}><button className="rounded border px-4 py-2 text-sm">Đăng xuất</button></form>
      </main>
    );
  }
  const unread = await countUnreadNotifications(await createClient()).catch(() => 0);
  return (
    <>
      <header className="border-b">
        <nav className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3 text-sm" aria-label="Điều hướng chính">
          <Link href="/dashboard" className="font-bold">UIT Connect</Link>
          {MENU[profile.role].map(([href, label]) => <Link key={href} href={href} className="hover:underline">{label}</Link>)}
          <Link href="/notifications" className="hover:underline">Thông báo{unread > 0 && ` (${unread})`}</Link>
          <span className="ml-auto text-gray-600">{profile.full_name} · {ROLE_LABEL[profile.role]}</span>
          <form action={signOut}><button className="rounded border px-3 py-1">Đăng xuất</button></form>
        </nav>
      </header>
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6">{children}</main>
    </>
  );
}
