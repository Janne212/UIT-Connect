import Link from 'next/link';
import { Suspense } from 'react';
import { requireRole } from '@/lib/auth/session';
import { createClient } from '@/lib/supabase/server';
import { listTags } from '@/lib/queries/catalog';
import { getMyCompany } from '@/lib/queries/companies';
import { COLLABORATION_MODES } from '@/lib/constants';
import { ActionForm, Field, FieldError, SelectField } from '@/components/forms/action-form';
import { Empty, Loading, PageTitle } from '@/components/ui';
import { createProblemAction } from '../actions';

// Chức năng 3 — Tạo/Thêm bài toán/vấn đề (chỉ doanh nghiệp đã có hồ sơ công ty; bài vào Chờ duyệt)
export default function NewProblemPage() {
  return <Suspense fallback={<Loading />}><NewProblem /></Suspense>;
}

async function NewProblem() {
  const profile = await requireRole('company');
  const db = await createClient();
  const [company, tags] = await Promise.all([getMyCompany(db, profile.id), listTags(db)]);
  if (!company) {
    return (
      <>
        <PageTitle>Đăng bài toán mới</PageTitle>
        <Empty>Hãy hoàn thiện <Link href="/company" className="underline">hồ sơ doanh nghiệp</Link> trước khi đăng bài toán.</Empty>
      </>
    );
  }
  return (
    <>
      <PageTitle>Đăng bài toán mới</PageTitle>
      <div className="max-w-2xl">
        <ActionForm action={createProblemAction} submitLabel="Publish">
          <Field label="Tên bài toán (10–250 ký tự)" name="title" required />
          <Field label="Mô tả vấn đề (tối thiểu 30 ký tự)" name="description" textarea rows={6} required />
          <Field label="Kết quả kỳ vọng (tối thiểu 10 ký tự)" name="expected_outcome" textarea required />
          <Field label="Ước lượng thời gian (ngày, 1–730)" name="estimated_duration_days" type="number" min={1} max={730} required />
          <fieldset className="text-sm">
            <legend className="font-medium">Lĩnh vực / kỹ năng cần có</legend>
            <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1">
              {tags.map((t) => <label key={t.id}><input type="checkbox" name="tag_ids" value={t.id} /> {t.name}</label>)}
            </div>
            <FieldError name="tag_ids" />
          </fieldset>
          <fieldset className="space-y-3 rounded border p-3">
            <legend className="px-1 text-sm font-medium">Thông tin mở rộng (không bắt buộc)</legend>
            <Field label="Bối cảnh" name="extra.background" textarea />
            <Field label="Ràng buộc kỹ thuật" name="extra.constraints" textarea />
            <Field label="Yêu cầu công nghệ" name="extra.tech_requirements" />
            <Field label="Quyền lợi / kinh phí" name="extra.compensation" />
            <SelectField label="Hình thức làm việc" name="extra.collaboration_mode" options={COLLABORATION_MODES.map((m) => ({ value: m, label: m }))} />
            <Field label="Quy mô nhóm mong muốn (1–20)" name="extra.preferred_team_size" type="number" min={1} max={20} />
          </fieldset>
        </ActionForm>
      </div>
    </>
  );
}
