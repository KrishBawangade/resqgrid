'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { INITIAL_AUDIT_LOGS } from '@/lib/data/initialScenario';
import { AuditLogEntry } from '@/lib/types';
import { 
  FileText, 
  Filter, 
  ShieldAlert, 
  Boxes, 
  Truck, 
  CheckCircle2, 
  RefreshCw
} from 'lucide-react';

export default function CoordinatorAuditPage() {
  const [logs, setLogs] = useState<AuditLogEntry[]>(INITIAL_AUDIT_LOGS);
  const [filterCategory, setFilterCategory] = useState<string>('ALL');
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSyncTime, setLastSyncTime] = useState<Date | null>(null);

  const fetchAuditLogs = useCallback(async (isManual = false) => {
    if (isManual) setIsSyncing(true);
    try {
      const res = await fetch('/api/audit', { cache: 'no-store' });
      if (res.ok) {
        const data: AuditLogEntry[] = await res.json();
        if (Array.isArray(data) && data.length > 0) {
          setLogs(data);
        }
      }
      setLastSyncTime(new Date());
    } catch (err) {
      console.warn('Failed to fetch audit logs:', err);
    } finally {
      if (isManual) setIsSyncing(false);
    }
  }, []);

  useEffect(() => {
    fetchAuditLogs();

    let eventSource: EventSource | null = null;
    try {
      eventSource = new EventSource('/api/requests/stream');
      eventSource.onmessage = (event) => {
        if (!event.data) return;
        try {
          const payload = JSON.parse(event.data);
          if (payload.type === 'AUDIT_LOG_ADDED' && payload.data) {
            const entry = payload.data as AuditLogEntry;
            setLogs((prev) => [entry, ...prev.filter((l) => l.id !== entry.id)]);
            setLastSyncTime(new Date());
          }
        } catch {}
      };
    } catch (err) {
      console.warn('SSE connection failed in audit:', err);
    }

    let channel: BroadcastChannel | null = null;
    if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
      try {
        channel = new BroadcastChannel('resqgrid_realtime');
        channel.onmessage = (event) => {
          if (event.data?.type === 'AUDIT_LOG_ADDED' && event.data?.data) {
            const entry = event.data.data as AuditLogEntry;
            setLogs((prev) => [entry, ...prev.filter((l) => l.id !== entry.id)]);
          }
        };
      } catch {}
    }

    return () => {
      if (eventSource) eventSource.close();
      if (channel) channel.close();
    };
  }, [fetchAuditLogs]);

  const filtered = logs.filter((l) => {
    if (filterCategory === 'ALL') return true;
    return l.category === filterCategory;
  });

  const getCategoryBadge = (cat: string) => {
    switch (cat) {
      case 'OVERRIDE':
        return (
          <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-50 text-purple-700 border border-purple-200">
            <ShieldAlert className="w-3 h-3 text-purple-600" />
            <span>Priority Override</span>
          </span>
        );
      case 'ALLOCATION':
        return (
          <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
            <Boxes className="w-3 h-3 text-amber-600" />
            <span>Stock Allocation</span>
          </span>
        );
      case 'REPLENISHMENT':
        return (
          <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200">
            <Truck className="w-3 h-3 text-blue-600" />
            <span>Replenishment</span>
          </span>
        );
      case 'VERIFICATION':
        return (
          <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
            <CheckCircle2 className="w-3 h-3 text-emerald-600" />
            <span>Verification</span>
          </span>
        );
      default:
        return (
          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-700">
            {cat}
          </span>
        );
    }
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-extrabold text-slate-900 tracking-tight flex items-center space-x-2">
            <FileText className="w-5 h-5 text-blue-600" />
            <span>Operational Audit Trail & Override Ledger</span>
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Append-only, permanent log of all coordinator priority overrides, stock reservations, and supplier receipts.
          </p>
        </div>

        <div className="flex items-center space-x-2">
          <button
            onClick={() => fetchAuditLogs(true)}
            disabled={isSyncing}
            className="px-3 py-1.5 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 rounded-xl text-xs font-semibold transition-all shadow-2xs flex items-center space-x-1.5 cursor-pointer disabled:opacity-50"
            title="Reload from Neon DB"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-slate-500 ${isSyncing ? 'animate-spin text-blue-600' : ''}`} />
            <span>{isSyncing ? 'Syncing...' : 'Sync'}</span>
          </button>

          {/* Filter Category */}
          <div className="flex items-center space-x-1 bg-white border border-slate-200 rounded-xl px-2.5 py-1.5 shadow-2xs text-xs">
            <Filter className="w-3.5 h-3.5 text-slate-400" />
            <select
              value={filterCategory}
              onChange={(e) => setFilterCategory(e.target.value)}
              className="bg-transparent text-slate-700 font-semibold focus:outline-none cursor-pointer"
            >
              <option value="ALL">All Event Types</option>
              <option value="OVERRIDE">Priority Overrides</option>
              <option value="ALLOCATION">Stock Allocations</option>
              <option value="REPLENISHMENT">Replenishment</option>
              <option value="VERIFICATION">Verification</option>
            </select>
          </div>
        </div>
      </div>

      <div className="text-[11px] text-slate-500 font-mono px-1 flex items-center justify-between">
        <span>Append-Only Ledger • Real-time event streaming</span>
        <span>Last updated: {lastSyncTime ? lastSyncTime.toLocaleTimeString() : 'Connecting...'}</span>
      </div>

      {/* Audit Table */}
      <div className="bg-white border border-slate-200/90 rounded-2xl p-5 shadow-xs space-y-3">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="text-[10px] uppercase tracking-wider text-slate-500 bg-slate-50/80 border-b border-slate-100">
              <tr>
                <th className="py-2.5 px-3 font-bold">Audit ID</th>
                <th className="py-2.5 px-3 font-bold">Timestamp</th>
                <th className="py-2.5 px-3 font-bold">Category</th>
                <th className="py-2.5 px-3 font-bold">Actor</th>
                <th className="py-2.5 px-3 font-bold">Transaction / Justification Details</th>
                <th className="py-2.5 px-3 font-bold text-right">Inventory Delta</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-sans">
              {filtered.map((item) => (
                <tr key={item.id} className="hover:bg-slate-50/80 transition-colors">
                  <td className="py-3 px-3 font-mono font-bold text-blue-600 text-[11px]">
                    {item.id}
                  </td>

                  <td className="py-3 px-3 font-mono text-[11px] text-slate-500">
                    {item.timestamp}
                  </td>

                  <td className="py-3 px-3">
                    {getCategoryBadge(item.category)}
                  </td>

                  <td className="py-3 px-3 font-semibold text-slate-800">
                    {item.actor}
                  </td>

                  <td className="py-3 px-3 text-slate-700 max-w-md text-xs leading-relaxed">
                    {item.details}
                  </td>

                  <td className="py-3 px-3 text-right font-mono text-[11px]">
                    {item.delta ? (
                      <span className={`font-bold px-2 py-0.5 rounded-full ${
                        item.delta.startsWith('+')
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                          : 'bg-amber-50 text-amber-700 border border-amber-200'
                      }`}>
                        {item.delta}
                      </span>
                    ) : (
                      <span className="text-slate-300">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
