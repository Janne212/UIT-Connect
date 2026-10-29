import Link from 'next/link';

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="mx-auto w-full max-w-md px-4 py-10">
      <Link href="/" className="mb-6 block text-lg font-bold">UIT Connect</Link>
      {children}
    </main>
  );
}
