'use client';

import { createContext, use, useActionState, type ReactNode } from 'react';
import type { ActionState } from '@/types';

// Form dùng chung cho mọi Server Action: khóa nút khi đang gửi, hiện lỗi sát ô (fieldErrors từ Zod)
// và chỉ báo thành công sau khi server/database xác nhận. Giao diện thô — nhóm frontend thay bằng thiết kế Stitch.
type Action = (state: ActionState, formData: FormData) => Promise<ActionState>;

const FormStateContext = createContext<ActionState>(null);

export function ActionForm({
  action, children, submitLabel = 'Gửi', pendingLabel = 'Đang gửi…', className, danger,
}: {
  action: Action; children?: ReactNode; submitLabel?: string; pendingLabel?: string; className?: string; danger?: boolean;
}) {
  const [state, formAction, pending] = useActionState(action, null);
  return (
    <FormStateContext value={state}>
      <form action={formAction} className={className ?? 'space-y-3'} noValidate>
        {children}
        {state?.error && <p role="alert" className="text-sm text-red-700">{state.error}</p>}
        {state?.ok && state.message && <p role="status" className="text-sm text-green-700">{state.message}</p>}
        <button
          type="submit"
          disabled={pending}
          className={`rounded px-4 py-2 text-sm font-medium text-white disabled:opacity-60 ${danger ? 'bg-red-700' : 'bg-blue-700'}`}
        >
          {pending ? pendingLabel : submitLabel}
        </button>
      </form>
    </FormStateContext>
  );
}

export function FieldError({ name }: { name: string }) {
  const state = use(FormStateContext);
  const message = state?.fieldErrors?.[name];
  return message ? <p className="mt-1 text-xs text-red-700">{message}</p> : null;
}

// Ô nhập có nhãn tiếng Việt + lỗi theo tên ô
export function Field({
  label, name, type = 'text', required, defaultValue, placeholder, textarea, rows = 4, min, max, step,
}: {
  label: string; name: string; type?: string; required?: boolean; defaultValue?: string | number | null;
  placeholder?: string; textarea?: boolean; rows?: number; min?: number | string; max?: number | string; step?: number;
}) {
  const id = `f-${name}`;
  const common = {
    id, name, required, placeholder, defaultValue: defaultValue ?? undefined,
    className: 'mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm',
  };
  return (
    <div>
      <label htmlFor={id} className="block text-sm font-medium">
        {label}{required && <span className="text-red-700"> *</span>}
      </label>
      {textarea ? <textarea {...common} rows={rows} /> : <input {...common} type={type} min={min} max={max} step={step} />}
      <FieldError name={name} />
    </div>
  );
}

export function SelectField({
  label, name, options, required, defaultValue, placeholder = '— Chọn —',
}: {
  label: string; name: string; options: Array<{ value: string | number; label: string }>; required?: boolean;
  defaultValue?: string | number | null; placeholder?: string;
}) {
  const id = `f-${name}`;
  return (
    <div>
      <label htmlFor={id} className="block text-sm font-medium">
        {label}{required && <span className="text-red-700"> *</span>}
      </label>
      <select id={id} name={name} defaultValue={defaultValue ?? ''} className="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm">
        <option value="">{placeholder}</option>
        {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
      <FieldError name={name} />
    </div>
  );
}
