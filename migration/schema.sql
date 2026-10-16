-- =====================================================================================
-- UIT CONNECT — schema.sql
-- Nền tảng : Supabase (PostgreSQL 15+). Chạy trên database TRỐNG (SQL Editor hoặc
--            đặt vào supabase/migrations/). Không idempotent (không có DROP).
-- Mục 5.3  : đây là nguồn chân lý của ERD + từ điển dữ liệu. Mỗi bảng có COMMENT mô tả
--            ý nghĩa nghiệp vụ (xem Supabase Studio); cột không tự giải thích có chú thích
--            ngay trên dòng khai báo.
-- Đã kiểm thử: nạp sạch schema.sql rồi supabase_auth_uit_connect.sql trên PostgreSQL 16 (stub auth/roles) và chạy
--            các phép thử hành vi: đăng ký + whitelist role, đồng bộ email, quyền cột trên profiles, RPC admin,
--            ràng buộc theo M1 (companies, business_problems, connection_requests), RLS theo sinh viên/doanh nghiệp/anon,
--            máy trạng thái kết nối. Chưa chạy trên project Supabase thật: cần bật pg_cron và kiểm tra lại sau khi nạp.
--
-- Bố cục:
--   0. Schema & extension          5. Trigger (bất biến nghiệp vụ)
--   1. Kiểu liệt kê (enum)         6. Hàm cron: hết hạn / nhắc việc
--   2. Bảng                        7. Row Level Security (RLS) + quyền
--   3. Chú thích bảng              8. View phục vụ dashboard / thống kê
--   4. Index                       9. Dữ liệu khởi tạo tối thiểu
--
-- Quy ước tên : [EXT] = bảng/cột thuộc nhóm chức năng TỐI ƯU (có thể bỏ qua khi làm MVP).
-- Thứ tự chạy : (1) schema.sql  ->  (2) supabase_auth_uit_connect.sql (trigger đăng ký/đồng bộ email trên auth.users,
--               backfill, rpc_admin_set_role, rpc_admin_set_active). Hai file không tạo trùng đối tượng nào.
--
-- Ánh xạ từ điển dữ liệu M1 (mục 3.3) -> cột DB:
--   FR01 username_email / password / session_token -> auth.users.email / mật khẩu / JWT (Supabase Auth, không có bảng riêng)
--   FR01 is_active                                 -> profiles.is_active
--   FR02 company_name / contact_email / phone_number / field_of_activity
--                                                  -> companies.name / contact_email / phone / industry
--   FR03 problem_title / problem_detail            -> business_problems.title / description
--   FR03 status {Pending, Open, Closed}            -> 2 trục: review_status (Pending = pending_review) và solve_status
--                                                     (Open = approved + open; Closed = solved)
--   FR04 keyword / type_filter / category_id       -> search_tsv / portfolio_items.kind / tags.id (integer)
--   FR05 student_id / problem_id / invitation_note -> connection_requests.team_id (nhận bằng NHÓM, nhóm trưởng phản hồi)
--                                                     / problem_id (NOT NULL, theo UC14) / message
--   Trạng thái kết nối (Task Description)          -> pending=chờ phản hồi · expired=hết hạn phản hồi · rejected=bị từ chối
--                                                     in_progress=đang thực hiện · cancelled=đã dừng · completed=đã hoàn thành
--                                                     (chờ duyệt / hết hạn duyệt là review_status của bài đăng, không phải của kết nối)
--
-- Ghi chú     : các hàm RPC nghiệp vụ (rpc_submit_review, rpc_create_connection_request,
--               rpc_respond_connection, rpc_end_connection, rpc_extend_connection …)
--               được đặc tả ở mục 5.5/5.6; file này chỉ chứa phần "bất biến" mà DB phải
--               tự bảo vệ dù ai gọi (trigger, check, unique, RLS).
-- =====================================================================================

-- ---------------------------------------------------------------- 0. SCHEMA & EXTENSION
create schema if not exists extensions;
create extension if not exists unaccent with schema extensions;   -- tìm kiếm tiếng Việt không dấu
-- Cột search_tsv (generated) được tính bằng quyền của NGƯỜI GHI -> role client phải dùng được schema chứa unaccent.
grant usage on schema extensions to anon, authenticated, service_role;

-- Schema "app": hàm nội bộ, KHÔNG nằm trong danh sách schema được expose qua Data API.
create schema if not exists app;
grant usage on schema app to anon, authenticated, service_role;

-- unaccent() mặc định chỉ STABLE -> bọc lại thành IMMUTABLE để dùng được trong generated column.
create or replace function app.f_unaccent(t text) returns text
language sql immutable parallel safe strict
as $$ select extensions.unaccent('extensions.unaccent'::regdictionary, t) $$;

-- ---------------------------------------------------------------- 1. ENUM
create type public.user_role         as enum ('student','company','lecturer','admin');          -- 4 actor của đề tài
create type public.item_kind         as enum ('project','product','paper');
create type public.review_status     as enum ('pending_review','approved','rejected','expired'); -- kiểm duyệt nội dung
create type public.solve_status      as enum ('open','in_progress','solved');                   -- vòng đời bài toán
create type public.request_direction as enum ('team_to_company','company_to_team');
create type public.connection_status as enum ('pending','expired','rejected','in_progress','cancelled','completed');
create type public.team_role         as enum ('leader','member');
create type public.tag_kind          as enum ('field','skill');                                 -- lĩnh vực | kỹ năng
create type public.attachment_kind   as enum ('proposal','deliverable');
create type public.email_status      as enum ('not_required','pending','sent','failed');
create type public.template_kind     as enum ('accept','reject');
create type public.notification_type as enum (
  'review_approved','review_rejected','review_expired',
  'connection_received','connection_accepted','connection_rejected','connection_expired',
  'connection_cancelled','connection_completed','connection_extended','connection_overdue_reminder',
  'system'
);

-- ---------------------------------------------------------------- 2. BẢNG
-- ===== 2.1 Cấu hình & danh tính ======================================================
create table public.system_settings (
  key         text primary key,                      -- vd 'review_sla_days'
  value       jsonb not null,                        -- giá trị (số, mảng, chuỗi…)
  description text,
  updated_at  timestamptz not null default now()
);

