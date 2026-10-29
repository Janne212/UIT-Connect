import type { DB } from '@/lib/db';

// RLS notif_read chỉ trả thông báo của chính người dùng
export async function listNotifications(db: DB, limit = 50) {
  const { data, error } = await db
    .from('notifications')
    .select('id, type, title, body, link_path, connection_id, read_at, created_at')
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data;
}

export async function countUnreadNotifications(db: DB) {
  const { count, error } = await db
    .from('notifications')
    .select('id', { count: 'exact', head: true })
    .is('read_at', null);
  if (error) throw error;
  return count ?? 0;
}
