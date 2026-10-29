import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Suspense } from 'react';
import { z } from 'zod';
import { requireRole } from '@/lib/auth/session';
import { createClient } from '@/lib/supabase/server';
import { getConnection, getPartnerContacts } from '@/lib/queries/connections';
import { CONNECTION_STATUS_LABEL, ITEM_KIND_LABEL } from '@/lib/constants';
import { formatDate, formatDateTime } from '@/lib/utils';
import { ActionForm, Field } from '@/components/forms/action-form';
import { AttachmentUploader } from '@/components/connections/attachment-uploader';
import { Card, KeyValue, Loading, PageTitle, StatusBadge } from '@/components/ui';
import { endConnectionAction, extendConnectionAction, respondConnectionAction } from '../actions';

// Chi tiết một kết nối: thông tin hai bên, proposal, phản hồi (đồng ý/từ chối),
// kết thúc (hoàn thành kèm đánh giá / dừng kèm lý do), gia hạn. Nút chỉ hiện đúng vai trò + trạng thái;
// RPC vẫn kiểm tra lại quyền, mọi lỗi từ server được hiển thị.
export default function ConnectionPage(props: PageProps<'/connections/[id]'>) {
  return <Suspense fallback={<Loading />}><ConnectionDetail params={props.params} /></Suspense>;
}

