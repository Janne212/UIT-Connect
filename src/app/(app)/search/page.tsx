import Link from 'next/link';
import { Suspense } from 'react';
import { requireRole } from '@/lib/auth/session';
import { createClient } from '@/lib/supabase/server';
import { listTags } from '@/lib/queries/catalog';
import { searchPortfolio } from '@/lib/queries/portfolio';
import { searchProblems } from '@/lib/queries/problems';
import { searchParamsSchema } from '@/lib/validation/schemas';
import { ITEM_KIND_LABEL } from '@/lib/constants';
import { formatDate } from '@/lib/utils';
import { SearchFilters } from '@/components/search-filters';
import { Card, Empty, Loading, PageTitle, TagList } from '@/components/ui';

// Chức năng 9 — Tìm kiếm sản phẩm/bài toán của sv/doanh nghiệp theo lĩnh vực (+ từ khóa)
export default function SearchPage(props: PageProps<'/search'>) {
  return <Suspense fallback={<Loading />}><Search searchParams={props.searchParams} /></Suspense>;
}

async function Search({ searchParams }: { searchParams: PageProps<'/search'>['searchParams'] }) {
  await requireRole();
  const sp = searchParamsSchema.parse(await searchParams);
  const db = await createClient();
  const tags = await listTags(db);
  const hasCriteria = !!sp.q?.trim() || sp.tag.length > 0;

  return (
    <>
      <PageTitle>Tìm kiếm theo lĩnh vực</PageTitle>
      <SearchFilters action="/search" tags={tags} q={sp.q} selected={sp.tag} />
      {!hasCriteria ? <Empty>Nhập từ khóa hoặc chọn lĩnh vực/kỹ năng để tìm.</Empty> : <Results q={sp.q} tagIds={sp.tag} />}
    </>
  );
}

async function Results({ q, tagIds }: { q?: string; tagIds: number[] }) {
  const db = await createClient();
  const [problems, items] = await Promise.all([
    searchProblems(db, { q, tagIds, pageSize: 20 }),
    searchPortfolio(db, { q, tagIds, pageSize: 20 }),
  ]);
  if (problems.total + items.total === 0) return <Empty>Không có kết quả tìm kiếm</Empty>;
  return (
    <div className="grid gap-6 md:grid-cols-2">
      <section>
        <h2 className="mb-2 font-semibold">Bài toán ({problems.total})</h2>
        <div className="space-y-2">
          {problems.rows.map((p) => (
            <Card key={p.id}>
              <Link href={`/problems/${p.id}`} className="font-medium underline">{p.title}</Link>
              <p className="text-xs text-gray-600">{p.companies?.name} · {formatDate(p.created_at)}</p>
              <TagList tags={p.problem_tags} />
            </Card>
          ))}
        </div>
      </section>
      <section>
        <h2 className="mb-2 font-semibold">Project / Product / Paper ({items.total})</h2>
        <div className="space-y-2">
          {items.rows.map((i) => (
            <Card key={i.id}>
              <Link href={`/portfolio/${i.id}`} className="font-medium underline">{i.title}</Link>
              <p className="text-xs text-gray-600">{ITEM_KIND_LABEL[i.kind]} · {i.student_teams?.name} · {formatDate(i.created_at)}</p>
              <TagList tags={i.item_tags} />
            </Card>
          ))}
        </div>
      </section>
    </div>
  );
}
