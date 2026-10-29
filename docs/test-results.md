# Kết quả kiểm thử — backend giai đoạn 1

Ngày chạy: 29/10/2026 · Nhánh `UITConnect.v2`

> **Phạm vi môi trường:** chưa có quyền truy cập project Supabase của nhóm, nên toàn bộ kiểm thử chạy trên **PostgreSQL 16 cục bộ** với bản giả lập phần Supabase cung cấp (`auth.users`, `auth.uid()`, `storage`, role `anon`/`authenticated`, quyền mặc định) và **PostgREST 12.2.3** (cùng phần mềm Supabase chạy ở `/rest/v1`). Chưa kiểm: Supabase Auth thật (đăng nhập/đăng ký/quên mật khẩu qua GoTrue), tải tệp thật lên Storage, pg_cron tự chạy. Sau khi chạy migration trên project thật, cần làm lại mục "Việc còn lại" bên dưới.

## 1. Database: migration + RLS + RPC — 104/104 PASS

Chạy: `PGURL=postgres://postgres:<mk>@localhost:5432/postgres bash supabase/tests/local/run.sh`
(nạp stub → 6 migration → 8 tài khoản thử → `supabase/tests/local/20_tests.sql`; mỗi phép thử đăng nhập giả lập rồi `set role authenticated` nên RLS áp dụng đầy đủ)

