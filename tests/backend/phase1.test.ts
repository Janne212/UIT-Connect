// Kiểm thử backend giai đoạn 1 qua đúng các hàm mà Server Action / trang gọi (lib/services, lib/queries),
// với client supabase-js thật -> PostgREST -> PostgreSQL có RLS. Chạy bằng tests/backend/run.sh.
import assert from 'node:assert/strict';
import { after, before, describe, test } from 'node:test';
import { anonClient, clientAs, IDS, startProxy, stopProxy } from './harness';
import { formToObject } from '@/lib/validation/form';
import {
  createConnectionSchema, endConnectionSchema, portfolioItemSchema, problemSchema, registerSchema, reviewSchema,
} from '@/lib/validation/schemas';
import { upsertCompany, createTeam, addTeamMember, removeTeamMember, updateProfile } from '@/lib/services/accounts';
import { createPortfolioItem, deletePortfolioItem, resubmitContent, updatePortfolioItem } from '@/lib/services/portfolio';
import { createProblem, deleteProblem, updateProblem } from '@/lib/services/problems';
import {
  createConnectionRequest, endConnection, extendConnection, recordAttachment, respondConnection,
} from '@/lib/services/connections';
import { markNotificationsRead, submitReview } from '@/lib/services/moderation';
import { getConnectionTtlOptions, listTags } from '@/lib/queries/catalog';
import { getPortfolioItem, searchPortfolio } from '@/lib/queries/portfolio';
import { getProblem, listCompanyProblems, searchProblems } from '@/lib/queries/problems';
import { getConnection, getPartnerContacts, listConnections } from '@/lib/queries/connections';
import { getTrackingBoard } from '@/lib/queries/tracking';
import { getStaffDashboard } from '@/lib/queries/dashboard';
import { getTeam, getTeamEngagements, listMyLeaderTeams, searchStudents } from '@/lib/queries/teams';
import { countUnreadNotifications, listNotifications } from '@/lib/queries/notifications';
import { getMyCompany } from '@/lib/queries/companies';

const fd = (entries: Array<[string, string]>) => {
  const f = new FormData();
  for (const [k, v] of entries) f.append(k, v);
  return f;
};

const A = () => clientAs('A');
const B = () => clientAs('B');
const A2 = () => clientAs('A2');
const C = () => clientAs('C');
const C2 = () => clientAs('C2');
const L = () => clientAs('L');

const ctx: Record<string, string> = {};
let tagAI = 0, tagPython = 0, tagWeb = 0;

before(async () => {
  await startProxy();
  const tags = await listTags(A());
  tagAI = tags.find((t) => t.slug === 'tri-tue-nhan-tao')!.id;
  tagPython = tags.find((t) => t.slug === 'python')!.id;
  tagWeb = tags.find((t) => t.slug === 'phat-trien-web')!.id;
});
after(stopProxy);

