-- =====================================================================================
-- Bộ kiểm thử phân quyền + nghiệp vụ giai đoạn 1 (chạy bằng supabase/tests/local/run.sh).
-- Mỗi khối: đăng nhập giả lập (test.login) -> set role authenticated -> thao tác như client
-- (RLS + quyền cột áp dụng đầy đủ) -> reset role. Mã Txx khớp bảng T01–T22 của tài liệu.
-- =====================================================================================
\set ON_ERROR_STOP 1
set client_min_messages = notice;

-- ---------------------------------------------------------------- Tài khoản (T02, T03, T04, T05)
select test.ok((select role from public.profiles where id = test.id('X')) = 'student',
               'T02 đăng ký tự xưng admin qua metadata vẫn là student');
select test.ok((select role from public.profiles where id = test.id('C')) = 'company',
               'Đăng ký chọn Doanh nghiệp -> role company');
select test.ok((select email from public.profiles where id = test.id('A')) = 'a@test.local',
               'profiles.email đồng bộ từ auth.users');

select test.login('A'); set role authenticated;
select test.err($$update public.profiles set role = 'admin' where id = test.id('A')$$, '42501',
                'T03 sinh viên tự nâng role bị từ chối');
select test.err($$select email from public.profiles limit 1$$, '42501', 'T04 không đọc được cột email');
select test.err($$select * from public.profiles limit 1$$, '42501', 'T04 select * trên profiles bị từ chối');
update public.profiles set headline = 'Sinh viên năm 3 KTPM' where id = test.id('A');
select test.ok((select headline from public.profiles where id = test.id('A')) = 'Sinh viên năm 3 KTPM',
               'Sửa cột trình bày của chính mình được phép');
update public.profiles set headline = 'hack' where id = test.id('B');
reset role;
select test.ok((select headline from public.profiles where id = test.id('B')) is null,
               'A không sửa được hồ sơ của B (RLS)');

select set_config('request.jwt.claims', '', false); set role anon;
select test.err($$select id from public.business_problems$$, '42501', 'T05 anon không đọc được bảng');
select test.err($$select id from public.portfolio_items$$, '42501', 'T05 anon không đọc được portfolio');
reset role;

-- ---------------------------------------------------------------- Hồ sơ doanh nghiệp
select test.login('C'); set role authenticated;
insert into public.companies (owner_id, name, contact_email, industry, phone, size_range, website)
values (test.id('C'), 'Công ty Cổ phần C', 'lienhe@c.vn', 'Phần mềm doanh nghiệp và AI', '0281234567', '51-200', 'https://c.vn');
select test.err($$insert into public.companies (owner_id, name, contact_email, industry, phone)
                 values (test.id('C'), 'Công ty thứ hai', 'x@c.vn', 'Phần mềm doanh nghiệp', '0281234567')$$,
                '23505', 'Mỗi tài khoản chỉ một công ty');
insert into public.profile_contacts (profile_id, email, zalo) values (test.id('C'), 'pm@c.vn', '0909000111');
reset role;

select test.login('C2'); set role authenticated;
insert into public.companies (owner_id, name, contact_email, industry, phone)
values (test.id('C2'), 'Công ty TNHH C2', 'hr@c2.vn', 'Thương mại điện tử', '02899998888');
reset role;

select test.login('A'); set role authenticated;
select test.err($$insert into public.companies (owner_id, name, contact_email, industry, phone)
                 values (test.id('A'), 'Sinh viên lập công ty', 'a@a.vn', 'Phần mềm doanh nghiệp', '0281234567')$$,
                '42501', 'Sinh viên không tạo được hồ sơ doanh nghiệp');
insert into public.profile_contacts (profile_id, email) values (test.id('A'), 'a.personal@gmail.com');
reset role;

-- ---------------------------------------------------------------- Nhóm sinh viên
select test.login('A'); set role authenticated;
do $$ declare v uuid; begin
  insert into public.student_teams (name, description, created_by)
  values ('Nhóm AI UIT', 'Nhóm nghiên cứu trí tuệ nhân tạo', test.id('A')) returning id into v;
  perform test.remember('TEAM_A', v);