- PASS: T02 đăng ký tự xưng admin qua metadata vẫn là student
- PASS: Đăng ký chọn Doanh nghiệp -> role company
- PASS: profiles.email đồng bộ từ auth.users
- PASS: T03 sinh viên tự nâng role bị từ chối [42501 permission denied for table profiles]
- PASS: T04 không đọc được cột email [42501 permission denied for table profiles]
- PASS: T04 select * trên profiles bị từ chối [42501 permission denied for table profiles]
- PASS: Sửa cột trình bày của chính mình được phép
- PASS: A không sửa được hồ sơ của B (RLS)
- PASS: T05 anon không đọc được bảng [42501 permission denied for table business_problems]
- PASS: T05 anon không đọc được portfolio [42501 permission denied for table portfolio_items]
- PASS: Mỗi tài khoản chỉ một công ty [23505 duplicate key value violates unique constraint "companies_owner_id_key"]
- PASS: Sinh viên không tạo được hồ sơ doanh nghiệp [42501 new row violates row-level security policy for table "companies"]
- PASS: Người tạo nhóm tự động là nhóm trưởng
- PASS: Không thêm được tài khoản doanh nghiệp vào nhóm [42501 new row violates row-level security policy for table "team_members"]
- PASS: Thành viên thường không thêm được người khác [42501 new row violates row-level security policy for table "team_members"]
- PASS: Doanh nghiệp không tạo được nhóm [42501 new row violates row-level security policy for table "student_teams"]
- PASS: Bài mới luôn ở pending_review dù client gửi approved
- PASS: Thành viên item phải thuộc nhóm (FK ghép) [23503 insert or update on table "item_members" violates foreign key constraint "fk_im_member"]
- PASS: Product/paper bắt buộc có project cha [23514 new row for relation "portfolio_items" violates check constraint "ck_items_parent_kind"]
- PASS: Sinh viên không tự duyệt bài của mình [42501 Cột "review_status" chỉ được thay đổi qua hàm nghiệp vụ (RPC)]
- PASS: Nhóm khác không thấy bài đang chờ duyệt
- PASS: Không đăng được bài cho nhóm mình không là thành viên [42501 new row violates row-level security policy for table "portfolio_items"]
- PASS: T06 bài toán mới ép về pending_review/open
- PASS: Tiêu đề bài toán dưới 10 ký tự bị chặn [23514 new row for relation "business_problems" violates check constraint "business_problems_title_check"]
- PASS: Ước lượng > 730 ngày bị chặn [23514 new row for relation "business_problems" violates check constraint "business_problems_estimated_duration_days_check"]
- PASS: Doanh nghiệp khác không gắn tag vào bài toán của C [42501 new row violates row-level security policy for table "problem_tags"]
- PASS: T06 sinh viên không thấy bài toán chờ duyệt
- PASS: T08 sinh viên gọi rpc_submit_review bị từ chối 42501 [42501 Chỉ giảng viên hoặc quản trị viên được duyệt]
- PASS: Hàng đợi duyệt có 5 bài (2 item + 3 bài toán)
- PASS: T07 từ chối thiếu lý do báo lỗi [P0001 Cần ghi lý do từ chối]
- PASS: Bài đã xử lý không xử lý lại [P0002 Không có nội dung đang chờ duyệt với id này]
- PASS: status_history ghi lại tạo + duyệt bài toán
- PASS: Doanh nghiệp nhận thông báo duyệt
- PASS: T07 duyệt xong sinh viên thấy bài toán
- PASS: Người đăng thấy lý do từ chối
- PASS: Gửi lại bài bị từ chối -> pending_review
- PASS: Không gửi lại được bài đã duyệt [P0001 Chỉ gửi lại được bài bị từ chối hoặc hết hạn duyệt]
- PASS: Nhóm khác không gửi lại được bài [42501 Chỉ thành viên nhóm được gửi lại bài]
- PASS: T19 tìm không dấu ra kết quả
- PASS: T19 tìm có dấu (đã bỏ dấu) ra cùng kết quả
- PASS: Lọc sản phẩm theo lĩnh vực Trí tuệ nhân tạo
- PASS: Lọc bài toán theo lĩnh vực Trí tuệ nhân tạo
- PASS: T09 yêu cầu ở trạng thái pending
- PASS: T09 gửi trùng yêu cầu đang chờ bị chặn [23505 duplicate key value violates unique constraint "uq_cr_one_pending_per_pair"]
- PASS: Thời hạn không nằm trong danh sách cấu hình bị chặn [P0001 Thời hạn phản hồi không hợp lệ]
- PASS: Thời hạn null bị chặn [P0001 Thời hạn phản hồi không hợp lệ]
- PASS: Không gửi yêu cầu thay nhóm mình không làm nhóm trưởng [42501 Bạn không có quyền gửi yêu cầu này]
- PASS: T09 doanh nghiệp nhận thông báo yêu cầu mới
- PASS: T10 thành viên (không phải nhóm trưởng) gửi yêu cầu bị từ chối [42501 Bạn không có quyền gửi yêu cầu này]
- PASS: Thành viên nhóm thấy yêu cầu của nhóm
- PASS: T15 nhóm khác không đọc được kết nối của A
- PASS: T15 view dashboard cũng không lộ
- PASS: T14 client không insert thẳng connection_requests [42501 new row violates row-level security policy for table "connection_requests"]
- PASS: T16 chưa thấy liên hệ ngoài của doanh nghiệp khi kết nối còn chờ
- PASS: T14 cập nhật status trực tiếp không có tác dụng
- PASS: Người gửi không tự chấp nhận yêu cầu của mình [42501 Bạn không có quyền phản hồi yêu cầu này]
- PASS: T11 kết nối in_progress
- PASS: T11 bài toán in_progress
- PASS: Mốc bắt đầu và hạn dự kiến tự điền theo ước lượng
- PASS: T16 doanh nghiệp thấy liên hệ ngoài của nhóm sau khi đồng ý
- PASS: T11 yêu cầu chờ khác của bài toán tự bị đóng
- PASS: T16 nhóm thấy liên hệ ngoài của doanh nghiệp sau khi đồng ý
- PASS: T12 bài toán đã có nhóm thực hiện không nhận thêm yêu cầu [P0001 Bài toán không còn nhận kết nối]
- PASS: T16 nhóm bị từ chối không thấy liên hệ ngoài
- PASS: Lời mời của doanh nghiệp cần thư ngỏ >= 10 ký tự [P0001 Thư ngỏ gửi nhóm cần tối thiểu 10 ký tự]
- PASS: Không mời bằng bài toán không còn mở/không thuộc mình [P0001 Bài toán không còn nhận kết nối]
- PASS: Chiều company_to_team
- PASS: Nhóm trưởng nhận thông báo lời mời
- PASS: Thành viên thường không phản hồi lời mời [42501 Bạn không có quyền phản hồi yêu cầu này]
- PASS: Nhóm trưởng từ chối lời mời
- PASS: Không phản hồi lại yêu cầu đã xử lý [P0001 Yêu cầu không còn ở trạng thái chờ phản hồi]
- PASS: Sinh viên không kết thúc được kết nối [42501 Chỉ doanh nghiệp sở hữu bài toán được kết thúc kết nối]
- PASS: T13 hoàn thành thiếu điểm đánh giá báo lỗi [P0001 Cần chọn điểm đánh giá từ 1 đến 5]
- PASS: T13 dừng thiếu lý do báo lỗi [P0001 Cần nêu lý do dừng kết nối]
- PASS: Gia hạn về trước hạn hiện tại bị chặn [P0001 Hạn mới phải sau hạn hiện tại]
- PASS: Lịch sử gia hạn được ghi
- PASS: T13 hoàn thành kèm đánh giá
- PASS: T13 hoàn thành -> bài toán solved
- PASS: Không xóa bài toán đang có nhóm thực hiện [P0001 Bài toán đang có nhóm thực hiện, hãy kết thúc kết nối trước khi xóa]
- PASS: T13 dừng -> bài toán về open
- PASS: Lịch sử hợp tác của nhóm có 1 hoàn thành + 1 đã dừng
- PASS: T20 tệp trên 20 MB bị chặn [23514 new row for relation "connection_attachments" violates check constraint "connection_attachments_size_bytes_check"]
- PASS: Chỉ chọn tệp hoặc liên kết, không cả hai [23514 new row for relation "connection_attachments" violates check constraint "ck_att_file_xor_link"]
- PASS: T20 người ngoài kết nối không đọc được tệp đính kèm
- PASS: T20 người ngoài không thấy dòng đính kèm
- PASS: T20 người ngoài không tải tệp vào kết nối của người khác [42501 new row violates row-level security policy for table "objects"]
- PASS: Doanh nghiệp đọc được proposal đính kèm
- PASS: Client không gọi được hàm cron [42501 permission denied for function fn_expire_overdue]
- PASS: T18 yêu cầu quá hạn -> expired
- PASS: T18 người gửi nhận thông báo hết hạn
- PASS: Bài quá hạn duyệt -> expired
- PASS: Client chỉ sửa được read_at của thông báo [42501 permission denied for table notifications]
- PASS: Chỉ đọc thông báo của mình
- PASS: Giảng viên thấy mọi kết nối trên dashboard
- PASS: Dashboard tính thời gian thực hiện
- PASS: Staff đọc được status_history
- PASS: Doanh nghiệp không đọc status_history
- PASS: Chuyển quyền nhóm trưởng
- PASS: Cựu nhóm trưởng không còn quyền chuyển [42501 Chỉ nhóm trưởng được chuyển quyền]
- PASS: T17 admin không tự khóa chính mình [42501 Không thể tự khóa chính mình]
- PASS: T17 khóa tài khoản đặt banned_until
- PASS: Tài khoản bị khóa không tạo được dữ liệu [42501 new row violates row-level security policy for table "student_teams"]
- PASS: Tài khoản bị khóa không gửi được yêu cầu [42501 Tài khoản không hoạt động]