describe('Tài khoản & hồ sơ', () => {
  test('Zod đăng ký: chỉ nhận student/company, doanh nghiệp điền công ty ngay khi đăng ký', () => {
    const bad = registerSchema.safeParse({ role: 'admin', full_name: 'X', email: 'x@a.vn', password: '123456' });
    assert.equal(bad.success, false);
    const company = registerSchema.safeParse(formToObject(fd([
      ['role', 'company'], ['full_name', 'Trần C'], ['email', 'c@c.vn'], ['password', '123456'],
      ['company.name', 'Công ty C'], ['company.contact_email', 'lh@c.vn'], ['company.industry', 'Phần mềm doanh nghiệp'],
      ['company.phone', '0281234567'], ['company.size_range', '51-200'], ['company.website', ''],
    ])));
    assert.ok(company.success, JSON.stringify(company.error?.issues));
    assert.equal(company.data.role === 'company' && company.data.company?.name, 'Công ty C');
    const companyNoProfile = registerSchema.safeParse(formToObject(fd([
      ['role', 'company'], ['full_name', 'Trần C'], ['email', 'c@c.vn'], ['password', '123456'], ['company.name', ''],
    ])));
    assert.ok(companyNoProfile.success, 'công ty để trống -> bỏ qua, điền sau');
  });

  test('Doanh nghiệp tạo hồ sơ công ty; sinh viên không tạo được', async () => {
    const res = await upsertCompany(C(), IDS.C, {
      name: 'Công ty Cổ phần C', contact_email: 'lienhe@c.vn', industry: 'Phần mềm doanh nghiệp và AI',
      phone: '0281234567', size_range: '51-200', website: 'https://c.vn',
    });
    assert.ok(res?.ok, res?.error);
    const again = await upsertCompany(C(), IDS.C, {
      name: 'Công ty Cổ phần C (sửa)', contact_email: 'lienhe@c.vn', industry: 'Phần mềm doanh nghiệp và AI', phone: '0281234567',
    });
    assert.ok(again?.ok, 'lần 2 là cập nhật, không tạo trùng');
    assert.equal((await getMyCompany(C(), IDS.C))?.name, 'Công ty Cổ phần C (sửa)');
    assert.ok((await upsertCompany(C2(), IDS.C2, {
      name: 'Công ty TNHH C2', contact_email: 'hr@c2.vn', industry: 'Thương mại điện tử', phone: '02899998888',
    }))?.ok);
    const student = await upsertCompany(A(), IDS.A, {
      name: 'Sinh viên lập công ty', contact_email: 'a@a.vn', industry: 'Phần mềm doanh nghiệp', phone: '0281234567',
    });
    assert.ok(student?.error);
  });

  test('Cập nhật hồ sơ + kênh liên hệ ngoài', async () => {
    const res = await updateProfile(A(), IDS.A, { full_name: 'Sinh viên A', headline: 'KTPM K19', contact_email: 'a.personal@gmail.com' });
    assert.ok(res?.ok, res?.error);
    assert.ok((await updateProfile(C(), IDS.C, { full_name: 'Đại diện C', contact_zalo: '0909000111' }))?.ok);
  });

  test('Nhóm: tạo, tìm sinh viên theo tên (có/không dấu), thêm thành viên', async () => {
    const team = await createTeam(A(), IDS.A, { name: 'Nhóm AI UIT', description: 'Nghiên cứu trí tuệ nhân tạo' });
    assert.ok(team?.ok && team.id);
    ctx.teamA = team.id!;
    const found = await searchStudents(A(), 'sinh vien b');
    assert.ok(found.some((p) => p.id === IDS.B), 'tìm không dấu ra "Sinh viên B"');
    assert.ok((await addTeamMember(A(), ctx.teamA, IDS.B))?.ok);
    assert.match((await addTeamMember(A(), ctx.teamA, IDS.B))?.error ?? '', /đã ở trong nhóm/);
    assert.ok((await addTeamMember(B(), ctx.teamA, IDS.A2))?.error, 'thành viên thường không thêm được');
    assert.ok((await createTeam(C(), IDS.C, { name: 'Nhóm của DN' }))?.error, 'doanh nghiệp không tạo nhóm');
    const t2 = await createTeam(A2(), IDS.A2, { name: 'Nhóm Web A2' });
    ctx.teamA2 = t2!.id!;
    const team1 = await getTeam(B(), ctx.teamA);
    assert.equal(team1?.team_members.length, 2);
    assert.deepEqual((await listMyLeaderTeams(A(), IDS.A)).map((t) => t.id), [ctx.teamA]);
    assert.match((await removeTeamMember(A(), ctx.teamA, IDS.A))?.error ?? '', /chuyển quyền/);
  });
});

