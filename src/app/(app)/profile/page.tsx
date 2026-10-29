import { Suspense } from 'react';
import { requireRole } from '@/lib/auth/session';
import { createClient } from '@/lib/supabase/server';
import { ActionForm, Field } from '@/components/forms/action-form';
import { Loading, PageTitle } from '@/components/ui';
import { saveProfileAction } from '../account-actions';

// Hồ sơ cá nhân + kênh liên hệ ngoài (chỉ lộ cho đối tác khi kết nối đang thực hiện/đã hoàn thành)
export default function ProfilePage() {
  return <Suspense fallback={<Loading />}><ProfileForm /></Suspense>;
}

async function ProfileForm() {
  const profile = await requireRole();
  const db = await createClient();
  const { data: contacts } = await db.from('profile_contacts').select('email, phone, zalo, other_url').eq('profile_id', profile.id).maybeSingle();
  return (
    <>
      <PageTitle>Hồ sơ của tôi</PageTitle>
      <div className="max-w-2xl">
        <ActionForm action={saveProfileAction} submitLabel="Lưu hồ sơ">
          <Field label="Họ và tên" name="full_name" required defaultValue={profile.full_name} />
          <Field label="Giới thiệu một dòng (tối đa 160 ký tự)" name="headline" defaultValue={profile.headline} />
          <Field label="Ảnh đại diện (liên kết)" name="avatar_url" type="url" defaultValue={profile.avatar_url} />
          {profile.role === 'student' && (
            <>
              <Field label="Khoa / chuyên ngành" name="major" defaultValue={profile.major} />
              <Field label="Khóa" name="cohort" defaultValue={profile.cohort} />
            </>
          )}
          <Field label="Giới thiệu bản thân (tối đa 2000 ký tự)" name="bio" textarea defaultValue={profile.bio} />
          <fieldset className="space-y-3 rounded border p-3">
            <legend className="px-1 text-sm font-medium">Kênh liên hệ ngoài (chỉ đối tác đã kết nối mới thấy)</legend>
            <Field label="Email liên hệ" name="contact_email" type="email" defaultValue={contacts?.email} />
            <Field label="Số điện thoại" name="contact_phone" defaultValue={contacts?.phone} />
            <Field label="Zalo" name="contact_zalo" defaultValue={contacts?.zalo} />
            <Field label="Liên kết khác" name="contact_other_url" type="url" defaultValue={contacts?.other_url} />
          </fieldset>
        </ActionForm>
      </div>
    </>
  );
}
