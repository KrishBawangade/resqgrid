'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { 
  Activity, 
  Flame, 
  ShieldAlert,
  CheckCircle2,
  Info
} from 'lucide-react';
import { ReliefRequest, ReliefDepot } from '@/lib/types';

interface OperationsSummaryRibbonProps {
  requests: ReliefRequest[];
  depots: ReliefDepot[];
  onSelectPendingVerification?: () => void;
  onSelectCriticalTriage?: () => void;
  onSelectActiveDemands?: () => void;
}

export default function OperationsSummaryRibbon({
  requests,
  depots,
  onSelectPendingVerification,
  onSelectCriticalTriage,
  onSelectActiveDemands,
}: OperationsSummaryRibbonProps) {
  // 1. ACTIVE REQUESTS: In-flight demands in triage, warehouse staging, or field transit
  // Explicitly excludes completed (delivered) and closed (rejected) demands
  const activeRequests = requests.filter(
    (r) => r.requestStatus !== 'delivered' && r.requestStatus !== 'rejected'
  );
  const activeCount = activeRequests.length;
  const deliveredCount = requests.filter((r) => r.requestStatus === 'delivered').length;
  const inTransitCount = requests.filter((r) => r.requestStatus === 'dispatched').length;
  const stagedCount = requests.filter(
    (r) => r.requestStatus === 'fully_allocated' || r.requestStatus === 'partially_allocated'
  ).length;
  const triageCount = requests.filter(
    (r) => r.requestStatus === 'submitted' || r.requestStatus === 'queued' || r.requestStatus === 'verified'
  ).length;

  // 2. CRITICAL TRIAGE (≥85): ONLY acute threats that ARE NOT YET FULLY ALLOCATED
  // Must have unfulfilled quantity > 0 and be active (not delivered, dispatched, or rejected)
  const criticalUnallocated = requests.filter(
    (r) =>
      r.priorityScore >= 85 &&
      r.unfulfilledQty > 0 &&
      r.requestStatus !== 'fully_allocated' &&
      r.requestStatus !== 'dispatched' &&
      r.requestStatus !== 'delivered' &&
      r.requestStatus !== 'rejected'
  );
  const criticalCount = criticalUnallocated.length;

  // 3. PENDING VERIFICATION: Active requests awaiting field volunteer/coordinator authentication
  // Excludes closed/rejected requests, staged, in-transit, and completed field deliveries
  const pendingVerificationRequests = requests.filter(
    (r) =>
      r.verificationStatus === 'pending' &&
      r.requestStatus !== 'rejected' &&
      r.requestStatus !== 'fully_allocated' &&
      r.requestStatus !== 'dispatched' &&
      r.requestStatus !== 'delivered'
  );
  const pendingVerificationCount = pendingVerificationRequests.length;

  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
      {/* 1. Active Requests / Demands */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.05 }}
        onClick={onSelectActiveDemands}
        className={`bg-white border rounded-2xl p-4 shadow-xs flex flex-col justify-between transition-all ${
          onSelectActiveDemands
            ? 'cursor-pointer hover:border-blue-400 hover:shadow-xs hover:bg-blue-50/10 border-slate-200/90'
            : 'border-slate-200/90'
        }`}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-1.5">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
              Active Demands
            </span>
            <span
              className="text-slate-400 cursor-help"
              title="Active demands = In-flight requests currently being triaged, staged in depots, or en route in field transit corridors (excludes 100% fulfilled deliveries and rejected claims)."
            >
              <Info className="w-3 h-3 text-slate-400 hover:text-slate-600 transition-colors" />
            </span>
          </div>
          <span className="w-8 h-8 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
            <Activity className="w-4 h-4" />
          </span>
        </div>

        <div className="mt-2 flex items-baseline justify-between">
          <div className="flex items-baseline space-x-1.5">
            <span className="text-3xl font-extrabold text-slate-900 font-mono tracking-tight">
              {activeCount}
            </span>
            <span className="text-xs text-slate-500 font-medium">in-flight</span>
          </div>
          <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full border ${
            activeCount > 0
              ? 'text-blue-700 bg-blue-50 border-blue-200/70'
              : 'text-emerald-700 bg-emerald-50 border-emerald-200/70'
          }`}>
            {activeCount > 0 ? `${activeCount} In Pipeline` : 'All Demands Fulfilled'}
          </span>
        </div>

        <div className="mt-1 pt-1 border-t border-slate-100 flex flex-col space-y-0.5">
          <p className="text-[10.5px] text-slate-500 font-medium">
            Active in-flight lifecycle (excludes fulfilled & closed)
          </p>
          <div className="flex items-center space-x-1.5 text-[10px] font-mono text-slate-400">
            <span>{triageCount} triage</span>
            <span>•</span>
            <span>{stagedCount} staged</span>
            <span>•</span>
            <span>{inTransitCount} transit</span>
            <span>•</span>
            <span className="text-emerald-600 font-semibold">{deliveredCount} fulfilled</span>
          </div>
        </div>
      </motion.div>

      {/* 2. Critical Needs (Only Unallocated!) */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        onClick={onSelectCriticalTriage}
        className={`bg-white border rounded-2xl p-4 shadow-xs flex flex-col justify-between transition-all ${
          onSelectCriticalTriage
            ? 'cursor-pointer hover:border-rose-400 hover:shadow-xs hover:bg-rose-50/10 border-slate-200/90'
            : 'border-slate-200/90'
        }`}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-1.5">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
              Critical Triage (&ge;85)
            </span>
            <span
              className="text-slate-400 cursor-help"
              title="Acute threats to life (Priority Score ≥85) that have NOT yet been allocated warehouse stock."
            >
              <Info className="w-3 h-3 text-slate-400 hover:text-slate-600 transition-colors" />
            </span>
          </div>
          <span className={`w-8 h-8 rounded-xl flex items-center justify-center ${
            criticalCount > 0 ? 'bg-rose-50 text-rose-600' : 'bg-emerald-50 text-emerald-600'
          }`}>
            <Flame className="w-4 h-4" />
          </span>
        </div>

        <div className="mt-2 flex items-baseline justify-between">
          <div className="flex items-center space-x-2">
            <span className={`text-3xl font-extrabold font-mono tracking-tight ${
              criticalCount > 0 ? 'text-rose-600' : 'text-slate-900'
            }`}>
              {criticalCount}
            </span>
            {criticalCount > 0 ? (
              <span className="w-2.5 h-2.5 rounded-full bg-rose-600 animate-pulse" />
            ) : (
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            )}
          </div>
          <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full border ${
            criticalCount > 0
              ? 'text-rose-700 bg-rose-50 border-rose-200 animate-pulse'
              : 'text-emerald-700 bg-emerald-50 border-emerald-200'
          }`}>
            {criticalCount > 0 ? 'Immediate Allocation' : 'All Critical Staged'}
          </span>
        </div>

        <div className="mt-1 pt-1 border-t border-slate-100 flex flex-col space-y-0.5">
          <p className="text-[10.5px] text-slate-500 font-medium">
            {criticalCount > 0
              ? 'Unallocated acute life threats awaiting depot stock'
              : 'All critical demands (≥85) allocated or delivered ✓'}
          </p>
          <div className="flex items-center space-x-1.5 text-[10px] font-mono text-slate-400">
            <span>
              {criticalCount > 0
                ? `${criticalCount} urgent need awaiting coordinator staging`
                : 'Zero unallocated critical bottlenecks in queue'}
            </span>
          </div>
        </div>
      </motion.div>

      {/* 3. Pending Verification */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.15 }}
        onClick={onSelectPendingVerification}
        className={`bg-white border rounded-2xl p-4 shadow-xs flex flex-col justify-between transition-all ${
          onSelectPendingVerification 
            ? 'cursor-pointer hover:border-amber-400 hover:shadow-xs hover:bg-amber-50/20 border-slate-200/90' 
            : 'border-slate-200/90'
        }`}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-1.5">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
              Pending Verification
            </span>
            <span
              className="text-slate-400 cursor-help"
              title="Active intake demands awaiting verification by field volunteers or incident coordinators before staging."
            >
              <Info className="w-3 h-3 text-slate-400 hover:text-slate-600 transition-colors" />
            </span>
          </div>
          <span className={`w-8 h-8 rounded-xl flex items-center justify-center ${
            pendingVerificationCount > 0 ? 'bg-amber-50 text-amber-600' : 'bg-emerald-50 text-emerald-600'
          }`}>
            <ShieldAlert className="w-4 h-4" />
          </span>
        </div>

        <div className="mt-2 flex items-baseline justify-between">
          <span className={`text-3xl font-extrabold font-mono tracking-tight ${
            pendingVerificationCount > 0 ? 'text-amber-600' : 'text-slate-900'
          }`}>
            {pendingVerificationCount}
          </span>
          <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full border ${
            pendingVerificationCount > 0
              ? 'text-amber-700 bg-amber-50 border-amber-200'
              : 'text-emerald-700 bg-emerald-50 border-emerald-200'
          }`}>
            {pendingVerificationCount > 0 ? 'Review Needed' : 'All Verified'}
          </span>
        </div>

        <div className="mt-1 pt-1 border-t border-slate-100 flex flex-col space-y-0.5">
          <p className="text-[10.5px] text-slate-500 font-medium">
            {pendingVerificationCount > 0
              ? 'Awaiting field volunteer authentication →'
              : 'All active incident demands authenticated ✓'}
          </p>
          <div className="flex items-center space-x-1.5 text-[10px] font-mono text-slate-400">
            <span>
              {pendingVerificationCount > 0
                ? `${pendingVerificationCount} unverified intake in active queue`
                : '100% verified field intake pipeline'}
            </span>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
