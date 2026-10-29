import type { PostgrestError } from '@supabase/supabase-js';
import type { ZodError } from 'zod';
import type { ActionState } from '@/types';

// Đổi lỗi Postgres/PostgREST thành thông báo tiếng Việt; không để lộ nội dung lỗi nội bộ.
export function mapDbError(error: Pick<PostgrestError, 'code' | 'message'>): string {
  switch (error.code) {
    case '42501':
      // RPC của dự án tự viết thông báo tiếng Việt cho lỗi quyền; lỗi quyền mức bảng thì dùng câu chung
      return isOwnMessage(error.message) ? error.message : 'Bạn không có quyền thực hiện thao tác này';
    case '23505':
      return 'Dữ liệu đã tồn tại (ví dụ: đã có yêu cầu đang chờ cho cùng bài toán và nhóm)';
    case '23514':
      return 'Dữ liệu chưa đạt yêu cầu của hệ thống';
    case '23503':
      return 'Dữ liệu liên quan không tồn tại';
    case '23502':
      return 'Thiếu thông tin bắt buộc';
    case 'P0002':
      return isOwnMessage(error.message) ? error.message : 'Không tìm thấy dữ liệu';
    case 'P0001':
      return error.message; // thông báo nghiệp vụ do chính các RPC của dự án viết bằng tiếng Việt
    case 'PGRST116':
      return 'Không tìm thấy dữ liệu';
    default:
      return 'Có lỗi xảy ra, vui lòng thử lại';
  }
}

// Thông báo do RPC của dự án tự raise luôn có dấu tiếng Việt; lỗi hệ thống của Postgres thì không.
function isOwnMessage(message: string | undefined) {
  return !!message && /[À-ỹ]/.test(message) && !/permission denied/i.test(message);
}

export function dbErrorState(error: Pick<PostgrestError, 'code' | 'message'>): ActionState {
  return { error: mapDbError(error) };
}

// Gom lỗi Zod theo tên ô để form hiển thị sát ô nhập
export function zodErrorState(error: ZodError): ActionState {
  const fieldErrors: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path.join('.') || '_';
    if (!fieldErrors[key]) fieldErrors[key] = issue.message;
  }
  return { error: error.issues[0]?.message ?? 'Dữ liệu chưa hợp lệ', fieldErrors };
}