## 2. Backend qua supabase-js → PostgREST → PostgreSQL — 36/36 PASS

Chạy: `PGURL=… POSTGREST_BIN=/đường/dẫn/postgrest bash tests/backend/run.sh`
Gọi đúng các hàm mà Server Action và trang dùng (`src/lib/services/*`, `src/lib/queries/*`, schema Zod, `formToObject`), với JWT riêng của từng tài khoản thử.

- PASS: Zod đăng ký: chỉ nhận student/company, doanh nghiệp điền công ty ngay khi đăng ký
- PASS: Doanh nghiệp tạo hồ sơ công ty; sinh viên không tạo được
- PASS: Cập nhật hồ sơ + kênh liên hệ ngoài
- PASS: Nhóm: tạo, tìm sinh viên theo tên (có/không dấu), thêm thành viên
- PASS: Form hợp lệ -> bài ở trạng thái Chờ duyệt, kèm tag và thành viên
- PASS: Product phải chọn project cha; thiếu thông tin báo lỗi, không lưu
- PASS: Thành viên ngoài nhóm -> lỗi và bài vừa tạo được dọn
- PASS: Bài chờ duyệt không hiện với người khác, không có trong tìm kiếm
- PASS: Doanh nghiệp không được đăng project
- PASS: Form hợp lệ (cột bắt buộc + extra + tag) -> Chờ duyệt
- PASS: Thiếu thông tin báo lỗi tiếng Việt; sinh viên không đăng được
- PASS: Sửa bài toán khi còn mở
- PASS: Giảng viên duyệt; từ chối bắt buộc lý do; sinh viên không duyệt được
- PASS: Gửi lại bài bị từ chối rồi được duyệt
- PASS: Lọc theo tag lĩnh vực (một bảng tag chung)
- PASS: Từ khóa có dấu / không dấu ra cùng kết quả; lọc theo loại
- PASS: Khách (chưa đăng nhập) không đọc được dữ liệu
- PASS: Chi tiết sản phẩm kèm nhóm, thành viên, tag, project cha/con
- PASS: Chi tiết bài toán kèm thông tin doanh nghiệp đăng
- PASS: Thời hạn phản hồi lấy từ system_settings
- PASS: Nhóm trưởng gửi yêu cầu tới bài toán, kèm liên kết proposal
- PASS: Thành viên thường / thời hạn sai / proposal sai đường dẫn bị chặn
- PASS: Doanh nghiệp mời nhóm (thư ngỏ >= 10 ký tự), nhóm trưởng nhận thông báo
- PASS: Nhóm khác gửi yêu cầu cùng bài toán
- PASS: Doanh nghiệp đồng ý -> đang thực hiện; yêu cầu chờ khác bị đóng; lộ kênh liên hệ
- PASS: Nhóm trưởng từ chối lời mời của doanh nghiệp
- PASS: Gia hạn và hoàn thành (bắt buộc điểm), hoặc dừng (bắt buộc lý do)
- PASS: Sinh viên: thấy kết nối của nhóm + bài chờ duyệt của nhóm; không thấy của người khác
- PASS: Doanh nghiệp: yêu cầu cần phản hồi được đánh dấu việc cần làm
- PASS: Nhóm trưởng thấy lời mời đang chờ là việc cần làm
- PASS: Thống kê kết nối theo trạng thái, thời gian, hàng đợi duyệt
- PASS: Sinh viên gọi dashboard chỉ thấy phần của mình
- PASS: Xóa bài chưa duyệt (xóa cứng) và đã duyệt (xóa mềm)
- PASS: Sửa bài đã duyệt
- PASS: Đánh dấu đã đọc thông báo
- PASS: Doanh nghiệp xem danh sách bài toán của mình để chọn khi mời

