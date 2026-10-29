-- =====================================================================================
-- UIT CONNECT — Storage cho tệp đính kèm kết nối (Chặng 2.7)
-- Bucket riêng tư `connection-attachments`; bảng connection_attachments chỉ lưu đường dẫn.
-- Quy ước đường dẫn: {connectionId}/{uuid}-{tên tệp đã làm sạch}
-- Trần 20 MB (20971520 byte) khớp CHECK của connection_attachments và khóa max_attachment_mb.
-- Luồng: RPC tạo yêu cầu -> tải tệp lên bucket -> insert connection_attachments (policy ca_insert).
-- =====================================================================================

insert into storage.buckets (id, name, public, file_size_limit)
values ('connection-attachments', 'connection-attachments', false, 20971520)
on conflict (id) do nothing;

-- Thư mục đầu tiên của đường dẫn là id kết nối; chỉ ai thấy được kết nối
-- (RLS cr_read của connection_requests) mới đọc / ghi được tệp.
drop policy if exists att_storage_read   on storage.objects;
drop policy if exists att_storage_insert on storage.objects;
drop policy if exists att_storage_delete on storage.objects;

create policy att_storage_read on storage.objects for select to authenticated
  using (bucket_id = 'connection-attachments'
         and exists (select 1 from public.connection_requests cr
                      where cr.id::text = (storage.foldername(name))[1]));

create policy att_storage_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'connection-attachments'
              and exists (select 1 from public.connection_requests cr
                           where cr.id::text = (storage.foldername(name))[1]));

create policy att_storage_delete on storage.objects for delete to authenticated
  using (bucket_id = 'connection-attachments' and owner_id = (select auth.uid())::text);
