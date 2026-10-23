'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { 
  Radio, 
  Layers, 
  Boxes, 
  FileText, 
  ExternalLink,
  ShieldCheck,
  UserCheck
} from 'lucide-react';

export default function CoordinatorHeader() {
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-40 bg-white/90 backdrop-blur-md border-b border-slate-200/80 shadow-2xs">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-2.5 flex items-center justify-between">
        {/* Brand & Incident Ticker */}
        <div className="flex items-center space-x-3.5">
          <Link href="/" className="flex items-center space-x-2.5 group">
            <div className="w-8 h-8 rounded-xl bg-blue-600 text-white flex items-center justify-center font-extrabold text-base shadow-sm group-hover:bg-blue-700 transition-colors">
              Q
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="font-extrabold text-base tracking-tight text-slate-900">
                  ResQGrid
                </span>
                <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200/60 font-mono">
                  Command Console
                </span>
              </div>
            </div>
          </Link>
        </div>

        {/* Tactical Navigation Tabs */}
        <nav className="flex items-center space-x-1 text-xs font-semibold">
          <Link
            href="/"
            className={`px-3 py-1.5 rounded-lg transition-colors flex items-center space-x-1.5 ${
              pathname === '/'
                ? 'bg-slate-100 text-slate-900 font-bold'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
            }`}
          >
            <Radio className="w-3.5 h-3.5 text-blue-600" />
            <span>Operations & Triage</span>
          </Link>

          <Link
            href="/inventory"
            className={`px-3 py-1.5 rounded-lg transition-colors flex items-center space-x-1.5 ${
              pathname === '/inventory'
                ? 'bg-slate-100 text-slate-900 font-bold'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
            }`}
          >
            <Boxes className="w-3.5 h-3.5 text-amber-600" />
            <span>Depot Inventory</span>
            <span className="text-[9px] px-1.5 py-0.2 rounded-full bg-amber-100 text-amber-800 font-bold border border-amber-200">
              Shortage
            </span>
          </Link>

          <Link
            href="/audit"
            className={`px-3 py-1.5 rounded-lg transition-colors flex items-center space-x-1.5 ${
              pathname === '/audit'
                ? 'bg-slate-100 text-slate-900 font-bold'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
            }`}
          >
            <FileText className="w-3.5 h-3.5 text-slate-500" />
            <span>Audit Trail</span>
          </Link>

          <span className="text-slate-200 px-1">|</span>

          {/* User Badge */}
          <div className="flex items-center space-x-1.5 pl-1 text-[11px] text-slate-600">
            <span className="w-6 h-6 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center font-bold text-slate-700 text-[10px]">
              V
            </span>
            <span className="hidden md:inline font-semibold text-slate-800">Coord. Vance</span>
          </div>
        </nav>
      </div>
    </header>
  );
}