describe('Chức năng 2 — Tạo/Thêm project/product/paper', () => {
  test('Form hợp lệ -> bài ở trạng thái Chờ duyệt, kèm tag và thành viên', async () => {
    const parsed = portfolioItemSchema.safeParse(formToObject(fd([
      ['kind', 'project'], ['team_id', ctx.teamA], ['title', 'Chatbot trí tuệ nhân tạo hỗ trợ tuyển sinh'],
      ['summary', 'Chatbot trả lời câu hỏi tuyển sinh dùng mô hình ngôn ngữ lớn'], ['source_url', 'https://github.com/uit/chatbot'],
      ['started_on', '2026-02-01'], ['finished_on', '2026-06-30'], ['advisor_id', IDS.L],
      ['tag_ids', String(tagAI)], ['tag_ids', String(tagPython)],
      ['member_ids', IDS.A], ['member_role.' + IDS.A, 'Trưởng nhóm'], ['member_ids', IDS.B], ['member_role.' + IDS.B, 'Backend'],
    ]), ['tag_ids']));
    assert.ok(parsed.success, JSON.stringify(parsed.error?.issues));
    const res = await createPortfolioItem(A(), IDS.A, parsed.data);
    assert.ok(res?.ok, res?.error);
    ctx.project = res!.id!;
    const item = await getPortfolioItem(A(), ctx.project);
    assert.equal(item?.review_status, 'pending_review');
    assert.equal(item?.item_tags.length, 2);
    assert.equal(item?.item_members.length, 2);
    assert.equal(item?.advisor?.full_name, 'Giảng viên L');
  });

  test('Product phải chọn project cha; thiếu thông tin báo lỗi, không lưu', async () => {
    const noParent = portfolioItemSchema.safeParse({ kind: 'product', team_id: ctx.teamA, title: 'EduBot', summary: 'Bản demo của chatbot', source_url: 'https://edubot.vn' });
    assert.equal(noParent.success, false);
    const missing = portfolioItemSchema.safeParse({ kind: 'project', team_id: ctx.teamA, title: '', summary: 'ngắn', source_url: 'ftp://x' });
    assert.equal(missing.success, false);
    assert.ok(missing.error!.issues.length >= 3);
    const ok = portfolioItemSchema.parse({ kind: 'product', team_id: ctx.teamA, parent_id: ctx.project, title: 'EduBot bản demo',
      summary: 'Bản chạy thử của chatbot tuyển sinh', source_url: 'https://edubot.demo.vn' });
    const res = await createPortfolioItem(A(), IDS.A, ok);
    assert.ok(res?.ok, res?.error);
    ctx.product = res!.id!;
  });

  test('Thành viên ngoài nhóm -> lỗi và bài vừa tạo được dọn', async () => {
    const input = portfolioItemSchema.parse({ kind: 'project', team_id: ctx.teamA, title: 'Bài có thành viên lạ',
      summary: 'Thử ghi item_members sai nhóm', source_url: 'https://x.vn', members: [{ profile_id: IDS.A2 }] });
    const res = await createPortfolioItem(A(), IDS.A, input);
    assert.match(res?.error ?? '', /thuộc nhóm/);
    const { count } = await A().from('portfolio_items').select('id', { count: 'exact', head: true }).eq('title', 'Bài có thành viên lạ');
    assert.equal(count, 0);
  });

  test('Bài chờ duyệt không hiện với người khác, không có trong tìm kiếm', async () => {
    assert.equal(await getPortfolioItem(C(), ctx.project), null);
    assert.equal((await searchPortfolio(C(), { q: 'chatbot' })).total, 0);
  });

  test('Doanh nghiệp không được đăng project', async () => {
    const res = await createPortfolioItem(C(), IDS.C, portfolioItemSchema.parse({ kind: 'project', team_id: ctx.teamA,
      title: 'DN đăng hộ', summary: 'Doanh nghiệp không có quyền', source_url: 'https://x.vn' }));
    assert.ok(res?.error);
  });
});

