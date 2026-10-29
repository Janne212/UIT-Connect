import { ActionForm, Field } from '@/components/forms/action-form';
import { PageTitle } from '@/components/ui';
import { updatePassword } from '../../(auth)/actions';

// Mở từ liên kết đặt lại mật khẩu (auth/confirm đã đổi token thành phiên). Liên kết dùng 1 lần.
export default function ResetPasswordPage() {
  return (
    <div className="max-w-md">
      <PageTitle>Đặt mật khẩu mới</PageTitle>
      <ActionForm action={updatePassword} submitLabel="Đổi mật khẩu">
        <Field label="Mật khẩu mới (tối thiểu 6 ký tự)" name="password" type="password" required />
        <Field label="Nhập lại mật khẩu" name="confirm" type="password" required />
      </ActionForm>
    </div>
  );
}
