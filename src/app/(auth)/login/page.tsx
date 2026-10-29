import Link from 'next/link';
import { Suspense } from 'react';
import { ActionForm, Field } from '@/components/forms/action-form';
import { signIn } from '../actions';

// Chức năng 1 — Đăng nhập (không tách theo vai trò; điều hướng theo vai trò sau khi đăng nhập)
export default function LoginPage(props: PageProps<'/login'>) {
  return (
    <>
      <h1 className="mb-4 text-xl font-semibold">Đăng nhập</h1>
      <Suspense fallback={null}>
        <Notice searchParams={props.searchParams} />
      </Suspense>
      <Suspense fallback={null}>
        <LoginForm searchParams={props.searchParams} />
      </Suspense>
      <p className="mt-4 text-sm">
        Chưa có tài khoản? <Link href="/register" className="underline">Đăng ký</Link> ·{' '}
        <Link href="/forgot-password" className="underline">Quên mật khẩu</Link>
      </p>
    </>
  );
}

async function Notice({ searchParams }: { searchParams: PageProps<'/login'>['searchParams'] }) {
  const sp = await searchParams;
  const text =
    sp.registered === '1' ? 'Đăng ký thành công. Hãy đăng nhập.'
    : sp.registered === 'confirm' ? 'Đăng ký thành công. Hãy mở email để xác nhận tài khoản rồi đăng nhập.'
    : sp.reset === '1' ? 'Đã đổi mật khẩu. Hãy đăng nhập lại.'
    : sp.error === 'confirm' ? 'Liên kết xác nhận không hợp lệ hoặc đã hết hạn.'
    : null;
  const extra = sp.company === 'failed' ? ' Hồ sơ doanh nghiệp chưa lưu được, hãy cập nhật sau khi đăng nhập.' : '';
  return text ? <p role="status" className="mb-3 rounded bg-blue-50 p-3 text-sm">{text}{extra}</p> : null;
}

async function LoginForm({ searchParams }: { searchParams: PageProps<'/login'>['searchParams'] }) {
  const sp = await searchParams;
  const next = typeof sp.next === 'string' ? sp.next : '';
  return (
    <ActionForm action={signIn} submitLabel="Đăng nhập" pendingLabel="Đang đăng nhập…">
      <input type="hidden" name="next" value={next} />
      <Field label="Email" name="email" type="email" required />
      <Field label="Mật khẩu" name="password" type="password" required />
    </ActionForm>
  );
}