describe('Chức năng 3 — Tạo/Thêm bài toán doanh nghiệp', () => {
  test('Form hợp lệ (cột bắt buộc + extra + tag) -> Chờ duyệt', async () => {
    const parsed = problemSchema.safeParse(formToObject(fd([
      ['title', 'Tối ưu hóa mô hình LLM trên thiết bị biên'],
      ['description', 'Doanh nghiệp cần chạy mô hình ngôn ngữ trên thiết bị biên với bộ nhớ hạn chế.'],
      ['expected_outcome', 'Mô hình chạy dưới 2GB RAM'], ['estimated_duration_days', '90'],
      ['extra.background', 'Thiết bị IoT tại nhà máy'], ['extra.collaboration_mode', 'Từ xa'], ['extra.preferred_team_size', '4'],
      ['extra.compensation', ''], ['tag_ids', String(tagAI)],
    ]), ['tag_ids']));
    assert.ok(parsed.success, JSON.stringify(parsed.error?.issues));
    const res = await createProblem(C(), IDS.C, parsed.data);
    assert.ok(res?.ok, res?.error);
    ctx.p1 = res!.id!;
    const p = await getProblem(C(), ctx.p1);
    assert.equal(p?.review_status, 'pending_review');
    assert.deepEqual(p?.extra, { background: 'Thiết bị IoT tại nhà máy', collaboration_mode: 'Từ xa', preferred_team_size: 4 });
    ctx.p3 = (await createProblem(C(), IDS.C, problemSchema.parse({ title: 'Hệ thống gợi ý sản phẩm thương mại',
      description: 'Xây dựng hệ thống gợi ý sản phẩm cho sàn thương mại điện tử.', expected_outcome: 'Tăng tỉ lệ chuyển đổi',
      estimated_duration_days: 60, tag_ids: [tagWeb] })))!.id!;
    ctx.p2 = (await createProblem(C2(), IDS.C2, problemSchema.parse({ title: 'Phân tích dữ liệu khách hàng thân thiết',
      description: 'Phân tích hành vi mua sắm để đề xuất chương trình khách hàng thân thiết.',
      expected_outcome: 'Báo cáo phân khúc khách hàng', estimated_duration_days: 45 })))!.id!;
  });

  test('Thiếu thông tin báo lỗi tiếng Việt; sinh viên không đăng được', async () => {
    const bad = problemSchema.safeParse({ title: 'Ngắn', description: 'ngắn', expected_outcome: '', estimated_duration_days: '731' });
    assert.equal(bad.success, false);
    const msgs = bad.error!.issues.map((i) => i.message).join(' | ');
    assert.match(msgs, /Tiêu đề từ 10 đến 250 ký tự/);
    assert.match(msgs, /Ước lượng từ 1 đến 730 ngày/);
    const student = await createProblem(A(), IDS.A, problemSchema.parse({ title: 'Sinh viên đăng bài toán',
      description: 'Sinh viên không có hồ sơ doanh nghiệp nên phải bị chặn.', expected_outcome: 'Phải bị hệ thống chặn', estimated_duration_days: 10 }));
    assert.match(student?.error ?? '', /hồ sơ doanh nghiệp/);
  });

  test('Sửa bài toán khi còn mở', async () => {
    const res = await updateProblem(C(), ctx.p3, problemSchema.parse({ title: 'Hệ thống gợi ý sản phẩm thương mại điện tử',
      description: 'Xây dựng hệ thống gợi ý sản phẩm cho sàn thương mại điện tử.', expected_outcome: 'Tăng tỉ lệ chuyển đổi',
      estimated_duration_days: 60, tag_ids: [tagWeb, tagPython] }));
    assert.ok(res?.ok, res?.error);
    assert.ok((await updateProblem(C2(), ctx.p3, problemSchema.parse({ title: 'Doanh nghiệp khác sửa bài',
      description: 'Không được phép sửa bài toán của công ty khác.', expected_outcome: 'Phải bị hệ thống chặn', estimated_duration_days: 1 })))?.error);
  });
});

describe('Kiểm duyệt (điều kiện để nội dung hiển thị)', () => {
  test('Giảng viên duyệt; từ chối bắt buộc lý do; sinh viên không duyệt được', async () => {
    assert.equal(reviewSchema.safeParse({ entity: 'business_problem', id: ctx.p1, decision: 'reject', note: '' }).success, false);
    assert.ok((await submitReview(A(), { entity: 'business_problem', id: ctx.p1, decision: 'approve' }))?.error);
    for (const id of [ctx.p1, ctx.p2, ctx.p3]) {
      assert.ok((await submitReview(L(), { entity: 'business_problem', id, decision: 'approve' }))?.ok);
    }
    assert.ok((await submitReview(L(), { entity: 'portfolio_item', id: ctx.project, decision: 'approve' }))?.ok);
    const rej = await submitReview(L(), { entity: 'portfolio_item', id: ctx.product, decision: 'reject', note: 'Thiếu ảnh demo' });
    assert.ok(rej?.ok);
    const again = await submitReview(L(), { entity: 'portfolio_item', id: ctx.product, decision: 'approve' });
    assert.match(again?.error ?? '', /Không có nội dung đang chờ duyệt/);
  });

  test('Gửi lại bài bị từ chối rồi được duyệt', async () => {
    assert.ok((await resubmitContent(A(), 'portfolio_item', ctx.product))?.ok);
    assert.ok((await submitReview(L(), { entity: 'portfolio_item', id: ctx.product, decision: 'approve' }))?.ok);
  });
});

