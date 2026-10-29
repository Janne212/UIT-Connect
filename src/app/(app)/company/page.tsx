import { Suspense } from 'react';
import { requireRole } from '@/lib/auth/session';
import { createClient } from '@/lib/supabase/server';
import { getMyCompany } from '@/lib/queries/companies';
import { COMPANY_SIZE_RANGES } from '@/lib/constants';
import { ActionForm, Field, SelectField } from '@/components/forms/action-form';
import { Loading, PageTitle } from '@/components/ui';
import { saveCompanyAction } from '../account-actions';

// Hồ sơ doanh nghiệp (FR02) — 1 tài khoản = 1 công ty; bắt buộc có trước khi đăng bài toán
export default function CompanyPage() {
  return <Suspense fallback={<Loading />}><CompanyForm /></Suspense>;
}

async function CompanyForm() {
  const profile = await requireRole('company');
  const c = await getMyCompany(await createClient(), profile.id);
  return (
    <>
      <PageTitle>Hồ sơ doanh nghiệp</PageTitle>
      <div className="max-w-2xl">
        <ActionForm action={saveCompanyAction} submitLabel="Lưu hồ sơ">
          <Field label="Tên doanh nghiệp (5–200 ký tự)" name="name" required defaultValue={c?.name} />
          <Field label="Email liên hệ công khai" name="contact_email" type="email" required defaultValue={c?.contact_email} />
          <Field label="Lĩnh vực hoạt động (10–500 ký tự)" name="industry" required defaultValue={c?.industry} />
          <Field label="Số điện thoại (10–11 chữ số)" name="phone" required defaultValue={c?.phone} />
          <SelectField label="Quy mô" name="size_range" defaultValue={c?.size_range} options={COMPANY_SIZE_RANGES.map((s) => ({ value: s, label: s }))} />
          <Field label="Website" name="website" type="url" placeholder="https://" defaultValue={c?.website} />
          <Field label="Logo (liên kết)" name="logo_url" type="url" placeholder="https://" defaultValue={c?.logo_url} />
          <Field label="Địa chỉ trụ sở" name="address" defaultValue={c?.address} />
          <Field label="Giới thiệu (tối đa 5000 ký tự)" name="description" textarea rows={5} defaultValue={c?.description} />
        </ActionForm>
      </div>
    </>
  );
}
