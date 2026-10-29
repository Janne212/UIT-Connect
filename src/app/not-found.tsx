import Link from 'next/link';

// RLS trả 0 dòng (không có quyền) cũng về đây, nên không lộ việc bản ghi có tồn tại hay không
export default function NotFound() {
  return (
    <main className="mx-auto max-w-md p-10 text-center">
      <h1 className="text-xl font-semibold">Không tìm thấy trang</h1>
      <p className="my-3 text-sm text-gray-600">Nội dung không tồn tại hoặc bạn không có quyền xem.</p>
      <Link href="/dashboard" className="underline">Về trang chủ</Link>
    </main>
  );
}
