'use client';

import React from 'react';
import { 
  AlertCircle, 
  MapPin, 
  Users, 
  Warehouse, 
  Clock, 
  ShieldAlert 
} from 'lucide-react';

export default function IncidentBriefingBanner() {
  return (
    <div className="bg-white border border-slate-200/90 rounded-2xl p-4 shadow-xs space-y-2.5">
      {/* Top Meta Row */}
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
        <div className="flex items-center space-x-2">
          <span className="inline-flex items-center space-x-1.5 px-2.5 py-0.5 rounded-full bg-rose-50 text-rose-700 border border-rose-200 text-[10px] font-bold uppercase tracking-wider">
            <span className="w-1.5 h-1.5 rounded-full bg-rose-600 animate-pulse" />
            <span>Active Operation</span>
          </span>
          <span className="font-mono text-slate-400 font-bold text-[11px]">
            INC-2026-FL04
          </span>
        </div>

        <div className="flex items-center space-x-3 text-[11px] text-slate-500 font-medium">
          <span className="flex items-center space-x-1">
            <ShieldAlert className="w-3.5 h-3.5 text-amber-600" />
            <span>Severity: <strong>Level 3 Emergency</strong></span>
          </span>
          <span className="text-slate-300">•</span>
          <span className="flex items-center space-x-1">
            <Clock className="w-3.5 h-3.5 text-slate-400" />
            <span>Activated: <strong>06:00 UTC (Hour 14)</strong></span>
          </span>
        </div>
      </div>

      {/* Title & Tactical Briefing */}
      <div>
        <h1 className="text-lg font-extrabold text-slate-900 tracking-tight">
          Operation River Surge — Sector 4 Flash Flood Relief
        </h1>
        <p className="text-xs text-slate-600 mt-1 leading-relaxed">
          Severe riverbank embankment breach in East Basin causing sudden ground inundation. 4 sectors affected with drinking water contamination and clinic supply depletion. Ground transport to Sector 4 restricted to boat transit.
        </p>
      </div>

      {/* Quick Status Chips */}
      <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-slate-100 text-[11px]">
        <div className="flex items-center space-x-1 text-slate-600 bg-slate-50 px-2 py-0.5 rounded-md border border-slate-200/60 font-medium">
          <MapPin className="w-3 h-3 text-slate-400" />
          <span>Riverside Basin & North Corridor</span>
        </div>

        <div className="flex items-center space-x-1 text-slate-600 bg-slate-50 px-2 py-0.5 rounded-md border border-slate-200/60 font-medium">
          <Users className="w-3 h-3 text-slate-400" />
          <span>315 Direct Population Affected</span>
        </div>

        <div className="flex items-center space-x-1 text-slate-600 bg-slate-50 px-2 py-0.5 rounded-md border border-slate-200/60 font-medium">
          <Warehouse className="w-3 h-3 text-slate-400" />
          <span>2 Depots Mobilized (Alpha & Beta)</span>
        </div>
      </div>
    </div>
  );
}
