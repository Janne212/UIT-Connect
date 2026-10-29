-- =====================================================================================
-- UIT CONNECT — RPC kiểm duyệt nội dung, gửi lại, xóa mềm, đổi nhóm trưởng (Chặng 2.6)
-- Schema chặn client sửa review_status / deleted_at / member_role của nhóm trưởng, nên
-- các thao tác này phải đi qua hàm SECURITY DEFINER và tự kiểm tra quyền trong thân hàm.
-- Mã lỗi: 42501 không đủ quyền · P0001 lỗi nghiệp vụ · P0002 không tìm thấy.
-- =====================================================================================

begin;

-- -------------------------------------------------------------------------------------
-- 1) Giảng viên / admin duyệt hoặc từ chối một bài đăng đang chờ duyệt
--    p_entity: 'portfolio_item' | 'business_problem'
-- -------------------------------------------------------------------------------------
create or replace function public.rpc_submit_review(
  p_entity text, p_id uuid, p_approve boolean, p_note text)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_uid    uuid := (select auth.uid());
  v_status public.review_status;
  v_owner  uuid;
  v_title  text;
begin
  if not app.is_staff() then
    raise exception 'Chỉ giảng viên hoặc quản trị viên được duyệt' using errcode = '42501';
  end if;
  if p_approve is null then
    raise exception 'Hãy chọn Duyệt hoặc Từ chối' using errcode = 'P0001';
  end if;
  if not p_approve and nullif(btrim(p_note), '') is null then
    raise exception 'Cần ghi lý do từ chối' using errcode = 'P0001';
  end if;
  if char_length(coalesce(p_note, '')) > 2000 then
    raise exception 'Ghi chú duyệt tối đa 2000 ký tự' using errcode = 'P0001';
  end if;
  v_status := case when p_approve then 'approved'::public.review_status else 'rejected'::public.review_status end;

  if p_entity = 'portfolio_item' then
    update public.portfolio_items
       set review_status = v_status, reviewed_by = v_uid, reviewed_at = now(),
           review_note = nullif(btrim(p_note), '')
     where id = p_id and review_status = 'pending_review' and deleted_at is null
    returning created_by, title into v_owner, v_title;
  elsif p_entity = 'business_problem' then
    update public.business_problems bp
       set review_status = v_status, reviewed_by = v_uid, reviewed_at = now(),
           review_note = nullif(btrim(p_note), '')
     where bp.id = p_id and bp.review_status = 'pending_review' and bp.deleted_at is null
    returning (select c.owner_id from public.companies c where c.id = bp.company_id), bp.title
         into v_owner, v_title;
  else
    raise exception 'Loại nội dung không hợp lệ' using errcode = 'P0001';
  end if;

  if not found then
    raise exception 'Không có nội dung đang chờ duyệt với id này' using errcode = 'P0002';
  end if;

  insert into public.notifications (recipient_id, type, title, body, link_path, payload)
  values (v_owner,
          case when p_approve then 'review_approved' else 'review_rejected' end::public.notification_type,
          case when p_approve then 'Nội dung đã được duyệt' else 'Nội dung bị từ chối' end,
          'Bài “' || v_title || '”.' || coalesce(' Ghi chú: ' || nullif(btrim(p_note), ''), ''),
          case when p_entity = 'portfolio_item' then '/portfolio/' else '/problems/' end || p_id,
          jsonb_build_object('entity', p_entity, 'id', p_id));
end $$;

-- -------------------------------------------------------------------------------------
-- 2) Gửi lại bài bị từ chối hoặc hết hạn duyệt -> pending_review với hạn duyệt mới
--    Quyền: thành viên nhóm (portfolio_item) hoặc chủ công ty (business_problem)
-- -------------------------------------------------------------------------------------
create or replace function public.rpc_resubmit_content(p_entity text, p_id uuid)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_team    uuid;
  v_company uuid;
  v_status  public.review_status;
  v_deleted timestamptz;
begin
  if app.my_role() is null then
    raise exception 'Tài khoản không hoạt động' using errcode = '42501';
  end if;

  if p_entity = 'portfolio_item' then
    select i.team_id, i.review_status, i.deleted_at into v_team, v_status, v_deleted
      from public.portfolio_items i where i.id = p_id for update;
    if not found then
      raise exception 'Không tìm thấy bài đăng' using errcode = 'P0002';
    end if;
    if not app.is_team_member(v_team) then
      raise exception 'Chỉ thành viên nhóm được gửi lại bài' using errcode = '42501';
    end if;
  elsif p_entity = 'business_problem' then
    select bp.company_id, bp.review_status, bp.deleted_at into v_company, v_status, v_deleted
      from public.business_problems bp where bp.id = p_id for update;
    if not found then
      raise exception 'Không tìm thấy bài toán' using errcode = 'P0002';
    end if;
    if v_company is distinct from app.my_company_id() then
      raise exception 'Chỉ doanh nghiệp sở hữu bài toán được gửi lại' using errcode = '42501';
    end if;
  else
    raise exception 'Loại nội dung không hợp lệ' using errcode = 'P0001';
  end if;

  if v_deleted is not null then
    raise exception 'Bài đã bị xóa' using errcode = 'P0001';
  end if;
  if v_status not in ('rejected', 'expired') then
    raise exception 'Chỉ gửi lại được bài bị từ chối hoặc hết hạn duyệt' using errcode = 'P0001';
  end if;

  if p_entity = 'portfolio_item' then
    update public.portfolio_items
       set review_status = 'pending_review', review_submitted_at = now(),
           review_expires_at = now() + app.review_sla(),
           reviewed_by = null, reviewed_at = null, review_note = null
     where id = p_id;
  else
    update public.business_problems
       set review_status = 'pending_review', review_submitted_at = now(),
           review_expires_at = now() + app.review_sla(),
           reviewed_by = null, reviewed_at = null, review_note = null
     where id = p_id;
  end if;
