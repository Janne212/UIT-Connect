import type { z } from 'zod';
import type { DB } from '@/lib/db';
import { mapDbError } from '@/lib/errors';
import type { companySchema, profileSchema, teamSchema } from '@/lib/validation/schemas';
import type { ActionState } from '@/types';

// ---------------------------------------------------------------- Hồ sơ doanh nghiệp (1 tài khoản = 1 công ty)
export async function upsertCompany(db: DB, userId: string, input: z.infer<typeof companySchema>): Promise<ActionState> {
  const row = {
    name: input.name,
    contact_email: input.contact_email,
    industry: input.industry,
    phone: input.phone,
    size_range: input.size_range ?? null,
    website: input.website ?? null,
    description: input.description ?? null,
    logo_url: input.logo_url ?? null,
    address: input.address ?? null,
  };
  const { data: existing, error: readErr } = await db.from('companies').select('id').eq('owner_id', userId).maybeSingle();
  if (readErr) return { error: mapDbError(readErr) };

  const res = existing
    ? await db.from('companies').update(row).eq('id', existing.id).select('id').single()
    : await db.from('companies').insert({ ...row, owner_id: userId }).select('id').single();
  if (res.error) {
    if (res.error.code === '23505') return { error: 'Tài khoản này đã có hồ sơ doanh nghiệp' };
    return { error: mapDbError(res.error) };
  }
  return { ok: true, id: res.data.id, message: 'Đã lưu hồ sơ doanh nghiệp' };
}

// ---------------------------------------------------------------- Hồ sơ cá nhân + kênh liên hệ ngoài
export async function updateProfile(db: DB, userId: string, input: z.infer<typeof profileSchema>): Promise<ActionState> {
  // Chỉ gửi các cột được cấp quyền update; không gửi role, is_active, email
  const { error } = await db
    .from('profiles')
    .update({
      full_name: input.full_name,
      avatar_url: input.avatar_url ?? null,
      headline: input.headline ?? null,
      bio: input.bio ?? null,
      major: input.major ?? null,
      cohort: input.cohort ?? null,
    })
    .eq('id', userId);
  if (error) return { error: mapDbError(error) };

  const contacts = {
    email: input.contact_email ?? null,
    phone: input.contact_phone ?? null,
    zalo: input.contact_zalo ?? null,
    other_url: input.contact_other_url ?? null,
  };
  const hasAny = Object.values(contacts).some(Boolean);
  const res = hasAny
    ? await db.from('profile_contacts').upsert({ profile_id: userId, ...contacts })
    : await db.from('profile_contacts').delete().eq('profile_id', userId); // ck_contact_not_empty: không lưu dòng rỗng
  if (res.error) return { error: mapDbError(res.error) };
  return { ok: true, message: 'Đã lưu hồ sơ' };
}

// ---------------------------------------------------------------- Nhóm sinh viên
export async function createTeam(db: DB, userId: string, input: z.infer<typeof teamSchema>): Promise<ActionState> {
  // created_by bắt buộc = người dùng hiện tại (policy teams_insert); trigger tự thêm người tạo làm nhóm trưởng
  const { data, error } = await db
    .from('student_teams')
    .insert({ name: input.name, description: input.description ?? null, created_by: userId })
    .select('id')
    .single();
  if (error) return { error: mapDbError(error) };
  return { ok: true, id: data.id, message: 'Đã tạo nhóm' };
}

export async function updateTeam(db: DB, teamId: string, input: z.infer<typeof teamSchema>): Promise<ActionState> {
  const { data, error } = await db
    .from('student_teams')
    .update({ name: input.name, description: input.description ?? null })
    .eq('id', teamId)
    .select('id')
    .maybeSingle();
  if (error) return { error: mapDbError(error) };
  if (!data) return { error: 'Chỉ nhóm trưởng được sửa thông tin nhóm' };
  return { ok: true, id: teamId, message: 'Đã lưu thông tin nhóm' };
}

export async function addTeamMember(db: DB, teamId: string, profileId: string): Promise<ActionState> {
  const { error } = await db.from('team_members').insert({ team_id: teamId, profile_id: profileId, member_role: 'member' });
  if (error) {
    if (error.code === '23505') return { error: 'Sinh viên này đã ở trong nhóm' };
    if (error.code === '42501') return { error: 'Chỉ nhóm trưởng được thêm thành viên, và chỉ thêm được tài khoản sinh viên' };
    return { error: mapDbError(error) };
  }
  return { ok: true, message: 'Đã thêm thành viên' };
}

// Nhóm trưởng xóa thành viên, hoặc thành viên tự rời nhóm (không xóa được nhóm trưởng)
export async function removeTeamMember(db: DB, teamId: string, profileId: string): Promise<ActionState> {
  const { data, error } = await db.from('team_members').delete().eq('team_id', teamId).eq('profile_id', profileId).select('profile_id');
  if (error) return { error: mapDbError(error) };
  if (!data.length) return { error: 'Không xóa được: nhóm trưởng phải chuyển quyền trước khi rời nhóm' };
  return { ok: true, message: 'Đã cập nhật thành viên' };
}

export async function transferTeamLeader(db: DB, teamId: string, newLeaderId: string): Promise<ActionState> {
  const { error } = await db.rpc('rpc_transfer_team_leader', { p_team: teamId, p_new_leader: newLeaderId });
  if (error) return { error: mapDbError(error) };
  return { ok: true, message: 'Đã chuyển quyền nhóm trưởng' };
}
