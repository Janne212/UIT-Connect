-- =====================================================================================
-- UIT CONNECT — RPC vòng đời kết nối (Chặng 2.5 của tài liệu hướng dẫn)
-- Chạy SAU 20261022000001_schema.sql và 20261022000002_auth_integration.sql.
--
-- connection_requests cố ý KHÔNG có policy ghi: mọi thao tác ghi đi qua các hàm
-- SECURITY DEFINER dưới đây. Mỗi hàm tự kiểm tra người gọi (vai trò, nhóm trưởng,
-- chủ bài toán) và trạng thái; trigger máy trạng thái trong schema là chốt chặn cuối.
--
-- Mã lỗi: 42501 = không đủ quyền · P0001 = lỗi nghiệp vụ (thông báo tiếng Việt hiển thị
--         thẳng cho người dùng) · P0002 = không tìm thấy.
--
-- So với bản đề xuất trong tài liệu, bản này bổ sung:
--   * kiểm tra p_ttl_days null (bản gốc để lọt và lỗi NOT NULL khó hiểu)
--   * thư ngỏ >= 10 ký tự khi doanh nghiệp mời nhóm (báo P0001 thay vì lỗi CHECK 23514)
--   * hoàn thành bắt buộc có điểm đánh giá 1–5 (Requirement: "chưa có điểm đánh giá → yêu cầu nhập")
--   * doanh nghiệp chỉ được gửi lời mời kèm bài toán đã duyệt của chính mình
-- =====================================================================================

begin;

-- Thông báo cho mọi thành viên của một nhóm (hàm nội bộ, client không gọi được)
create or replace function app.notify_team_members(
  p_team uuid, p_type public.notification_type, p_title text, p_body text, p_conn uuid)
returns void
language sql security definer set search_path = ''
as $$
  insert into public.notifications (recipient_id, type, title, body, link_path, connection_id)
  select tm.profile_id, p_type, p_title, p_body, '/connections/' || p_conn, p_conn
    from public.team_members tm
   where tm.team_id = p_team
$$;
revoke execute on function app.notify_team_members(uuid, public.notification_type, text, text, uuid)
  from public, anon, authenticated;

-- -------------------------------------------------------------------------------------
-- 1) Gửi yêu cầu kết nối (cả hai chiều). Trả về id của yêu cầu.
--    * Sinh viên (nhóm trưởng của p_team)  -> team_to_company
--    * Doanh nghiệp (chủ của p_problem)      -> company_to_team (mời nhóm, kèm bài toán mục tiêu)
-- -------------------------------------------------------------------------------------
create or replace function public.rpc_create_connection_request(
  p_problem uuid, p_team uuid, p_item uuid, p_message text, p_ttl_days integer)
returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  v_uid     uuid := (select auth.uid());
  v_role    public.user_role := app.my_role();
  v_problem public.business_problems%rowtype;
  v_owner   uuid;
  v_team    text;
  v_dir     public.request_direction;
  v_ttls    jsonb;
  v_id      uuid;
begin
  if v_role is null then
    raise exception 'Tài khoản không hoạt động' using errcode = '42501';
  end if;

  select * into v_problem from public.business_problems where id = p_problem;
  if not found or v_problem.review_status <> 'approved' or v_problem.deleted_at is not null
     or v_problem.solve_status <> 'open' then
    raise exception 'Bài toán không còn nhận kết nối' using errcode = 'P0001';
  end if;

  select c.owner_id into v_owner from public.companies c where c.id = v_problem.company_id;
  select t.name into v_team from public.student_teams t where t.id = p_team;
  if v_team is null then
    raise exception 'Không tìm thấy nhóm' using errcode = 'P0002';
  end if;

  if v_role = 'student' and app.is_team_leader(p_team) then
    v_dir := 'team_to_company';
  elsif v_role = 'company' and v_owner = v_uid then
    v_dir := 'company_to_team';
    if char_length(btrim(coalesce(p_message, ''))) < 10 then
      raise exception 'Thư ngỏ gửi nhóm cần tối thiểu 10 ký tự' using errcode = 'P0001';
    end if;
  else
    raise exception 'Bạn không có quyền gửi yêu cầu này' using errcode = '42501';
  end if;

  select s.value into v_ttls from public.system_settings s where s.key = 'connection_ttl_options_days';
  if p_ttl_days is null or v_ttls is null or not (v_ttls @> to_jsonb(p_ttl_days)) then
    raise exception 'Thời hạn phản hồi không hợp lệ' using errcode = 'P0001';
  end if;

  if p_item is not null and not exists (
       select 1 from public.portfolio_items i
        where i.id = p_item and i.team_id = p_team
          and i.review_status = 'approved' and i.deleted_at is null) then
    raise exception 'Sản phẩm làm cầu nối không hợp lệ' using errcode = 'P0001';
  end if;

  if p_message is not null and char_length(p_message) > 3000 then
    raise exception 'Thư ngỏ tối đa 3000 ký tự' using errcode = 'P0001';
  end if;

  insert into public.connection_requests
         (problem_id, team_id, item_id, direction, requested_by, message, expires_at)
  values (p_problem, p_team, p_item, v_dir, v_uid, nullif(btrim(p_message), ''),
          now() + make_interval(days => p_ttl_days))
  returning id into v_id;

  if v_dir = 'team_to_company' then
    insert into public.notifications (recipient_id, type, title, body, link_path, connection_id, payload)
    values (v_owner, 'connection_received', 'Có yêu cầu kết nối mới',
            'Nhóm “' || v_team || '” muốn thực hiện bài toán “' || v_problem.title || '”.',
            '/connections/' || v_id, v_id,
            jsonb_build_object('team_id', p_team, 'problem_id', p_problem));
  else
    insert into public.notifications (recipient_id, type, title, body, link_path, connection_id, payload)
    select tm.profile_id, 'connection_received', 'Doanh nghiệp mời nhóm bạn',
           'Nhóm “' || v_team || '” được mời thực hiện bài toán “' || v_problem.title || '”.',
           '/connections/' || v_id, v_id,
           jsonb_build_object('team_id', p_team, 'problem_id', p_problem)
      from public.team_members tm
     where tm.team_id = p_team and tm.member_role = 'leader';
  end if;

  return v_id;