end $$;
select test.ok((select member_role from public.team_members where team_id = test.id('TEAM_A') and profile_id = test.id('A')) = 'leader',
               'Người tạo nhóm tự động là nhóm trưởng');
insert into public.team_members (team_id, profile_id) values (test.id('TEAM_A'), test.id('B'));
select test.err($$insert into public.team_members (team_id, profile_id) values (test.id('TEAM_A'), test.id('C'))$$,
                '42501', 'Không thêm được tài khoản doanh nghiệp vào nhóm');
reset role;

select test.login('B'); set role authenticated;
select test.err($$insert into public.team_members (team_id, profile_id) values (test.id('TEAM_A'), test.id('X'))$$,
                '42501', 'Thành viên thường không thêm được người khác');
reset role;

select test.login('C'); set role authenticated;
select test.err($$insert into public.student_teams (name, created_by) values ('Nhóm của DN', test.id('C'))$$,
                '42501', 'Doanh nghiệp không tạo được nhóm');
reset role;

select test.login('A2'); set role authenticated;
do $$ declare v uuid; begin
  insert into public.student_teams (name, created_by) values ('Nhóm Web A2', test.id('A2')) returning id into v;
  perform test.remember('TEAM_A2', v);
end $$;
reset role;

-- ---------------------------------------------------------------- Tạo project / product / paper
select test.login('A'); set role authenticated;
do $$ declare v uuid; begin
  -- cố tình gửi review_status = approved: trigger phải ép về pending_review
  insert into public.portfolio_items (team_id, kind, title, summary, source_url, created_by, review_status)
  values (test.id('TEAM_A'), 'project', 'Chatbot trí tuệ nhân tạo hỗ trợ tuyển sinh',
          'Chatbot trả lời câu hỏi tuyển sinh dùng mô hình ngôn ngữ lớn', 'https://github.com/uit/chatbot',
          test.id('A'), 'approved')
  returning id into v;
  perform test.remember('ITEM_PROJECT', v);
  insert into public.portfolio_items (team_id, kind, parent_id, title, summary, source_url, created_by)
  values (test.id('TEAM_A'), 'product', v, 'EduBot bản demo', 'Bản chạy thử của chatbot tuyển sinh',
          'https://edubot.demo.vn', test.id('A'))
  returning id into v;
  perform test.remember('ITEM_PRODUCT', v);
end $$;
select test.ok((select review_status from public.portfolio_items where id = test.id('ITEM_PROJECT')) = 'pending_review',
               'Bài mới luôn ở pending_review dù client gửi approved');
insert into public.item_tags (item_id, tag_id)
select test.id('ITEM_PROJECT'), id from public.tags where slug in ('tri-tue-nhan-tao', 'python');
insert into public.item_members (item_id, team_id, profile_id, role_label)
values (test.id('ITEM_PROJECT'), test.id('TEAM_A'), test.id('B'), 'Backend');
select test.err($$insert into public.item_members (item_id, team_id, profile_id) values (test.id('ITEM_PROJECT'), test.id('TEAM_A'), test.id('A2'))$$,
                '23503', 'Thành viên item phải thuộc nhóm (FK ghép)');
select test.err($$insert into public.portfolio_items (team_id, kind, title, summary, source_url, created_by)
                 values (test.id('TEAM_A'), 'paper', 'Paper thiếu cha', 'Không có project cha nên lỗi', 'https://x.vn', test.id('A'))$$,
                '23514', 'Product/paper bắt buộc có project cha');
select test.err($$update public.portfolio_items set review_status = 'approved' where id = test.id('ITEM_PROJECT')$$,
                '42501', 'Sinh viên không tự duyệt bài của mình');
reset role;

select test.login('A2'); set role authenticated;
select test.ok((select count(*) from public.portfolio_items where id = test.id('ITEM_PROJECT')) = 0,
               'Nhóm khác không thấy bài đang chờ duyệt');
