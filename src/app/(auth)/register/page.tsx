import Link from 'next/link';
import { RegisterForm } from './register-form';

// Đăng ký: chỉ Sinh viên hoặc Doanh nghiệp tự đăng ký (giảng viên/admin do quản trị cấp)
export default function RegisterPage() {
  return (
    <>
      <h1 className="mb-4 text-xl font-semibold">Đăng ký tài khoản</h1>
      <RegisterForm />
      <p className="mt-4 text-sm">Đã có tài khoản? <Link href="/login" className="underline">Đăng nhập</Link></p>
    </>
  );
}
