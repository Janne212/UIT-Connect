-- Tài khoản thử cho bộ test cục bộ (CHỈ dùng trong database tạm uitc_test).
-- Đăng ký qua auth.users -> trigger handle_new_user tạo profiles; staff được nâng vai trò bằng SQL
-- (đúng quy trình "admin đầu tiên tạo bằng SQL" trong tài liệu hướng dẫn).

create schema if not exists test;
grant usage on schema test to anon, authenticated;

create table test.ids (name text primary key, id uuid not null);
grant select on test.ids to anon, authenticated;

insert into auth.users (id, email, raw_user_meta_data) values
  ('aaaaaaaa-0000-4000-8000-000000000001', 'a@test.local',  '{"full_name":"Sinh viên A","role":"student"}'),
  ('aaaaaaaa-0000-4000-8000-000000000002', 'b@test.local',  '{"full_name":"Sinh viên B","role":"student"}'),
  ('aaaaaaaa-0000-4000-8000-000000000003', 'a2@test.local', '{"full_name":"Sinh viên A2","role":"student"}'),
  ('aaaaaaaa-0000-4000-8000-000000000004', 'c@test.local',  '{"full_name":"Doanh nghiệp C","role":"company"}'),
  ('aaaaaaaa-0000-4000-8000-000000000005', 'c2@test.local', '{"full_name":"Doanh nghiệp C2","role":"company"}'),
  ('aaaaaaaa-0000-4000-8000-000000000006', 'l@test.local',  '{"full_name":"Giảng viên L"}'),
  ('aaaaaaaa-0000-4000-8000-000000000007', 'q@test.local',  '{"full_name":"Quản trị Q"}'),
  -- T02: tự xưng admin qua user_metadata -> phải thành student
  ('aaaaaaaa-0000-4000-8000-000000000008', 'x@test.local',  '{"full_name":"Kẻ tự xưng","role":"admin"}');

update public.profiles set role = 'lecturer' where id = 'aaaaaaaa-0000-4000-8000-000000000006';
update public.profiles set role = 'admin'    where id = 'aaaaaaaa-0000-4000-8000-000000000007';

insert into test.ids values
  ('A',  'aaaaaaaa-0000-4000-8000-000000000001'),
  ('B',  'aaaaaaaa-0000-4000-8000-000000000002'),
  ('A2', 'aaaaaaaa-0000-4000-8000-000000000003'),
  ('C',  'aaaaaaaa-0000-4000-8000-000000000004'),
  ('C2', 'aaaaaaaa-0000-4000-8000-000000000005'),
  ('L',  'aaaaaaaa-0000-4000-8000-000000000006'),
  ('Q',  'aaaaaaaa-0000-4000-8000-000000000007'),
  ('X',  'aaaaaaaa-0000-4000-8000-000000000008');

-- Đăng nhập giả lập: đặt JWT claims giống PostgREST. Sau đó gọi "set role authenticated".
create or replace function test.login(p_name text) returns void
language plpgsql as $$
declare v uuid;
begin
  select id into v from test.ids where name = p_name;
  if v is null then raise exception 'không có tài khoản thử %', p_name; end if;
  perform set_config('request.jwt.claims', json_build_object('sub', v, 'role', 'authenticated')::text, false);
end $$;
grant execute on function test.login(text) to anon, authenticated;

create or replace function test.id(p_name text) returns uuid
language sql stable as $$ select id from test.ids where name = p_name $$;
grant execute on function test.id(text) to anon, authenticated;

-- Lưu id sinh ra trong lúc test (chạy với quyền postgres để ghi vào test.ids)
create or replace function test.remember(p_name text, p_id uuid) returns void
language sql security definer as $$
  insert into test.ids values (p_name, p_id) on conflict (name) do update set id = excluded.id
$$;
grant execute on function test.remember(text, uuid) to anon, authenticated;

create or replace function test.ok(p_cond boolean, p_msg text) returns void
language plpgsql as $$
begin
  if p_cond is distinct from true then raise exception 'FAIL: %', p_msg; end if;
  raise notice 'PASS: %', p_msg;
end $$;
grant execute on function test.ok(boolean, text) to anon, authenticated;

-- Chạy câu lệnh và yêu cầu lỗi đúng SQLSTATE
create or replace function test.err(p_sql text, p_code text, p_msg text) returns void
language plpgsql as $$
begin
  begin
    execute p_sql;
  exception when others then
    if sqlstate = p_code then
      raise notice 'PASS: % [% %]', p_msg, sqlstate, sqlerrm;
      return;
    end if;
    raise exception 'FAIL: % — mong đợi %, nhận % (%)', p_msg, p_code, sqlstate, sqlerrm;
  end;
  raise exception 'FAIL: % — mong đợi lỗi %, nhưng câu lệnh chạy thành công', p_msg, p_code;
end $$;
grant execute on function test.err(text, text, text) to anon, authenticated;
