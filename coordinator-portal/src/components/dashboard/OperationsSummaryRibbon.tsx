'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { 
  Activity, 
  Flame, 
  ShieldAlert 
} from 'lucide-react';
import { ReliefRequest, ReliefDepot } from '@/lib/types';

interface OperationsSummaryRibbonProps {
  requests: ReliefRequest[];
  depots: ReliefDepot[];
  onSelectPendingVerification?: () => void;
}

export default function OperationsSummaryRibbon({
  requests,
  depots,
  onSelectPendingVerification,
}: OperationsSummaryRibbonProps) {
  const activeCount = requests.length;
  const criticalCount = requests.filter((r) => r.priorityScore >= 85).length;
  const pendingVerificationCount = requests.filter((r) => r.verificationStatus === 'pending').length;

  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
      {/* 1. Active Requests */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.05 }}
        className="bg-white border border-slate-200/90 rounded-2xl p-4 shadow-xs flex flex-col justify-between"
      >
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
            Active Requests
          </span>
          <span className="w-8 h-8 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
            <Activity className="w-4 h-4" />
          </span>
        </div>
        <div className="mt-2 flex items-baseline justify-between">
          <span className="text-3xl font-extrabold text-slate-900 font-mono tracking-tight">
            {activeCount}
          </span>
          <span className="text-[11px] font-semibold text-blue-700 bg-blue-50 px-2 py-0.5 rounded-full border border-blue-200/60">
            100% Tracked
          </span>
        </div>
        <p className="text-[11px] text-slate-500 mt-1">
          Sector 4 Flash Flood Operations Area
        </p>
      </motion.div>

      {/* 2. Critical Needs */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="bg-white border border-slate-200/90 rounded-2xl p-4 shadow-xs flex flex-col justify-between"
      >
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
            Critical Triage (&ge;85)
          </span>
          <span className="w-8 h-8 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center">
            <Flame className="w-4 h-4" />
          </span>
        </div>
        <div className="mt-2 flex items-baseline justify-between">
          <div className="flex items-center space-x-2">
            <span className="text-3xl font-extrabold text-rose-600 font-mono tracking-tight">
              {criticalCount}
            </span>
            <span className="w-2 h-2 rounded-full bg-rose-600 animate-pulse" />
          </div>
          <span className="text-[11px] font-bold text-rose-700 bg-rose-50 px-2 py-0.5 rounded-full border border-rose-200">
            Immediate Response
          </span>
        </div>
        <p className="text-[11px] text-slate-500 mt-1">
          Threat to human health/life within 6-12h
        </p>
      </motion.div>

      {/* 3. Pending Verification */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.15 }}
        onClick={onSelectPendingVerification}
        className={`bg-white border rounded-2xl p-4 shadow-xs flex flex-col justify-between transition-all ${
          onSelectPendingVerification 
            ? 'cursor-pointer hover:border-amber-400 hover:shadow-sm hover:bg-amber-50/20 border-slate-200/90' 
            : 'border-slate-200/90'
        }`}
      >
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
            Pending Verification
          </span>
          <span className="w-8 h-8 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
            <ShieldAlert className="w-4 h-4" />
          </span>
        </div>
        <div className="mt-2 flex items-baseline justify-between">
          <span className="text-3xl font-extrabold text-amber-600 font-mono tracking-tight">
            {pendingVerificationCount}
          </span>
          <span className="text-[11px] font-semibold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200">
            {pendingVerificationCount > 0 ? 'Review Needed' : 'All Clear'}
          </span>
        </div>
        <p className="text-[11px] text-slate-500 mt-1">
          Awaiting field volunteer authentication &rarr;
        </p>
      </motion.div>
    </div>
  );
}
