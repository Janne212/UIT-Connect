import Link from 'next/link';
import type { ReactNode } from 'react';

// Thành phần hiển thị tối giản (server component). Nhóm frontend thay bằng component theo thiết kế Stitch.

export function PageTitle({ children, actions }: { children: ReactNode; actions?: ReactNode }) {
  return (
    <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
      <h1 className="text-xl font-semibold">{children}</h1>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

export function Badge({ children, tone = 'gray' }: { children: ReactNode; tone?: 'gray' | 'blue' | 'green' | 'amber' | 'red' }) {
  const tones = {
    gray: 'bg-gray-100 text-gray-800', blue: 'bg-blue-100 text-blue-800', green: 'bg-green-100 text-green-800',
    amber: 'bg-amber-100 text-amber-800', red: 'bg-red-100 text-red-800',
  } as const;
  return <span className={`inline-block rounded px-2 py-0.5 text-xs font-medium ${tones[tone]}`}>{children}</span>;
}

const STATUS_TONE: Record<string, 'gray' | 'blue' | 'green' | 'amber' | 'red'> = {
  pending: 'amber', review_pending_review: 'amber', pending_review: 'amber',
  in_progress: 'blue', open: 'blue',
  completed: 'green', approved: 'green', solved: 'green',
  rejected: 'red', review_rejected: 'red', cancelled: 'red',
  expired: 'gray', review_expired: 'gray',
};

export function StatusBadge({ status, label }: { status: string; label: string }) {
  return <Badge tone={STATUS_TONE[status] ?? 'gray'}>{label}</Badge>;
}

export function TagList({ tags }: { tags: Array<{ tags: { id: number; name: string; kind: string } | null }> }) {
  const list = tags.map((t) => t.tags).filter((t): t is NonNullable<typeof t> => !!t);
  if (!list.length) return null;
  return (
    <ul className="flex flex-wrap gap-1" aria-label="Lĩnh vực và kỹ năng">
      {list.map((t) => <li key={t.id}><Badge tone={t.kind === 'field' ? 'blue' : 'gray'}>{t.name}</Badge></li>)}
    </ul>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return <p className="rounded border border-dashed p-6 text-center text-sm text-gray-600">{children}</p>;
}

export function Card({ children }: { children: ReactNode }) {
  return <div className="rounded border border-gray-200 p-4">{children}</div>;
}

export function Loading() {
  return <p className="p-4 text-sm text-gray-600" role="status">Đang tải…</p>;
}

export function Pager({ page, total, pageSize, href }: { page: number; total: number; pageSize: number; href: (p: number) => string }) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  if (pages <= 1) return null;
  return (
    <nav className="mt-4 flex items-center gap-3 text-sm" aria-label="Phân trang">
      {page > 1 && <Link href={href(page - 1)} className="underline">← Trước</Link>}
      <span>Trang {page}/{pages}</span>
      {page < pages && <Link href={href(page + 1)} className="underline">Sau →</Link>}
    </nav>
  );
}

export function KeyValue({ items }: { items: Array<[string, ReactNode]> }) {
  return (
    <dl className="grid grid-cols-1 gap-x-4 gap-y-1 text-sm sm:grid-cols-[180px_1fr]">
      {items.map(([k, v]) => (
        <div key={k} className="contents">
          <dt className="font-medium text-gray-600">{k}</dt>
          <dd>{v ?? '—'}</dd>
        </div>
      ))}
    </dl>
  );
}