create table public.profiles (                       -- 1-1 với auth.users
  id          uuid primary key references auth.users(id) on delete cascade,
  role        public.user_role not null default 'student',   -- chỉ đổi qua RPC của admin
  full_name   text not null check (char_length(btrim(full_name)) between 1 and 120),
  avatar_url  text,
  headline    text check (char_length(headline) <= 160),     -- giới thiệu 1 dòng
  bio         text check (char_length(bio) <= 2000),
  major       text check (char_length(major) <= 120),        -- chuyên ngành (sv)
  cohort      text check (char_length(cohort) <= 20),        -- khóa (sv), vd 'K19'
  email       text,                                          -- FR01 username_email: BẢN SAO email đăng nhập của auth.users (trigger đồng bộ, xem supabase_auth_uit_connect.sql). Client không được đọc/ghi cột này.
  is_active   boolean not null default true,                 -- FR01/UC17: false = tài khoản bị khóa. Chỉ đổi qua rpc_admin_set_active
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create table public.profile_contacts (               -- kênh liên hệ ngoài hệ thống (email, Zalo…)
  profile_id  uuid primary key references public.profiles(id) on delete cascade,
  email       text check (email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  phone       text check (char_length(phone) <= 30),
  zalo        text check (char_length(zalo) <= 100),                -- số hoặc link Zalo (bước "duy trì kết nối")
  other_url   text check (other_url ~* '^https?://'),
  updated_at  timestamptz not null default now(),
  constraint ck_contact_not_empty check (num_nonnulls(email, phone, zalo, other_url) >= 1)
);

create table public.companies (
  id          uuid primary key default gen_random_uuid(),
  owner_id    uuid not null unique references public.profiles(id) on delete restrict,  -- 1 tài khoản = 1 doanh nghiệp
  name        text not null check (char_length(btrim(name)) between 5 and 200),             -- FR02 company_name (5–200)
  contact_email text not null check (contact_email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'),       -- FR02 contact_email (email liên hệ công khai, KHÁC email đăng nhập)
  industry    text not null check (char_length(btrim(industry)) between 10 and 500),        -- FR02 field_of_activity (Text, tối thiểu 10)
  size_range  text check (size_range in ('1-10','11-50','51-200','201-1000','1000+')),
  website     text check (website ~* '^https?://'),
  description text check (char_length(description) <= 5000),
  logo_url    text,
  phone       text not null check (phone ~ '^[0-9]{10,11}$'),                               -- FR02 phone_number (10–11 chữ số)
  address     text check (char_length(address) <= 300),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- ===== 2.2 Nhóm sinh viên ===========================================================
create table public.student_teams (
  id          uuid primary key default gen_random_uuid(),
  name        text not null check (char_length(btrim(name)) between 2 and 100),
  description text check (char_length(description) <= 3000),
  avatar_url  text,
  created_by  uuid not null references public.profiles(id) on delete restrict,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create table public.team_members (
  team_id     uuid not null references public.student_teams(id) on delete cascade,
  profile_id  uuid not null references public.profiles(id) on delete cascade,
  member_role public.team_role not null default 'member',   -- [EXT] hiển thị nhóm trưởng / thành viên
  joined_at   timestamptz not null default now(),
  primary key (team_id, profile_id)
);

-- ===== 2.3 Hồ sơ năng lực: project / product / paper (1 bảng, phân loại bằng kind) ====
create table public.portfolio_items (
  id                   uuid primary key default gen_random_uuid(),
  team_id              uuid not null references public.student_teams(id) on delete cascade,
  kind                 public.item_kind not null,
  parent_id            uuid,                                  -- product/paper trỏ về project cha
  title                text not null check (char_length(btrim(title)) between 3 and 200),
  summary              text not null check (char_length(btrim(summary)) between 10 and 5000),
  source_url           text not null check (source_url ~* '^https?://'),  -- chỉ lưu URL nguồn (repo, demo, bài báo)
  cover_image_url      text,
  started_on           date,
  finished_on          date,                                  -- null = đang thực hiện
  paper_application    text check (char_length(paper_application) <= 3000), -- "ứng dụng thực tiễn" (chỉ paper)
  advisor_id           uuid references public.profiles(id) on delete set null, -- GVHD (chỉ project)
  -- kiểm duyệt (giảng viên/điều phối)
  review_status        public.review_status not null default 'pending_review',
  review_submitted_at  timestamptz not null default now(),
  review_expires_at    timestamptz not null default (now() + interval '7 days'),
  reviewed_by          uuid references public.profiles(id) on delete set null,
  reviewed_at          timestamptz,
  review_note          text check (char_length(review_note) <= 2000),
  deleted_at           timestamptz,                           -- xóa mềm (nội dung đã duyệt)
  created_by           uuid not null references public.profiles(id) on delete restrict,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),
  search_tsv           tsvector generated always as (
                         to_tsvector('simple', app.f_unaccent(coalesce(title,'') || ' ' || coalesce(summary,'')))
                       ) stored,
  constraint uq_items_id_team unique (id, team_id),
  constraint fk_items_parent foreign key (parent_id, team_id)
             references public.portfolio_items (id, team_id) on delete cascade,   -- cha phải cùng nhóm
  constraint ck_items_parent_kind check (
             (kind = 'project' and parent_id is null) or (kind in ('product','paper') and parent_id is not null)),
  constraint ck_items_paper_app  check (paper_application is null or kind = 'paper'),
  constraint ck_items_advisor    check (advisor_id is null or kind = 'project'),
  constraint ck_items_dates      check (started_on is null or finished_on is null or finished_on >= started_on),
  constraint ck_items_reviewed   check ((review_status in ('approved','rejected')) = (reviewed_at is not null)),
  constraint ck_items_reject_note check (review_status <> 'rejected' or nullif(btrim(review_note), '') is not null)
);

create table public.item_members (                   -- ai đã tham gia project/product/paper nào
  item_id     uuid not null,
  team_id     uuid not null,
  profile_id  uuid not null,
  role_label  text check (char_length(role_label) <= 80),   -- vd 'Backend', 'Tác giả chính'
  primary key (item_id, profile_id),
  constraint fk_im_item   foreign key (item_id, team_id)    references public.portfolio_items (id, team_id) on delete cascade,
  constraint fk_im_member foreign key (team_id, profile_id) references public.team_members (team_id, profile_id) on delete cascade
);

-- ===== 2.4 Bài toán của doanh nghiệp ================================================
create table public.business_problems (
  id                      uuid primary key default gen_random_uuid(),
  company_id              uuid not null references public.companies(id) on delete cascade,
  title                   text not null check (char_length(btrim(title)) between 10 and 250),   -- FR03 problem_title
  description             text not null check (char_length(btrim(description)) >= 30),   -- mô tả vấn đề (BẮT BUỘC)
  expected_outcome        text not null check (char_length(btrim(expected_outcome)) >= 10), -- kết quả kỳ vọng (BẮT BUỘC)
  estimated_duration_days integer not null check (estimated_duration_days between 1 and 730), -- ước lượng thời gian (BẮT BUỘC)
  extra                   jsonb not null default '{}'::jsonb check (jsonb_typeof(extra) = 'object'),
                          -- phần form MỞ RỘNG: {background, constraints, tech_requirements, compensation,
                          --   collaboration_mode, preferred_team_size, ...} — thêm trường không cần migration
  solve_status            public.solve_status not null default 'open',   -- vòng đời; do trigger đồng bộ từ connection
  -- kiểm duyệt
  review_status           public.review_status not null default 'pending_review',
  review_submitted_at     timestamptz not null default now(),
  review_expires_at       timestamptz not null default (now() + interval '7 days'),
  reviewed_by             uuid references public.profiles(id) on delete set null,
  reviewed_at             timestamptz,
  review_note             text check (char_length(review_note) <= 2000),
  deleted_at              timestamptz,
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now(),
  search_tsv              tsvector generated always as (
                            to_tsvector('simple', app.f_unaccent(coalesce(title,'') || ' ' || coalesce(description,'')))
                          ) stored,
  constraint ck_bp_reviewed    check ((review_status in ('approved','rejected')) = (reviewed_at is not null)),
  constraint ck_bp_reject_note check (review_status <> 'rejected' or nullif(btrim(review_note), '') is not null),
  constraint ck_bp_solve_needs_approved check (solve_status = 'open' or review_status = 'approved')
);

-- ===== 2.5 Phân loại (lĩnh vực / kỹ năng) ===========================================
create table public.tags (
  id          integer generated always as identity primary key,
  kind        public.tag_kind not null,
  name        text not null check (char_length(btrim(name)) between 1 and 60),
  slug        text not null check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  is_active   boolean not null default true,
  created_by  uuid references public.profiles(id) on delete set null,
  created_at  timestamptz not null default now(),
  constraint uq_tags_kind_slug unique (kind, slug)
);

create table public.item_tags (
  item_id uuid    not null references public.portfolio_items(id) on delete cascade,
  tag_id  integer not null references public.tags(id) on delete restrict,
  primary key (item_id, tag_id)
);

create table public.problem_tags (
  problem_id uuid    not null references public.business_problems(id) on delete cascade,
  tag_id     integer not null references public.tags(id) on delete restrict,
  primary key (problem_id, tag_id)
);

-- ===== 2.6 Yêu cầu kết nối (trung tâm của nghiệp vụ) =================================
create table public.connection_requests (
  id               uuid primary key default gen_random_uuid(),
  problem_id       uuid not null references public.business_problems(id) on delete restrict,
  team_id          uuid not null references public.student_teams(id) on delete restrict,
  item_id          uuid,                              -- project/product/paper là "cầu nối" của lần kết nối (có thể trống)
  direction        public.request_direction not null, -- ai khởi tạo
  requested_by     uuid not null references public.profiles(id) on delete restrict,
  message          text check (char_length(message) <= 3000),     -- thư ngỏ / lời nhắn
  status           public.connection_status not null default 'pending',
  expires_at       timestamptz not null,              -- hạn phản hồi do NGƯỜI GỬI chọn
  responded_by     uuid references public.profiles(id) on delete set null,  -- null = hệ thống (tự đóng)
  responded_at     timestamptz,
  response_message text check (char_length(response_message) <= 3000),       -- nội dung mail đồng ý/từ chối đã gửi
  started_at       timestamptz,                       -- lúc chuyển 'in_progress'
  expected_end_at  timestamptz,                       -- = started_at + ước lượng của bài toán (+ gia hạn)
  ended_at         timestamptz,                       -- lúc 'cancelled' | 'completed'
  end_reason       text check (char_length(end_reason) <= 2000),   -- lý do hủy (bắt buộc khi cancelled)
  end_rating       smallint,                          -- [EXT] doanh nghiệp đánh giá nhóm 1..5
  end_feedback     text check (char_length(end_feedback) <= 3000), -- [EXT] nhận xét sau hoàn thành
  reminder_sent_at timestamptz,                       -- lần nhắc quá hạn gần nhất
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  constraint fk_cr_item foreign key (item_id, team_id)
             references public.portfolio_items (id, team_id) on delete set null (item_id),   -- item phải thuộc đúng nhóm
  constraint ck_cr_message  check (direction <> 'company_to_team' or char_length(btrim(coalesce(message, ''))) >= 10), -- FR05 invitation_note
  constraint ck_cr_expires  check (expires_at > created_at),
  constraint ck_cr_responded check ((responded_at is not null) = (status in ('in_progress','rejected','cancelled','completed'))),
  constraint ck_cr_started   check ((started_at is not null)    = (status in ('in_progress','cancelled','completed'))),
  constraint ck_cr_expected  check ((expected_end_at is not null) = (started_at is not null)),
  constraint ck_cr_ended     check ((ended_at is not null)      = (status in ('cancelled','completed'))),
  constraint ck_cr_cancel_reason check (status <> 'cancelled' or nullif(btrim(end_reason), '') is not null),
  constraint ck_cr_rating    check (end_rating is null or (end_rating between 1 and 5 and status = 'completed'))
);

create table public.connection_attachments (         -- proposal đính kèm yêu cầu / sản phẩm bàn giao khi hoàn thành
  id            uuid primary key default gen_random_uuid(),
  connection_id uuid not null references public.connection_requests(id) on delete cascade,
  kind          public.attachment_kind not null,
  file_name     text,
  storage_path  text,                                 -- đường dẫn trong Supabase Storage (bucket private)
  mime_type     text,
  size_bytes    bigint check (size_bytes between 1 and 20971520),   -- trần 20 MB (khớp 'max_attachment_mb')
  external_url  text check (external_url ~* '^https?://'),          -- hoặc dán link thay vì upload
  uploaded_by   uuid not null references public.profiles(id) on delete restrict,
  created_at    timestamptz not null default now(),
  constraint ck_att_file_xor_link check (
    ((storage_path is not null and file_name is not null and size_bytes is not null) and external_url is null)
    or (storage_path is null and external_url is not null))
);

create table public.connection_participants (        -- [EXT] ai được thông báo / tham gia một kết nối
  connection_id    uuid not null references public.connection_requests(id) on delete cascade,
  profile_id       uuid not null references public.profiles(id) on delete cascade,
  participant_role text not null check (participant_role in ('member','advisor','company_rep')),
  invited_by       uuid not null references public.profiles(id) on delete restrict,
  notified_at      timestamptz,
  primary key (connection_id, profile_id)
);

create table public.connection_extensions (          -- lịch sử gia hạn thời gian thực hiện
  id               uuid primary key default gen_random_uuid(),
  connection_id    uuid not null references public.connection_requests(id) on delete cascade,
  previous_end_at  timestamptz not null,
  new_end_at       timestamptz not null,
  reason           text check (char_length(reason) <= 1000),
  requested_by     uuid not null references public.profiles(id) on delete restrict,
  created_at       timestamptz not null default now(),
  constraint ck_ext_forward check (new_end_at > previous_end_at)
);

-- ===== 2.7 Thông báo, mẫu email, nhật ký ============================================
create table public.notifications (                  -- 1 dòng = 1 sự kiện: vừa là chuông trong app, vừa là hàng đợi email (outbox)
  id             uuid primary key default gen_random_uuid(),
  recipient_id   uuid not null references public.profiles(id) on delete cascade,
  type           public.notification_type not null,
  title          text not null,
  body           text,
  link_path      text,                                -- đường dẫn nội bộ để "nhảy đến", vd /connections/<id>
  connection_id  uuid references public.connection_requests(id) on delete set null,
  payload        jsonb not null default '{}'::jsonb,  -- biến để render mail/mẫu
  read_at        timestamptz,                         -- đã đọc trong app
  email_status   public.email_status not null default 'pending',
  email_attempts smallint not null default 0,
  email_sent_at  timestamptz,
  email_error    text,
  created_at     timestamptz not null default now()
);

create table public.email_templates (                -- [EXT] doanh nghiệp/nhóm tự soạn mẫu mail đồng ý/từ chối
  id          uuid primary key default gen_random_uuid(),
  owner_id    uuid not null references public.profiles(id) on delete cascade,
  kind        public.template_kind not null,
  name        text not null check (char_length(btrim(name)) between 1 and 100),
  subject     text not null check (char_length(subject) <= 200),
  body        text not null check (char_length(body) <= 5000),   -- hỗ trợ biến {{team_name}}, {{problem_title}}…
  is_default  boolean not null default false,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create table public.status_history (                 -- nhật ký bất biến (append-only) mọi lần đổi trạng thái
  id           bigint generated always as identity primary key,
  entity_type  text not null check (entity_type in ('portfolio_item','business_problem','connection_request')),
  entity_id    uuid not null,                         -- đa hình có chủ đích: log không cần FK
  from_status  text,
  to_status    text not null,
  actor_id     uuid references public.profiles(id) on delete set null,   -- null = hệ thống/cron
  note         text,
  created_at   timestamptz not null default now()
);

-- ---------------------------------------------------------------- 3. CHÚ THÍCH BẢNG (ý nghĩa nghiệp vụ)
comment on table public.system_settings        is 'Tham số vận hành (hạn duyệt, lựa chọn thời hạn phản hồi, chu kỳ nhắc, trần dung lượng) — đổi không cần deploy.';
comment on table public.profiles               is 'Hồ sơ người dùng (1-1 auth.users). Cột role quyết định actor: sinh viên / doanh nghiệp / giảng viên-điều phối / quản trị; is_active=false là tài khoản bị khóa (FR01/UC17).';
comment on table public.profile_contacts       is 'Kênh liên hệ ngoài (email, Zalo…) phục vụ bước "Duy trì kết nối". Chỉ lộ cho đối tác sau khi kết nối được chấp nhận.';
comment on table public.companies              is 'Hồ sơ doanh nghiệp (StudentTeam ↔ Company ở phía còn lại). Mỗi tài khoản doanh nghiệp sở hữu một công ty.';
comment on table public.student_teams          is 'Hồ sơ nhóm sinh viên — chủ thể đăng project/product/paper và là một bên của kết nối.';
comment on table public.team_members           is 'Thành viên và vai trò (nhóm trưởng/thành viên). Nhóm trưởng là người nhận và phản hồi yêu cầu kết nối.';
comment on table public.portfolio_items        is 'Danh mục project/product/paper (gộp 1 bảng, phân loại bằng kind; product/paper là con của project). Chỉ lưu URL nguồn. Có vòng đời kiểm duyệt + hạn duyệt.';
comment on table public.item_members           is 'Thành viên của nhóm đã tham gia từng project/product/paper cụ thể (composite FK bảo đảm là thành viên đúng nhóm).';
comment on table public.business_problems      is 'Bài toán/vấn đề thực tế doanh nghiệp đăng theo form (trường bắt buộc là cột, trường mở rộng nằm trong extra). Có 2 trục trạng thái: review_status và solve_status.';
comment on table public.tags                   is 'Danh mục lĩnh vực/kỹ năng dùng chung để tìm kiếm và thống kê lĩnh vực doanh nghiệp quan tâm.';
comment on table public.item_tags              is 'Gắn tag cho project/product/paper.';
comment on table public.problem_tags           is 'Gắn tag lĩnh vực/kỹ năng cho bài toán doanh nghiệp.';
comment on table public.connection_requests    is 'Yêu cầu kết nối (cả 2 chiều) + toàn bộ vòng đời: chờ phản hồi → đang thực hiện → hoàn thành/đã dừng, hoặc từ chối/hết hạn. Cũng là nguồn dữ liệu cho dashboard và portfolio lịch sử hợp tác.';
comment on table public.connection_attachments is 'Proposal đính kèm khi gửi yêu cầu và sản phẩm bàn giao khi hoàn thành (file trong Storage hoặc link).';
comment on table public.connection_participants is '[EXT] Thành viên/GVHD/đại diện doanh nghiệp được chọn để nhận thông báo và tham gia một kết nối.';
comment on table public.connection_extensions  is '[EXT] Lịch sử gia hạn thời gian thực hiện để ghi nhận thời gian hoàn thành thực tế.';
comment on table public.notifications          is 'Thông báo trong app và hàng đợi email (outbox): một sự kiện nghiệp vụ → một dòng → hai kênh.';
comment on table public.email_templates        is '[EXT] Mẫu mail đồng ý/từ chối do người dùng tự soạn, xem trước trước khi gửi.';
comment on table public.status_history         is 'Nhật ký đổi trạng thái (bài đăng, bài toán, kết nối) phục vụ dashboard, truy vết và giải quyết tranh chấp.';

-- ---------------------------------------------------------------- 4. INDEX
-- (PostgreSQL không tự tạo index cho FK -> khai báo cho các FK dùng để join/lọc)
create index ix_team_members_profile     on public.team_members (profile_id);
create index ix_teams_created_by         on public.student_teams (created_by);
create index ix_items_team               on public.portfolio_items (team_id);
create index ix_items_parent             on public.portfolio_items (parent_id) where parent_id is not null;
create index ix_items_catalog            on public.portfolio_items (kind, created_at desc) where review_status = 'approved' and deleted_at is null;
create index ix_items_review_deadline    on public.portfolio_items (review_expires_at) where review_status = 'pending_review';
create index ix_items_search             on public.portfolio_items using gin (search_tsv);
create index ix_item_members_member      on public.item_members (team_id, profile_id);
create index ix_problems_company         on public.business_problems (company_id);
create index ix_problems_catalog         on public.business_problems (solve_status, created_at desc) where review_status = 'approved' and deleted_at is null;
create index ix_problems_review_deadline on public.business_problems (review_expires_at) where review_status = 'pending_review';
create index ix_problems_search          on public.business_problems using gin (search_tsv);
create index ix_item_tags_tag            on public.item_tags (tag_id);
create index ix_problem_tags_tag         on public.problem_tags (tag_id);

create index ix_cr_team                  on public.connection_requests (team_id, status);
create index ix_cr_problem               on public.connection_requests (problem_id, status);
create index ix_cr_requested_by          on public.connection_requests (requested_by);
create index ix_cr_item                  on public.connection_requests (item_id) where item_id is not null;
create index ix_cr_expiry_scan           on public.connection_requests (expires_at) where status = 'pending';
create index ix_cr_overdue_scan          on public.connection_requests (expected_end_at) where status = 'in_progress';
-- Bất biến: tối đa 1 nhóm đang thực hiện mỗi bài toán; không gửi trùng yêu cầu đang chờ cho cùng (bài toán, nhóm)
create unique index uq_cr_one_active_per_problem on public.connection_requests (problem_id) where status = 'in_progress';
create unique index uq_cr_one_pending_per_pair   on public.connection_requests (problem_id, team_id) where status = 'pending';

create index ix_attachments_connection   on public.connection_attachments (connection_id);
create index ix_participants_profile     on public.connection_participants (profile_id);
create index ix_extensions_connection    on public.connection_extensions (connection_id);
create index ix_notifications_inbox      on public.notifications (recipient_id, created_at desc);
create index ix_notifications_outbox     on public.notifications (created_at) where email_status = 'pending';
create index ix_templates_owner          on public.email_templates (owner_id, kind);
create unique index uq_template_default  on public.email_templates (owner_id, kind) where is_default;
create unique index uq_team_one_leader   on public.team_members (team_id) where member_role = 'leader';
create index ix_history_entity           on public.status_history (entity_type, entity_id, created_at);

-- ---------------------------------------------------------------- 5. HÀM HỖ TRỢ + TRIGGER
-- 5.1 Hàm tra cứu ngữ cảnh người dùng (dùng trong RLS). SECURITY DEFINER để tránh đệ quy RLS.
create or replace function app.my_role() returns public.user_role
language sql stable security definer set search_path = ''
as $$ select p.role from public.profiles p where p.id = (select auth.uid()) and p.is_active $$;

create or replace function app.is_staff() returns boolean
language sql stable security definer set search_path = ''
as $$ select coalesce(app.my_role() in ('lecturer','admin'), false) $$;

create or replace function app.is_admin() returns boolean
language sql stable security definer set search_path = ''
as $$ select coalesce(app.my_role() = 'admin', false) $$;

create or replace function app.my_company_id() returns uuid
language sql stable security definer set search_path = ''
as $$ select c.id from public.companies c where c.owner_id = (select auth.uid()) $$;

create or replace function app.is_team_member(p_team uuid) returns boolean
language sql stable security definer set search_path = ''
as $$ select exists (select 1 from public.team_members tm
                      where tm.team_id = p_team and tm.profile_id = (select auth.uid())) $$;

create or replace function app.is_team_leader(p_team uuid) returns boolean
language sql stable security definer set search_path = ''
as $$ select exists (select 1 from public.team_members tm
                      where tm.team_id = p_team and tm.profile_id = (select auth.uid()) and tm.member_role = 'leader') $$;

create or replace function app.owns_problem(p_problem uuid) returns boolean
language sql stable security definer set search_path = ''
as $$ select exists (select 1 from public.business_problems bp
                       join public.companies c on c.id = bp.company_id
                      where bp.id = p_problem and c.owner_id = (select auth.uid())) $$;

-- Nhóm/ người gửi của một kết nối liên quan tới bài toán này -> được xem bài toán kể cả khi đã xóa mềm
create or replace function app.is_party_to_problem(p_problem uuid) returns boolean
language sql stable security definer set search_path = ''
as $$ select exists (select 1 from public.connection_requests cr
                      where cr.problem_id = p_problem
                        and (cr.requested_by = (select auth.uid()) or app.is_team_member(cr.team_id))) $$;

-- Quy tắc nghiệp vụ: chỉ lộ kênh liên hệ ngoài cho đối tác khi kết nối đang thực hiện / đã hoàn thành
create or replace function app.can_view_contacts(p_target uuid) returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1
      from public.connection_requests cr
      join public.business_problems bp on bp.id = cr.problem_id
      join public.companies c          on c.id  = bp.company_id
     where cr.status in ('in_progress','completed')
       and ( (c.owner_id = (select auth.uid())
              and exists (select 1 from public.team_members tm where tm.team_id = cr.team_id and tm.profile_id = p_target))
          or (c.owner_id = p_target
              and exists (select 1 from public.team_members tm where tm.team_id = cr.team_id and tm.profile_id = (select auth.uid()))) )
  )
$$;

create or replace function app.review_sla() returns interval
language sql stable security definer set search_path = ''
as $$ select make_interval(days => coalesce((select (s.value #>> '{}')::int from public.system_settings s
                                              where s.key = 'review_sla_days'), 7)) $$;

-- 5.2 updated_at tự động
create or replace function app.set_updated_at() returns trigger language plpgsql as
$$ begin new.updated_at := now(); return new; end $$;

do $$
declare t text;
begin
  foreach t in array array['system_settings','profiles','profile_contacts','companies','student_teams',
                           'portfolio_items','business_problems','connection_requests','email_templates']
  loop
    execute format('create trigger trg_set_updated_at before update on public.%I
                    for each row execute function app.set_updated_at()', t);
  end loop;
end $$;

-- 5.3 Đăng ký tài khoản -> tự tạo profile: nằm ở supabase_auth_uit_connect.sql (chạy SAU file này),
--     vì chỉ file đó đụng tới bảng do Supabase Auth sở hữu (auth.users). schema.sql chỉ chứa mô hình dữ liệu ứng dụng.

-- 5.4 Người tạo nhóm tự động là nhóm trưởng
create or replace function app.add_team_leader() returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  insert into public.team_members (team_id, profile_id, member_role)
  values (new.id, new.created_by, 'leader');
  return new;
end $$;
create trigger trg_team_leader after insert on public.student_teams
  for each row execute function app.add_team_leader();

-- 5.5 Chặn client (role authenticated/anon) tự sửa cột "nhạy cảm"; chỉ RPC SECURITY DEFINER,
--     pg_cron hoặc service_role mới được đổi. (current_user trong RPC = chủ hàm, không phải 'authenticated')
create or replace function app.guard_protected_columns() returns trigger language plpgsql as
$$
declare c text;
begin
  if current_user in ('authenticated','anon') then
    foreach c in array tg_argv loop
      if (to_jsonb(new) -> c) is distinct from (to_jsonb(old) -> c) then
        raise exception 'Cột "%" chỉ được thay đổi qua hàm nghiệp vụ (RPC)', c using errcode = '42501';
      end if;
    end loop;
  end if;
  return new;
end $$;

create trigger trg_guard_profiles before update on public.profiles
  for each row execute function app.guard_protected_columns('role','is_active','email');
create trigger trg_guard_items before update on public.portfolio_items
  for each row execute function app.guard_protected_columns(
    'team_id','kind','parent_id','created_by','review_status','review_submitted_at',
    'review_expires_at','reviewed_by','reviewed_at','review_note','deleted_at');
create trigger trg_guard_problems before update on public.business_problems
  for each row execute function app.guard_protected_columns(
    'company_id','solve_status','review_status','review_submitted_at',
    'review_expires_at','reviewed_by','reviewed_at','review_note','deleted_at');

-- 5.6 Bài đăng mới do client tạo luôn bắt đầu ở 'pending_review' + hạn duyệt theo cấu hình
create or replace function app.on_item_insert() returns trigger language plpgsql as
$$
begin
  if current_user in ('authenticated','anon') then
    new.created_by := (select auth.uid());
    new.review_status := 'pending_review';
    new.review_submitted_at := now();
    new.review_expires_at := now() + app.review_sla();
    new.reviewed_by := null; new.reviewed_at := null; new.review_note := null; new.deleted_at := null;
  end if;
  return new;
end $$;
create trigger trg_item_insert before insert on public.portfolio_items
  for each row execute function app.on_item_insert();

create or replace function app.on_problem_insert() returns trigger language plpgsql as
$$
begin
  if current_user in ('authenticated','anon') then
    new.solve_status := 'open';
    new.review_status := 'pending_review';
    new.review_submitted_at := now();
    new.review_expires_at := now() + app.review_sla();
    new.reviewed_by := null; new.reviewed_at := null; new.review_note := null; new.deleted_at := null;
  end if;
  return new;
end $$;
create trigger trg_problem_insert before insert on public.business_problems
  for each row execute function app.on_problem_insert();

-- 5.7 Product/paper phải có cha là PROJECT (FK composite đã bảo đảm cùng nhóm)
create or replace function app.enforce_item_parent() returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if new.parent_id is not null
     and not exists (select 1 from public.portfolio_items p where p.id = new.parent_id and p.kind = 'project') then
    raise exception 'parent_id phải trỏ tới một project' using errcode = '23514';
  end if;
  return new;
end $$;
create trigger trg_item_parent before insert or update of parent_id, kind on public.portfolio_items
  for each row execute function app.enforce_item_parent();

-- 5.8 MÁY TRẠNG THÁI của connection_requests: chỉ cho phép các bước chuyển hợp lệ + tự điền mốc thời gian
--     pending → in_progress | rejected | expired ;  in_progress → cancelled | completed ;  còn lại là trạng thái cuối
create or replace function app.connection_transition_guard() returns trigger
language plpgsql security definer set search_path = ''
as $$
declare v_days integer;
begin
  if new.status is not distinct from old.status then
    return new;
  end if;

  if not ( (old.status = 'pending'     and new.status in ('in_progress','rejected','expired'))
        or (old.status = 'in_progress' and new.status in ('cancelled','completed')) ) then
    raise exception 'Chuyển trạng thái % -> % không hợp lệ', old.status, new.status using errcode = '23514';
  end if;

  if new.status = 'in_progress' then
    select bp.estimated_duration_days into v_days from public.business_problems bp where bp.id = new.problem_id;
    new.responded_at    := coalesce(new.responded_at, now());
    new.started_at      := now();
    new.expected_end_at := now() + make_interval(days => v_days);
  elsif new.status = 'rejected' then
    new.responded_at := coalesce(new.responded_at, now());
  elsif new.status in ('cancelled','completed') then
    new.ended_at := now();
  end if;
  return new;
end $$;
create trigger trg_cr_transition before update of status on public.connection_requests
  for each row execute function app.connection_transition_guard();

-- 5.9 Đồng bộ trạng thái bài toán theo kết nối (đúng mô tả: hủy → về mặc định; hoàn thành → đã giải quyết)
--     và tự đóng các yêu cầu đang chờ khác của cùng bài toán khi đã có nhóm nhận.
create or replace function app.sync_problem_status() returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if new.status = 'in_progress' then
    update public.business_problems set solve_status = 'in_progress' where id = new.problem_id;

    with r as (
      update public.connection_requests
         set status = 'rejected',
             response_message = 'Hệ thống: bài toán đã được nhóm khác tiếp nhận.'
       where problem_id = new.problem_id and status = 'pending' and id <> new.id
      returning id, requested_by
    )
    insert into public.notifications (recipient_id, type, title, body, link_path, connection_id)
    select r.requested_by, 'connection_rejected', 'Yêu cầu kết nối đã được đóng',
           'Bài toán đã được nhóm khác tiếp nhận.', '/connections/' || r.id, r.id
      from r;

  elsif new.status = 'completed' then
    update public.business_problems set solve_status = 'solved' where id = new.problem_id;
  elsif new.status = 'cancelled' then
    update public.business_problems set solve_status = 'open' where id = new.problem_id;
  end if;
  return null;
end $$;
create trigger trg_cr_sync_problem after update of status on public.connection_requests
  for each row when (new.status is distinct from old.status)
  execute function app.sync_problem_status();

-- 5.10 Ghi nhật ký đổi trạng thái
create or replace function app.log_status_change() returns trigger
language plpgsql security definer set search_path = ''
as $$
declare v_old text; v_new text;
begin
  v_new := to_jsonb(new) ->> tg_argv[1];
  if tg_op = 'UPDATE' then
    v_old := to_jsonb(old) ->> tg_argv[1];
    if v_old is not distinct from v_new then return null; end if;
  end if;
  insert into public.status_history (entity_type, entity_id, from_status, to_status, actor_id)
  values (tg_argv[0], (to_jsonb(new) ->> 'id')::uuid, v_old, v_new, (select auth.uid()));
  return null;
end $$;
create trigger trg_log_items after insert or update of review_status on public.portfolio_items
  for each row execute function app.log_status_change('portfolio_item','review_status');
create trigger trg_log_problems after insert or update of review_status on public.business_problems
  for each row execute function app.log_status_change('business_problem','review_status');
create trigger trg_log_connections after insert or update of status on public.connection_requests
  for each row execute function app.log_status_change('connection_request','status');

-- ---------------------------------------------------------------- 6. HÀM CRON (pg_cron)
-- Quét: (1) bài đăng quá hạn duyệt → 'expired'  (2) yêu cầu quá hạn phản hồi → 'expired'
--       (3) kết nối quá thời gian ước lượng mà chưa hủy/hoàn thành → nhắc doanh nghiệp.
-- Mỗi thay đổi sinh một dòng notifications; email do dispatcher gửi (outbox) nên không mất thư nếu mail lỗi.
create or replace function app.fn_expire_overdue() returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare n_items int; n_problems int; n_conn int; n_overdue int;
begin
  with e as (
    update public.portfolio_items set review_status = 'expired'
     where review_status = 'pending_review' and review_expires_at < now()
    returning id, title, created_by
  ), n as (
    insert into public.notifications (recipient_id, type, title, body, link_path, payload)
    select created_by, 'review_expired', 'Bài đăng hết hạn chờ duyệt',
           'Bài "' || title || '" đã quá hạn duyệt. Bạn có thể gửi lại.', '/portfolio/' || id,
           jsonb_build_object('item_id', id)
      from e
  ) select count(*) into n_items from e;

  with e as (
    update public.business_problems set review_status = 'expired'
     where review_status = 'pending_review' and review_expires_at < now()
    returning id, title, company_id
  ), n as (
    insert into public.notifications (recipient_id, type, title, body, link_path, payload)
    select c.owner_id, 'review_expired', 'Bài toán hết hạn chờ duyệt',
           'Bài toán "' || e.title || '" đã quá hạn duyệt. Bạn có thể gửi lại.', '/problems/' || e.id,
           jsonb_build_object('problem_id', e.id)
      from e join public.companies c on c.id = e.company_id
  ) select count(*) into n_problems from e;

  with e as (
    update public.connection_requests set status = 'expired'
     where status = 'pending' and expires_at < now()
    returning id, requested_by
  ), n as (
    insert into public.notifications (recipient_id, type, title, body, link_path, connection_id)
    select requested_by, 'connection_expired', 'Yêu cầu kết nối hết hạn phản hồi',
           'Đối tác chưa phản hồi trong thời hạn bạn đặt. Bạn có thể gửi lại.', '/connections/' || id, id
      from e
  ) select count(*) into n_conn from e;

  with r as (
    update public.connection_requests cr set reminder_sent_at = now()
      from public.business_problems bp
     where bp.id = cr.problem_id and cr.status = 'in_progress' and cr.expected_end_at < now()
       and (cr.reminder_sent_at is null
            or cr.reminder_sent_at < now() - make_interval(days => coalesce(
                 (select (s.value #>> '{}')::int from public.system_settings s where s.key = 'reminder_interval_days'), 7)))
    returning cr.id, bp.title, bp.company_id
  ), n as (
    insert into public.notifications (recipient_id, type, title, body, link_path, connection_id)
    select c.owner_id, 'connection_overdue_reminder', 'Nhắc cập nhật trạng thái dự án',
           'Bài toán "' || r.title || '" đã quá thời gian ước lượng. Vui lòng hoàn thành, hủy hoặc gia hạn.',
           '/connections/' || r.id, r.id
      from r join public.companies c on c.id = r.company_id
  ) select count(*) into n_overdue from r;

  return jsonb_build_object('items_expired', n_items, 'problems_expired', n_problems,
                            'connections_expired', n_conn, 'reminders_sent', n_overdue);
end $$;
revoke execute on function app.fn_expire_overdue() from public, anon, authenticated;

-- Đăng ký lịch chạy mỗi 10 phút nếu pg_cron đã bật (Supabase: Dashboard → Integrations → Cron)
do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.schedule('uitconnect_expire_overdue', '*/10 * * * *', $job$select app.fn_expire_overdue()$job$);
  else
    raise notice 'pg_cron chưa bật: hãy bật extension rồi chạy lại phần cron.schedule(...)';
  end if;
end $$;

-- ---------------------------------------------------------------- 7. ROW LEVEL SECURITY
do $$
declare t text;
begin
  foreach t in array array['system_settings','profiles','profile_contacts','companies','student_teams','team_members',
        'portfolio_items','item_members','business_problems','tags','item_tags','problem_tags','connection_requests',
        'connection_attachments','connection_participants','connection_extensions','notifications','email_templates',
        'status_history']
  loop
    execute format('alter table public.%I enable row level security', t);
  end loop;
end $$;

-- Nguyên tắc: mặc định TỪ CHỐI. Client chỉ được ghi trực tiếp các bảng "CRUD thuần";
-- connection_requests / extensions / status_history KHÔNG có policy ghi → chỉ RPC (SECURITY DEFINER) mới ghi được.

-- system_settings
create policy settings_read  on public.system_settings for select to authenticated using (true);
create policy settings_admin on public.system_settings for all    to authenticated using (app.is_admin()) with check (app.is_admin());

-- profiles
create policy profiles_read   on public.profiles for select to authenticated using (true);
create policy profiles_update on public.profiles for update to authenticated
  using (id = (select auth.uid())) with check (id = (select auth.uid()));

-- profile_contacts
create policy contacts_read on public.profile_contacts for select to authenticated
  using (profile_id = (select auth.uid()) or app.is_staff() or app.can_view_contacts(profile_id));
create policy contacts_write on public.profile_contacts for all to authenticated
  using (profile_id = (select auth.uid())) with check (profile_id = (select auth.uid()));

-- companies
create policy companies_read   on public.companies for select to authenticated using (true);
create policy companies_insert on public.companies for insert to authenticated
  with check (owner_id = (select auth.uid()) and app.my_role() = 'company');
create policy companies_update on public.companies for update to authenticated
  using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));

-- student_teams
create policy teams_read   on public.student_teams for select to authenticated using (true);
create policy teams_insert on public.student_teams for insert to authenticated
  with check (created_by = (select auth.uid()) and app.my_role() = 'student');
create policy teams_update on public.student_teams for update to authenticated
  using (app.is_team_leader(id)) with check (app.is_team_leader(id));
create policy teams_delete on public.student_teams for delete to authenticated using (app.is_team_leader(id));

-- team_members (đổi nhóm trưởng qua RPC để tránh trạng thái "không có nhóm trưởng")
create policy tm_read   on public.team_members for select to authenticated using (true);
create policy tm_insert on public.team_members for insert to authenticated
  with check (app.is_team_leader(team_id)
              and exists (select 1 from public.profiles p where p.id = profile_id and p.role = 'student'));
create policy tm_delete on public.team_members for delete to authenticated
  using (member_role <> 'leader' and (app.is_team_leader(team_id) or profile_id = (select auth.uid())));

-- portfolio_items: công khai khi đã duyệt; nhóm thấy mọi bài của mình; staff thấy tất cả
create policy items_read on public.portfolio_items for select to authenticated
  using ((review_status = 'approved' and deleted_at is null) or app.is_team_member(team_id) or app.is_staff());
create policy items_insert on public.portfolio_items for insert to authenticated
  with check (app.is_team_member(team_id));
create policy items_update on public.portfolio_items for update to authenticated
  using (app.is_team_member(team_id) and deleted_at is null) with check (app.is_team_member(team_id));
create policy items_delete on public.portfolio_items for delete to authenticated   -- xóa cứng chỉ khi chưa duyệt
  using (app.is_team_member(team_id) and review_status <> 'approved');

-- item_members / item_tags kế thừa quyền xem từ portfolio_items (RLS áp dụng cả trong subquery)
create policy im_read  on public.item_members for select to authenticated
  using (exists (select 1 from public.portfolio_items i where i.id = item_id));
create policy im_write on public.item_members for all to authenticated
  using (app.is_team_member(team_id)) with check (app.is_team_member(team_id));

create policy it_read  on public.item_tags for select to authenticated
  using (exists (select 1 from public.portfolio_items i where i.id = item_id));
create policy it_write on public.item_tags for all to authenticated
  using (exists (select 1 from public.portfolio_items i where i.id = item_id and app.is_team_member(i.team_id)))
  with check (exists (select 1 from public.portfolio_items i where i.id = item_id and app.is_team_member(i.team_id)));

-- business_problems: chỉ người đã đăng nhập mới thấy; sửa chỉ khi còn 'open'
create policy bp_read on public.business_problems for select to authenticated
  using ((review_status = 'approved' and deleted_at is null)
         or company_id = app.my_company_id() or app.is_staff() or app.is_party_to_problem(id));
create policy bp_insert on public.business_problems for insert to authenticated
  with check (company_id = app.my_company_id());
create policy bp_update on public.business_problems for update to authenticated
  using (company_id = app.my_company_id() and deleted_at is null and solve_status = 'open')
  with check (company_id = app.my_company_id());
create policy bp_delete on public.business_problems for delete to authenticated
  using (company_id = app.my_company_id() and review_status <> 'approved');

create policy pt_read  on public.problem_tags for select to authenticated
  using (exists (select 1 from public.business_problems p where p.id = problem_id));
create policy pt_write on public.problem_tags for all to authenticated
  using (app.owns_problem(problem_id)) with check (app.owns_problem(problem_id));

-- tags
create policy tags_read   on public.tags for select to authenticated using (is_active or app.is_staff());
create policy tags_insert on public.tags for insert to authenticated
  with check ((kind = 'skill' and created_by = (select auth.uid())) or app.is_staff());
create policy tags_update on public.tags for update to authenticated using (app.is_staff()) with check (app.is_staff());
create policy tags_delete on public.tags for delete to authenticated using (app.is_staff());

-- connection_requests: chỉ các bên liên quan + staff được ĐỌC; không có policy ghi (ghi qua RPC)
create policy cr_read on public.connection_requests for select to authenticated
  using (requested_by = (select auth.uid()) or app.is_team_member(team_id)
         or app.owns_problem(problem_id) or app.is_staff());

-- bảng con của kết nối: thấy khi thấy được kết nối cha
create policy ca_read on public.connection_attachments for select to authenticated
  using (exists (select 1 from public.connection_requests cr where cr.id = connection_id));
create policy ca_insert on public.connection_attachments for insert to authenticated
  with check (uploaded_by = (select auth.uid())
              and exists (select 1 from public.connection_requests cr where cr.id = connection_id));
create policy ca_delete on public.connection_attachments for delete to authenticated
  using (uploaded_by = (select auth.uid()));

create policy cp_read on public.connection_participants for select to authenticated
  using (exists (select 1 from public.connection_requests cr where cr.id = connection_id));
create policy cp_insert on public.connection_participants for insert to authenticated
  with check (invited_by = (select auth.uid())
              and exists (select 1 from public.connection_requests cr where cr.id = connection_id));
create policy cp_delete on public.connection_participants for delete to authenticated
  using (invited_by = (select auth.uid()));

create policy ce_read on public.connection_extensions for select to authenticated
  using (exists (select 1 from public.connection_requests cr where cr.id = connection_id));

-- notifications: chỉ xem thông báo của mình; client chỉ được đặt read_at (quyền cột bên dưới)
create policy notif_read   on public.notifications for select to authenticated using (recipient_id = (select auth.uid()));
create policy notif_update on public.notifications for update to authenticated
  using (recipient_id = (select auth.uid())) with check (recipient_id = (select auth.uid()));

-- email_templates
create policy tpl_all on public.email_templates for all to authenticated
  using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));

-- status_history: chỉ staff đọc
create policy hist_read on public.status_history for select to authenticated using (app.is_staff());

-- Quyền mức bảng/cột (phòng thủ nhiều lớp, bổ sung cho RLS)
revoke truncate, references, trigger on all tables in schema public from anon, authenticated;
revoke all on all tables in schema public from anon;                   -- M1: SCR-05..14 đều yêu cầu đăng nhập -> anon không đọc/ghi gì
revoke insert, delete on public.profiles from authenticated;           -- profile chỉ được tạo bởi trigger đăng ký, không xóa từ client
revoke insert, update, delete on public.notifications from authenticated;
grant  update (read_at) on public.notifications to authenticated;

-- profiles: quyền theo CỘT. Client chỉ sửa được phần trình bày hồ sơ; không đọc được `email` (bản sao email đăng nhập,
-- tránh lộ cho người khác — email của chính mình lấy qua supabase.auth.getUser()). Hệ quả: KHÔNG dùng select('*') trên profiles.
revoke select, update on public.profiles from authenticated;
grant  select (id, role, full_name, avatar_url, headline, bio, major, cohort, is_active, created_at, updated_at)
       on public.profiles to authenticated;
grant  update (full_name, avatar_url, headline, bio, major, cohort) on public.profiles to authenticated;

-- ---------------------------------------------------------------- 8. VIEW
-- security_invoker = true: view chạy với quyền người gọi nên RLS của bảng gốc vẫn áp dụng.
create view public.v_moderation_queue with (security_invoker = true) as
  select 'portfolio_item'::text as entity_type, i.id as entity_id, i.kind::text as sub_type, i.title,
         t.name as owner_name, i.review_submitted_at as submitted_at, i.review_expires_at as expires_at
    from public.portfolio_items i join public.student_teams t on t.id = i.team_id
   where i.review_status = 'pending_review' and i.deleted_at is null
  union all
  select 'business_problem', p.id, 'problem', p.title, c.name, p.review_submitted_at, p.review_expires_at
    from public.business_problems p join public.companies c on c.id = p.company_id
   where p.review_status = 'pending_review' and p.deleted_at is null;

create view public.v_connection_dashboard with (security_invoker = true) as
  select cr.id, cr.status, cr.direction,
         t.name as team_name, c.name as company_name, bp.title as problem_title, it.title as item_title,
         cr.created_at, cr.expires_at, cr.responded_at, cr.started_at, cr.expected_end_at, cr.ended_at,
         case when cr.responded_at is not null then extract(day from cr.responded_at - cr.created_at)::int end as response_days,
         case when cr.ended_at is not null     then extract(day from cr.ended_at - cr.started_at)::int end     as execution_days,
         (cr.status = 'in_progress' and cr.expected_end_at < now()) as is_overdue
    from public.connection_requests cr
    join public.business_problems bp on bp.id = cr.problem_id
    join public.companies c          on c.id  = bp.company_id
    join public.student_teams t      on t.id  = cr.team_id
    left join public.portfolio_items it on it.id = cr.item_id;

create view public.v_team_engagements with (security_invoker = true) as   -- "lịch sử hợp tác" trong portfolio nhóm
  select cr.team_id, cr.id as connection_id, bp.title as problem_title, c.name as company_name,
         cr.status, cr.started_at, cr.ended_at, cr.end_reason, cr.end_rating, cr.end_feedback
    from public.connection_requests cr
    join public.business_problems bp on bp.id = cr.problem_id
    join public.companies c          on c.id  = bp.company_id
   where cr.status in ('in_progress','completed','cancelled');

create view public.v_field_interest with (security_invoker = true) as     -- [EXT] thống kê lĩnh vực doanh nghiệp quan tâm
  select t.id as tag_id, t.name as field_name,
         count(distinct bp.id) filter (where bp.review_status = 'approved' and bp.deleted_at is null) as approved_problems,
         count(distinct cr.id) filter (where cr.direction = 'company_to_team')                          as company_initiated_requests
    from public.tags t
    left join public.problem_tags pt on pt.tag_id = t.id
    left join public.business_problems bp on bp.id = pt.problem_id
    left join public.connection_requests cr on cr.problem_id = bp.id
   where t.kind = 'field'
   group by t.id, t.name;

-- ---------------------------------------------------------------- 9. DỮ LIỆU KHỞI TẠO TỐI THIỂU
insert into public.system_settings (key, value, description) values
  ('review_sla_days',              '7',            'Số ngày tối đa chờ giảng viên/điều phối duyệt một bài đăng; quá hạn → expired'),
  ('connection_ttl_options_days',  '[3,7,14,30]',  'Các lựa chọn thời hạn phản hồi mà người gửi yêu cầu kết nối được chọn'),
  ('connection_default_ttl_days',  '7',            'Thời hạn phản hồi mặc định'),
  ('reminder_interval_days',       '7',            'Chu kỳ nhắc doanh nghiệp khi dự án quá thời gian ước lượng'),
  ('max_attachment_mb',            '20',           'Dung lượng tối đa mỗi tệp đính kèm (khớp CHECK và giới hạn bucket Storage)')
on conflict (key) do nothing;

insert into public.tags (kind, name, slug) values
  ('field','Trí tuệ nhân tạo','tri-tue-nhan-tao'),
  ('field','Khoa học dữ liệu','khoa-hoc-du-lieu'),
  ('field','Phát triển web','phat-trien-web'),
  ('field','Ứng dụng di động','ung-dung-di-dong'),
  ('field','IoT & hệ thống nhúng','iot-he-thong-nhung'),
  ('field','An toàn thông tin','an-toan-thong-tin'),
  ('field','Điện toán đám mây','dien-toan-dam-may'),
  ('field','Thương mại điện tử','thuong-mai-dien-tu'),
  ('skill','Python','python'),
  ('skill','TypeScript','typescript'),
  ('skill','React','react'),
  ('skill','Node.js','node-js'),
  ('skill','SQL','sql'),
  ('skill','Machine Learning','machine-learning'),
  ('skill','UI/UX','ui-ux')
on conflict do nothing;
