'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { HeartHandshake, Search, PlusCircle, AlertTriangle } from 'lucide-react';

export default function CitizenHeader() {
  const pathname = usePathname();

  const isSubmitActive = pathname === '/' || pathname === '/submit';
  const isTrackActive = pathname.startsWith('/track');

  return (
    <header className="border-b border-slate-200 bg-white sticky top-0 z-50 shadow-xs">
      {/* Emergency Advisory Top Ribbon */}
      <div className="bg-amber-500/10 border-b border-amber-200/80 px-4 py-1.5 text-xs text-amber-900 font-medium flex items-center justify-between">
        <div className="max-w-7xl mx-auto w-full flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <span className="flex h-2 w-2 rounded-full bg-amber-500 animate-pulse" />
            <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
            <span>
              <strong>Active Incident:</strong> Sector 4 Flash Flood & Evacuation Order In Effect. All relief requests are automatically prioritized.
            </span>
          </div>
          <div className="flex items-center gap-2 text-xs text-amber-800">
            <span>Life Threat? Call Local 911 / 112 immediately</span>
          </div>
        </div>
      </div>

      {/* Main Navigation Bar */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        <div className="flex items-center justify-between h-16">
          {/* Logo & Platform Badge */}
          <div className="flex items-center gap-3">
            <Link href="/" className="flex items-center gap-2.5 group">
              <div className="h-10 w-10 rounded-xl bg-blue-600 flex items-center justify-center text-white shadow-xs group-hover:bg-blue-700 transition-colors">
                <HeartHandshake className="w-5 h-5" />
              </div>
              <div className="flex flex-col">
                <div className="flex items-center gap-2">
                  <span className="text-xl font-bold tracking-tight text-slate-900">
                    ResQ<span className="text-blue-600">Grid</span>
                  </span>
                  <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200">
                    Citizen Portal
                  </span>
                </div>
                <span className="text-xs text-slate-500 font-medium -mt-0.5 hidden sm:inline">
                  Intelligent Emergency Relief Intake & Live Tracker
                </span>
              </div>
            </Link>
          </div>

          {/* Navigation Links */}
          <nav className="flex items-center gap-1.5 sm:gap-2">
            <Link
              href="/"
              className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-sm font-semibold transition-colors ${
                isSubmitActive
                  ? 'bg-blue-50 text-blue-700 border border-blue-200/80 shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              <PlusCircle className="w-4 h-4 text-blue-600" />
              <span>Submit Request</span>
            </Link>

            <Link
              href="/track"
              className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-sm font-semibold transition-colors ${
                isTrackActive
                  ? 'bg-blue-50 text-blue-700 border border-blue-200/80 shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              <Search className="w-4 h-4 text-emerald-600" />
              <span>Track Request</span>
            </Link>
          </nav>
        </div>
      </div>
    </header>
  );
}