describe('Chức năng 9 — Tìm kiếm sản phẩm/bài toán theo lĩnh vực', () => {
  test('Lọc theo tag lĩnh vực (một bảng tag chung)', async () => {
    const items = await searchPortfolio(C(), { tagIds: [tagAI] });
    assert.deepEqual(items.rows.map((r) => r.id), [ctx.project]);
    assert.equal(items.rows[0].student_teams?.name, 'Nhóm AI UIT');
    assert.equal(items.rows[0].item_tags.length, 2, 'vẫn trả đủ tag để hiển thị, không chỉ tag đang lọc');
    const problems = await searchProblems(A(), { tagIds: [tagAI] });
    assert.deepEqual(problems.rows.map((r) => r.id), [ctx.p1]);
    const multi = await searchProblems(A(), { tagIds: [tagAI, tagWeb] });
    assert.equal(multi.total, 2, 'nhiều tag: bài có ít nhất một tag');
    assert.equal((await searchProblems(A(), { tagIds: [tagPython, tagWeb] })).total, 1, 'không trả trùng dòng khi khớp 2 tag');
    assert.equal((await searchProblems(A(), {})).total, 3, 'bỏ hết tag -> danh sách đầy đủ');
  });

  test('Từ khóa có dấu / không dấu ra cùng kết quả; lọc theo loại', async () => {
    const a = await searchPortfolio(C(), { q: 'trí tuệ nhân tạo' });
    const b = await searchPortfolio(C(), { q: 'tri tue nhan tao' });
    assert.equal(a.total, 1);
    assert.deepEqual(a.rows.map((r) => r.id), b.rows.map((r) => r.id));
    assert.equal((await searchPortfolio(C(), { kind: 'product' })).rows[0]?.id, ctx.product);
    assert.equal((await searchProblems(A(), { q: 'LLM thiết bị biên' })).total, 1);
    assert.equal((await searchProblems(A(), { q: 'blockchain' })).total, 0);
    assert.equal((await searchProblems(A(), { q: '%) or 1=1 --' })).total, 0, 'ký tự đặc biệt không phá truy vấn');
  });

  test('Khách (chưa đăng nhập) không đọc được dữ liệu', async () => {
    await assert.rejects(searchProblems(anonClient(), {}));
  });
});

describe('Chức năng 7, 8 — Trang chi tiết', () => {
  test('Chi tiết sản phẩm kèm nhóm, thành viên, tag, project cha/con', async () => {
    const item = await getPortfolioItem(C(), ctx.project);
    assert.equal(item?.student_teams?.name, 'Nhóm AI UIT');
    assert.equal(item?.student_teams?.team_members.length, 2);
    assert.ok(item?.student_teams?.team_members.every((m) => m.profiles?.full_name));
    assert.deepEqual(item?.children.map((c) => c.id), [ctx.product]);
    const product = await getPortfolioItem(C(), ctx.product);
    assert.equal(product?.parent?.id, ctx.project);
  });

  test('Chi tiết bài toán kèm thông tin doanh nghiệp đăng', async () => {
    const p = await getProblem(A(), ctx.p1);
    assert.equal(p?.companies?.name, 'Công ty Cổ phần C (sửa)');
    assert.equal(p?.problem_tags[0]?.tags?.slug, 'tri-tue-nhan-tao');
  });
});

