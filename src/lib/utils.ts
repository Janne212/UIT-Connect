// search_tsv lưu không dấu (app.f_unaccent) nên từ khóa phải bỏ dấu trước khi truy vấn.
export function removeDiacritics(input: string): string {
  return input
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D');
}

// Chuẩn hóa từ khóa: bỏ dấu, bỏ ký tự đặc biệt mà to_tsquery hiểu nhầm, gộp khoảng trắng
export function normalizeKeyword(input: string | undefined | null): string {
  if (!input) return '';
  return removeDiacritics(input)
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

const dateFmt = new Intl.DateTimeFormat('vi-VN', { dateStyle: 'medium', timeZone: 'Asia/Ho_Chi_Minh' });
const dateTimeFmt = new Intl.DateTimeFormat('vi-VN', {
  dateStyle: 'short',
  timeStyle: 'short',
  timeZone: 'Asia/Ho_Chi_Minh',
});

export function formatDate(value: string | null | undefined): string {
  return value ? dateFmt.format(new Date(value)) : '—';
}

export function formatDateTime(value: string | null | undefined): string {
  return value ? dateTimeFmt.format(new Date(value)) : '—';
}

export function cn(...classes: Array<string | false | null | undefined>): string {
  return classes.filter(Boolean).join(' ');
}

// Tên tệp an toàn cho đường dẫn Storage: {connectionId}/{uuid}-{tên đã làm sạch}
export function sanitizeFileName(name: string): string {
  const cleaned = removeDiacritics(name)
    .replace(/[^a-zA-Z0-9._-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
  return (cleaned || 'tep').slice(-120);
}

// Đối số RPC kiểu "string" do supabase gen types sinh ra nhưng tham số SQL nhận NULL.
// PostgREST truyền null đúng nghĩa SQL NULL, nên ép kiểu ở một chỗ duy nhất cho dễ kiểm.
export function sqlNull<T>(value: T | null | undefined): T {
  return (value ?? null) as T;
}

export function toArray(values: FormDataEntryValue[]): string[] {
  return values.map(String).map((v) => v.trim()).filter(Boolean);
}
