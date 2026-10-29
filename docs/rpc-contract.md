# Hợp đồng các hàm RPC

Mọi RPC nằm trong `supabase/migrations/`, chạy `SECURITY DEFINER` (trừ `rpc_search_students`), `search_path = ''`, đã thu hồi quyền của `anon`, chỉ `authenticated` gọi được. Quyền được kiểm tra **trong thân hàm** bằng `auth.uid()`, không tin tham số client gửi.

Mã lỗi (đổi sang tiếng Việt trong `src/lib/errors.ts`):

| Mã | Ý nghĩa | Hiển thị |
|---|---|---|
| `42501` | Không đủ quyền | Thông báo của RPC (tiếng Việt) |
| `P0001` | Lỗi nghiệp vụ | Thông báo của RPC, hiển thị nguyên văn |
| `P0002` | Không tìm thấy | Thông báo của RPC |
| `23505` | Trùng (vd đã có yêu cầu đang chờ cho cùng bài toán + nhóm) | Câu chung |
| `23514` | Vi phạm CHECK / máy trạng thái | Câu chung |

## Vòng đời kết nối — `20261022000003_rpc_connections.sql`

### `rpc_create_connection_request(p_problem uuid, p_team uuid, p_item uuid, p_message text, p_ttl_days int) → uuid`
- **Ai gọi:** sinh viên là **nhóm trưởng** của `p_team` (chiều `team_to_company`), hoặc doanh nghiệp **sở hữu** `p_problem` (chiều `company_to_team`). Chiều do RPC tự xác định.
- **Điều kiện:** bài toán `approved`, chưa xóa, `solve_status = open`. `p_ttl_days` thuộc `system_settings.connection_ttl_options_days` (mặc định `[3,7,14,30]`). `p_item` (không bắt buộc) phải là bài `approved` của chính `p_team`. Doanh nghiệp mời thì thư ngỏ ≥ 10 ký tự. Thư ngỏ ≤ 3000.
- **Kết quả:** thêm `connection_requests` ở `pending`, `expires_at = now() + p_ttl_days`; thông báo cho chủ bài toán (hoặc nhóm trưởng khi doanh nghiệp mời).
- **Lỗi:** `42501` tài khoản khóa / không phải nhóm trưởng / không sở hữu bài toán · `P0001` bài toán không còn nhận kết nối, thời hạn sai, sản phẩm cầu nối sai, thư ngỏ ngắn · `P0002` không có nhóm · `23505` đã có yêu cầu đang chờ cho cặp (bài toán, nhóm).

### `rpc_respond_connection(p_id uuid, p_accept boolean, p_message text) → void`
- **Ai gọi:** bên NHẬN — chủ bài toán (khi `team_to_company`) hoặc nhóm trưởng (khi `company_to_team`).
- **Điều kiện:** yêu cầu `pending`, chưa quá `expires_at`; khi đồng ý thì bài toán vẫn `open`.
- **Kết quả:** `in_progress` (trigger điền `started_at`, `expected_end_at = now() + estimated_duration_days`, bài toán → `in_progress`, **các yêu cầu đang chờ khác của bài toán tự bị `rejected`** và người gửi được báo) hoặc `rejected`. Thông báo cho người gửi.
- **Lỗi:** `42501` · `P0001` hết hạn / không còn chờ / bài toán đã có nhóm · `P0002`.

### `rpc_end_connection(p_id uuid, p_outcome text, p_reason text, p_rating smallint, p_feedback text) → void`
- **Ai gọi:** doanh nghiệp sở hữu bài toán.
- **Điều kiện:** kết nối `in_progress`. `p_outcome` = `completed` (bắt buộc `p_rating` 1–5) hoặc `cancelled` (bắt buộc `p_reason`).
- **Kết quả:** `completed` → bài toán `solved`; `cancelled` → bài toán về `open`. Thông báo cho mọi thành viên nhóm. Lịch sử hiện ở `v_team_engagements`.

### `rpc_extend_connection(p_id uuid, p_new_end timestamptz, p_reason text) → void`
- **Ai gọi:** doanh nghiệp sở hữu bài toán; kết nối `in_progress`; hạn mới phải sau `expected_end_at`.
- **Kết quả:** ghi `connection_extensions`, cập nhật `expected_end_at`, reset nhắc quá hạn, thông báo nhóm.

## Kiểm duyệt — `20261022000004_rpc_moderation.sql`

### `rpc_submit_review(p_entity text, p_id uuid, p_approve boolean, p_note text) → void`
- `p_entity`: `portfolio_item` | `business_problem`. **Ai gọi:** `lecturer` hoặc `admin`.
- Chỉ xử lý bài đang `pending_review` (bài đã xử lý → `P0002`). Từ chối bắt buộc `p_note`. Ghi `reviewed_by`, `reviewed_at`, `review_note`; thông báo người đăng.

### `rpc_resubmit_content(p_entity text, p_id uuid) → void`
- **Ai gọi:** thành viên nhóm (portfolio_item) hoặc chủ công ty (business_problem). Chỉ khi `rejected` hoặc `expired`.
- Đặt lại `pending_review`, `review_expires_at = now() + review_sla_days`, xóa thông tin duyệt cũ.

### `rpc_soft_delete_content(p_entity text, p_id uuid) → void`
- Cùng quyền như trên; đặt `deleted_at`. Bài toán: từ chối khi `solve_status = in_progress`; các yêu cầu `pending` của bài toán bị đóng và người gửi được báo. (Bài chưa duyệt thì xóa cứng qua policy delete — `lib/services/*` tự chọn.)

### `rpc_transfer_team_leader(p_team uuid, p_new_leader uuid) → void`
- **Ai gọi:** nhóm trưởng hiện tại; người nhận phải là thành viên nhóm. Hạ cũ → nâng mới trong một giao dịch (index `uq_team_one_leader`).

## Bổ sung giai đoạn 1 — `20261029000006_phase1_backend.sql`

### `rpc_search_students(p_query text, p_limit int default 20) → table(id, full_name, major, cohort, avatar_url)`
- `SECURITY INVOKER` (RLS + quyền cột của `profiles` vẫn áp dụng, không trả email). Tìm sinh viên đang hoạt động theo tên **không dấu**, ≥ 2 ký tự, tối đa 50 dòng. Dùng khi nhóm trưởng thêm thành viên.

### View `v_connection_dashboard`
- Thêm cột cuối: `problem_id, team_id, item_id, requested_by, company_id` (cột cũ giữ nguyên, vẫn `security_invoker`).

## Quản trị — `20261022000002_auth_integration.sql` (có sẵn)

- `rpc_admin_set_role(p_user uuid, p_role user_role)` và `rpc_admin_set_active(p_user uuid, p_active boolean)`: chỉ `admin`, không tự đổi/khóa chính mình. Giai đoạn 1 chưa có giao diện.

## Hàm cron (không gọi từ client)

- `app.fn_expire_overdue()`: mỗi 10 phút (pg_cron) chuyển bài quá hạn duyệt → `expired`, yêu cầu quá hạn phản hồi → `expired`, nhắc doanh nghiệp khi quá thời gian ước lượng. Client gọi → `42501`.
