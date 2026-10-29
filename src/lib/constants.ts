import type { ConnectionStatus, ItemKind, ReviewStatus, Role, SolveStatus } from '@/types';

export const ROLE_LABEL: Record<Role, string> = {
  student: 'Sinh viên',
  company: 'Doanh nghiệp',
  lecturer: 'Giảng viên / Điều phối',
  admin: 'Quản trị viên',
};

export const ITEM_KIND_LABEL: Record<ItemKind, string> = {
  project: 'Project',
  product: 'Product',
  paper: 'Paper',
};

// Trạng thái kiểm duyệt bài đăng ("chờ duyệt", "hết hạn" trong bảng theo dõi)
export const REVIEW_STATUS_LABEL: Record<ReviewStatus, string> = {
  pending_review: 'Chờ duyệt',
  approved: 'Đã duyệt',
  rejected: 'Bị từ chối duyệt',
  expired: 'Hết hạn duyệt',
};

export const SOLVE_STATUS_LABEL: Record<SolveStatus, string> = {
  open: 'Đang mở',
  in_progress: 'Đang có nhóm thực hiện',
  solved: 'Đã giải quyết',
};

// Trạng thái yêu cầu kết nối (khớp enum connection_status trong schema)
export const CONNECTION_STATUS_LABEL: Record<ConnectionStatus, string> = {
  pending: 'Chờ phản hồi',
  expired: 'Hết hạn phản hồi',
  rejected: 'Bị từ chối',
  in_progress: 'Đang thực hiện',
  cancelled: 'Đã dừng',
  completed: 'Đã hoàn thành',
};

export const CONNECTION_STATUSES = Object.keys(CONNECTION_STATUS_LABEL) as ConnectionStatus[];
export const REVIEW_STATUSES = Object.keys(REVIEW_STATUS_LABEL) as ReviewStatus[];

export const COMPANY_SIZE_RANGES = ['1-10', '11-50', '51-200', '201-1000', '1000+'] as const;
export const COLLABORATION_MODES = ['Từ xa', 'Kết hợp', 'Tại doanh nghiệp'] as const;

export const MAX_ATTACHMENT_BYTES = 20 * 1024 * 1024; // khớp CHECK connection_attachments.size_bytes
export const ATTACHMENT_BUCKET = 'connection-attachments';
export const PAGE_SIZE = 12;
