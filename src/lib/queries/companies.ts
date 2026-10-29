import type { DB } from '@/lib/db';

const COMPANY_COLUMNS =
  'id, owner_id, name, contact_email, industry, size_range, website, description, logo_url, phone, address, created_at, updated_at';

// companies đọc được bởi MỌI người đã đăng nhập, nên phải lọc theo owner_id khi cần "công ty của tôi"
export async function getMyCompany(db: DB, userId: string) {
  const { data, error } = await db.from('companies').select(COMPANY_COLUMNS).eq('owner_id', userId).maybeSingle();
  if (error) throw error;
  return data;
}

export async function getCompany(db: DB, id: string) {
  const { data, error } = await db.from('companies').select(COMPANY_COLUMNS).eq('id', id).maybeSingle();
  if (error) throw error;
  return data;
}