select test.err($$insert into public.portfolio_items (team_id, kind, title, summary, source_url, created_by)
                 values (test.id('TEAM_A'), 'project', 'Đăng hộ nhóm khác', 'Không phải thành viên nhóm', 'https://x.vn', test.id('A2'))$$,
                '42501', 'Không đăng được bài cho nhóm mình không là thành viên');
reset role;

-- ---------------------------------------------------------------- Tạo bài toán doanh nghiệp (T06)
select test.login('C'); set role authenticated;
do $$ declare v uuid; begin
  insert into public.business_problems (company_id, title, description, expected_outcome, estimated_duration_days, extra, review_status, solve_status)
  values (app.my_company_id(), 'Tối ưu hóa mô hình LLM trên thiết bị biên',
          'Doanh nghiệp cần chạy mô hình ngôn ngữ trên thiết bị biên với bộ nhớ hạn chế.',
          'Mô hình chạy dưới 2GB RAM', 90, '{"collaboration_mode":"remote","preferred_team_size":4}', 'approved', 'solved')
  returning id into v;
  perform test.remember('P1', v);
  insert into public.business_problems (company_id, title, description, expected_outcome, estimated_duration_days)
  values (app.my_company_id(), 'Hệ thống gợi ý sản phẩm thương mại', 'Xây dựng hệ thống gợi ý sản phẩm cho sàn thương mại điện tử.',
          'Tăng tỉ lệ chuyển đổi', 60)
  returning id into v;
  perform test.remember('P3', v);
end $$;
select test.ok((select review_status::text || '/' || solve_status::text from public.business_problems where id = test.id('P1')) = 'pending_review/open',
               'T06 bài toán mới ép về pending_review/open');
insert into public.problem_tags (problem_id, tag_id) select test.id('P1'), id from public.tags where slug = 'tri-tue-nhan-tao';
select test.err($$insert into public.business_problems (company_id, title, description, expected_outcome, estimated_duration_days)
                 values (app.my_company_id(), 'Ngắn', 'Mô tả đủ dài để vượt qua kiểm tra ba mươi ký tự.', 'Kết quả rõ ràng', 30)$$,
                '23514', 'Tiêu đề bài toán dưới 10 ký tự bị chặn');
select test.err($$insert into public.business_problems (company_id, title, description, expected_outcome, estimated_duration_days)
                 values (app.my_company_id(), 'Bài toán thời gian quá dài', 'Mô tả đủ dài để vượt qua kiểm tra ba mươi ký tự.', 'Kết quả rõ ràng', 731)$$,
                '23514', 'Ước lượng > 730 ngày bị chặn');
reset role;

select test.login('C2'); set role authenticated;
do $$ declare v uuid; begin
  insert into public.business_problems (company_id, title, description, expected_outcome, estimated_duration_days)
  values (app.my_company_id(), 'Phân tích dữ liệu khách hàng thân thiết', 'Phân tích hành vi mua sắm để đề xuất chương trình khách hàng thân thiết.',
          'Báo cáo phân khúc khách hàng', 45)
  returning id into v;
  perform test.remember('P2', v);
end $$;
select test.err($$insert into public.problem_tags (problem_id, tag_id) select test.id('P1'), id from public.tags where slug = 'sql'$$,
                '42501', 'Doanh nghiệp khác không gắn tag vào bài toán của C');
reset role;

select test.login('A'); set role authenticated;
select test.ok((select count(*) from public.business_problems where id = test.id('P1')) = 0,
               'T06 sinh viên không thấy bài toán chờ duyệt');
-- T08
select test.err($$select public.rpc_submit_review('business_problem', test.id('P1'), true, null)$$, '42501',
                'T08 sinh viên gọi rpc_submit_review bị từ chối 42501');
reset role;

-- ---------------------------------------------------------------- Kiểm duyệt (T07)
select test.login('L'); set role authenticated;
select test.ok((select count(*) from public.v_moderation_queue) = 5, 'Hàng đợi duyệt có 5 bài (2 item + 3 bài toán)');
select test.err($$select public.rpc_submit_review('business_problem', test.id('P1'), false, '  ')$$, 'P0001',
                'T07 từ chối thiếu lý do báo lỗi');
