'use client';

import { useState } from 'react';
import { ActionForm, Field, FieldError, SelectField } from '@/components/forms/action-form';
import { createPortfolioItemAction } from '../actions';
import type { Tag } from '@/types';

export type TeamOption = {
  id: string;
  name: string;
  members: Array<{ id: string; full_name: string }>;
  projects: Array<{ id: string; title: string }>;
};

// Form "Thêm project, product hoặc paper" — mỗi ô ánh xạ cột portfolio_items / item_tags / item_members
export function PortfolioItemForm({ teams, tags, lecturers }: {
  teams: TeamOption[]; tags: Tag[]; lecturers: Array<{ id: string; full_name: string }>;
}) {
  const [kind, setKind] = useState<'project' | 'product' | 'paper'>('project');
  const [teamId, setTeamId] = useState(teams[0]?.id ?? '');
  const team = teams.find((t) => t.id === teamId);

  return (
    <ActionForm action={createPortfolioItemAction} submitLabel="Publish" pendingLabel="Đang gửi…">
      <fieldset>
        <legend className="text-sm font-medium">Loại nội dung <span className="text-red-700">*</span></legend>
        <div className="mt-1 flex gap-4 text-sm">
          {(['project', 'product', 'paper'] as const).map((k) => (
            <label key={k}><input type="radio" name="kind" value={k} checked={kind === k} onChange={() => setKind(k)} /> {k}</label>
          ))}
        </div>
      </fieldset>

      <div>
        <label htmlFor="f-team_id" className="block text-sm font-medium">Nhóm đăng <span className="text-red-700">*</span></label>
        <select id="f-team_id" name="team_id" value={teamId} onChange={(e) => setTeamId(e.target.value)} className="mt-1 w-full rounded border px-3 py-2 text-sm">
          {teams.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
        </select>
        <FieldError name="team_id" />
      </div>

      {kind !== 'project' && (
        <SelectField key={teamId} label="Thuộc project" name="parent_id" required
          options={(team?.projects ?? []).map((p) => ({ value: p.id, label: p.title }))}
          placeholder={team?.projects.length ? '— Chọn project —' : 'Nhóm chưa có project nào'} />
      )}

      <Field label="Tiêu đề (3–200 ký tự)" name="title" required />
      <Field label="Tóm tắt (10–5000 ký tự)" name="summary" textarea required />
      <Field label="Liên kết nguồn (repo, demo, bài báo)" name="source_url" type="url" placeholder="https://" required />
      <Field label="Ảnh bìa (liên kết)" name="cover_image_url" type="url" placeholder="https://" />
      <div className="grid grid-cols-2 gap-3">
        <Field label="Bắt đầu" name="started_on" type="date" />
        <Field label="Kết thúc" name="finished_on" type="date" />
      </div>
      {kind === 'paper' && <Field label="Ứng dụng thực tiễn (tối đa 3000 ký tự)" name="paper_application" textarea />}
      {kind === 'project' && (
        <SelectField label="Giảng viên hướng dẫn" name="advisor_id" options={lecturers.map((l) => ({ value: l.id, label: l.full_name }))} />
      )}

      <fieldset className="text-sm">
        <legend className="font-medium">Lĩnh vực / kỹ năng</legend>
        <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1">
          {tags.map((t) => <label key={t.id}><input type="checkbox" name="tag_ids" value={t.id} /> {t.name}</label>)}
        </div>
        <FieldError name="tag_ids" />
      </fieldset>

      <fieldset key={teamId} className="space-y-1 text-sm">
        <legend className="font-medium">Thành viên tham gia</legend>
        <input type="hidden" name="member_ids" value="" />
        {(team?.members ?? []).map((m) => (
          <div key={m.id} className="flex items-center gap-2">
            <label className="w-48"><input type="checkbox" name="member_ids" value={m.id} /> {m.full_name}</label>
            <input name={`member_role.${m.id}`} maxLength={80} aria-label={`Vai trò của ${m.full_name}`} placeholder="Vai trò (vd Backend)" className="flex-1 rounded border px-2 py-1" />
          </div>
        ))}
        <FieldError name="members" />
      </fieldset>
    </ActionForm>
  );
}