describe('Chức năng 4 — Gửi yêu cầu kết nối (2 chiều, proposal)', () => {
  test('Thời hạn phản hồi lấy từ system_settings', async () => {
    assert.deepEqual(await getConnectionTtlOptions(A()), { options: [3, 7, 14, 30], defaultDays: 7 });
  });

  test('Nhóm trưởng gửi yêu cầu tới bài toán, kèm liên kết proposal', async () => {
    const parsed = createConnectionSchema.parse(formToObject(fd([
      ['problemId', ctx.p1], ['teamId', ctx.teamA], ['itemId', ctx.project], ['message', 'Nhóm muốn thực hiện bài toán'],
      ['ttlDays', '7'], ['attachmentUrl', 'https://drive.google.com/proposal'],
    ])));
    const res = await createConnectionRequest(A(), IDS.A, parsed);
    assert.ok(res?.ok && !res.error, res?.error);
    ctx.cr1 = res!.id!;
    const dup = await createConnectionRequest(A(), IDS.A, parsed);
    assert.match(dup?.error ?? '', /đã có yêu cầu đang chờ/);
    const conn = await getConnection(C(), ctx.cr1);
    assert.equal(conn?.status, 'pending');
    assert.equal(conn?.direction, 'team_to_company');
    assert.equal(conn?.connection_attachments[0]?.external_url, 'https://drive.google.com/proposal');
    assert.equal(conn?.portfolio_items?.title, 'Chatbot trí tuệ nhân tạo hỗ trợ tuyển sinh');
  });

  test('Thành viên thường / thời hạn sai / proposal sai đường dẫn bị chặn', async () => {
    const r1 = await createConnectionRequest(B(), IDS.B, { problemId: ctx.p3, teamId: ctx.teamA, ttlDays: 7 });
    assert.match(r1?.error ?? '', /không có quyền/);
    const r2 = await createConnectionRequest(A(), IDS.A, { problemId: ctx.p3, teamId: ctx.teamA, ttlDays: 5 });
    assert.match(r2?.error ?? '', /Thời hạn phản hồi không hợp lệ/);
    const r3 = await recordAttachment(A(), IDS.A, { connectionId: ctx.cr1, kind: 'proposal',
      storagePath: `${ctx.p1}/abc-hack.pdf`, fileName: 'hack.pdf', sizeBytes: 10 });
    assert.match(r3?.error ?? '', /không khớp/);
    const r4 = await recordAttachment(A(), IDS.A, { connectionId: ctx.cr1, kind: 'proposal',
      storagePath: `${ctx.cr1}/0b7c1f2e-proposal.pdf`, fileName: 'proposal.pdf', mimeType: 'application/pdf', sizeBytes: 2048 });
    assert.ok(r4?.ok, r4?.error);
  });

  test('Doanh nghiệp mời nhóm (thư ngỏ >= 10 ký tự), nhóm trưởng nhận thông báo', async () => {
    const short = await createConnectionRequest(C2(), IDS.C2, { problemId: ctx.p2, teamId: ctx.teamA, itemId: ctx.product, message: 'Ngắn', ttlDays: 14 });
    assert.match(short?.error ?? '', /tối thiểu 10 ký tự/);
    const res = await createConnectionRequest(C2(), IDS.C2, { problemId: ctx.p2, teamId: ctx.teamA, itemId: ctx.product,
      message: 'Công ty muốn mời nhóm phân tích dữ liệu khách hàng', ttlDays: 14 });
    assert.ok(res?.ok, res?.error);
    ctx.invite = res!.id!;
    const notes = await listNotifications(A());
    assert.ok(notes.some((n) => n.connection_id === ctx.invite && n.link_path === `/connections/${ctx.invite}`));
  });

  test('Nhóm khác gửi yêu cầu cùng bài toán', async () => {
    const res = await createConnectionRequest(A2(), IDS.A2, { problemId: ctx.p1, teamId: ctx.teamA2, ttlDays: 3 });
    assert.ok(res?.ok, res?.error);
    ctx.crA2 = res!.id!;
    assert.equal(await getConnection(A2(), ctx.cr1), null, 'không xem được kết nối của nhóm khác');
  });
});

