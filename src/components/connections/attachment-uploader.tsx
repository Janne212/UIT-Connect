'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { ATTACHMENT_BUCKET, MAX_ATTACHMENT_BYTES } from '@/lib/constants';
import { sanitizeFileName } from '@/lib/utils';
import { recordAttachmentAction } from '@/app/(app)/connections/actions';

// Đính kèm thêm tệp vào kết nối đã có (proposal bổ sung, hoặc sản phẩm bàn giao khi hoàn thành).
// Tệp đi thẳng từ trình duyệt lên bucket private; policy storage chỉ cho các bên của kết nối ghi.
export function AttachmentUploader({ connectionId, kind }: { connectionId: string; kind: 'proposal' | 'deliverable' }) {
  const router = useRouter();
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, startTransition] = useTransition();

  function onUpload(file: File | undefined) {
    if (!file) return;
    if (file.size > MAX_ATTACHMENT_BYTES) return setMessage({ ok: false, text: 'Tệp tối đa 20 MB' });
    startTransition(async () => {
      const path = `${connectionId}/${crypto.randomUUID()}-${sanitizeFileName(file.name)}`;
      const up = await createClient().storage.from(ATTACHMENT_BUCKET).upload(path, file, { contentType: file.type || undefined });
      if (up.error) return setMessage({ ok: false, text: 'Tải tệp thất bại, hãy thử lại' });
      const res = await recordAttachmentAction({
        connectionId, kind, storagePath: path, fileName: file.name, mimeType: file.type || undefined, sizeBytes: file.size,
      });
      setMessage(res?.ok ? { ok: true, text: 'Đã đính kèm tệp' } : { ok: false, text: res?.error ?? 'Không lưu được tệp' });
      if (res?.ok) router.refresh();
    });
  }

  return (
    <div className="space-y-1">
      <label className="block text-sm font-medium">
        {kind === 'proposal' ? 'Đính kèm đề xuất (tối đa 20 MB)' : 'Đính kèm sản phẩm bàn giao (tối đa 20 MB)'}
        <input type="file" disabled={pending} onChange={(e) => onUpload(e.target.files?.[0])} className="mt-1 block text-sm" />
      </label>
      {pending && <p className="text-xs text-gray-600">Đang tải lên…</p>}
      {message && <p className={`text-xs ${message.ok ? 'text-green-700' : 'text-red-700'}`}>{message.text}</p>}
    </div>
  );
}