end $$;

-- -------------------------------------------------------------------------------------
-- 2) Bên NHẬN đồng ý hoặc từ chối
--    team_to_company: chủ bài toán phản hồi · company_to_team: nhóm trưởng phản hồi
-- -------------------------------------------------------------------------------------
create or replace function public.rpc_respond_connection(p_id uuid, p_accept boolean, p_message text)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_uid   uuid := (select auth.uid());
  v_cr    public.connection_requests%rowtype;
  v_owner uuid;
  v_title text;
  v_ok    boolean;
begin
  if p_accept is null then
    raise exception 'Hãy chọn Đồng ý hoặc Từ chối' using errcode = 'P0001';
  end if;

  select * into v_cr from public.connection_requests where id = p_id for update;
  if not found then
    raise exception 'Không tìm thấy yêu cầu' using errcode = 'P0002';
  end if;

  select c.owner_id, bp.title into v_owner, v_title
    from public.business_problems bp
    join public.companies c on c.id = bp.company_id
   where bp.id = v_cr.problem_id;

  v_ok := coalesce(app.my_role() is not null and (
            (v_cr.direction = 'team_to_company' and v_owner = v_uid)
         or (v_cr.direction = 'company_to_team' and app.is_team_leader(v_cr.team_id))), false);
  if not v_ok then
    raise exception 'Bạn không có quyền phản hồi yêu cầu này' using errcode = '42501';
  end if;
  if v_cr.status <> 'pending' then
    raise exception 'Yêu cầu không còn ở trạng thái chờ phản hồi' using errcode = 'P0001';
  end if;
  if v_cr.expires_at < now() then
    raise exception 'Yêu cầu đã quá hạn phản hồi' using errcode = 'P0001';
  end if;
  if p_accept and not exists (
       select 1 from public.business_problems bp
        where bp.id = v_cr.problem_id and bp.solve_status = 'open'
          and bp.review_status = 'approved' and bp.deleted_at is null) then
    raise exception 'Bài toán đã có nhóm thực hiện hoặc không còn mở' using errcode = 'P0001';
  end if;
  if p_message is not null and char_length(p_message) > 3000 then
    raise exception 'Nội dung phản hồi tối đa 3000 ký tự' using errcode = 'P0001';
  end if;

  -- Trigger máy trạng thái tự điền mốc thời gian; trigger đồng bộ đổi solve_status
  -- và đóng các yêu cầu đang chờ khác của cùng bài toán
  update public.connection_requests
     set status = case when p_accept then 'in_progress'::public.connection_status
                       else 'rejected'::public.connection_status end,
         responded_by = v_uid,
         response_message = nullif(btrim(p_message), '')
   where id = p_id;

  insert into public.notifications (recipient_id, type, title, body, link_path, connection_id)
  values (v_cr.requested_by,
          case when p_accept then 'connection_accepted' else 'connection_rejected' end::public.notification_type,
          case when p_accept then 'Yêu cầu kết nối được chấp nhận' else 'Yêu cầu kết nối bị từ chối' end,
          'Bài toán “' || v_title || '”.', '/connections/' || p_id, p_id);
end $$;

-- -------------------------------------------------------------------------------------
-- 3) Doanh nghiệp kết thúc kết nối: completed (bắt buộc điểm 1–5) hoặc cancelled (bắt buộc lý do)
-- -------------------------------------------------------------------------------------
create or replace function public.rpc_end_connection(
  p_id uuid, p_outcome text, p_reason text, p_rating smallint, p_feedback text)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_uid   uuid := (select auth.uid());
  v_cr    public.connection_requests%rowtype;
  v_title text;