describe('Phản hồi, kết thúc, gia hạn kết nối', () => {
  test('Doanh nghiệp đồng ý -> đang thực hiện; yêu cầu chờ khác bị đóng; lộ kênh liên hệ', async () => {
    assert.equal((await getPartnerContacts(A(), [IDS.C])).length, 0, 'chưa đồng ý: chưa thấy liên hệ');
    assert.ok((await respondConnection(A(), { id: ctx.cr1, decision: 'accept' }))?.error, 'người gửi không tự đồng ý');
    const res = await respondConnection(C(), { id: ctx.cr1, decision: 'accept', message: 'Rất vui được hợp tác' });
    assert.ok(res?.ok, res?.error);
    assert.equal((await getConnection(C(), ctx.cr1))?.status, 'in_progress');
    assert.equal((await getConnection(A2(), ctx.crA2))?.status, 'rejected');
    assert.equal((await getPartnerContacts(A(), [IDS.C]))[0]?.zalo, '0909000111');
    assert.equal((await getPartnerContacts(A2(), [IDS.C])).length, 0);
  });

  test('Nhóm trưởng từ chối lời mời của doanh nghiệp', async () => {
    assert.ok((await respondConnection(B(), { id: ctx.invite, decision: 'accept' }))?.error);
    assert.ok((await respondConnection(A(), { id: ctx.invite, decision: 'reject', message: 'Nhóm đang bận' }))?.ok);
  });

  test('Gia hạn và hoàn thành (bắt buộc điểm), hoặc dừng (bắt buộc lý do)', async () => {
    assert.equal(endConnectionSchema.safeParse({ id: ctx.cr1, outcome: 'completed' }).success, false);
    assert.equal(endConnectionSchema.safeParse({ id: ctx.cr1, outcome: 'cancelled', reason: '' }).success, false);
    const ext = await extendConnection(C(), { id: ctx.cr1, newEnd: '2027-12-31', reason: 'Thêm thời gian kiểm thử' });
    assert.ok(ext?.ok, ext?.error);
    assert.match((await extendConnection(C(), { id: ctx.cr1, newEnd: '2026-01-01' }))?.error ?? '', /Hạn mới phải sau/);
    const done = await endConnection(C(), IDS.C, endConnectionSchema.parse({ id: ctx.cr1, outcome: 'completed', rating: '5',
      feedback: 'Nhóm làm rất tốt', deliverableUrl: 'https://github.com/uit/llm-edge' }));
    assert.ok(done?.ok && !done.error, done?.error);
    const conn = await getConnection(A(), ctx.cr1);
    assert.equal(conn?.status, 'completed');
    assert.equal(conn?.end_rating, 5);
    assert.equal(conn?.connection_extensions.length, 1);
    assert.ok(conn?.connection_attachments.some((a) => a.kind === 'deliverable'));
    assert.equal((await getProblem(A(), ctx.p1))?.solve_status, 'solved');

    const cr3 = await createConnectionRequest(A(), IDS.A, { problemId: ctx.p3, teamId: ctx.teamA, ttlDays: 30 });
    ctx.cr3 = cr3!.id!;
    assert.ok((await respondConnection(C(), { id: ctx.cr3, decision: 'accept' }))?.ok);
    assert.match((await deleteProblem(C(), ctx.p3))?.error ?? '', /đang có nhóm thực hiện/);
    assert.ok((await endConnection(C(), IDS.C, { id: ctx.cr3, outcome: 'cancelled', reason: 'Đổi ưu tiên' }))?.ok);
    assert.equal((await getProblem(A(), ctx.p3))?.solve_status, 'open');
    assert.equal((await getTeamEngagements(A(), ctx.teamA)).length, 2);
  });
});

describe('Chức năng 5 — Bảng theo dõi trạng thái matching', () => {
  test('Sinh viên: thấy kết nối của nhóm + bài chờ duyệt của nhóm; không thấy của người khác', async () => {
    const draft = await createPortfolioItem(A(), IDS.A, portfolioItemSchema.parse({ kind: 'paper', team_id: ctx.teamA, parent_id: ctx.project,
      title: 'Paper chatbot tuyển sinh', summary: 'Bài báo mô tả kiến trúc chatbot', source_url: 'https://arxiv.org/abs/1', paper_application: 'Tư vấn tuyển sinh' }));
    ctx.paper = draft!.id!;
    const board = await getTrackingBoard(A(), { id: IDS.A, role: 'student' });
    const statuses = new Map(board.map((r) => [r.id, r.status]));
    assert.equal(statuses.get(ctx.cr1), 'completed');
    assert.equal(statuses.get(ctx.cr3), 'cancelled');
    assert.equal(statuses.get(ctx.invite), 'rejected');
    assert.equal(statuses.get(ctx.paper), 'review_pending_review');
    assert.ok(!statuses.has(ctx.crA2), 'không thấy kết nối của nhóm khác');
    const onlyPending = await getTrackingBoard(A(), { id: IDS.A, role: 'student' }, 'review_pending_review');
    assert.deepEqual(onlyPending.map((r) => r.id), [ctx.paper]);
    const a2 = await getTrackingBoard(A2(), { id: IDS.A2, role: 'student' });
    assert.deepEqual(a2.map((r) => r.status), ['rejected']);
    assert.equal(a2[0].statusLabel, 'Bị từ chối');
  });

  test('Doanh nghiệp: yêu cầu cần phản hồi được đánh dấu việc cần làm', async () => {
    const res = await createConnectionRequest(A(), IDS.A, { problemId: ctx.p3, teamId: ctx.teamA, ttlDays: 7 });
    ctx.cr4 = res!.id!;
    const board = await getTrackingBoard(C(), { id: IDS.C, role: 'company' });
    const row = board.find((r) => r.id === ctx.cr4)!;
    assert.equal(row.status, 'pending');
    assert.equal(row.needsMyAction, true);
    assert.ok(!board.some((r) => r.id === ctx.invite), 'C không thấy lời mời của C2');
    const mine = await getTrackingBoard(A(), { id: IDS.A, role: 'student' });
    assert.equal(mine.find((r) => r.id === ctx.cr4)?.needsMyAction, false, 'người gửi chỉ chờ, không phải việc cần làm');
  });

  test('Nhóm trưởng thấy lời mời đang chờ là việc cần làm', async () => {
    const res = await createConnectionRequest(C2(), IDS.C2, { problemId: ctx.p2, teamId: ctx.teamA, message: 'Mời nhóm lần nữa với đề xuất mới', ttlDays: 7 });
    ctx.invite2 = res!.id!;
    assert.equal((await getTrackingBoard(A(), { id: IDS.A, role: 'student' })).find((r) => r.id === ctx.invite2)?.needsMyAction, true);
    assert.equal((await getTrackingBoard(B(), { id: IDS.B, role: 'student' })).find((r) => r.id === ctx.invite2)?.needsMyAction, false);
  });
});

