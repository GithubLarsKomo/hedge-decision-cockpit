import './globals.css';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'NASDAQ Hedge Decision Cockpit',
  description: 'Decision dashboard for a NASDAQ tail-risk hedge program'
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="de">
      <body className="min-h-screen text-slate-900">{children}</body>
    </html>
  );
}