select public.rpc_submit_review('business_problem', test.id('P1'), true, null);
select public.rpc_submit_review('business_problem', test.id('P2'), true, null);
select public.rpc_submit_review('business_problem', test.id('P3'), true, 'OK');
select public.rpc_submit_review('portfolio_item', test.id('ITEM_PROJECT'), true, null);
select public.rpc_submit_review('portfolio_item', test.id('ITEM_PRODUCT'), false, 'Thiếu ảnh demo');
select test.err($$select public.rpc_submit_review('business_problem', test.id('P1'), true, null)$$, 'P0002',
                'Bài đã xử lý không xử lý lại');
reset role;
select test.ok((select count(*) from public.status_history where entity_id = test.id('P1')) = 2,
               'status_history ghi lại tạo + duyệt bài toán');
select test.ok((select count(*) from public.notifications where recipient_id = test.id('C') and type = 'review_approved') = 2,
               'Doanh nghiệp nhận thông báo duyệt');

select test.login('A'); set role authenticated;
select test.ok((select count(*) from public.business_problems where id = test.id('P1')) = 1, 'T07 duyệt xong sinh viên thấy bài toán');
-- gửi lại bài bị từ chối
select test.ok((select review_note from public.portfolio_items where id = test.id('ITEM_PRODUCT')) = 'Thiếu ảnh demo',
               'Người đăng thấy lý do từ chối');
select public.rpc_resubmit_content('portfolio_item', test.id('ITEM_PRODUCT'));
select test.ok((select review_status from public.portfolio_items where id = test.id('ITEM_PRODUCT')) = 'pending_review',
               'Gửi lại bài bị từ chối -> pending_review');
select test.err($$select public.rpc_resubmit_content('portfolio_item', test.id('ITEM_PROJECT'))$$, 'P0001',
                'Không gửi lại được bài đã duyệt');
reset role;
select test.login('A2'); set role authenticated;
select test.err($$select public.rpc_resubmit_content('portfolio_item', test.id('ITEM_PRODUCT'))$$, '42501',
                'Nhóm khác không gửi lại được bài');
reset role;
select test.login('L'); set role authenticated;
select public.rpc_submit_review('portfolio_item', test.id('ITEM_PRODUCT'), true, null);
reset role;

-- ---------------------------------------------------------------- Tìm kiếm (T19) + lọc theo lĩnh vực
select test.login('C'); set role authenticated;
select test.ok((select count(*) from public.portfolio_items
                 where search_tsv @@ plainto_tsquery('simple', 'tri tue nhan tao')) = 1, 'T19 tìm không dấu ra kết quả');
select test.ok((select count(*) from public.portfolio_items
                 where search_tsv @@ plainto_tsquery('simple', app.f_unaccent('trí tuệ nhân tạo'))) = 1,
               'T19 tìm có dấu (đã bỏ dấu) ra cùng kết quả');
select test.ok((select count(distinct i.id) from public.portfolio_items i join public.item_tags it on it.item_id = i.id
                  join public.tags t on t.id = it.tag_id
                 where t.slug = 'tri-tue-nhan-tao' and i.review_status = 'approved') = 1,
               'Lọc sản phẩm theo lĩnh vực Trí tuệ nhân tạo');
reset role;
select test.login('A'); set role authenticated;
select test.ok((select count(*) from public.business_problems bp join public.problem_tags pt on pt.problem_id = bp.id
                  join public.tags t on t.id = pt.tag_id where t.slug = 'tri-tue-nhan-tao') = 1,
               'Lọc bài toán theo lĩnh vực Trí tuệ nhân tạo');
reset role;

-- ---------------------------------------------------------------- Gửi yêu cầu kết nối (T09, T10)
select test.login('A'); set role authenticated;
do $$ declare v uuid; begin
  v := public.rpc_create_connection_request(test.id('P1'), test.id('TEAM_A'), test.id('ITEM_PROJECT'),
                                            'Nhóm muốn thực hiện bài toán này', 7);
  perform test.remember('CR1', v);
