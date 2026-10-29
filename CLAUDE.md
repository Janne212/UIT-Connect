@AGENTS.md

# Quy tắc dự án UIT Connect (cho Claude Code)

- Next.js 16 App Router, `cacheComponents` bật: mọi thứ đọc phiên/cookie/params phải nằm sau `<Suspense>`. Đọc `node_modules/next/dist/docs/` trước khi dùng API lạ.
- `src/proxy.ts` thay cho middleware. Proxy và `requireRole` chỉ để điều hướng; quyền thật nằm ở RLS và RPC.
- Truy vấn Supabase phía server dùng `src/lib/supabase/server.ts`. Logic đọc đặt ở `src/lib/queries/*`, logic ghi ở `src/lib/services/*` (nhận client làm tham số); `actions.ts` chỉ: `requireRole` → Zod → service → `revalidatePath`/`redirect`.
- KHÔNG BAO GIỜ `select('*')` trên `profiles`; dùng `PROFILE_COLUMNS`. Email người khác không đọc được từ client.
- `connection_requests` chỉ ghi qua RPC. `review_status`, `deleted_at`, `solve_status`, `role`, `is_active` chỉ đổi qua RPC.
- `SUPABASE_SECRET_KEY` chỉ dùng trong `src/lib/supabase/admin.ts` (`import 'server-only'`), sau khi đã kiểm tra quyền admin. Không đọc/in `.env.local`, không ghi mật khẩu hay token vào log.
- Không tắt RLS để sửa lỗi. Mọi thay đổi database là **một tệp mới** trong `supabase/migrations/`; không sửa tệp đã chạy. Sau đó sinh lại `src/types/database.ts`, sửa `src/lib/validation/schemas.ts` cho khớp CHECK, rồi mới sửa giao diện.
- Thông báo lỗi cho người dùng bằng tiếng Việt qua `src/lib/errors.ts`; RPC raise `P0001` với câu tiếng Việt.
- Sau mỗi thay đổi: `npm run typecheck`, `npx eslint .`, `npm run test:db`, `npm run test:backend` (xem README) và nêu cách kiểm tra.
