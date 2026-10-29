import { z } from 'zod';
import { COLLABORATION_MODES, COMPANY_SIZE_RANGES, MAX_ATTACHMENT_BYTES } from '@/lib/constants';

// Mỗi schema phản chiếu CHECK của supabase/migrations/20261022000001_schema.sql.
// Đổi CHECK trong DB (bằng migration mới) thì phải sửa ở đây. Database vẫn là chốt chặn cuối.

// ô trống ('' từ FormData) -> undefined để .optional() hoạt động
const blank = (v: unknown) => (typeof v === 'string' && v.trim() === '' ? undefined : v);
const optionalText = (max: number, label: string) =>
  z.preprocess(blank, z.string().trim().max(max, `${label} tối đa ${max} ký tự`).optional());
const httpUrl = (label: string) =>
  z.string().trim().regex(/^https?:\/\//i, `${label} phải bắt đầu bằng http:// hoặc https://`).max(2000);
const optionalHttpUrl = (label: string) => z.preprocess(blank, httpUrl(label).optional());
const emailField = (label: string) => z.email(`${label} không hợp lệ`).trim().max(254);
const optionalUuid = z.preprocess(blank, z.uuid('Mã không hợp lệ').optional());
const optionalDate = z.preprocess(blank, z.iso.date('Ngày không hợp lệ').optional());

// ---------------------------------------------------------------- Tài khoản
export const loginSchema = z.object({
  email: emailField('Email'),
  password: z.string().min(6, 'Mật khẩu tối thiểu 6 ký tự'),
});

export const companyFields = {
  name: z.string().trim().min(5, 'Tên doanh nghiệp từ 5 đến 200 ký tự').max(200, 'Tên doanh nghiệp từ 5 đến 200 ký tự'),
  contact_email: emailField('Email liên hệ'),
  industry: z.string().trim().min(10, 'Lĩnh vực hoạt động tối thiểu 10 ký tự').max(500, 'Lĩnh vực hoạt động tối đa 500 ký tự'),
  phone: z.string().trim().regex(/^[0-9]{10,11}$/, 'Số điện thoại gồm 10–11 chữ số'),
  size_range: z.preprocess(blank, z.enum(COMPANY_SIZE_RANGES, 'Quy mô không hợp lệ').optional()),
  website: optionalHttpUrl('Website'),
  description: optionalText(5000, 'Giới thiệu'),
  logo_url: optionalHttpUrl('Logo'),
  address: optionalText(300, 'Địa chỉ'),
};
export const companySchema = z.object(companyFields);

export const registerSchema = z.discriminatedUnion('role', [
  z.object({
    role: z.literal('student'),
    full_name: z.string().trim().min(1, 'Họ tên không được trống').max(120, 'Họ tên tối đa 120 ký tự'),
    email: emailField('Email'),
    password: z.string().min(6, 'Mật khẩu tối thiểu 6 ký tự'),
    major: optionalText(120, 'Khoa / chuyên ngành'),
    cohort: optionalText(20, 'Khóa'),
  }),
  z.object({
    role: z.literal('company'),
    full_name: z.string().trim().min(1, 'Họ tên người đại diện không được trống').max(120, 'Họ tên tối đa 120 ký tự'),
    email: emailField('Email'),
    password: z.string().min(6, 'Mật khẩu tối thiểu 6 ký tự'),
    // Thông tin doanh nghiệp có thể điền ngay khi đăng ký hoặc sau trong trang hồ sơ doanh nghiệp
    company: z.preprocess((v) => (v && typeof v === 'object' && Object.values(v).some((x) => blank(x) !== undefined) ? v : undefined),
      companySchema.optional()),
  }),
], { error: 'Hãy chọn loại tài khoản Sinh viên hoặc Doanh nghiệp' });

export const forgotPasswordSchema = z.object({ email: emailField('Email') });
export const resetPasswordSchema = z
  .object({
    password: z.string().min(6, 'Mật khẩu tối thiểu 6 ký tự'),
    confirm: z.string(),
  })
  .refine((v) => v.password === v.confirm, { message: 'Mật khẩu nhập lại không khớp', path: ['confirm'] });

export const profileSchema = z.object({
  full_name: z.string().trim().min(1, 'Họ tên không được trống').max(120, 'Họ tên tối đa 120 ký tự'),
  avatar_url: optionalHttpUrl('Ảnh đại diện'),
  headline: optionalText(160, 'Giới thiệu một dòng'),
  bio: optionalText(2000, 'Giới thiệu bản thân'),
  major: optionalText(120, 'Khoa / chuyên ngành'),
  cohort: optionalText(20, 'Khóa'),
  contact_email: z.preprocess(blank, emailField('Email liên hệ').optional()),
  contact_phone: optionalText(30, 'Số điện thoại'),
  contact_zalo: optionalText(100, 'Zalo'),
  contact_other_url: optionalHttpUrl('Liên kết khác'),
});

// ---------------------------------------------------------------- Nhóm
export const teamSchema = z.object({
  name: z.string().trim().min(2, 'Tên nhóm từ 2 đến 100 ký tự').max(100, 'Tên nhóm từ 2 đến 100 ký tự'),
  description: optionalText(3000, 'Mô tả nhóm'),
});

// ---------------------------------------------------------------- Project / product / paper
export const itemMemberSchema = z.object({
  profile_id: z.uuid('Thành viên không hợp lệ'),
  role_label: optionalText(80, 'Vai trò trong nội dung'),
});

export const portfolioItemSchema = z
  .object({
    kind: z.enum(['project', 'product', 'paper'], 'Hãy chọn loại nội dung'),
    team_id: z.uuid('Hãy chọn nhóm đăng'),
    parent_id: optionalUuid,
    title: z.string().trim().min(3, 'Tiêu đề từ 3 đến 200 ký tự').max(200, 'Tiêu đề từ 3 đến 200 ký tự'),
    summary: z.string().trim().min(10, 'Tóm tắt từ 10 đến 5000 ký tự').max(5000, 'Tóm tắt từ 10 đến 5000 ký tự'),
    source_url: httpUrl('Liên kết nguồn'),
    cover_image_url: optionalHttpUrl('Ảnh bìa'),
    started_on: optionalDate,
    finished_on: optionalDate,
    paper_application: optionalText(3000, 'Ứng dụng thực tiễn'),
    advisor_id: optionalUuid,
    tag_ids: z.array(z.coerce.number().int().positive()).max(20, 'Tối đa 20 tag').default([]),
    members: z.array(itemMemberSchema).max(30).default([]),
  })
  .superRefine((v, ctx) => {
    if (v.kind !== 'project' && !v.parent_id)
      ctx.addIssue({ code: 'custom', path: ['parent_id'], message: 'Product/paper phải thuộc một project của nhóm' });
    if (v.kind === 'project' && v.parent_id)
      ctx.addIssue({ code: 'custom', path: ['parent_id'], message: 'Project không có project cha' });
    if (v.paper_application && v.kind !== 'paper')
      ctx.addIssue({ code: 'custom', path: ['paper_application'], message: 'Ứng dụng thực tiễn chỉ dành cho paper' });
    if (v.advisor_id && v.kind !== 'project')
      ctx.addIssue({ code: 'custom', path: ['advisor_id'], message: 'Giảng viên hướng dẫn chỉ gắn cho project' });
    if (v.started_on && v.finished_on && v.finished_on < v.started_on)
      ctx.addIssue({ code: 'custom', path: ['finished_on'], message: 'Ngày kết thúc không được trước ngày bắt đầu' });
  });

// ---------------------------------------------------------------- Bài toán doanh nghiệp
export const problemExtraSchema = z.object({
  background: optionalText(5000, 'Bối cảnh'),
  constraints: optionalText(5000, 'Ràng buộc kỹ thuật'),
  tech_requirements: optionalText(2000, 'Yêu cầu công nghệ'),
  compensation: optionalText(1000, 'Quyền lợi / kinh phí'),
  collaboration_mode: z.preprocess(blank, z.enum(COLLABORATION_MODES, 'Hình thức làm việc không hợp lệ').optional()),
  preferred_team_size: z.preprocess(blank, z.coerce.number().int().min(1, 'Quy mô nhóm từ 1 đến 20').max(20, 'Quy mô nhóm từ 1 đến 20').optional()),
});

export const problemSchema = z.object({
  title: z.string().trim().min(10, 'Tiêu đề từ 10 đến 250 ký tự').max(250, 'Tiêu đề từ 10 đến 250 ký tự'),
  description: z.string().trim().min(30, 'Mô tả vấn đề tối thiểu 30 ký tự').max(20000),
  expected_outcome: z.string().trim().min(10, 'Kết quả kỳ vọng tối thiểu 10 ký tự').max(10000),
  estimated_duration_days: z.coerce.number('Ước lượng thời gian phải là số ngày').int().min(1, 'Ước lượng từ 1 đến 730 ngày').max(730, 'Ước lượng từ 1 đến 730 ngày'),
  extra: problemExtraSchema.default({}),
  tag_ids: z.array(z.coerce.number().int().positive()).max(20, 'Tối đa 20 tag').default([]),
});

// ---------------------------------------------------------------- Kết nối
export const createConnectionSchema = z.object({
  problemId: z.uuid('Hãy chọn bài toán'),
  teamId: z.uuid('Hãy chọn nhóm'),
  itemId: optionalUuid,
  message: optionalText(3000, 'Thư ngỏ'),
  ttlDays: z.coerce.number('Hãy chọn thời hạn phản hồi').int().positive('Hãy chọn thời hạn phản hồi'),
  attachmentUrl: optionalHttpUrl('Liên kết đề xuất'),
});

export const respondConnectionSchema = z.object({
  id: z.uuid('Yêu cầu không hợp lệ'),
  decision: z.enum(['accept', 'reject'], 'Hãy chọn Đồng ý hoặc Từ chối'),
  message: optionalText(3000, 'Nội dung gửi kèm'),
});

export const endConnectionSchema = z
  .object({
    id: z.uuid('Kết nối không hợp lệ'),
    outcome: z.enum(['completed', 'cancelled'], 'Hãy chọn Hoàn thành hoặc Dừng'),
    reason: optionalText(2000, 'Lý do'),
    rating: z.preprocess(blank, z.coerce.number().int().min(1).max(5).optional()),
    feedback: optionalText(3000, 'Nhận xét'),
    deliverableUrl: optionalHttpUrl('Liên kết bàn giao'),
  })
  .superRefine((v, ctx) => {
    if (v.outcome === 'cancelled' && !v.reason)
      ctx.addIssue({ code: 'custom', path: ['reason'], message: 'Cần nêu lý do dừng kết nối' });
    if (v.outcome === 'completed' && !v.rating)
      ctx.addIssue({ code: 'custom', path: ['rating'], message: 'Cần chọn điểm đánh giá từ 1 đến 5' });
  });

export const extendConnectionSchema = z.object({
  id: z.uuid('Kết nối không hợp lệ'),
  newEnd: z.iso.date('Hãy chọn hạn mới'),
  reason: optionalText(1000, 'Lý do gia hạn'),
});

export const attachmentRecordSchema = z.object({
  connectionId: z.uuid(),
  kind: z.enum(['proposal', 'deliverable']),
  storagePath: z.string().min(40).max(400),
  fileName: z.string().trim().min(1).max(255),
  mimeType: z.string().max(255).optional(),
  sizeBytes: z.coerce.number().int().min(1, 'Tệp rỗng').max(MAX_ATTACHMENT_BYTES, 'Tệp tối đa 20 MB'),
});

// ---------------------------------------------------------------- Kiểm duyệt
export const reviewSchema = z
  .object({
    entity: z.enum(['portfolio_item', 'business_problem']),
    id: z.uuid(),
    decision: z.enum(['approve', 'reject'], 'Hãy chọn Duyệt hoặc Từ chối'),
    note: optionalText(2000, 'Ghi chú'),
  })
  .superRefine((v, ctx) => {
    if (v.decision === 'reject' && !v.note)
      ctx.addIssue({ code: 'custom', path: ['note'], message: 'Cần ghi lý do từ chối' });
  });

export const contentRefSchema = z.object({
  entity: z.enum(['portfolio_item', 'business_problem']),
  id: z.uuid(),
});

// ---------------------------------------------------------------- Tìm kiếm
export const searchParamsSchema = z.object({
  q: z.preprocess(blank, z.string().max(200).optional()),
  kind: z.preprocess(blank, z.enum(['project', 'product', 'paper']).optional()),
  tag: z.preprocess((v) => (v === undefined ? [] : Array.isArray(v) ? v : [v]), z.array(z.coerce.number().int().positive()).max(20)),
  status: z.preprocess(blank, z.string().max(30).optional()),
  page: z.preprocess(blank, z.coerce.number().int().min(1).max(1000).default(1)),
});
