import type { DB } from '@/lib/db';
import type { Tag, TagKind } from '@/types';

// Danh mục tag lĩnh vực/kỹ năng (dùng chung cho bài toán và sản phẩm — Requirement: "một bảng tag")
export async function listTags(db: DB, kind?: TagKind): Promise<Tag[]> {
  let query = db.from('tags').select('id, kind, name, slug').eq('is_active', true).order('kind').order('name');
  if (kind) query = query.eq('kind', kind);
  const { data, error } = await query;
  if (error) throw error;
  return data;
}

// Các lựa chọn thời hạn phản hồi do admin cấu hình (system_settings.connection_ttl_options_days)
export async function getConnectionTtlOptions(db: DB): Promise<{ options: number[]; defaultDays: number }> {
  const { data, error } = await db
    .from('system_settings')
    .select('key, value')
    .in('key', ['connection_ttl_options_days', 'connection_default_ttl_days']);
  if (error) throw error;
  const map = new Map(data.map((r) => [r.key, r.value]));
  const raw = map.get('connection_ttl_options_days');
  const options = Array.isArray(raw) ? raw.map(Number).filter((n) => Number.isInteger(n) && n > 0) : [3, 7, 14, 30];
  const def = Number(map.get('connection_default_ttl_days'));
  return { options, defaultDays: options.includes(def) ? def : options[0] };
}

// Danh sách giảng viên để chọn GVHD cho project (profiles chỉ đọc cột công khai)
export async function listLecturers(db: DB) {
  const { data, error } = await db
    .from('profiles')
    .select('id, full_name, headline')
    .eq('role', 'lecturer')
    .eq('is_active', true)
    .order('full_name');
  if (error) throw error;
  return data;
}
