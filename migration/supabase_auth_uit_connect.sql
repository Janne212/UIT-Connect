-- =====================================================================================
-- UIT CONNECT — supabase_auth_uit_connect.sql
-- Tích hợp Supabase Auth với schema.sql.  CHẠY SAU schema.sql (cần public.profiles,
-- public.user_role và schema app đã tồn tại). Chạy lại nhiều lần vẫn an toàn.
--
-- Phân chia trách nhiệm giữa hai file (không đối tượng nào được tạo ở cả hai nơi):
--   schema.sql                 : bảng profiles + RLS + quyền cột + guard cột nhạy cảm (role, is_active, email)
--   supabase_auth_uit_connect.sql : mọi thứ chạm tới auth.users (trigger tạo profile, đồng bộ email, backfill)
--                                   + 2 RPC quản trị tài khoản (UC17: đổi vai trò, khóa/mở khóa)
--
-- Ánh xạ M1 FR01:  username_email -> auth.users.email (bản sao: profiles.email)
--                  is_active      -> profiles.is_active (+ auth.users.banned_until để chặn đăng nhập thật)
--                  password, session_token -> do Supabase Auth quản lý, không có cột trong schema
-- =====================================================================================

begin;

-- ---------------------------------------------------------------- 0. KIỂM TRA TIÊN QUYẾT
do $$
begin
  if to_regclass('public.profiles') is null
     or to_regtype('public.user_role') is null
     or to_regnamespace('app') is null
     or not exists (select 1 from information_schema.columns
                     where table_schema = 'public' and table_name = 'profiles' and column_name in ('email','is_active') having count(*) = 2) then
    raise exception 'Hãy chạy schema.sql (bản đã sửa: profiles có email, is_active) trước file này';
  end if;
end $$;

-- ---------------------------------------------------------------- 1. DỌN PHẦN CỦA BẢN CŨ (nếu đã từng chạy)
-- Bản cũ dùng kiểu account_role, cột website_url, policy profiles_select_own (chặn đọc hồ sơ công khai)
-- và prevent_self_role_change (chặn luôn cả RPC của admin vì auth.uid() vẫn khác null trong RPC).
drop trigger  if exists on_auth_user_created              on auth.users;
drop trigger  if exists on_auth_user_email_changed        on auth.users;
drop trigger  if exists profiles_prevent_self_role_change on public.profiles;
drop policy   if exists profiles_select_own               on public.profiles;
drop policy   if exists profiles_update_own               on public.profiles;
drop function if exists public.handle_new_auth_user();
drop function if exists public.sync_auth_email_to_profile();
drop function if exists public.prevent_self_role_change();

-- ---------------------------------------------------------------- 2. ĐĂNG KÝ -> TỰ TẠO PROFILE
-- YC-02 / SCR-03: người dùng tự chọn loại tài khoản "sinh viên" hoặc "doanh nghiệp".
-- Chỉ 2 giá trị đó được nhận từ user_metadata; lecturer/admin KHÔNG bao giờ tự xưng được
-- (cấp qua public.rpc_admin_set_role bên dưới). Mặc định (thiếu/sai giá trị) = 'student'.
create or replace function app.handle_new_user() returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  v_name text;
begin
  v_name := coalesce(nullif(btrim(new.raw_user_meta_data ->> 'full_name'), ''),
                     nullif(split_part(coalesce(new.email, ''), '@', 1), ''),
                     'Người dùng mới');

  insert into public.profiles (id, role, full_name, email)
  values (
    new.id,
    case when new.raw_user_meta_data ->> 'role' = 'company' then 'company'::public.user_role
         else 'student'::public.user_role end,
    left(v_name, 120),                      -- khớp CHECK độ dài full_name
    new.email
  )
  on conflict (id) do nothing;
  return new;
end $$;

drop trigger if exists trg_auth_user_created on auth.users;
create trigger trg_auth_user_created after insert on auth.users
  for each row execute function app.handle_new_user();

-- ---------------------------------------------------------------- 3. ĐỒNG BỘ EMAIL auth.users -> profiles
-- Email đăng nhập và xác thực vẫn do Supabase Auth quản lý; profiles.email chỉ là bản sao
-- (phục vụ quản trị và gửi thông báo), client không đọc/ghi được cột này (quyền cột trong schema.sql).
create or replace function app.sync_auth_email() returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if new.email is distinct from old.email then
    update public.profiles set email = new.email where id = new.id;
  end if;
  return new;
end $$;

drop trigger if exists trg_auth_email_changed on auth.users;
create trigger trg_auth_email_changed after update of email on auth.users
  for each row execute function app.sync_auth_email();

-- ---------------------------------------------------------------- 4. BACKFILL (user tạo trước khi cài tích hợp)
insert into public.profiles (id, role, full_name, email)
select u.id,
       case when u.raw_user_meta_data ->> 'role' = 'company' then 'company'::public.user_role
            else 'student'::public.user_role end,
       left(coalesce(nullif(btrim(u.raw_user_meta_data ->> 'full_name'), ''),
                     nullif(split_part(coalesce(u.email, ''), '@', 1), ''),
                     'Người dùng mới'), 120),
       u.email
  from auth.users u
