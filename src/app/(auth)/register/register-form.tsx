'use client';

import { useState } from 'react';
import { ActionForm, Field, SelectField } from '@/components/forms/action-form';
import { COMPANY_SIZE_RANGES } from '@/lib/constants';
import { signUp } from '../actions';

export function RegisterForm() {
  const [role, setRole] = useState<'student' | 'company'>('student');
  return (
    <ActionForm action={signUp} submitLabel="Đăng ký" pendingLabel="Đang tạo tài khoản…">
      <fieldset>
        <legend className="text-sm font-medium">Loại tài khoản</legend>
        <div className="mt-1 flex gap-4 text-sm">
          <label><input type="radio" name="role" value="student" checked={role === 'student'} onChange={() => setRole('student')} /> Sinh viên</label>
          <label><input type="radio" name="role" value="company" checked={role === 'company'} onChange={() => setRole('company')} /> Doanh nghiệp</label>
        </div>
      </fieldset>
      <Field label={role === 'company' ? 'Họ tên người đại diện' : 'Họ và tên'} name="full_name" required />
      <Field label="Email" name="email" type="email" required />
      <Field label="Mật khẩu (tối thiểu 6 ký tự)" name="password" type="password" required />
      {role === 'student' ? (
        <>
          <Field label="Khoa / chuyên ngành" name="major" />
          <Field label="Khóa (vd K19)" name="cohort" />
        </>
      ) : (
        <fieldset className="space-y-3 rounded border p-3">
          <legend className="px-1 text-sm font-medium">Thông tin doanh nghiệp (có thể bổ sung sau)</legend>
          <Field label="Tên doanh nghiệp (5–200 ký tự)" name="company.name" />
          <Field label="Email liên hệ công khai" name="company.contact_email" type="email" />
          <Field label="Lĩnh vực hoạt động (tối thiểu 10 ký tự)" name="company.industry" />
          <Field label="Số điện thoại (10–11 chữ số)" name="company.phone" />
          <SelectField label="Quy mô" name="company.size_range" options={COMPANY_SIZE_RANGES.map((s) => ({ value: s, label: s }))} />
          <Field label="Website" name="company.website" type="url" placeholder="https://" />
          <Field label="Địa chỉ trụ sở" name="company.address" />
        </fieldset>
      )}
    </ActionForm>
  );
}