end $$;
select test.ok((select status from public.connection_requests where id = test.id('CR1')) = 'pending', 'T09 yêu cầu ở trạng thái pending');
select test.err($$select public.rpc_create_connection_request(test.id('P1'), test.id('TEAM_A'), null, null, 7)$$, '23505',
                'T09 gửi trùng yêu cầu đang chờ bị chặn');
select test.err($$select public.rpc_create_connection_request(test.id('P2'), test.id('TEAM_A'), null, null, 5)$$, 'P0001',
                'Thời hạn không nằm trong danh sách cấu hình bị chặn');
select test.err($$select public.rpc_create_connection_request(test.id('P2'), test.id('TEAM_A'), null, null, null)$$, 'P0001',
                'Thời hạn null bị chặn');
select test.err($$select public.rpc_create_connection_request(test.id('P2'), test.id('TEAM_A2'), null, null, 7)$$, '42501',
                'Không gửi yêu cầu thay nhóm mình không làm nhóm trưởng');
reset role;
select test.ok((select count(*) from public.notifications where recipient_id = test.id('C') and connection_id = test.id('CR1')) = 1,
               'T09 doanh nghiệp nhận thông báo yêu cầu mới');

select test.login('B'); set role authenticated;
select test.err($$select public.rpc_create_connection_request(test.id('P3'), test.id('TEAM_A'), null, null, 7)$$, '42501',
                'T10 thành viên (không phải nhóm trưởng) gửi yêu cầu bị từ chối');
select test.ok((select count(*) from public.connection_requests where id = test.id('CR1')) = 1,
               'Thành viên nhóm thấy yêu cầu của nhóm');
reset role;

select test.login('A2'); set role authenticated;
do $$ declare v uuid; begin
  v := public.rpc_create_connection_request(test.id('P1'), test.id('TEAM_A2'), null, null, 3);
  perform test.remember('CR_A2', v);
end $$;
-- T15
select test.ok((select count(*) from public.connection_requests where id = test.id('CR1')) = 0, 'T15 nhóm khác không đọc được kết nối của A');
select test.ok((select count(*) from public.v_connection_dashboard where id = test.id('CR1')) = 0, 'T15 view dashboard cũng không lộ');
reset role;

-- ---------------------------------------------------------------- Client không ghi thẳng (T14)
select test.login('A'); set role authenticated;
update public.connection_requests set status = 'in_progress' where id = test.id('CR1');
select test.err($$insert into public.connection_requests (problem_id, team_id, direction, requested_by, expires_at)
                 values (test.id('P2'), test.id('TEAM_A'), 'team_to_company', test.id('A'), now() + interval '1 day')$$,
                '42501', 'T14 client không insert thẳng connection_requests');
-- T16 trước khi kết nối được chấp nhận
select test.ok((select count(*) from public.profile_contacts where profile_id = test.id('C')) = 0,
               'T16 chưa thấy liên hệ ngoài của doanh nghiệp khi kết nối còn chờ');
reset role;
select test.ok((select status from public.connection_requests where id = test.id('CR1')) = 'pending',
               'T14 cập nhật status trực tiếp không có tác dụng');

-- ---------------------------------------------------------------- Phản hồi (T11, T12)
select test.login('A'); set role authenticated;
select test.err($$select public.rpc_respond_connection(test.id('CR1'), true, null)$$, '42501',
                'Người gửi không tự chấp nhận yêu cầu của mình');
reset role;
select test.login('C'); set role authenticated;
select public.rpc_respond_connection(test.id('CR1'), true, 'Rất vui được hợp tác');
select test.ok((select status from public.connection_requests where id = test.id('CR1')) = 'in_progress', 'T11 kết nối in_progress');
select test.ok((select solve_status from public.business_problems where id = test.id('P1')) = 'in_progress', 'T11 bài toán in_progress');
select test.ok((select started_at is not null and expected_end_at > now() + interval '89 days'
                  from public.connection_requests where id = test.id('CR1')), 'Mốc bắt đầu và hạn dự kiến tự điền theo ước lượng');
