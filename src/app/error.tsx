'use client';

// Lỗi chung khi trang ném lỗi; không hiển thị chi tiết lỗi nội bộ
export default function ErrorPage({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main className="mx-auto max-w-md p-10 text-center">
      <h1 className="text-xl font-semibold">Có lỗi xảy ra</h1>
      <p className="my-3 text-sm text-gray-600">Vui lòng thử lại sau ít phút.</p>
      <button onClick={reset} className="rounded border px-4 py-2 text-sm">Thử lại</button>
    </main>
  );
}