begin
  if p_outcome is null or p_outcome not in ('completed', 'cancelled') then
    raise exception 'Kết quả phải là completed hoặc cancelled' using errcode = 'P0001';
  end if;

  select * into v_cr from public.connection_requests where id = p_id for update;
  if not found then
    raise exception 'Không tìm thấy kết nối' using errcode = 'P0002';
  end if;

  select bp.title into v_title
    from public.business_problems bp
    join public.companies c on c.id = bp.company_id
   where bp.id = v_cr.problem_id and c.owner_id = v_uid;
  if v_title is null or app.my_role() is distinct from 'company' then
    raise exception 'Chỉ doanh nghiệp sở hữu bài toán được kết thúc kết nối' using errcode = '42501';
  end if;

  if v_cr.status <> 'in_progress' then
    raise exception 'Kết nối không ở trạng thái đang thực hiện' using errcode = 'P0001';
  end if;
  if p_outcome = 'cancelled' and nullif(btrim(p_reason), '') is null then
    raise exception 'Cần nêu lý do dừng kết nối' using errcode = 'P0001';
  end if;
  if p_outcome = 'completed' and (p_rating is null or p_rating not between 1 and 5) then
    raise exception 'Cần chọn điểm đánh giá từ 1 đến 5' using errcode = 'P0001';
  end if;
  if char_length(coalesce(p_reason, '')) > 2000 or char_length(coalesce(p_feedback, '')) > 3000 then
    raise exception 'Nội dung quá dài (lý do tối đa 2000, nhận xét tối đa 3000 ký tự)' using errcode = 'P0001';
  end if;

  update public.connection_requests
     set status       = p_outcome::public.connection_status,
         end_reason   = nullif(btrim(p_reason), ''),
         end_rating   = case when p_outcome = 'completed' then p_rating end,
         end_feedback = case when p_outcome = 'completed' then nullif(btrim(p_feedback), '') end
   where id = p_id;

  perform app.notify_team_members(
    v_cr.team_id,
    case when p_outcome = 'completed' then 'connection_completed' else 'connection_cancelled' end::public.notification_type,
    case when p_outcome = 'completed' then 'Kết nối đã hoàn thành' else 'Kết nối đã dừng' end,
    'Bài toán “' || v_title || '”.', p_id);
end $$;

-- -------------------------------------------------------------------------------------
-- 4) Doanh nghiệp gia hạn thời gian thực hiện
-- -------------------------------------------------------------------------------------
create or replace function public.rpc_extend_connection(p_id uuid, p_new_end timestamptz, p_reason text)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_uid   uuid := (select auth.uid());
  v_cr    public.connection_requests%rowtype;
  v_title text;
begin
  select * into v_cr from public.connection_requests where id = p_id for update;
  if not found then
    raise exception 'Không tìm thấy kết nối' using errcode = 'P0002';
  end if;

  select bp.title into v_title
    from public.business_problems bp
    join public.companies c on c.id = bp.company_id
   where bp.id = v_cr.problem_id and c.owner_id = v_uid;
  if v_title is null or app.my_role() is distinct from 'company' then
    raise exception 'Chỉ doanh nghiệp sở hữu bài toán được gia hạn' using errcode = '42501';
  end if;
  if v_cr.status <> 'in_progress' then
    raise exception 'Kết nối không ở trạng thái đang thực hiện' using errcode = 'P0001';
  end if;
  if p_new_end is null or p_new_end <= v_cr.expected_end_at then
    raise exception 'Hạn mới phải sau hạn hiện tại' using errcode = 'P0001';
  end if;
  if char_length(coalesce(p_reason, '')) > 1000 then
    raise exception 'Lý do gia hạn tối đa 1000 ký tự' using errcode = 'P0001';
  end if;

  insert into public.connection_extensions (connection_id, previous_end_at, new_end_at, reason, requested_by)
  values (p_id, v_cr.expected_end_at, p_new_end, nullif(btrim(p_reason), ''), v_uid);

  update public.connection_requests
     set expected_end_at = p_new_end, reminder_sent_at = null
   where id = p_id;

  perform app.notify_team_members(v_cr.team_id, 'connection_extended',
    'Thời hạn thực hiện được gia hạn', 'Bài toán “' || v_title || '”.', p_id);
end $$;

revoke execute on function public.rpc_create_connection_request(uuid, uuid, uuid, text, integer) from public, anon;
revoke execute on function public.rpc_respond_connection(uuid, boolean, text)                     from public, anon;
revoke execute on function public.rpc_end_connection(uuid, text, text, smallint, text)            from public, anon;
revoke execute on function public.rpc_extend_connection(uuid, timestamptz, text)                  from public, anon;
grant  execute on function public.rpc_create_connection_request(uuid, uuid, uuid, text, integer) to authenticated;
grant  execute on function public.rpc_respond_connection(uuid, boolean, text)                     to authenticated;
grant  execute on function public.rpc_end_connection(uuid, text, text, smallint, text)            to authenticated;
grant  execute on function public.rpc_extend_connection(uuid, timestamptz, text)                  to authenticated;

commit;