select test.ok((select count(*) from public.profile_contacts where profile_id = test.id('A')) = 1,
               'T16 doanh nghiệp thấy liên hệ ngoài của nhóm sau khi đồng ý');
reset role;
select test.ok((select status from public.connection_requests where id = test.id('CR_A2')) = 'rejected',
               'T11 yêu cầu chờ khác của bài toán tự bị đóng');
select test.login('A'); set role authenticated;
select test.ok((select count(*) from public.profile_contacts where profile_id = test.id('C')) = 1,
               'T16 nhóm thấy liên hệ ngoài của doanh nghiệp sau khi đồng ý');
reset role;
select test.login('A2'); set role authenticated;
select test.err($$select public.rpc_create_connection_request(test.id('P1'), test.id('TEAM_A2'), null, null, 7)$$, 'P0001',
                'T12 bài toán đã có nhóm thực hiện không nhận thêm yêu cầu');
select test.ok((select count(*) from public.profile_contacts where profile_id = test.id('C')) = 0,
               'T16 nhóm bị từ chối không thấy liên hệ ngoài');
reset role;

-- ---------------------------------------------------------------- Doanh nghiệp mời nhóm (chiều ngược lại)
select test.login('C2'); set role authenticated;
select test.err($$select public.rpc_create_connection_request(test.id('P2'), test.id('TEAM_A'), test.id('ITEM_PRODUCT'), 'Ngắn', 7)$$, 'P0001',
                'Lời mời của doanh nghiệp cần thư ngỏ >= 10 ký tự');
select test.err($$select public.rpc_create_connection_request(test.id('P1'), test.id('TEAM_A'), null, 'Mời nhóm làm bài toán của công ty khác', 7)$$, 'P0001',
                'Không mời bằng bài toán không còn mở/không thuộc mình');
do $$ declare v uuid; begin
  v := public.rpc_create_connection_request(test.id('P2'), test.id('TEAM_A'), test.id('ITEM_PRODUCT'),
                                            'Công ty muốn mời nhóm phân tích dữ liệu khách hàng', 14);
  perform test.remember('CR_INVITE', v);
end $$;
select test.ok((select direction from public.connection_requests where id = test.id('CR_INVITE')) = 'company_to_team', 'Chiều company_to_team');
reset role;
select test.ok((select count(*) from public.notifications where recipient_id = test.id('A') and connection_id = test.id('CR_INVITE')) = 1,
               'Nhóm trưởng nhận thông báo lời mời');
select test.login('B'); set role authenticated;
select test.err($$select public.rpc_respond_connection(test.id('CR_INVITE'), true, null)$$, '42501',
                'Thành viên thường không phản hồi lời mời');
reset role;
select test.login('A'); set role authenticated;
select public.rpc_respond_connection(test.id('CR_INVITE'), false, 'Nhóm đang bận dự án khác');
select test.ok((select status from public.connection_requests where id = test.id('CR_INVITE')) = 'rejected', 'Nhóm trưởng từ chối lời mời');
select test.err($$select public.rpc_respond_connection(test.id('CR_INVITE'), true, null)$$, 'P0001',
                'Không phản hồi lại yêu cầu đã xử lý');
reset role;

-- ---------------------------------------------------------------- Kết thúc, gia hạn (T13)
select test.login('A'); set role authenticated;
select test.err($$select public.rpc_end_connection(test.id('CR1'), 'completed', null, 5::smallint, null)$$, '42501',
                'Sinh viên không kết thúc được kết nối');
reset role;
select test.login('C'); set role authenticated;
select test.err($$select public.rpc_end_connection(test.id('CR1'), 'completed', null, null, 'Tốt')$$, 'P0001',
                'T13 hoàn thành thiếu điểm đánh giá báo lỗi');
select test.err($$select public.rpc_end_connection(test.id('CR1'), 'cancelled', '  ', null, null)$$, 'P0001',
                'T13 dừng thiếu lý do báo lỗi');
select test.err($$select public.rpc_extend_connection(test.id('CR1'), now(), 'Lùi hạn')$$, 'P0001',
                'Gia hạn về trước hạn hiện tại bị chặn');
