import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'UIT Connect',
  description: 'Cổng kết nối doanh nghiệp với sinh viên UIT',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="vi" className="h-full antialiased">
      <body className="flex min-h-full flex-col">{children}</body>
    </html>
  );
}
