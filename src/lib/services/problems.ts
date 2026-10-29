import type { z } from 'zod';
import type { DB } from '@/lib/db';
import { mapDbError } from '@/lib/errors';
import type { problemSchema } from '@/lib/validation/schemas';
import type { ActionState } from '@/types';

export type ProblemInput = z.infer<typeof problemSchema>;

// Trường bắt buộc là cột; trường mở rộng của form gom vào cột extra (jsonb object)
function problemColumns(input: ProblemInput) {
  const extra = Object.fromEntries(Object.entries(input.extra).filter(([, v]) => v !== undefined && v !== ''));
  return {
    title: input.title,
    description: input.description,
    expected_outcome: input.expected_outcome,
    estimated_duration_days: input.estimated_duration_days,
    extra,
  };
}

// Tạo bài toán. companies đọc được bởi mọi người nên PHẢI lọc theo owner_id.
// Trigger trg_problem_insert ép pending_review/open dù client gửi gì.
export async function createProblem(db: DB, userId: string, input: ProblemInput): Promise<ActionState> {
  const { data: company, error: cErr } = await db.from('companies').select('id').eq('owner_id', userId).maybeSingle();
  if (cErr) return { error: mapDbError(cErr) };
  if (!company) return { error: 'Hãy hoàn thiện hồ sơ doanh nghiệp trước khi đăng bài toán' };

  const { data, error } = await db
    .from('business_problems')
    .insert({ company_id: company.id, ...problemColumns(input) })
    .select('id')
    .single();
  if (error) return { error: mapDbError(error) };

  const tagError = await replaceProblemTags(db, data.id, input.tag_ids);
  if (tagError) {
    await db.from('business_problems').delete().eq('id', data.id);
    return { error: tagError };
  }
  return { ok: true, id: data.id, message: 'Đã gửi bài toán, vui lòng chờ giảng viên duyệt' };
}

// Sửa chỉ khi bài còn "open" (policy bp_update). Không đổi được trạng thái duyệt/giải quyết.
export async function updateProblem(db: DB, id: string, input: ProblemInput): Promise<ActionState> {
  const { data, error } = await db.from('business_problems').update(problemColumns(input)).eq('id', id).select('id').maybeSingle();
  if (error) return { error: mapDbError(error) };
  if (!data) return { error: 'Chỉ sửa được bài toán của bạn khi chưa có nhóm thực hiện' };
  const tagError = await replaceProblemTags(db, id, input.tag_ids);
  if (tagError) return { error: tagError };
  return { ok: true, id, message: 'Đã lưu thay đổi' };
}

async function replaceProblemTags(db: DB, problemId: string, tagIds: number[]): Promise<string | null> {
  const del = await db.from('problem_tags').delete().eq('problem_id', problemId);
  if (del.error) return mapDbError(del.error);
  if (!tagIds.length) return null;
  const { error } = await db.from('problem_tags').insert([...new Set(tagIds)].map((tag_id) => ({ problem_id: problemId, tag_id })));
  return error ? mapDbError(error) : null;
}

// Bài chưa duyệt -> xóa cứng; đã duyệt -> xóa mềm qua RPC (RPC chặn khi đang có nhóm thực hiện
// và tự đóng các yêu cầu đang chờ của bài toán)
export async function deleteProblem(db: DB, id: string): Promise<ActionState> {
  const { data: problem, error } = await db.from('business_problems').select('id, review_status').eq('id', id).maybeSingle();
  if (error) return { error: mapDbError(error) };
  if (!problem) return { error: 'Không tìm thấy bài toán' };
  if (problem.review_status === 'approved') {
    const res = await db.rpc('rpc_soft_delete_content', { p_entity: 'business_problem', p_id: id });
    if (res.error) return { error: mapDbError(res.error) };
  } else {
    const res = await db.from('business_problems').delete().eq('id', id).select('id');
    if (res.error) return { error: mapDbError(res.error) };
    if (!res.data.length) return { error: 'Bạn không có quyền xóa bài toán này' };
  }
  return { ok: true, message: 'Đã xóa bài toán' };
}
