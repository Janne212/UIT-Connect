'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { requireRole } from '@/lib/auth/session';
import { zodErrorState } from '@/lib/errors';
import { formToObject } from '@/lib/validation/form';
import { companySchema, profileSchema, teamSchema } from '@/lib/validation/schemas';
import {
  addTeamMember, createTeam, removeTeamMember, transferTeamLeader, updateProfile, updateTeam, upsertCompany,
} from '@/lib/services/accounts';
import { markNotificationsRead } from '@/lib/services/moderation';
import { z } from 'zod';
import type { ActionState } from '@/types';

// Hồ sơ doanh nghiệp (cần có trước khi đăng bài toán)
export async function saveCompanyAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const profile = await requireRole('company');
  const parsed = companySchema.safeParse(formToObject(formData));
  if (!parsed.success) return zodErrorState(parsed.error);
  const res = await upsertCompany(await createClient(), profile.id, parsed.data);
  if (res?.ok) revalidatePath('/company');
  return res;
}

export async function saveProfileAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const profile = await requireRole();
  const parsed = profileSchema.safeParse(formToObject(formData));
  if (!parsed.success) return zodErrorState(parsed.error);
  const res = await updateProfile(await createClient(), profile.id, parsed.data);
  if (res?.ok) revalidatePath('/profile');
  return res;
}

// ---------------------------------------------------------------- Nhóm sinh viên (điều kiện để đăng project/gửi kết nối)
export async function createTeamAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const profile = await requireRole('student');
  const parsed = teamSchema.safeParse(formToObject(formData));
  if (!parsed.success) return zodErrorState(parsed.error);
  const res = await createTeam(await createClient(), profile.id, parsed.data);
  if (!res?.ok) return res;
  revalidatePath('/teams');
  redirect(`/teams/${res.id}`);
}

export async function updateTeamAction(teamId: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireRole('student');
  const parsed = teamSchema.safeParse(formToObject(formData));
  if (!parsed.success) return zodErrorState(parsed.error);
  const res = await updateTeam(await createClient(), teamId, parsed.data);
  if (res?.ok) revalidatePath(`/teams/${teamId}`);
  return res;
}

const memberSchema = z.object({ teamId: z.uuid(), profileId: z.uuid('Hãy chọn sinh viên') });

export async function addTeamMemberAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireRole('student');
  const parsed = memberSchema.safeParse(formToObject(formData));
  if (!parsed.success) return zodErrorState(parsed.error);
  const res = await addTeamMember(await createClient(), parsed.data.teamId, parsed.data.profileId);
  if (res?.ok) revalidatePath(`/teams/${parsed.data.teamId}`);
  return res;
}

export async function removeTeamMemberAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireRole('student');
  const parsed = memberSchema.safeParse(formToObject(formData));
  if (!parsed.success) return zodErrorState(parsed.error);
  const res = await removeTeamMember(await createClient(), parsed.data.teamId, parsed.data.profileId);
  if (res?.ok) revalidatePath(`/teams/${parsed.data.teamId}`);
  return res;
}

export async function transferLeaderAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireRole('student');
  const parsed = memberSchema.safeParse(formToObject(formData));
  if (!parsed.success) return zodErrorState(parsed.error);
  const res = await transferTeamLeader(await createClient(), parsed.data.teamId, parsed.data.profileId);
  if (res?.ok) revalidatePath(`/teams/${parsed.data.teamId}`);
  return res;
}

// ---------------------------------------------------------------- Thông báo
export async function markNotificationsReadAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireRole();
  const ids = formData.getAll('id').map(String).filter((v) => z.uuid().safeParse(v).success);
  const res = await markNotificationsRead(await createClient(), ids.length ? ids : 'all');
  if (res?.ok) revalidatePath('/notifications');
  return res;
}