describe('Chức năng 6 — Dashboard quản lý của giảng viên/điều phối', () => {
  test('Thống kê kết nối theo trạng thái, thời gian, hàng đợi duyệt', async () => {
    const d = await getStaffDashboard(L());
    assert.equal(d.connectionStats.total, 6);
    assert.equal(d.connectionStats.byStatus.completed, 1);
    assert.equal(d.connectionStats.byStatus.cancelled, 1);
    assert.equal(d.connectionStats.byStatus.pending, 2);
    assert.equal(d.connectionStats.byStatus.rejected, 2);
    assert.equal(d.moderationCount.total, 1, 'paper đang chờ duyệt');
    assert.equal(d.moderation[0].entity_id, ctx.paper);
    assert.ok(d.moderation[0].days_left >= 6);
    const row = d.connections.find((c) => c.id === ctx.cr1)!;
    assert.ok(row.created_at && row.responded_at && row.started_at && row.ended_at);
    assert.ok(d.fieldInterest.some((f) => f.field_name === 'Trí tuệ nhân tạo' && f.approved_problems === 1));
  });

  test('Sinh viên gọi dashboard chỉ thấy phần của mình', async () => {
    const d = await getStaffDashboard(A2());
    assert.equal(d.connectionStats.total, 1);
  });
});

describe('Xóa, thông báo', () => {
  test('Xóa bài chưa duyệt (xóa cứng) và đã duyệt (xóa mềm)', async () => {
    assert.ok((await deletePortfolioItem(A(), ctx.paper))?.ok);
    assert.equal((await A().from('portfolio_items').select('id').eq('id', ctx.paper)).data?.length, 0);
    assert.ok((await deletePortfolioItem(A2(), ctx.product))?.error, 'nhóm khác không xóa được');
    assert.ok((await deletePortfolioItem(A(), ctx.product))?.ok);
    assert.equal((await searchPortfolio(C(), { kind: 'product' })).total, 0, 'bài xóa mềm biến khỏi danh mục');
  });

  test('Sửa bài đã duyệt', async () => {
    const res = await updatePortfolioItem(A(), ctx.project, portfolioItemSchema.parse({ kind: 'project', team_id: ctx.teamA,
      title: 'Chatbot trí tuệ nhân tạo hỗ trợ tuyển sinh UIT', summary: 'Chatbot trả lời câu hỏi tuyển sinh dùng mô hình ngôn ngữ lớn',
      source_url: 'https://github.com/uit/chatbot', tag_ids: [tagAI] }));
    assert.ok(res?.ok, res?.error);
    assert.equal((await getPortfolioItem(C(), ctx.project))?.item_tags.length, 1);
  });

  test('Đánh dấu đã đọc thông báo', async () => {
    assert.ok((await countUnreadNotifications(C())) > 0);
    assert.ok((await markNotificationsRead(C(), 'all'))?.ok);
    assert.equal(await countUnreadNotifications(C()), 0);
  });

  test('Doanh nghiệp xem danh sách bài toán của mình để chọn khi mời', async () => {
    const company = await getMyCompany(C(), IDS.C);
    const open = await listCompanyProblems(C(), company!.id, { onlyOpenApproved: true });
    assert.deepEqual(open.map((p) => p.id), [ctx.p3]);
    assert.ok((await listConnections(C())).length >= 3);
  });
});