## 3. Trang Next.js (bản build production) — 24/24 PASS

`npm run build` rồi `next start`, gọi từng trang bằng cookie phiên của từng vai trò qua PostgREST ở trên (máy chủ Auth được thay bằng endpoint giả trả thông tin user từ JWT — chỉ dùng cho smoke test, không nằm trong repo).

| Vai trò | Trang | Kết quả |
|---|---|---|
| Khách | `/dashboard` | 307 → `/login?next=/dashboard` |
| Khách | `/` | 200, trang giới thiệu |
| SV A | `/dashboard` | 200, HomePage + "Việc cần làm" |
| SV A | `/search?tag=1`, `/search?q=tri+tue+nhan+tao` | 200, có kết quả |
| SV A | `/problems`, `/problems/[id]` | 200, kèm doanh nghiệp đăng; nút "Tạo kết nối" ở bài còn mở |
| DN C | `/portfolio/[id]` | 200, kèm nhóm thực hiện |
| SV A | `/portfolio`, `/portfolio/new` | 200 |
| SV A | `/connections`, `/connections/[id]` | 200 |
| SV A2 (nhóm khác) | `/connections/[id của A]` | Trang "Không tìm thấy", không lộ dữ liệu |
| DN C | `/connections?status=pending`, `/connections/[id]` | 200, "Cần bạn xử lý", form phản hồi |
| DN C | `/problems/new`, `/company` | 200 |
| SV A | `/teams/[id]`, `/notifications` | 200 |
| GV L | `/dashboard`, `/moderation` | 200, dashboard quản lý |
| SV A | `/moderation` | chuyển về `/dashboard?error=forbidden` |
| SV A | `/problems/not-a-uuid` | Trang "Không tìm thấy" |

Ghi chú: `notFound()`/`redirect()` nằm trong `<Suspense>` (bắt buộc với `cacheComponents` của Next.js 16) nên mã HTTP là 200 kèm trang 404/lệnh chuyển hướng trong nội dung — hành vi chuẩn của streaming.

## 4. Chất lượng mã

| Lệnh | Kết quả |
|---|---|
| `npx tsc --noEmit` | 0 lỗi |
| `npx eslint .` | 0 lỗi, 0 cảnh báo |
| `npm run build` | thành công, 25 route |

## Lỗi tìm ra và đã sửa trong quá trình kiểm thử

1. Tìm sinh viên "sinh vien b" không ra "Sinh viên B" (`ilike` không bỏ dấu tên đã lưu) → thêm `rpc_search_students` dùng `app.f_unaccent`.
2. RPC tạo kết nối trong tài liệu để lọt `p_ttl_days = null` (lỗi NOT NULL khó hiểu) → báo "Thời hạn phản hồi không hợp lệ".
3. Hoàn thành kết nối không bắt buộc điểm đánh giá → bắt buộc 1–5 (acceptance criteria).
4. Next.js 16 báo `Date.now()` khi prerender (supabase-js nạp phiên) → `await connection()` trong `lib/supabase/server.ts`.

## Việc còn lại khi có project Supabase thật

- [ ] Chạy 6 migration (`npx supabase db push` hoặc SQL Editor), kiểm tra 19 bảng, lịch cron `uitconnect_expire_overdue`, bucket `connection-attachments` private.
- [ ] Đăng ký sinh viên / doanh nghiệp qua `/register`, đăng nhập sai mật khẩu, quên mật khẩu (cần cấu hình Redirect URLs + mẫu email trỏ `/auth/confirm`).
- [ ] Gửi yêu cầu kèm **tệp** proposal thật (≤ 20 MB) và tải về bằng signed URL; tệp > 20 MB bị chặn.
- [ ] Sinh lại `src/types/database.ts` bằng `npx supabase gen types typescript --linked` và so khác biệt (bản hiện tại sinh bằng postgres-meta — cùng bộ sinh của Supabase CLI — từ database cục bộ).
