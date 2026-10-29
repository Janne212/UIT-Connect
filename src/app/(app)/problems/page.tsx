import Link from 'next/link';
import { Suspense } from 'react';
import { requireRole } from '@/lib/auth/session';
import { createClient } from '@/lib/supabase/server';
import { listTags } from '@/lib/queries/catalog';
import { searchProblems } from '@/lib/queries/problems';
import { searchParamsSchema } from '@/lib/validation/schemas';
import { SOLVE_STATUS_LABEL } from '@/lib/constants';
import { formatDate } from '@/lib/utils';
import { SearchFilters, toQueryString } from '@/components/search-filters';
import { Card, Empty, Loading, PageTitle, Pager, StatusBadge, TagList } from '@/components/ui';

// Danh sách bài toán đã duyệt: tiêu đề, ngày đăng, doanh nghiệp đăng; lọc theo lĩnh vực + từ khóa
export default function ProblemsPage(props: PageProps<'/problems'>) {
  return <Suspense fallback={<Loading />}><Problems searchParams={props.searchParams} /></Suspense>;
}

async function Problems({ searchParams }: { searchParams: PageProps<'/problems'>['searchParams'] }) {
  const profile = await requireRole();
  const sp = searchParamsSchema.parse(await searchParams);
  const db = await createClient();
  const [tags, result] = await Promise.all([listTags(db), searchProblems(db, { q: sp.q, tagIds: sp.tag, page: sp.page })]);
  return (
    <>
      <PageTitle actions={profile.role === 'company' && <Link href="/problems/new" className="rounded bg-blue-700 px-3 py-2 text-sm text-white">Thêm bài toán/vấn đề</Link>}>
        Bài toán doanh nghiệp
      </PageTitle>
      <SearchFilters action="/problems" tags={tags} q={sp.q} selected={sp.tag} />
      {result.rows.length === 0 ? <Empty>{sp.q || sp.tag.length ? 'Không có kết quả tìm kiếm' : 'Chưa có bài toán nào được duyệt'}</Empty> : (
        <div className="grid gap-3 md:grid-cols-2">
          {result.rows.map((p) => (
            <Card key={p.id}>
              <Link href={`/problems/${p.id}`} className="font-medium underline">{p.title}</Link>
              <p className="text-xs text-gray-600">{p.companies?.name} · đăng {formatDate(p.created_at)} · ~{p.estimated_duration_days} ngày</p>
              <div className="my-1"><StatusBadge status={p.solve_status} label={SOLVE_STATUS_LABEL[p.solve_status]} /></div>
              <TagList tags={p.problem_tags} />
            </Card>
          ))}
        </div>
      )}
      <Pager page={result.page} total={result.total} pageSize={result.pageSize}
        href={(p) => `/problems${toQueryString({ q: sp.q, tag: sp.tag, page: p })}`} />
    </>
  );
}
