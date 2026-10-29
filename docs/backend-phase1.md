# Backend giai đoạn 1 — bản đồ chức năng → mã nguồn

Nhánh `UITConnect.v2`. Kiến trúc theo tài liệu *UIT Connect — Hướng dẫn triển khai website (Next.js, Supabase, Vercel)*: backend gồm 3 lớp — ràng buộc + RLS trong PostgreSQL, RPC `SECURITY DEFINER`, và mã server Next.js (Server Component / Server Action). Trình duyệt không bao giờ được tin; database là chốt chặn cuối.

```
Trang (page.tsx, Server Component)   ──đọc──▶ src/lib/queries/*   ──▶ Supabase (RLS)
Form (Client) ──Server Action (actions.ts)──▶ Zod (lib/validation) ──▶ src/lib/services/* ──▶ bảng / RPC
```

`lib/queries` và `lib/services` nhận Supabase client làm tham số nên dùng được cả trong Next.js lẫn trong bộ test (`tests/backend`). **Nhóm frontend chỉ cần thay giao diện**: giữ nguyên tên ô (`name=`) của form và các Server Action; tên ô khớp cột DB theo `anh_xa_o_noi_dung.md`.

## 9 chức năng giai đoạn 1

| # | Chức năng | Server Action / Route | Logic | Đọc dữ liệu | Trang thô (để demo) | DB |
|---|---|---|---|---|---|---|
| 1 | Đăng nhập account | `signIn`, `signOut`, `signUp`, `requestPasswordReset`, `updatePassword` — `src/app/(auth)/actions.ts`; `src/app/auth/confirm/route.ts` | Supabase Auth (cookie qua `@supabase/ssr`), `src/proxy.ts` chặn trang khi chưa đăng nhập | `lib/auth/session.ts` (`getCurrentProfile`, `requireRole`) | `/login`, `/register`, `/forgot-password`, `/reset-password` | trigger `handle_new_user` (chỉ nhận role student/company) |
| 2 | Tạo/Thêm project/product/paper | `createPortfolioItemAction`, `updatePortfolioItemAction`, `deletePortfolioItemAction`, `resubmitContentAction` — `(app)/portfolio/actions.ts` | `lib/services/portfolio.ts` (ghi `portfolio_items` + `item_tags` + `item_members`, lỗi thì dọn) | `lib/queries/teams.ts` (nhóm, thành viên, project cha) | `/portfolio/new` | trigger ép `pending_review`; RLS `items_*` |
| 3 | Tạo/Thêm bài toán | `createProblemAction`, `updateProblemAction`, `deleteProblemAction` — `(app)/problems/actions.ts` | `lib/services/problems.ts` (cột bắt buộc + `extra` JSON + `problem_tags`) | `lib/queries/companies.ts` | `/problems/new`, `/company` (hồ sơ DN bắt buộc trước) | trigger ép `pending_review/open`; RLS `bp_*` |
| 4 | Gửi yêu cầu kết nối 2 chiều (cửa sổ confirm + proposal) | `createConnectionRequestAction`, `recordAttachmentAction` — `(app)/connections/actions.ts` | `lib/services/connections.ts` → `rpc_create_connection_request`; tệp proposal tải thẳng từ trình duyệt lên bucket private `connection-attachments` | `getConnectionTtlOptions`, `listMyLeaderTeams`, `listCompanyProblems` | Nút **Tạo kết nối** (`components/connections/connection-request-form.tsx`) ở `/problems/[id]` (sinh viên), `/portfolio/[id]` và `/teams/[id]` (doanh nghiệp) | RPC + unique `uq_cr_one_pending_per_pair` + Storage policy |
| 5 | Bảng theo dõi trạng thái matching | `respondConnectionAction`, `endConnectionAction`, `extendConnectionAction` | `lib/services/connections.ts` → `rpc_respond/end/extend_connection` | `lib/queries/tracking.ts` (`getTrackingBoard`): gộp **chờ duyệt / hết hạn duyệt / bị từ chối duyệt** (bài đăng) + **chờ phản hồi / hết hạn phản hồi / bị từ chối / đang thực hiện / đã dừng / đã hoàn thành** (kết nối), đánh dấu "Cần bạn xử lý" | `/connections?status=…`, `/connections/[id]` | view `v_connection_dashboard`, RLS `cr_read` |
| 6 | Dashboard quản lý gv/điều phối | `submitReviewAction` — `(app)/moderation/actions.ts` | `lib/services/moderation.ts` → `rpc_submit_review` | `lib/queries/dashboard.ts` (`getStaffDashboard`): số bài chờ duyệt, đã chờ bao lâu, hạn duyệt; kết nối theo trạng thái với thời gian khởi tạo/hạn phản hồi/bắt đầu/dự kiến/kết thúc, TB thời gian phản hồi & thực hiện, quá hạn, lĩnh vực quan tâm | `/dashboard` (vai trò lecturer/admin), `/moderation` | views `v_moderation_queue`, `v_connection_dashboard`, `v_field_interest` |
| 7 | Trang chi tiết project/product/paper | — | — | `getPortfolioItem` (kèm nhóm, thành viên + vai trò, tag, GVHD, project cha/con) | `/portfolio/[id]` | RLS: người ngoài chỉ thấy bài `approved` |
| 8 | Trang chi tiết bài toán | — | — | `getProblem` (kèm doanh nghiệp đăng, tag, `extra`) | `/problems/[id]` | RLS `bp_read` |
| 9 | Tìm kiếm theo lĩnh vực | — | — | `searchPortfolio`, `searchProblems`: lọc tag lĩnh vực/kỹ năng (≥ 1 tag khớp), từ khóa có/không dấu (`search_tsv` + bỏ dấu), loại, phân trang | `/search`, `/portfolio`, `/problems` | `item_tags`, `problem_tags`, GIN `search_tsv` |

