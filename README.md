# UIT-Connect
Website giới thiệu dự án, sản phẩm và paper của sinh viên UIT; doanh nghiệp gửi nhu cầu và chọn nhóm/dự án để kết nối giải quyết vấn đề.

## Nhánh

| Nhánh | Nội dung |
|---|---|
| `UITConnect.v1` | Design + Frontend hoàn thiện (14 màn hình) |
| **`UITConnect.v2`** | **Code chức năng giai đoạn 1 (nhánh này)** |
| `UITConnect.v3` | Code chức năng giai đoạn 2 |

Nhánh này chứa backend giai đoạn 1 (database, RPC, Storage, Server Actions, truy vấn) và **trang thô** để chạy thử từng chức năng. Giao diện chính thức đến từ `UITConnect.v1`: giữ nguyên Server Action và tên ô form, chỉ thay phần hiển thị. Bản đồ chức năng → tệp: [`docs/backend-phase1.md`](docs/backend-phase1.md). Hợp đồng RPC: [`docs/rpc-contract.md`](docs/rpc-contract.md). Kết quả kiểm thử: [`docs/test-results.md`](docs/test-results.md).

## Công nghệ

Next.js 16 (App Router, `src/proxy.ts`, Cache Components) · React 19 · TypeScript · Tailwind 4 · Supabase (PostgreSQL, Auth, Storage, pg_cron) · `@supabase/ssr` · Zod 4 · Vercel. Node.js ≥ 20.9.

## Cài đặt

### 1. Supabase
1. Database → Extensions: bật **pg_cron** (trước khi chạy migration để lịch quét hết hạn tự đăng ký).
2. Chạy 6 migration **theo thứ tự** trong `supabase/migrations/`:
   ```bash
   npx supabase login
   npx supabase link --project-ref <PROJECT_REF>
   npx supabase db push
   ```
   hoặc dán lần lượt từng tệp vào SQL Editor. `..._schema.sql` không chạy lại được trên database đã có schema.
3. Kiểm tra: 19 bảng trong `public`; `select jobname from cron.job` có `uitconnect_expire_overdue`; Storage có bucket private `connection-attachments`.
4. Authentication: bật Email, mật khẩu tối thiểu 6; URL Configuration: Site URL + Redirect URLs `http://localhost:3000/**` (và URL Vercel). Nếu bật Confirm email: mẫu email trỏ `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=email`; mẫu Reset password: `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=recovery&next=/reset-password`.
5. Admin đầu tiên (SQL Editor): `update public.profiles set role = 'admin' where id = '<uuid>';` Giảng viên: `set role = 'lecturer'`.

### 2. Ứng dụng
```bash
npm install
cp .env.example .env.local   # điền NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
npx supabase gen types typescript --linked > src/types/database.ts   # sinh lại kiểu sau mỗi migration
npm run dev
```

## Kiểm thử

| Lệnh | Kiểm gì | Cần |
|---|---|---|
| `npm run typecheck`, `npx eslint .`, `npm run build` | Kiểu, lint, build | — |
| `PGURL=postgres://postgres:<mk>@localhost:5432/postgres npm run test:db` | 104 phép thử migration + RLS + RPC (T02–T20 của tài liệu hướng dẫn) | PostgreSQL 15+ cục bộ (có `unaccent`) |
| `PGURL=… POSTGREST_BIN=<đường dẫn postgrest> npm run test:backend` | 36 phép thử 9 chức năng qua supabase-js → PostgREST | thêm [PostgREST v12](https://github.com/PostgREST/postgrest/releases) |

Hai bộ test tạo database tạm (`uitc_test`, `uitc_backend_test`) với bản giả lập phần Supabase (`supabase/tests/local/00_supabase_stub.sql`), **không** chạm vào project Supabase thật.

## Cấu trúc chính

```
supabase/migrations/      6 migration (schema + auth của nhóm chép nguyên văn, RPC, storage, bổ sung gđ1)
supabase/tests/local/     stub Supabase + tài khoản thử + 104 phép thử SQL
src/proxy.ts              làm mới phiên, chặn trang khi chưa đăng nhập
src/lib/supabase/         client trình duyệt / server / proxy / admin
src/lib/auth/session.ts   getCurrentProfile, requireRole
src/lib/validation/       Zod phản chiếu CHECK của schema; formToObject
src/lib/queries/          đọc dữ liệu (danh mục, chi tiết, tìm kiếm, bảng theo dõi, dashboard)
src/lib/services/         ghi dữ liệu (tạo bài, bài toán, kết nối, duyệt…)
src/app/(auth)/           đăng nhập, đăng ký, quên mật khẩu + actions
src/app/(app)/            trang sau đăng nhập + actions.ts của từng tính năng
tests/backend/            test end-to-end backend
docs/                     bản đồ chức năng, hợp đồng RPC, kết quả test
```
