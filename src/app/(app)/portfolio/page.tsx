import Link from 'next/link';
import { Suspense } from 'react';
import { requireRole } from '@/lib/auth/session';
import { createClient } from '@/lib/supabase/server';
import { listTags } from '@/lib/queries/catalog';
import { searchPortfolio } from '@/lib/queries/portfolio';
import { searchParamsSchema } from '@/lib/validation/schemas';
import { ITEM_KIND_LABEL } from '@/lib/constants';
import { formatDate } from '@/lib/utils';
import { SearchFilters, toQueryString } from '@/components/search-filters';
import { Card, Empty, Loading, PageTitle, Pager, TagList } from '@/components/ui';

// Danh mục project/product/paper đã duyệt (mới nhất trước), lọc theo loại + lĩnh vực + từ khóa
export default function PortfolioCatalogPage(props: PageProps<'/portfolio'>) {
  return <Suspense fallback={<Loading />}><Catalog searchParams={props.searchParams} /></Suspense>;
}

async function Catalog({ searchParams }: { searchParams: PageProps<'/portfolio'>['searchParams'] }) {
  const profile = await requireRole();
  const sp = searchParamsSchema.parse(await searchParams);
  const db = await createClient();
  const [tags, result] = await Promise.all([
    listTags(db),
    searchPortfolio(db, { q: sp.q, kind: sp.kind, tagIds: sp.tag, page: sp.page }),
  ]);
  return (
    <>
      <PageTitle actions={profile.role === 'student' && <Link href="/portfolio/new" className="rounded bg-blue-700 px-3 py-2 text-sm text-white">Thêm project/product/paper</Link>}>
        Project / Product / Paper
      </PageTitle>
      <SearchFilters action="/portfolio" tags={tags} q={sp.q} selected={sp.tag} kind={sp.kind} showKind />
      {result.rows.length === 0 ? <Empty>{sp.q || sp.tag.length || sp.kind ? 'Không có kết quả tìm kiếm' : 'Chưa có sản phẩm nào được duyệt'}</Empty> : (
        <div className="grid gap-3 md:grid-cols-2">
          {result.rows.map((i) => (
            <Card key={i.id}>
              <Link href={`/portfolio/${i.id}`} className="font-medium underline">{i.title}</Link>
              <p className="text-xs text-gray-600">{ITEM_KIND_LABEL[i.kind]} · {i.student_teams?.name} · {formatDate(i.created_at)}</p>
              <p className="my-1 line-clamp-2 text-sm">{i.summary}</p>
              <TagList tags={i.item_tags} />
            </Card>
          ))}
        </div>
      )}
      <Pager page={result.page} total={result.total} pageSize={result.pageSize}
        href={(p) => `/portfolio${toQueryString({ q: sp.q, kind: sp.kind, tag: sp.tag, page: p })}`} />
    </>
  );
}