select public.rpc_extend_connection(test.id('CR1'), now() + interval '120 days', 'Thêm thời gian kiểm thử');
select test.ok((select count(*) from public.connection_extensions where connection_id = test.id('CR1')) = 1, 'Lịch sử gia hạn được ghi');
select public.rpc_end_connection(test.id('CR1'), 'completed', null, 5::smallint, 'Nhóm làm rất tốt');
select test.ok((select status::text || '/' || end_rating from public.connection_requests where id = test.id('CR1')) = 'completed/5',
               'T13 hoàn thành kèm đánh giá');
select test.ok((select solve_status from public.business_problems where id = test.id('P1')) = 'solved', 'T13 hoàn thành -> bài toán solved');
reset role;

-- dừng một kết nối khác -> bài toán về open
select test.login('A'); set role authenticated;
do $$ begin perform test.remember('CR3', public.rpc_create_connection_request(test.id('P3'), test.id('TEAM_A'), null, null, 30)); end $$;
reset role;
select test.login('C'); set role authenticated;
select public.rpc_respond_connection(test.id('CR3'), true, null);
select test.err($$select public.rpc_soft_delete_content('business_problem', test.id('P3'))$$, 'P0001',
                'Không xóa bài toán đang có nhóm thực hiện');
select public.rpc_end_connection(test.id('CR3'), 'cancelled', 'Thay đổi ưu tiên của công ty', null, null);
select test.ok((select solve_status from public.business_problems where id = test.id('P3')) = 'open', 'T13 dừng -> bài toán về open');
reset role;
select test.login('A'); set role authenticated;
select test.ok((select count(*) from public.v_team_engagements where team_id = test.id('TEAM_A')) = 2,
               'Lịch sử hợp tác của nhóm có 1 hoàn thành + 1 đã dừng');
reset role;

-- ---------------------------------------------------------------- Tệp đính kèm (T20)
select test.login('A'); set role authenticated;
insert into storage.objects (bucket_id, name, owner_id)
values ('connection-attachments', test.id('CR1')::text || '/0001-proposal.pdf', test.id('A')::text);
insert into public.connection_attachments (connection_id, kind, file_name, storage_path, mime_type, size_bytes, uploaded_by)
values (test.id('CR1'), 'proposal', 'proposal.pdf', test.id('CR1')::text || '/0001-proposal.pdf', 'application/pdf', 1024, test.id('A'));
select test.err($$insert into public.connection_attachments (connection_id, kind, file_name, storage_path, size_bytes, uploaded_by)
                 values (test.id('CR1'), 'proposal', 'big.pdf', 'x/big.pdf', 20971521, test.id('A'))$$,
                '23514', 'T20 tệp trên 20 MB bị chặn');
select test.err($$insert into public.connection_attachments (connection_id, kind, file_name, storage_path, size_bytes, external_url, uploaded_by)
                 values (test.id('CR1'), 'proposal', 'a.pdf', 'x/a.pdf', 10, 'https://drive.google.com/x', test.id('A'))$$,
                '23514', 'Chỉ chọn tệp hoặc liên kết, không cả hai');
insert into public.connection_attachments (connection_id, kind, external_url, uploaded_by)
values (test.id('CR1'), 'proposal', 'https://drive.google.com/proposal', test.id('A'));
reset role;
select test.login('A2'); set role authenticated;
select test.ok((select count(*) from storage.objects where bucket_id = 'connection-attachments') = 0,
               'T20 người ngoài kết nối không đọc được tệp đính kèm');
select test.ok((select count(*) from public.connection_attachments) = 0, 'T20 người ngoài không thấy dòng đính kèm');
select test.err($$insert into storage.objects (bucket_id, name, owner_id) values ('connection-attachments', test.id('CR1')::text || '/hack.pdf', test.id('A2')::text)$$,
                '42501', 'T20 người ngoài không tải tệp vào kết nối của người khác');
reset role;
select test.login('C'); set role authenticated;
select test.ok((select count(*) from public.connection_attachments where connection_id = test.id('CR1')) = 2,
               'Doanh nghiệp đọc được proposal đính kèm');
