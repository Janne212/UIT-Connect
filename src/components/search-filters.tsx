import type { Tag } from '@/types';

// Bộ lọc GET: từ khóa (?q=), loại (?kind=), tag lĩnh vực/kỹ năng (?tag=1&tag=2). Không cần JavaScript.
export function SearchFilters({
  action, tags, q, selected, kind, showKind,
}: {
  action: string; tags: Tag[]; q?: string; selected: number[]; kind?: string; showKind?: boolean;
}) {
  const fields = tags.filter((t) => t.kind === 'field');
  const skills = tags.filter((t) => t.kind === 'skill');
  return (
    <form action={action} className="mb-4 space-y-3 rounded border p-3">
      <div className="flex flex-wrap gap-2">
        <input name="q" defaultValue={q} aria-label="Từ khóa" placeholder="Từ khóa (có dấu hoặc không dấu)" className="min-w-0 flex-1 rounded border px-3 py-2 text-sm" />
        {showKind && (
          <select name="kind" defaultValue={kind ?? ''} aria-label="Loại" className="rounded border px-2 text-sm">
            <option value="">Tất cả loại</option><option value="project">Project</option>
            <option value="product">Product</option><option value="paper">Paper</option>
          </select>
        )}
        <button className="rounded bg-blue-700 px-4 py-2 text-sm text-white">Lọc</button>
      </div>
      <TagGroup legend="Lĩnh vực" tags={fields} selected={selected} />
      <TagGroup legend="Kỹ năng" tags={skills} selected={selected} />
    </form>
  );
}

function TagGroup({ legend, tags, selected }: { legend: string; tags: Tag[]; selected: number[] }) {
  if (!tags.length) return null;
  return (
    <fieldset className="flex flex-wrap gap-x-3 gap-y-1 text-sm">
      <legend className="mr-2 font-medium">{legend}:</legend>
      {tags.map((t) => (
        <label key={t.id}><input type="checkbox" name="tag" value={t.id} defaultChecked={selected.includes(t.id)} /> {t.name}</label>
      ))}
    </fieldset>
  );
}

// Đọc searchParams (Next 16: Promise) thành giá trị đã kiểm tra
export function toQueryString(params: Record<string, string | number | number[] | undefined>) {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === '') continue;
    if (Array.isArray(v)) v.forEach((x) => sp.append(k, String(x)));
    else sp.set(k, String(v));
  }
  const s = sp.toString();
  return s ? `?${s}` : '';
}
