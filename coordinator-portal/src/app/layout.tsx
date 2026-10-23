import type { Metadata } from 'next';
import './globals.css';
import CoordinatorHeader from '@/components/layout/CoordinatorHeader';

export const metadata: Metadata = {
  title: 'ResQGrid — Emergency Command Center',
  description: 'Intelligent Emergency Relief Coordination Platform',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="h-full bg-slate-50 antialiased">
      <body className="min-h-full flex flex-col font-sans bg-slate-50 text-slate-900">
        <CoordinatorHeader />

        <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 py-5">
          {children}
        </main>

        <footer className="border-t border-slate-200/90 bg-white py-3 text-center text-xs text-slate-500">
          <div className="max-w-7xl mx-auto px-4 flex items-center justify-center">
            <span className="font-medium text-slate-600">
              ResQGrid Command Console • Intelligent Relief Coordination
            </span>
          </div>
        </footer>
      </body>
    </html>
  );
}