reset role;

-- ---------------------------------------------------------------- Hết hạn tự động (T18)
select test.login('A'); set role authenticated;
do $$ begin perform test.remember('CR_EXP', public.rpc_create_connection_request(test.id('P3'), test.id('TEAM_A'), null, null, 3)); end $$;
select test.err($$select app.fn_expire_overdue()$$, '42501', 'Client không gọi được hàm cron');
reset role;
update public.connection_requests set created_at = now() - interval '5 days', expires_at = now() - interval '1 day'
 where id = test.id('CR_EXP');
update public.portfolio_items set review_status = 'pending_review', review_expires_at = now() - interval '1 day',
       reviewed_at = null, reviewed_by = null where id = test.id('ITEM_PRODUCT');
select app.fn_expire_overdue();
select test.ok((select status from public.connection_requests where id = test.id('CR_EXP')) = 'expired', 'T18 yêu cầu quá hạn -> expired');
select test.ok((select count(*) from public.notifications where connection_id = test.id('CR_EXP') and type = 'connection_expired') = 1,
               'T18 người gửi nhận thông báo hết hạn');
select test.ok((select review_status from public.portfolio_items where id = test.id('ITEM_PRODUCT')) = 'expired', 'Bài quá hạn duyệt -> expired');

-- ---------------------------------------------------------------- Thông báo, dashboard, quản trị
select test.login('A'); set role authenticated;
update public.notifications set read_at = now() where recipient_id = test.id('A');
select test.err($$update public.notifications set title = 'sửa' where recipient_id = test.id('A')$$, '42501',
                'Client chỉ sửa được read_at của thông báo');
select test.ok((select count(*) from public.notifications where recipient_id <> test.id('A')) = 0, 'Chỉ đọc thông báo của mình');
reset role;
select test.login('L'); set role authenticated;
select test.ok((select count(*) from public.v_connection_dashboard) = 5, 'Giảng viên thấy mọi kết nối trên dashboard');
select test.ok((select count(*) from public.v_connection_dashboard where status = 'completed' and execution_days is not null) = 1,
               'Dashboard tính thời gian thực hiện');
select test.ok((select count(*) from public.status_history) > 0, 'Staff đọc được status_history');
reset role;
select test.login('C'); set role authenticated;
select test.ok((select count(*) from public.status_history) = 0, 'Doanh nghiệp không đọc status_history');
reset role;

select test.login('A'); set role authenticated;
select public.rpc_transfer_team_leader(test.id('TEAM_A'), test.id('B'));
select test.ok((select member_role from public.team_members where team_id = test.id('TEAM_A') and profile_id = test.id('B')) = 'leader',
               'Chuyển quyền nhóm trưởng');
select test.err($$select public.rpc_transfer_team_leader(test.id('TEAM_A'), test.id('A'))$$, '42501', 'Cựu nhóm trưởng không còn quyền chuyển');
reset role;

select test.login('Q'); set role authenticated;
select test.err($$select public.rpc_admin_set_active(test.id('Q'), false)$$, '42501', 'T17 admin không tự khóa chính mình');
select public.rpc_admin_set_active(test.id('A2'), false);
reset role;
select test.ok((select banned_until > now() from auth.users where id = test.id('A2')), 'T17 khóa tài khoản đặt banned_until');
select test.login('A2'); set role authenticated;
-- Ghi chú: policy bp_read/items_read cho mọi người đã đăng nhập đọc bài đã duyệt, không xét is_active.
-- Tài khoản bị khóa vẫn đọc được bài công khai cho tới khi access token hết hạn (banned_until chặn đăng nhập/refresh).
select test.err($$insert into public.student_teams (name, created_by) values ('Nhóm của tài khoản khóa', test.id('A2'))$$, '42501',
                'Tài khoản bị khóa không tạo được dữ liệu');
select test.err($$select public.rpc_create_connection_request(test.id('P3'), test.id('TEAM_A2'), null, null, 7)$$, '42501',
                'Tài khoản bị khóa không gửi được yêu cầu');
reset role;