end $$;

-- -------------------------------------------------------------------------------------
-- 3) Xóa mềm (dùng cho bài đã duyệt; bài chưa duyệt có thể xóa cứng qua policy delete)
--    Bài toán: từ chối khi đang có nhóm thực hiện; các yêu cầu đang chờ của bài toán
--    được đóng (rejected) và người gửi nhận thông báo.
-- -------------------------------------------------------------------------------------
create or replace function public.rpc_soft_delete_content(p_entity text, p_id uuid)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_team    uuid;
  v_company uuid;
  v_solve   public.solve_status;
  v_deleted timestamptz;
begin
  if app.my_role() is null then
    raise exception 'Tài khoản không hoạt động' using errcode = '42501';
  end if;

  if p_entity = 'portfolio_item' then
    select i.team_id, i.deleted_at into v_team, v_deleted
      from public.portfolio_items i where i.id = p_id for update;
    if not found then
      raise exception 'Không tìm thấy bài đăng' using errcode = 'P0002';
    end if;
    if not app.is_team_member(v_team) then
      raise exception 'Chỉ thành viên nhóm được xóa bài' using errcode = '42501';
    end if;
    if v_deleted is not null then
      raise exception 'Bài đã bị xóa trước đó' using errcode = 'P0001';
    end if;
    update public.portfolio_items set deleted_at = now() where id = p_id;

  elsif p_entity = 'business_problem' then
    select bp.company_id, bp.solve_status, bp.deleted_at into v_company, v_solve, v_deleted
      from public.business_problems bp where bp.id = p_id for update;
    if not found then
      raise exception 'Không tìm thấy bài toán' using errcode = 'P0002';
    end if;
    if v_company is distinct from app.my_company_id() then
      raise exception 'Chỉ doanh nghiệp sở hữu bài toán được xóa' using errcode = '42501';
    end if;
    if v_deleted is not null then
      raise exception 'Bài toán đã bị xóa trước đó' using errcode = 'P0001';
    end if;
    if v_solve = 'in_progress' then
      raise exception 'Bài toán đang có nhóm thực hiện, hãy kết thúc kết nối trước khi xóa' using errcode = 'P0001';
    end if;

    update public.business_problems set deleted_at = now() where id = p_id;

    with r as (
      update public.connection_requests
         set status = 'rejected', response_message = 'Hệ thống: doanh nghiệp đã gỡ bài toán.'
       where problem_id = p_id and status = 'pending'
      returning id, requested_by
    )
    insert into public.notifications (recipient_id, type, title, body, link_path, connection_id)
    select r.requested_by, 'connection_rejected', 'Yêu cầu kết nối đã được đóng',
           'Doanh nghiệp đã gỡ bài toán.', '/connections/' || r.id, r.id
      from r;
  else
    raise exception 'Loại nội dung không hợp lệ' using errcode = 'P0001';
  end if;
end $$;

-- -------------------------------------------------------------------------------------
-- 4) Chuyển quyền nhóm trưởng (uq_team_one_leader chỉ cho 1 leader nên hạ trước, nâng sau)
-- -------------------------------------------------------------------------------------
create or replace function public.rpc_transfer_team_leader(p_team uuid, p_new_leader uuid)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
begin
  if app.my_role() is distinct from 'student' or not app.is_team_leader(p_team) then
    raise exception 'Chỉ nhóm trưởng được chuyển quyền' using errcode = '42501';
  end if;
  if p_new_leader is null or p_new_leader = v_uid then
    raise exception 'Hãy chọn một thành viên khác trong nhóm' using errcode = 'P0001';
  end if;
  if not exists (select 1 from public.team_members tm
                  where tm.team_id = p_team and tm.profile_id = p_new_leader) then
    raise exception 'Người nhận không phải thành viên của nhóm' using errcode = 'P0001';
  end if;

  update public.team_members set member_role = 'member'
   where team_id = p_team and profile_id = v_uid;
  update public.team_members set member_role = 'leader'
   where team_id = p_team and profile_id = p_new_leader;
end $$;

revoke execute on function public.rpc_submit_review(text, uuid, boolean, text) from public, anon;
revoke execute on function public.rpc_resubmit_content(text, uuid)             from public, anon;
revoke execute on function public.rpc_soft_delete_content(text, uuid)          from public, anon;
revoke execute on function public.rpc_transfer_team_leader(uuid, uuid)         from public, anon;
grant  execute on function public.rpc_submit_review(text, uuid, boolean, text) to authenticated;
grant  execute on function public.rpc_resubmit_content(text, uuid)             to authenticated;
grant  execute on function public.rpc_soft_delete_content(text, uuid)          to authenticated;
grant  execute on function public.rpc_transfer_team_leader(uuid, uuid)         to authenticated;

commit;
