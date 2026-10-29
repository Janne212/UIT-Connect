-- =====================================================================================
-- UIT CONNECT — bổ sung cho backend giai đoạn 1 (chạy sau 20261022000005_storage.sql)
--  1) v_connection_dashboard: THÊM cột id (problem_id, team_id, item_id, requested_by, company_id) vào
--     cuối view để bảng theo dõi xác định "việc cần làm" (vd: chỉ nhóm trưởng của đúng nhóm được mời
--     mới phải phản hồi). create or replace view cho phép thêm cột cuối; cột cũ giữ nguyên.
--  2) rpc_search_students: tìm sinh viên theo tên KHÔNG DẤU để nhóm trưởng thêm thành viên
--     ("nguyen van a" tìm ra "Nguyễn Văn A"). SECURITY INVOKER: chạy bằng quyền người gọi nên RLS
--     và quyền theo cột của profiles vẫn áp dụng (chỉ trả cột công khai, không có email).
-- Không sửa file schema.sql gốc.
-- =====================================================================================

create or replace view public.v_connection_dashboard with (security_invoker = true) as
  select cr.id, cr.status, cr.direction,
         t.name as team_name, c.name as company_name, bp.title as problem_title, it.title as item_title,
         cr.created_at, cr.expires_at, cr.responded_at, cr.started_at, cr.expected_end_at, cr.ended_at,
         case when cr.responded_at is not null then extract(day from cr.responded_at - cr.created_at)::int end as response_days,
         case when cr.ended_at is not null     then extract(day from cr.ended_at - cr.started_at)::int end     as execution_days,
         (cr.status = 'in_progress' and cr.expected_end_at < now()) as is_overdue,
         cr.problem_id, cr.team_id, cr.item_id, cr.requested_by, bp.company_id
    from public.connection_requests cr
    join public.business_problems bp on bp.id = cr.problem_id
    join public.companies c          on c.id  = bp.company_id
    join public.student_teams t      on t.id  = cr.team_id
    left join public.portfolio_items it on it.id = cr.item_id;

create or replace function public.rpc_search_students(p_query text, p_limit integer default 20)
returns table (id uuid, full_name text, major text, cohort text, avatar_url text)
language sql stable security invoker set search_path = ''
as $$
  select p.id, p.full_name, p.major, p.cohort, p.avatar_url
    from public.profiles p
   where p.role = 'student' and p.is_active
     and char_length(btrim(coalesce(p_query, ''))) >= 2
     and lower(app.f_unaccent(p.full_name)) like
         '%' || lower(app.f_unaccent(replace(replace(replace(btrim(p_query), '\', '\\'), '%', '\%'), '_', '\_'))) || '%'
   order by p.full_name
   limit least(greatest(coalesce(p_limit, 20), 1), 50)
$$;

revoke execute on function public.rpc_search_students(text, integer) from public, anon;
grant  execute on function public.rpc_search_students(text, integer) to authenticated;
