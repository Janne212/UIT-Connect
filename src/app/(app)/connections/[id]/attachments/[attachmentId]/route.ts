import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { getAttachmentSignedUrl } from '@/lib/queries/connections';

// Tải tệp đính kèm: kiểm tra quyền bằng RLS (ca_read + policy storage) rồi chuyển tới signed URL ngắn hạn
export async function GET(_req: NextRequest, ctx: RouteContext<'/connections/[id]/attachments/[attachmentId]'>) {
  const { id, attachmentId } = await ctx.params;
  if (!z.uuid().safeParse(id).success || !z.uuid().safeParse(attachmentId).success) {
    return NextResponse.json({ error: 'Không tìm thấy' }, { status: 404 });
  }
  const db = await createClient();
  const { data: att } = await db
    .from('connection_attachments')
    .select('storage_path')
    .eq('id', attachmentId)
    .eq('connection_id', id)
    .maybeSingle();
  if (!att?.storage_path) return NextResponse.json({ error: 'Không tìm thấy' }, { status: 404 });
  try {
    return NextResponse.redirect(await getAttachmentSignedUrl(db, att.storage_path, 120));
  } catch {
    return NextResponse.json({ error: 'Không tải được tệp' }, { status: 404 });
  }
}