on conflict (id) do nothing;

update public.profiles p set email = u.email
  from auth.users u
 where u.id = p.id and p.email is distinct from u.email;

-- ---------------------------------------------------------------- 5. RPC QUẢN TRỊ TÀI KHOẢN (UC17 / FR08)
-- Chạy SECURITY DEFINER nên qua được guard_protected_columns (current_user = chủ hàm, không phải 'authenticated').
-- Quyền kiểm tra ngay trong hàm: chỉ admin còn hoạt động; không tự đổi/khóa chính mình.
create or replace function public.rpc_admin_set_role(p_user uuid, p_role public.user_role)
returns void
language plpgsql security definer set search_path = ''
as $$
begin
  if not app.is_admin() then
    raise exception 'Chỉ quản trị viên được đổi vai trò' using errcode = '42501';
  end if;
  if p_user = (select auth.uid()) then
    raise exception 'Không thể tự đổi vai trò của chính mình' using errcode = '42501';
  end if;

  update public.profiles set role = p_role where id = p_user;
  if not found then
    raise exception 'Không tìm thấy tài khoản %', p_user using errcode = 'P0002';
  end if;
end $$;

-- Khóa = is_active=false (RLS coi như không có vai trò) + banned_until trong Auth (chặn đăng nhập/refresh token).
-- Dùng mốc xa trong tương lai thay vì 'infinity' để GoTrue đọc được giá trị.
-- Hai cập nhật nằm cùng một giao dịch: lỗi ở bước nào thì hoàn tác cả hai.
create or replace function public.rpc_admin_set_active(p_user uuid, p_active boolean)
returns void
language plpgsql security definer set search_path = ''
as $$
begin
  if not app.is_admin() then
    raise exception 'Chỉ quản trị viên được khóa/mở khóa tài khoản' using errcode = '42501';
  end if;
  if p_user = (select auth.uid()) then
    raise exception 'Không thể tự khóa chính mình' using errcode = '42501';
  end if;

  update public.profiles set is_active = p_active where id = p_user;
  if not found then
    raise exception 'Không tìm thấy tài khoản %', p_user using errcode = 'P0002';
  end if;

  update auth.users
     set banned_until = case when p_active then null else now() + interval '100 years' end
   where id = p_user;
end $$;

revoke execute on function public.rpc_admin_set_role(uuid, public.user_role) from public, anon;
revoke execute on function public.rpc_admin_set_active(uuid, boolean)        from public, anon;
grant  execute on function public.rpc_admin_set_role(uuid, public.user_role) to authenticated;
grant  execute on function public.rpc_admin_set_active(uuid, boolean)        to authenticated;

commit;

-- =====================================================================================
-- THIẾT LẬP / VẬN HÀNH
-- A. Chạy schema.sql trước, file này sau. Chạy lại file này an toàn (idempotent).
-- B. Tạo quản trị viên đầu tiên (một lần, trong SQL Editor — chạy bằng role postgres nên không bị guard chặn):
--      update public.profiles set role = 'admin' where id = '<uuid của user trong Authentication > Users>';
--    Từ đó admin đăng nhập và dùng rpc_admin_set_role để cấp 'lecturer' / 'admin' cho người khác.
-- C. Dashboard > Authentication > Providers: bật Email (mật khẩu tối thiểu 6 ký tự cho khớp M1 FR01); cấu hình SMTP nếu cần mail thật.
--    Dashboard > Authentication > URL Configuration: Site URL và Redirect URLs của app.
-- D. Đăng ký (Next.js): supabase.auth.signUp({ email, password, options: { data: { full_name, role: 'student' | 'company' } } })
--    Giá trị role khác 'company' đều thành 'student'. Doanh nghiệp sau đó điền hồ sơ công ty (FR02) mới đăng được bài toán.
-- E. Client không đọc được profiles.email -> truy vấn profiles phải liệt kê cột (không select('*')); email của chính
--    mình lấy bằng supabase.auth.getUser(). Quản trị xem email người khác bằng server route dùng service_role.
-- F. Không để service_role key ở code trình duyệt.
-- G. Chưa có trong DB: khóa tài khoản sau 5 lần sai/15 phút (M1 FR01) và hết phiên sau 30 phút không thao tác (M1 SCR-05..14).
--    Supabase Auth chỉ rate-limit theo IP/endpoint và có tuỳ chọn phiên theo thời gian (tùy gói) — cần xác nhận lại với giảng viên
--    hoặc hiện thực riêng (bảng đếm lần sai / auth hook).
-- H. rpc_admin_set_active ghi vào auth.users.banned_until: cần thử trên project Supabase thật (đã thử trên stub PostgreSQL).
-- =====================================================================================