async function ConnectionDetail({ params }: { params: PageProps<'/connections/[id]'>['params'] }) {
  const profile = await requireRole();
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();
  const db = await createClient();
  const c = await getConnection(db, id);
  if (!c) notFound();

  const company = c.business_problems?.companies;
  const members = c.student_teams?.team_members ?? [];
  const isCompanyOwner = company?.owner_id === profile.id;
  const myMembership = members.find((m) => m.profiles?.id === profile.id);
  const isLeader = myMembership?.member_role === 'leader';
  const isRecipient = c.status === 'pending' && ((c.direction === 'team_to_company' && isCompanyOwner) || (c.direction === 'company_to_team' && isLeader));
  const isParty = isCompanyOwner || !!myMembership;

  // Kênh liên hệ ngoài của đối tác: RLS chỉ trả khi in_progress/completed
  const partnerIds = isCompanyOwner ? members.flatMap((m) => (m.profiles ? [m.profiles.id] : [])) : company ? [company.owner_id] : [];
  const contacts = isParty ? await getPartnerContacts(db, partnerIds) : [];
  const nameOf = new Map(members.flatMap((m) => (m.profiles ? [[m.profiles.id, m.profiles.full_name] as const] : [])));

  return (
    <div className="space-y-5">
      <PageTitle>Kết nối: {c.business_problems?.title}</PageTitle>
      <div className="flex items-center gap-2">
        <StatusBadge status={c.status} label={CONNECTION_STATUS_LABEL[c.status]} />
        <span className="text-sm text-gray-600">{c.direction === 'team_to_company' ? 'Nhóm gửi tới doanh nghiệp' : 'Doanh nghiệp mời nhóm'}</span>
      </div>

      <Card>
        <KeyValue items={[
          ['Bài toán', c.business_problems && <Link href={`/problems/${c.business_problems.id}`} className="underline">{c.business_problems.title}</Link>],
          ['Doanh nghiệp', company?.name],
          ['Nhóm', c.student_teams && <Link href={`/teams/${c.student_teams.id}`} className="underline">{c.student_teams.name}</Link>],
          ['Sản phẩm cầu nối', c.portfolio_items && <Link href={`/portfolio/${c.portfolio_items.id}`} className="underline">{c.portfolio_items.title} ({ITEM_KIND_LABEL[c.portfolio_items.kind]})</Link>],
          ['Thư ngỏ', c.message && <span className="whitespace-pre-line">{c.message}</span>],
          ['Khởi tạo', formatDateTime(c.created_at)],
          ['Hạn phản hồi', formatDateTime(c.expires_at)],
          ['Phản hồi lúc', formatDateTime(c.responded_at)],
          ['Nội dung phản hồi', c.response_message],
          ['Bắt đầu thực hiện', formatDate(c.started_at)],
          ['Dự kiến hoàn thành', formatDate(c.expected_end_at)],
          ['Kết thúc', formatDate(c.ended_at)],
          ...(c.end_reason ? [['Lý do dừng', c.end_reason] as [string, string]] : []),
          ...(c.end_rating ? [['Đánh giá', `${c.end_rating}/5${c.end_feedback ? ` — ${c.end_feedback}` : ''}`] as [string, string]] : []),
        ]} />
      </Card>

      <section>
        <h2 className="mb-2 font-semibold">Tệp / liên kết đính kèm</h2>
        <ul className="mb-2 space-y-1 text-sm">
          {c.connection_attachments.length === 0 && <li className="text-gray-600">Chưa có đính kèm</li>}
          {c.connection_attachments.map((a) => (
            <li key={a.id}>
              {a.kind === 'proposal' ? 'Đề xuất' : 'Bàn giao'}:{' '}
              {a.external_url
                ? <a href={a.external_url} target="_blank" rel="noopener noreferrer" className="underline">{a.external_url}</a>
                : <a href={`/connections/${c.id}/attachments/${a.id}`} className="underline">{a.file_name}</a>}
              <span className="text-gray-600"> · {formatDateTime(a.created_at)}</span>
            </li>
          ))}
        </ul>
        {isParty && ['pending', 'in_progress'].includes(c.status) && <AttachmentUploader connectionId={c.id} kind="proposal" />}
        {isCompanyOwner && ['in_progress', 'completed'].includes(c.status) && <AttachmentUploader connectionId={c.id} kind="deliverable" />}
      </section>

      {contacts.length > 0 && (
        <section>
          <h2 className="mb-2 font-semibold">Liên hệ đối tác (duy trì kết nối qua kênh ngoài)</h2>
          <ul className="text-sm">
            {contacts.map((ct) => (
              <li key={ct.profile_id}>
                {isCompanyOwner ? nameOf.get(ct.profile_id) : company?.name}:{' '}
                {[ct.email, ct.phone, ct.zalo && `Zalo ${ct.zalo}`, ct.other_url].filter(Boolean).join(' · ')}
              </li>
            ))}
          </ul>
        </section>
      )}

      {isRecipient && (
        <Card>
          <h2 className="mb-2 font-semibold">Phản hồi yêu cầu</h2>
          <ActionForm action={respondConnectionAction} submitLabel="Gửi phản hồi">
            <input type="hidden" name="id" value={c.id} />
            <fieldset className="flex gap-4 text-sm">
              <legend className="sr-only">Quyết định</legend>
              <label><input type="radio" name="decision" value="accept" /> Đồng ý</label>
              <label><input type="radio" name="decision" value="reject" /> Từ chối</label>
            </fieldset>
            <Field label="Nội dung gửi kèm (tối đa 3000 ký tự)" name="message" textarea />
          </ActionForm>
        </Card>
      )}

      {isCompanyOwner && c.status === 'in_progress' && (
        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <h2 className="mb-2 font-semibold">Hoàn thành kết nối</h2>
            <ActionForm action={endConnectionAction} submitLabel="Hoàn thành">
              <input type="hidden" name="id" value={c.id} /><input type="hidden" name="outcome" value="completed" />
              <Field label="Mức độ hài lòng (1–5)" name="rating" type="number" min={1} max={5} required />
              <Field label="Nhận xét" name="feedback" textarea />
              <Field label="Liên kết sản phẩm bàn giao" name="deliverableUrl" type="url" placeholder="https://" />
            </ActionForm>
          </Card>
          <Card>
            <h2 className="mb-2 font-semibold">Dừng kết nối</h2>
            <ActionForm action={endConnectionAction} submitLabel="Hủy kết nối" danger>
              <input type="hidden" name="id" value={c.id} /><input type="hidden" name="outcome" value="cancelled" />
              <Field label="Lý do dừng" name="reason" textarea required />
            </ActionForm>
          </Card>
          <Card>
            <h2 className="mb-2 font-semibold">Gia hạn thời gian thực hiện</h2>
            <p className="mb-2 text-sm text-gray-600">Hạn hiện tại: {formatDate(c.expected_end_at)}</p>
            <ActionForm action={extendConnectionAction} submitLabel="Gia hạn">
              <input type="hidden" name="id" value={c.id} />
              <Field label="Hạn mới" name="newEnd" type="date" required />
              <Field label="Lý do gia hạn" name="reason" textarea />
            </ActionForm>
          </Card>
        </div>
      )}

      {c.connection_extensions.length > 0 && (
        <section>
          <h2 className="mb-1 font-semibold">Lịch sử gia hạn</h2>
          <ul className="text-sm">{c.connection_extensions.map((e) => <li key={e.id}>{formatDate(e.previous_end_at)} → {formatDate(e.new_end_at)} {e.reason && `(${e.reason})`}</li>)}</ul>
        </section>
      )}
    </div>
  );
}
