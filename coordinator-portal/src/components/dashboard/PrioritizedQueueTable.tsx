'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ReliefRequest, ResourceType } from '@/lib/types';
import { 
  CheckCircle2, 
  Clock, 
  Droplets,
  HeartPulse,
  Utensils,
  Tent,
  ChevronRight,
  MapPin,
  Users,
  AlertTriangle,
  Hourglass,
  Boxes,
  XCircle,
  RotateCcw,
  X,
  Sparkles,
  Ban,
  Truck
} from 'lucide-react';

export type QueueTabType = 'pending_verification' | 'needs_attention' | 'partially_allocated' | 'fully_allocated' | 'rejected';

interface PrioritizedQueueTableProps {
  requests: ReliefRequest[];
  selectedRequestId: string | null;
  activeTab: QueueTabType;
  isLoading?: boolean;
  onTabChange: (tab: QueueTabType) => void;
  onSelectRequest: (req: ReliefRequest) => void;
  onVerify: (id: string) => void;
  onReject: (id: string, reason: string) => void;
  onRestore: (id: string) => void;
  onAllocate?: (id: string) => void;
  onDispatch?: (id: string) => void;
  onDeliver?: (id: string) => void;
}

export default function PrioritizedQueueTable({
  requests,
  selectedRequestId,
  activeTab,
  isLoading = false,
  onTabChange,
  onSelectRequest,
  onVerify,
  onReject,
  onRestore,
  onAllocate,
  onDispatch,
  onDeliver,
}: PrioritizedQueueTableProps) {
  const [filterResource, setFilterResource] = useState<string>('all');

  // Rejection modal state
  const [rejectModalReq, setRejectModalReq] = useState<ReliefRequest | null>(null);
  const [rejectionReasonInput, setRejectionReasonInput] = useState('');

  const getReqAllocated = (r: ReliefRequest) =>
    r.requestedResources && r.requestedResources.length > 0
      ? r.requestedResources.reduce((acc, item) => acc + item.allocatedQty, 0)
      : r.allocatedQty;

  const getReqUnfulfilled = (r: ReliefRequest) =>
    r.requestedResources && r.requestedResources.length > 0
      ? r.requestedResources.reduce((acc, item) => acc + item.unfulfilledQty, 0)
      : r.unfulfilledQty;

  // Strict, mutually-exclusive tab categorization by lifecycle state
  const isReqFulfilled = (r: ReliefRequest) =>
    r.requestStatus === 'delivered' ||
    r.requestStatus === 'dispatched' ||
    r.requestStatus === 'fully_allocated' ||
    (getReqUnfulfilled(r) === 0 && getReqAllocated(r) > 0);

  const isReqPartial = (r: ReliefRequest) =>
    !isReqFulfilled(r) &&
    (r.requestStatus === 'partially_allocated' || (getReqAllocated(r) > 0 && getReqUnfulfilled(r) > 0));

  const isReqRejected = (r: ReliefRequest) =>
    r.requestStatus === 'rejected' || r.verificationStatus === 'rejected';

  const isReqPendingVerification = (r: ReliefRequest) =>
    !isReqRejected(r) && !isReqFulfilled(r) && (r.verificationStatus === 'pending' || r.verificationStatus === 'flagged');

  // 1. Needs Attention (Active Queue) = ALL active unallocated demands (both verified & unverified) sorted by triage priority
  const needsAttentionList = requests.filter(
    (r) => !isReqRejected(r) && !isReqFulfilled(r) && !isReqPartial(r)
  );

  // 2. Pending Verification = Specifically demands awaiting coordinator/field authentication
  const pendingVerificationList = requests.filter(isReqPendingVerification);

  // 3. Partially Allocated = Demands with partial stock assigned but remaining deficit
  const partiallyAllocatedList = requests.filter(
    (r) => !isReqRejected(r) && isReqPartial(r)
  );

  // 4. Fully Allocated / Fulfilled = 100% stock reserved, in transit, or delivered
  const fullyAllocatedList = requests.filter(
    (r) => !isReqRejected(r) && isReqFulfilled(r)
  );

  // 5. Rejected Demands
  const rejectedList = requests.filter((r) => isReqRejected(r));

  // Current tab items
  const currentTabItems = 
    activeTab === 'pending_verification'
      ? pendingVerificationList
      : activeTab === 'needs_attention' 
      ? needsAttentionList 
      : activeTab === 'partially_allocated' 
      ? partiallyAllocatedList 
      : activeTab === 'fully_allocated'
      ? fullyAllocatedList
      : rejectedList;

  const filtered = currentTabItems
    .filter((r) => {
      if (filterResource === 'all') return true;
      if (r.resourceType === filterResource) return true;
      if (r.requestedResources && r.requestedResources.some((item) => item.resourceType === filterResource)) {
        return true;
      }
      return false;
    })
    .sort((a, b) => b.priorityScore - a.priorityScore);

  const getResourceIcon = (type: ResourceType) => {
    switch (type) {
      case 'drinking_water':
        return <Droplets className="w-4 h-4 text-blue-600" />;
      case 'medical_supplies':
        return <HeartPulse className="w-4 h-4 text-rose-600" />;
      case 'food_rations':
        return <Utensils className="w-4 h-4 text-amber-600" />;
      case 'shelter_kits':
        return <Tent className="w-4 h-4 text-purple-600" />;
    }
  };

  const handleOpenReject = (e: React.MouseEvent, req: ReliefRequest) => {
    e.stopPropagation();
    setRejectModalReq(req);
    setRejectionReasonInput('');
  };

  const handleConfirmReject = (e: React.FormEvent) => {
    e.preventDefault();
    if (!rejectModalReq || !rejectionReasonInput.trim()) return;
    onReject(rejectModalReq.id, rejectionReasonInput.trim());
    setRejectModalReq(null);
  };

  return (
    <div className="bg-white border border-slate-200/90 rounded-2xl p-4 shadow-xs space-y-3 flex flex-col h-[600px] overflow-hidden">
      {/* Top Tabs Wrapping Segmented Control */}
      <div className="pb-3 border-b border-slate-100 flex-shrink-0 space-y-2.5">
        <div className="bg-slate-100/90 p-1.5 rounded-xl flex flex-wrap items-center justify-start gap-1.5 border border-slate-200/70">
          {/* Tab 1: Needs Attention (All Active Unallocated) */}
          <button
            onClick={() => onTabChange('needs_attention')}
            className={`inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors duration-150 cursor-pointer whitespace-nowrap shadow-2xs ${
              activeTab === 'needs_attention'
                ? 'bg-white text-rose-700 border-2 border-rose-500 shadow-xs ring-2 ring-rose-500/15'
                : 'bg-white text-slate-700 hover:text-slate-900 border-2 border-slate-200 hover:border-slate-300 hover:bg-slate-50'
            }`}
            title="All active unallocated demands (both verified and unverified)"
          >
            <AlertTriangle className={`w-3.5 h-3.5 flex-shrink-0 ${activeTab === 'needs_attention' ? 'text-rose-600' : 'text-slate-500'}`} />
            <span>Attention</span>
            <span className={`text-[10px] font-mono px-1.5 py-0.2 rounded-full font-bold border ${
              activeTab === 'needs_attention' 
                ? 'bg-rose-100 text-rose-800 border-rose-200' 
                : 'bg-slate-100 text-slate-700 border-slate-200'
            }`}>
              {needsAttentionList.length}
            </span>
          </button>

          {/* Tab 2: Pending Verification (Specifically Unverified) */}
          <button
            onClick={() => onTabChange('pending_verification')}
            className={`inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors duration-150 cursor-pointer whitespace-nowrap shadow-2xs ${
              activeTab === 'pending_verification'
                ? 'bg-white text-violet-800 border-2 border-violet-500 shadow-xs ring-2 ring-violet-500/15'
                : 'bg-white text-slate-700 hover:text-slate-900 border-2 border-slate-200 hover:border-slate-300 hover:bg-slate-50'
            }`}
            title="Intake demands specifically awaiting coordinator authentication"
          >
            <Clock className={`w-3.5 h-3.5 flex-shrink-0 ${activeTab === 'pending_verification' ? 'text-violet-600' : 'text-slate-500'}`} />
            <span>To Verify</span>
            <span className={`text-[10px] font-mono px-1.5 py-0.2 rounded-full font-bold border ${
              activeTab === 'pending_verification' 
                ? 'bg-violet-100 text-violet-800 border-violet-200' 
                : 'bg-slate-100 text-slate-700 border-slate-200'
            }`}>
              {pendingVerificationList.length}
            </span>
          </button>

          {/* Tab 3: Partially Allocated */}
          <button
            onClick={() => onTabChange('partially_allocated')}
            className={`inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors duration-150 cursor-pointer whitespace-nowrap shadow-2xs ${
              activeTab === 'partially_allocated'
                ? 'bg-white text-amber-800 border-2 border-amber-500 shadow-xs ring-2 ring-amber-500/15'
                : 'bg-white text-slate-700 hover:text-slate-900 border-2 border-slate-200 hover:border-slate-300 hover:bg-slate-50'
            }`}
            title="Demands with remaining unfulfilled deficit"
          >
            <Hourglass className={`w-3.5 h-3.5 flex-shrink-0 ${activeTab === 'partially_allocated' ? 'text-amber-600' : 'text-slate-500'}`} />
            <span>Partial</span>
            <span className={`text-[10px] font-mono px-1.5 py-0.2 rounded-full font-bold border ${
              activeTab === 'partially_allocated' 
                ? 'bg-amber-100 text-amber-800 border-amber-200' 
                : 'bg-slate-100 text-slate-700 border-slate-200'
            }`}>
              {partiallyAllocatedList.length}
            </span>
          </button>

          {/* Tab 4: Fully Allocated */}
          <button
            onClick={() => onTabChange('fully_allocated')}
            className={`inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors duration-150 cursor-pointer whitespace-nowrap shadow-2xs ${
              activeTab === 'fully_allocated'
                ? 'bg-white text-emerald-800 border-2 border-emerald-500 shadow-xs ring-2 ring-emerald-500/15'
                : 'bg-white text-slate-700 hover:text-slate-900 border-2 border-slate-200 hover:border-slate-300 hover:bg-slate-50'
            }`}
            title="100% stock reserved, dispatched, or delivered"
          >
            <CheckCircle2 className={`w-3.5 h-3.5 flex-shrink-0 ${activeTab === 'fully_allocated' ? 'text-emerald-600' : 'text-slate-500'}`} />
            <span>Fulfilled</span>
            <span className={`text-[10px] font-mono px-1.5 py-0.2 rounded-full font-bold border ${
              activeTab === 'fully_allocated' 
                ? 'bg-emerald-100 text-emerald-800 border-emerald-200' 
                : 'bg-slate-100 text-slate-700 border-slate-200'
            }`}>
              {fullyAllocatedList.length}
            </span>
          </button>

          {/* Tab 5: Rejected / Flagged */}
          <button
            onClick={() => onTabChange('rejected')}
            className={`inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors duration-150 cursor-pointer whitespace-nowrap shadow-2xs ${
              activeTab === 'rejected'
                ? 'bg-white text-slate-900 border-2 border-slate-700 shadow-xs ring-2 ring-slate-500/15'
                : 'bg-white text-slate-700 hover:text-slate-900 border-2 border-slate-200 hover:border-slate-300 hover:bg-slate-50'
            }`}
            title="Denied or out-of-zone requests"
          >
            <Ban className={`w-3.5 h-3.5 flex-shrink-0 ${activeTab === 'rejected' ? 'text-slate-800' : 'text-slate-500'}`} />
            <span>Rejected</span>
            <span className={`text-[10px] font-mono px-1.5 py-0.2 rounded-full font-bold border ${
              activeTab === 'rejected' 
                ? 'bg-slate-800 text-white border-slate-700' 
                : 'bg-slate-100 text-slate-700 border-slate-200'
            }`}>
              {rejectedList.length}
            </span>
          </button>
        </div>

        {/* Tab Subtitle & Resource Filter */}
        <div className="flex items-center justify-between text-xs pt-0.5">
          <span className="text-[11px] text-slate-500 font-medium">
            {activeTab === 'needs_attention' && 'All active unallocated demands (ranked by triage priority)'}
            {activeTab === 'pending_verification' && 'Unverified demands specifically awaiting coordinator authentication'}
            {activeTab === 'partially_allocated' && 'Deficits preserved in queue awaiting depot stock'}
            {activeTab === 'fully_allocated' && '100% fulfilled requests ready or in transit'}
            {activeTab === 'rejected' && 'Denied, duplicate, or out-of-zone requests with audit trail'}
          </span>

          <div className="flex items-center space-x-1 bg-slate-50 border border-slate-200 rounded-lg px-2 py-0.5">
            <select
              value={filterResource}
              onChange={(e) => setFilterResource(e.target.value)}
              className="bg-transparent text-slate-700 font-medium focus:outline-none cursor-pointer text-[11px]"
            >
              <option value="all">All Resources</option>
              <option value="drinking_water">Drinking Water</option>
              <option value="medical_supplies">Medical Supplies</option>
              <option value="food_rations">Food Rations</option>
              <option value="shelter_kits">Shelter Kits</option>
            </select>
          </div>
        </div>
      </div>

      {/* Cards List (Scrollable) */}
      <div className="flex-1 overflow-y-auto pr-1">
        {isLoading ? (
          <div className="space-y-2.5 pb-2">
            {[1, 2, 3, 4].map((i) => (
              <div
                key={i}
                className="bg-white border border-slate-200/90 rounded-2xl p-4 shadow-2xs animate-pulse space-y-3"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <div className="h-5 w-20 bg-slate-200/80 rounded" />
                    <div className="h-5 w-16 bg-slate-100 rounded-full" />
                  </div>
                  <div className="h-6 w-14 bg-slate-200/80 rounded-lg" />
                </div>
                <div className="space-y-1.5">
                  <div className="h-3.5 w-3/4 bg-slate-200/70 rounded" />
                  <div className="h-3 w-1/2 bg-slate-100 rounded" />
                </div>
                <div className="flex items-center justify-between pt-2 border-t border-slate-100">
                  <div className="h-3 w-32 bg-slate-100 rounded" />
                  <div className="h-7 w-20 bg-slate-200/80 rounded-lg" />
                </div>
              </div>
            ))}
          </div>
        ) : (
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={activeTab + (filterResource ? `_${filterResource}` : '')}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
              className="space-y-2.5 pb-2 min-h-full flex flex-col"
            >
            {filtered.length === 0 ? (
              <div className="flex-1 min-h-[260px] flex flex-col items-center justify-center text-center p-6 space-y-2 bg-slate-50/60 rounded-xl border border-dashed border-slate-200">
            {activeTab === 'pending_verification' && (
              <>
                <div className="w-10 h-10 rounded-full bg-violet-50 text-violet-600 flex items-center justify-center">
                  <CheckCircle2 className="w-5 h-5" />
                </div>
                <div className="font-bold text-slate-800 text-xs">All Demands Verified!</div>
                <p className="text-[11px] text-slate-500 max-w-xs">
                  Zero verification backlog. All incoming requests have been authenticated and are ready for stock allocation.
                </p>
              </>
            )}

            {activeTab === 'needs_attention' && (
              <>
                <div className="w-10 h-10 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center">
                  <Sparkles className="w-5 h-5" />
                </div>
                <div className="font-bold text-slate-800 text-xs">No Pending Allocations!</div>
                <p className="text-[11px] text-slate-500 max-w-xs">
                  All verified demands have been assigned stock and moved to partial, full allocation, or rejected.
                </p>
              </>
            )}

            {activeTab === 'partially_allocated' && (
              <>
                <div className="w-10 h-10 rounded-full bg-slate-100 text-slate-500 flex items-center justify-center">
                  <Hourglass className="w-5 h-5" />
                </div>
                <div className="font-bold text-slate-800 text-xs">Zero Partial Deficits</div>
                <p className="text-[11px] text-slate-500 max-w-xs">
                  No requests are currently waiting for replenishment stock.
                </p>
              </>
            )}

            {activeTab === 'fully_allocated' && (
              <>
                <div className="w-10 h-10 rounded-full bg-slate-100 text-slate-500 flex items-center justify-center">
                  <Boxes className="w-5 h-5" />
                </div>
                <div className="font-bold text-slate-800 text-xs">No Fully Allocated Requests Yet</div>
                <p className="text-[11px] text-slate-500 max-w-xs">
                  Allocate stock to requests from the Needs Attention tab to complete allocations.
                </p>
              </>
            )}

            {activeTab === 'rejected' && (
              <>
                <div className="w-10 h-10 rounded-full bg-slate-100 text-slate-500 flex items-center justify-center">
                  <Ban className="w-5 h-5" />
                </div>
                <div className="font-bold text-slate-800 text-xs">Zero Rejected Requests</div>
                <p className="text-[11px] text-slate-500 max-w-xs">
                  Denied or out-of-zone requests will appear here with logged justification.
                </p>
              </>
            )}
              </div>
            ) : (
              filtered.map((req, idx) => {
              const isSelected = selectedRequestId === req.id;
              const isCritical = req.priorityScore >= 85;
              const isHigh = req.priorityScore >= 70 && req.priorityScore < 85;
              const isPending = req.verificationStatus === 'pending';
              const isRejected = req.requestStatus === 'rejected';

              const hasMultiResources = Boolean(req.requestedResources && req.requestedResources.length > 1);
              const totalRequested = (req.requestedResources && req.requestedResources.length > 0)
                ? req.requestedResources.reduce((acc, r) => acc + r.requestedQty, 0)
                : req.requestedQty;
              const totalAllocated = (req.requestedResources && req.requestedResources.length > 0)
                ? req.requestedResources.reduce((acc, r) => acc + r.allocatedQty, 0)
                : req.allocatedQty;
              const totalUnfulfilled = Math.max(0, totalRequested - totalAllocated);

              return (
                <div
                  key={req.id}
                  onClick={() => onSelectRequest(req)}
                  className={`p-3.5 rounded-xl border transition-colors duration-150 cursor-pointer text-xs space-y-2.5 ${
                    isSelected
                      ? 'bg-blue-50/90 border-blue-400 ring-2 ring-blue-500/20 shadow-xs'
                      : isRejected
                      ? 'bg-slate-50/70 border-slate-200 hover:border-slate-300'
                      : 'bg-white hover:bg-slate-50/90 border-slate-200/90 hover:border-slate-300 shadow-2xs'
                  }`}
                >
                  {/* Top Row: Rank, Resource, Score, Status Pill */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <span className="font-mono text-xs font-bold text-slate-400">
                        #{idx + 1}
                      </span>
                      {hasMultiResources ? (
                        <div className="flex items-center space-x-1.5 font-bold text-slate-900">
                          <Boxes className="w-4 h-4 text-blue-600 flex-shrink-0" />
                          <span>Multi-Resource Demand</span>
                          <span className="text-[10px] font-bold bg-blue-100 text-blue-800 px-1.5 py-0.2 rounded-full border border-blue-200">
                            {req.requestedResources!.length} Items
                          </span>
                        </div>
                      ) : (
                        <div className="flex items-center space-x-1.5 font-bold text-slate-900">
                          {getResourceIcon(req.resourceType)}
                          <span className="capitalize">{req.resourceType.replace(/_/g, ' ')}</span>
                        </div>
                      )}
                    </div>

                    <div className="flex items-center space-x-2">
                      {/* Priority Score Badge */}
                      <div
                        className={`font-mono font-bold px-2 py-0.5 rounded-full text-[11px] border flex items-center space-x-1 ${
                          isRejected
                            ? 'bg-slate-100 text-slate-500 border-slate-200'
                            : isCritical
                            ? 'bg-rose-50 text-rose-700 border-rose-200'
                            : isHigh
                            ? 'bg-amber-50 text-amber-700 border-amber-200'
                            : 'bg-blue-50 text-blue-700 border-blue-200'
                        }`}
                      >
                        {isCritical && !isRejected && <span className="w-1.5 h-1.5 rounded-full bg-rose-600 animate-pulse" />}
                        <span>{req.priorityScore.toFixed(1)}</span>
                      </div>

                      {/* Status Pill */}
                      {isRejected ? (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-50 text-rose-800 border border-rose-200 flex items-center space-x-1">
                          <XCircle className="w-3 h-3 text-rose-600" />
                          <span>Rejected</span>
                        </span>
                      ) : activeTab === 'pending_verification' ? (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-violet-50 text-violet-800 border border-violet-200 flex items-center space-x-1">
                          <Clock className="w-3 h-3 text-violet-600" />
                          <span>Awaiting Verification</span>
                        </span>
                      ) : activeTab === 'needs_attention' ? (
                        isPending ? (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-200 flex items-center space-x-1">
                            <Clock className="w-3 h-3 text-amber-600" />
                            <span>Triage Pending</span>
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-200 flex items-center space-x-1">
                            <AlertTriangle className="w-3 h-3 text-rose-500" />
                            <span>Ready to Allocate</span>
                          </span>
                        )
                      ) : activeTab === 'partially_allocated' ? (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-200 flex items-center space-x-1">
                          <Hourglass className="w-3 h-3 text-amber-600" />
                          <span>Deficit Remaining</span>
                        </span>
                      ) : req.requestStatus === 'delivered' ? (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200 flex items-center space-x-1">
                          <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                          <span>Stage 3: Fulfilled</span>
                        </span>
                      ) : req.requestStatus === 'dispatched' ? (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-sky-50 text-sky-800 border border-sky-200 flex items-center space-x-1 animate-pulse">
                          <Truck className="w-3 h-3 text-sky-600" />
                          <span>Stage 2: In Transit</span>
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 text-blue-800 border border-blue-200 flex items-center space-x-1">
                          <Boxes className="w-3 h-3 text-blue-600" />
                          <span>Stage 1: Staged</span>
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Rejection Justification Banner (for Rejected Tab) */}
                  {isRejected && req.rejectionReason && (
                    <div className="bg-rose-50/70 border border-rose-200/80 rounded-lg p-2 text-[11px] text-rose-900 space-y-0.5">
                      <div className="font-bold flex items-center space-x-1">
                        <span>Denial Justification:</span>
                        {req.rejectedAt && <span className="font-mono text-[10px] text-rose-600">({req.rejectedAt})</span>}
                      </div>
                      <p className="italic text-rose-800 text-[10.5px]">"{req.rejectionReason}"</p>
                    </div>
                  )}

                  {/* Location & People */}
                  <div className="flex items-center justify-between text-[11px] text-slate-500">
                    <div className="flex items-center space-x-1 truncate max-w-[240px]">
                      <MapPin className="w-3 h-3 text-slate-400 flex-shrink-0" />
                      <span className="truncate">{req.location.zoneName}</span>
                    </div>
                    <div className="flex items-center space-x-1 flex-shrink-0">
                      <Users className="w-3 h-3 text-slate-400" />
                      <span>{req.peopleAffected} People</span>
                    </div>
                  </div>

                  {/* Multi-Resource Badges */}
                  {hasMultiResources && (
                    <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                      {req.requestedResources!.map((item) => {
                        const isItemFulfilled = item.unfulfilledQty === 0;
                        const isItemPartial = item.allocatedQty > 0 && item.unfulfilledQty > 0;
                        return (
                          <span
                            key={item.resourceType}
                            className={`inline-flex items-center space-x-1.5 px-2 py-0.5 rounded-md text-[10.5px] font-semibold border ${
                              isItemFulfilled
                                ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                                : isItemPartial
                                ? 'bg-amber-50 text-amber-800 border-amber-200'
                                : 'bg-slate-50 text-slate-700 border-slate-200'
                            }`}
                          >
                            {getResourceIcon(item.resourceType)}
                            <span className="font-bold text-slate-800">
                              {item.resourceType === 'drinking_water' ? 'Water' : item.resourceType === 'medical_supplies' ? 'Medical' : item.resourceType === 'food_rations' ? 'Food' : 'Shelter'}
                            </span>
                            <span className="font-mono text-slate-600 font-normal">
                              {item.allocatedQty}/{item.requestedQty}{item.resourceType === 'drinking_water' ? 'L' : ''}
                            </span>
                            {isItemFulfilled ? (
                              <span className="text-emerald-600 font-bold">✓</span>
                            ) : isItemPartial ? (
                              <span className="text-amber-600 font-bold text-[9.5px]">({item.unfulfilledQty} deficit)</span>
                            ) : null}
                          </span>
                        );
                      })}
                    </div>
                  )}

                  {/* Stock Allocation Progress Bar (hidden for rejected) */}
                  {!isRejected && (
                    <div className="space-y-1 pt-1 border-t border-slate-100">
                      <div className="flex justify-between items-center text-[11px]">
                        <span className="font-mono text-slate-700 font-semibold">
                          {totalAllocated} / {totalRequested} {hasMultiResources ? 'Total Units' : 'Units'}
                        </span>
                        {totalUnfulfilled > 0 ? (
                          <span className="text-[10px] text-amber-700 font-bold bg-amber-50 px-1.5 py-0.2 rounded border border-amber-200">
                            {totalUnfulfilled} unmet deficit
                          </span>
                        ) : (
                          <span className="text-[10px] text-emerald-700 font-semibold bg-emerald-50 px-1.5 py-0.2 rounded border border-emerald-200">
                            ✓ Full Stock Reserved
                          </span>
                        )}
                      </div>

                      <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden flex border border-slate-200/50">
                        <div
                          style={{ width: `${totalRequested > 0 ? (totalAllocated / totalRequested) * 100 : 0}%` }}
                          className="bg-emerald-500 h-full transition-all"
                        />
                        <div
                          style={{ width: `${totalRequested > 0 ? (totalUnfulfilled / totalRequested) * 100 : 0}%` }}
                          className="bg-amber-400/80 h-full transition-all"
                        />
                      </div>
                    </div>
                  )}

                  {/* Bottom Action / Trigger Bar */}
                  <div className="flex items-center justify-between pt-0.5 text-[11px]">
                    <div className="flex items-center space-x-1.5 font-mono text-slate-400 text-[10px]">
                      <span>{req.id} • {req.requesterName}</span>
                      {req.allocatedDepotId && (
                        <span className="text-[9.5px] px-1.5 py-0.2 rounded bg-blue-50 text-blue-700 font-semibold border border-blue-200">
                          {req.allocatedDepotId}
                        </span>
                      )}
                    </div>

                    <div className="flex items-center space-x-2">
                      {isRejected ? (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onRestore(req.id);
                          }}
                          className="text-blue-700 bg-blue-50 hover:bg-blue-100 px-2.5 py-1 rounded-md font-bold flex items-center space-x-1 border border-blue-200 transition-colors"
                        >
                          <RotateCcw className="w-3 h-3" />
                          <span>Restore to Queue</span>
                        </button>
                      ) : activeTab === 'pending_verification' ? (
                        <>
                          <button
                            onClick={(e) => handleOpenReject(e, req)}
                            className="text-slate-500 hover:text-rose-700 hover:bg-rose-50 px-2 py-0.5 rounded text-[10.5px] font-semibold transition-colors"
                            title="Reject or flag request"
                          >
                            Reject
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              onVerify(req.id);
                            }}
                            className="text-violet-800 bg-violet-50 hover:bg-violet-100 px-2.5 py-1 rounded-md font-bold flex items-center space-x-1 border border-violet-200 transition-colors shadow-2xs hover:shadow-xs cursor-pointer"
                            title="Verify and authenticate relief demand"
                          >
                            <CheckCircle2 className="w-3 h-3 text-violet-600" />
                            <span>Verify</span>
                          </button>
                        </>
                      ) : activeTab === 'needs_attention' ? (
                        <>
                          <button
                            onClick={(e) => handleOpenReject(e, req)}
                            className="text-slate-500 hover:text-rose-700 hover:bg-rose-50 px-2 py-0.5 rounded text-[10.5px] font-semibold transition-colors"
                            title="Reject or flag request"
                          >
                            Reject
                          </button>

                          {isPending ? (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                onVerify(req.id);
                              }}
                              className="text-violet-800 bg-violet-50 hover:bg-violet-100 px-2.5 py-1 rounded-md font-bold flex items-center space-x-1 border border-violet-200 transition-colors shadow-2xs hover:shadow-xs cursor-pointer"
                              title="Verify and authenticate relief demand"
                            >
                              <CheckCircle2 className="w-3 h-3 text-violet-600" />
                              <span>Verify</span>
                            </button>
                          ) : onAllocate ? (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                onAllocate(req.id);
                              }}
                              className="text-blue-700 bg-blue-50 hover:bg-blue-100 px-2.5 py-1 rounded-md font-bold flex items-center space-x-1 border border-blue-200 transition-colors shadow-2xs hover:shadow-xs cursor-pointer"
                              title="Allocate warehouse stock to demand"
                            >
                              <Boxes className="w-3 h-3 text-blue-600" />
                              <span>Allocate</span>
                            </button>
                          ) : (
                            <span className="text-blue-600 font-semibold flex items-center space-x-0.5 hover:underline">
                              <span>Allocate</span>
                              <ChevronRight className="w-3.5 h-3.5" />
                            </span>
                          )}
                        </>
                      ) : activeTab === 'fully_allocated' ? (
                        req.requestStatus === 'delivered' ? (
                          <span className="text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-lg font-bold flex items-center space-x-1 text-[10.5px]">
                            <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                            <span>100% Fulfilled</span>
                          </span>
                        ) : req.requestStatus === 'dispatched' ? (
                          onDeliver ? (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                onDeliver(req.id);
                              }}
                              className="text-emerald-800 bg-emerald-50 hover:bg-emerald-100 px-2.5 py-1 rounded-lg text-[10.5px] font-bold flex items-center space-x-1 border border-emerald-300 transition-colors shadow-2xs hover:shadow-xs cursor-pointer"
                              title="Confirm citizen handover & 100% fulfill demand"
                            >
                              <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                              <span>Confirm Delivery</span>
                            </button>
                          ) : (
                            <span className="text-sky-700 font-semibold flex items-center space-x-1 text-[10.5px]">
                              <Truck className="w-3 h-3 text-sky-600" />
                              <span>En Route</span>
                            </span>
                          )
                        ) : onDispatch ? (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              onDispatch(req.id);
                            }}
                            className="text-sky-700 bg-sky-50 hover:bg-sky-100 px-2.5 py-1 rounded-lg text-[10.5px] font-bold flex items-center space-x-1 border border-sky-200 transition-colors shadow-2xs hover:shadow-xs cursor-pointer"
                            title="Dispatch relief cargo into transit corridor"
                          >
                            <Truck className="w-3 h-3 text-sky-600" />
                            <span>Dispatch</span>
                          </button>
                        ) : (
                          <span className="text-blue-600 font-semibold flex items-center space-x-0.5 hover:underline">
                            <span>View Record</span>
                            <ChevronRight className="w-3.5 h-3.5" />
                          </span>
                        )
                      ) : (
                        <span className="text-blue-600 font-semibold flex items-center space-x-0.5 hover:underline">
                          <span>Allocate Remainder</span>
                          <ChevronRight className="w-3.5 h-3.5" />
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            }))}
          </motion.div>
        </AnimatePresence>
      )}
    </div>

      {/* Reject Request Modal */}
      {rejectModalReq && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <motion.form
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            onSubmit={handleConfirmReject}
            className="bg-white border border-slate-200 rounded-2xl max-w-md w-full p-6 space-y-4 shadow-xl"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <div className="w-8 h-8 rounded-lg bg-rose-50 text-rose-600 flex items-center justify-center">
                  <Ban className="w-4 h-4" />
                </div>
                <h3 className="text-base font-bold text-slate-900">Reject Relief Request</h3>
              </div>
              <button
                type="button"
                onClick={() => setRejectModalReq(null)}
                className="text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">
              You are rejecting <strong>{rejectModalReq.id}</strong> ({rejectModalReq.requesterName} — {rejectModalReq.resourceType.replace(/_/g, ' ')}). A mandatory reason must be recorded for the permanent audit trail.
            </p>

            <div className="space-y-2 text-xs">
              <label className="block font-semibold text-slate-700">
                Common Rejection Justifications:
              </label>
              <div className="grid grid-cols-1 gap-1.5">
                {[
                  'Outside active Sector 4 flood disaster zone; commercial supply lines open.',
                  'Duplicate submission consolidated into verified sector dispatch.',
                  'Unreachable citizen contact number after 3 verification attempts.',
                  'Request for non-emergency or prohibited commercial items.',
                ].map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => setRejectionReasonInput(preset)}
                    className="text-left text-[11px] p-2 rounded-lg bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-700 transition-colors"
                  >
                    • {preset}
                  </button>
                ))}
              </div>

              <div className="pt-2">
                <label className="block font-semibold text-slate-700 mb-1">
                  Mandatory Denial Reason *
                </label>
                <textarea
                  rows={2}
                  required
                  value={rejectionReasonInput}
                  onChange={(e) => setRejectionReasonInput(e.target.value)}
                  placeholder="Enter or select rejection justification..."
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-900 focus:outline-none focus:border-rose-500 resize-none"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setRejectModalReq(null)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-semibold shadow-sm cursor-pointer"
              >
                Confirm Rejection & Archive
              </button>
            </div>
          </motion.form>
        </div>
      )}
    </div>
  );
}