Chức năng hỗ trợ (cần để 9 chức năng chạy được): nhóm sinh viên (`/teams`, `rpc_search_students`, `rpc_transfer_team_leader`), hồ sơ cá nhân + kênh liên hệ ngoài (`/profile`), thông báo (`/notifications`, số chưa đọc trên thanh menu).

## Migration (chạy theo thứ tự)

| Tệp | Nội dung |
|---|---|
| `20261022000001_schema.sql` | `schema.sql` của nhóm, **chép nguyên văn** (lấy từ lịch sử git, commit `0d7f479`) |
| `20261022000002_auth_integration.sql` | `supabase_auth_uit_connect.sql`, chép nguyên văn |
| `20261022000003_rpc_connections.sql` | 4 RPC kết nối (bản trong tài liệu + vá lỗi, xem đầu tệp) |
| `20261022000004_rpc_moderation.sql` | duyệt, gửi lại, xóa mềm, chuyển nhóm trưởng |
| `20261022000005_storage.sql` | bucket private 20 MB + policy |
| `20261029000006_phase1_backend.sql` | thêm cột id vào `v_connection_dashboard`; `rpc_search_students` (tìm tên không dấu) |

## Quyết định cần nhóm biết

1. **"Chờ duyệt / hết hạn" trong bảng theo dõi** là trạng thái kiểm duyệt của *bài đăng* (đúng chú thích trong `schema.sql`), không phải của yêu cầu kết nối. Bảng theo dõi hiển thị cả hai nguồn chung một bảng.
2. **Đăng ký xong chuyển về trang Đăng nhập** (theo acceptance criteria), kể cả khi Supabase tắt xác nhận email.
3. **Tệp proposal/bàn giao đi thẳng từ trình duyệt lên Storage** (Vercel giới hạn body 4.5 MB < 20 MB). Proposal dạng liên kết thì ghi ngay trong Server Action.
4. **Doanh nghiệp đăng ký có thể điền luôn hồ sơ công ty** (ô `company.*`); nếu bật xác nhận email thì điền sau ở `/company`. Ràng buộc theo `schema.sql`: tên 5–200, lĩnh vực ≥ 10 ký tự, điện thoại 10–11 số (khác một số giới hạn ghi trong `anh_xa_o_noi_dung.md` — schema thắng vì DB chặn).
5. **Nhiều tag khi lọc = có ít nhất một tag** (OR).
6. **Tài khoản bị khóa** vẫn đọc được bài công khai cho tới khi access token hết hạn (policy `bp_read`/`items_read` không xét `is_active`), nhưng không ghi được gì và không đăng nhập lại được (`banned_until`). Nếu cần chặn đọc ngay, thêm `app.my_role() is not null` vào hai policy bằng migration mới.
7. Chưa làm (ngoài giai đoạn 1): đăng nhập Google/Apple, gửi email từ hàng đợi `notifications`, trang quản trị người dùng/tag/cài đặt, trang sửa bài (Server Action sửa đã có sẵn).
