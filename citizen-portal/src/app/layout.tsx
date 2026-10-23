import type { Metadata } from 'next';
import './globals.css';
import CitizenHeader from '@/components/layout/CitizenHeader';

export const metadata: Metadata = {
  title: 'ResQGrid — Citizen & Volunteer Relief Portal',
  description: 'Intelligent Emergency Relief Intake & Real-Time Stock Allocation Tracker',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="h-full bg-slate-50 antialiased">
      <body className="min-h-full flex flex-col font-sans bg-slate-50 text-slate-900">
        <CitizenHeader />

        <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 py-6 sm:py-8">
          {children}
        </main>

        <footer className="border-t border-slate-200/90 bg-white py-4 text-center text-xs text-slate-500">
          <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-2">
            <span className="font-medium text-slate-600">
              ResQGrid • Public Disaster Intake & Real-Time Tracking
            </span>
            <span className="text-slate-400">
              Emergency Coordination Platform • 24-Hour Hackathon Demo
            </span>
          </div>
        </footer>
      </body>
    </html>
  );
}
