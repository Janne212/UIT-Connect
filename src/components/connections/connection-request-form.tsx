'use client';

import { useActionState, useRef, useState, startTransition } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { ATTACHMENT_BUCKET, MAX_ATTACHMENT_BYTES } from '@/lib/constants';
import { sanitizeFileName } from '@/lib/utils';
import { createConnectionRequestAction, recordAttachmentAction } from '@/app/(app)/connections/actions';
import type { ActionState } from '@/types';

type Option = { value: string; label: string };

// Cửa sổ xác nhận "Tạo kết nối" (Requirement nhóm 6) + ô đính kèm proposal.
//  - Sinh viên (nhóm trưởng) ở trang bài toán: problemId cố định, chọn nhóm + sản phẩm cầu nối
//  - Doanh nghiệp ở trang sản phẩm/nhóm: teamId (+itemId) cố định, chọn bài toán của mình
// Luồng: Submit -> RPC tạo yêu cầu (pending) -> nếu có tệp: tải thẳng lên Storage {id}/{uuid}-{tên}
//        -> ghi connection_attachments -> chuyển tới trang theo dõi kết nối. Hủy -> không tạo gì.
export function ConnectionRequestForm(props: {
  mode: 'student' | 'company';
  problemId?: string;
  teamId?: string;
  itemId?: string;
  teamOptions?: Option[];
  itemOptions?: Option[];
  problemOptions?: Option[];
  ttlOptions: number[];
  defaultTtl: number;
  targetLabel: string;
}) {
  const router = useRouter();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const [state, formAction, pending] = useActionState(async (prev: ActionState, fd: FormData): Promise<ActionState> => {
    setUploadError(null);
    if (file && fd.get('attachmentUrl')) return { error: 'Chỉ chọn tệp HOẶC liên kết đề xuất, không chọn cả hai' };
    if (file && file.size > MAX_ATTACHMENT_BYTES) return { error: 'Tệp đề xuất tối đa 20 MB' };
    const res = await createConnectionRequestAction(prev, fd);
    if (!res?.ok || !res.id) return res;
    if (file) {
      const path = `${res.id}/${crypto.randomUUID()}-${sanitizeFileName(file.name)}`;
      const up = await createClient().storage.from(ATTACHMENT_BUCKET).upload(path, file, { contentType: file.type || undefined });
      if (up.error) {
        setUploadError('Đã gửi yêu cầu nhưng tải tệp đề xuất thất bại. Bạn có thể đính kèm lại ở trang kết nối.');
      } else {
        const rec = await recordAttachmentAction({
          connectionId: res.id, kind: 'proposal', storagePath: path, fileName: file.name, mimeType: file.type || undefined, sizeBytes: file.size,
        });
        if (rec?.error) setUploadError(`Đã gửi yêu cầu nhưng chưa lưu được tệp: ${rec.error}`);
      }
    }
    startTransition(() => router.push(`/connections/${res.id}`));
    return res;
  }, null);

  const err = (name: string) => state?.fieldErrors?.[name] && <p className="text-xs text-red-700">{state.fieldErrors[name]}</p>;

  return (
    <>
      <button type="button" onClick={() => dialogRef.current?.showModal()} className="rounded bg-blue-700 px-4 py-2 text-sm font-medium text-white">
        Tạo kết nối
      </button>
      <dialog ref={dialogRef} className="w-full max-w-lg rounded p-0 backdrop:bg-black/40" aria-labelledby="conn-title">
        <form action={formAction} className="space-y-3 p-5">
          <h2 id="conn-title" className="text-lg font-semibold">Xác nhận gửi yêu cầu kết nối</h2>
          <p className="text-sm text-gray-600">{props.targetLabel}</p>

          {props.problemId && <input type="hidden" name="problemId" value={props.problemId} />}
          {props.teamId && <input type="hidden" name="teamId" value={props.teamId} />}
          {props.itemId && <input type="hidden" name="itemId" value={props.itemId} />}

          {props.mode === 'student' && (
            <>
              <Select name="teamId" label="Nhóm của bạn (bạn là nhóm trưởng)" options={props.teamOptions ?? []} required />
              {err('teamId')}
              <Select name="itemId" label="Sản phẩm làm cầu nối (không bắt buộc)" options={props.itemOptions ?? []} />
            </>
          )}
          {props.mode === 'company' && (
            <>
              <Select name="problemId" label="Bài toán của bạn" options={props.problemOptions ?? []} required />
              {err('problemId')}
            </>
          )}

          <label className="block text-sm font-medium">
            Thư ngỏ{props.mode === 'company' && <span className="text-red-700"> * (tối thiểu 10 ký tự)</span>}
            <textarea name="message" rows={4} maxLength={3000} className="mt-1 w-full rounded border px-3 py-2 text-sm" />
          </label>
          {err('message')}

          <label className="block text-sm font-medium">
            Thời hạn phản hồi <span className="text-red-700">*</span>
            <select name="ttlDays" defaultValue={props.defaultTtl} className="mt-1 w-full rounded border px-3 py-2 text-sm">
              {props.ttlOptions.map((d) => <option key={d} value={d}>{d} ngày</option>)}
            </select>
          </label>

          <fieldset className="space-y-2 rounded border p-3">
            <legend className="px-1 text-sm font-medium">Đề xuất (proposal) — tệp hoặc liên kết</legend>
            <input type="file" aria-label="Tệp đề xuất (tối đa 20 MB)" onChange={(e) => setFile(e.target.files?.[0] ?? null)} className="text-sm" />
            <input type="url" name="attachmentUrl" placeholder="https://… (liên kết Google Drive, GitHub…)" className="w-full rounded border px-3 py-2 text-sm" />
            {err('attachmentUrl')}
          </fieldset>

          {state?.error && <p role="alert" className="text-sm text-red-700">{state.error}</p>}
          {uploadError && <p role="alert" className="text-sm text-amber-700">{uploadError}</p>}

          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => dialogRef.current?.close()} className="rounded border px-4 py-2 text-sm">Hủy</button>
            <button type="submit" disabled={pending} className="rounded bg-blue-700 px-4 py-2 text-sm font-medium text-white disabled:opacity-60">
              {pending ? 'Đang gửi…' : 'Submit'}
            </button>
          </div>
        </form>
      </dialog>
    </>
  );
}

function Select({ name, label, options, required }: { name: string; label: string; options: Option[]; required?: boolean }) {
  return (
    <label className="block text-sm font-medium">
      {label}{required && <span className="text-red-700"> *</span>}
      <select name={name} className="mt-1 w-full rounded border px-3 py-2 text-sm" defaultValue={options.length === 1 ? options[0].value : ''}>
        <option value="">— Chọn —</option>
        {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </label>
  );
}
