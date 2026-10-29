import { Suspense } from 'react';
import { ActionForm, Field } from '@/components/forms/action-form';
import { requestPasswordReset } from '../actions';

export default function ForgotPasswordPage(props: PageProps<'/forgot-password'>) {
  return (
    <>
      <h1 className="mb-4 text-xl font-semibold">Quên mật khẩu</h1>
      <Suspense fallback={null}><Expired searchParams={props.searchParams} /></Suspense>
      <ActionForm action={requestPasswordReset} submitLabel="Gửi liên kết đặt lại">
        <Field label="Email đã đăng ký" name="email" type="email" required />
      </ActionForm>
    </>
  );
}

async function Expired({ searchParams }: { searchParams: PageProps<'/forgot-password'>['searchParams'] }) {
  const sp = await searchParams;
  return sp.error === 'expired'
    ? <p role="alert" className="mb-3 rounded bg-red-50 p-3 text-sm">Liên kết đã hết hạn hoặc đã được dùng. Hãy yêu cầu lại.</p>
    : null;
}
