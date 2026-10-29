import Link from 'next/link';

// Trang giới thiệu cho khách (chưa đăng nhập). Người đã đăng nhập được proxy.ts chuyển tới /dashboard.
// Nội dung tĩnh, nhóm frontend thay bằng trang giới thiệu theo thiết kế Stitch.
export default function GuestHome() {
  return (
    <main className="mx-auto max-w-3xl space-y-6 px-4 py-16">
      <h1 className="text-3xl font-bold">UIT Connect</h1>
      <p className="text-gray-700">
        Cổng kết nối doanh nghiệp với sinh viên UIT: nhóm sinh viên đăng project, product, paper; doanh nghiệp đăng
        bài toán thực tế; hai bên gửi yêu cầu kết nối và theo dõi hợp tác; giảng viên kiểm duyệt nội dung.
      </p>
      <div className="flex gap-3">
        <Link href="/login" className="rounded bg-blue-700 px-4 py-2 text-white">Đăng nhập</Link>
        <Link href="/register" className="rounded border px-4 py-2">Đăng ký</Link>
      </div>
    </main>
  );
}
