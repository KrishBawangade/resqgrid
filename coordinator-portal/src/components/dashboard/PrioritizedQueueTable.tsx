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
  Ban
} from 'lucide-react';

export type QueueTabType = 'needs_attention' | 'partially_allocated' | 'fully_allocated' | 'rejected';

interface PrioritizedQueueTableProps {
  requests: ReliefRequest[];
  selectedRequestId: string | null;
  activeTab: QueueTabType;
  onTabChange: (tab: QueueTabType) => void;
  onSelectRequest: (req: ReliefRequest) => void;
  onVerify: (id: string) => void;
  onReject: (id: string, reason: string) => void;
  onRestore: (id: string) => void;
}

export default function PrioritizedQueueTable({
  requests,
  selectedRequestId,
  activeTab,
  onTabChange,
  onSelectRequest,
  onVerify,
  onReject,
  onRestore,
}: PrioritizedQueueTableProps) {
  const [filterResource, setFilterResource] = useState<string>('all');

  // Rejection modal state
  const [rejectModalReq, setRejectModalReq] = useState<ReliefRequest | null>(null);
  const [rejectionReasonInput, setRejectionReasonInput] = useState('');

  // Tab categorization
  const needsAttentionList = requests.filter(
    (r) => r.requestStatus !== 'rejected' && r.allocatedQty === 0 && r.unfulfilledQty > 0
  );
  const partiallyAllocatedList = requests.filter(
    (r) => r.requestStatus !== 'rejected' && r.allocatedQty > 0 && r.unfulfilledQty > 0
  );
  const fullyAllocatedList = requests.filter(
    (r) => r.requestStatus !== 'rejected' && (r.unfulfilledQty === 0 || r.requestStatus === 'fully_allocated')
  );
  const rejectedList = requests.filter(
    (r) => r.requestStatus === 'rejected' || r.verificationStatus === 'rejected'
  );

  // Current tab items
  const currentTabItems = 
    activeTab === 'needs_attention' 
      ? needsAttentionList 
      : activeTab === 'partially_allocated' 
      ? partiallyAllocatedList 
      : activeTab === 'fully_allocated'
      ? fullyAllocatedList
      : rejectedList;

  const filtered = currentTabItems
    .filter((r) => {
      if (filterResource !== 'all' && r.resourceType !== filterResource) return false;
      return true;
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
      {/* Top 4 Tabs Segmented Control */}
      <div className="pb-3 border-b border-slate-100 flex-shrink-0 space-y-2.5">
        <div className="bg-slate-100/90 p-1 rounded-xl grid grid-cols-4 gap-1 border border-slate-200/70">
          {/* Tab 1: Needs Attention */}
          <button
            onClick={() => onTabChange('needs_attention')}
            className={`px-1.5 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center justify-center space-x-1 cursor-pointer ${
              activeTab === 'needs_attention'
                ? 'bg-white text-rose-700 shadow-2xs border border-rose-200/80'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <AlertTriangle className={`w-3.5 h-3.5 flex-shrink-0 ${activeTab === 'needs_attention' ? 'text-rose-600' : 'text-slate-400'}`} />
            <span className="truncate">Attention</span>
            <span className={`text-[10px] font-mono px-1.5 py-0.2 rounded-full font-bold ${
              activeTab === 'needs_attention' 
                ? 'bg-rose-100 text-rose-800' 
                : 'bg-slate-200 text-slate-700'
            }`}>
              {needsAttentionList.length}
            </span>
          </button>

          {/* Tab 2: Partially Allocated */}
          <button
            onClick={() => onTabChange('partially_allocated')}
            className={`px-1.5 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center justify-center space-x-1 cursor-pointer ${
              activeTab === 'partially_allocated'
                ? 'bg-white text-amber-800 shadow-2xs border border-amber-200/80'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Hourglass className={`w-3.5 h-3.5 flex-shrink-0 ${activeTab === 'partially_allocated' ? 'text-amber-600' : 'text-slate-400'}`} />
            <span className="truncate">Partial</span>
            <span className={`text-[10px] font-mono px-1.5 py-0.2 rounded-full font-bold ${
              activeTab === 'partially_allocated' 
                ? 'bg-amber-100 text-amber-800' 
                : 'bg-slate-200 text-slate-700'
            }`}>
              {partiallyAllocatedList.length}
            </span>
          </button>

          {/* Tab 3: Fully Allocated */}
          <button
            onClick={() => onTabChange('fully_allocated')}
            className={`px-1.5 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center justify-center space-x-1 cursor-pointer ${
              activeTab === 'fully_allocated'
                ? 'bg-white text-emerald-800 shadow-2xs border border-emerald-200/80'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <CheckCircle2 className={`w-3.5 h-3.5 flex-shrink-0 ${activeTab === 'fully_allocated' ? 'text-emerald-600' : 'text-slate-400'}`} />
            <span className="truncate">Fulfilled</span>
            <span className={`text-[10px] font-mono px-1.5 py-0.2 rounded-full font-bold ${
              activeTab === 'fully_allocated' 
                ? 'bg-emerald-100 text-emerald-800' 
                : 'bg-slate-200 text-slate-700'
            }`}>
              {fullyAllocatedList.length}
            </span>
          </button>

          {/* Tab 4: Rejected / Flagged */}
          <button
            onClick={() => onTabChange('rejected')}
            className={`px-1.5 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center justify-center space-x-1 cursor-pointer ${
              activeTab === 'rejected'
                ? 'bg-white text-slate-900 shadow-2xs border border-slate-300'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Ban className={`w-3.5 h-3.5 flex-shrink-0 ${activeTab === 'rejected' ? 'text-slate-800' : 'text-slate-400'}`} />
            <span className="truncate">Rejected</span>
            <span className={`text-[10px] font-mono px-1.5 py-0.2 rounded-full font-bold ${
              activeTab === 'rejected' 
                ? 'bg-slate-800 text-white' 
                : 'bg-slate-200 text-slate-700'
            }`}>
              {rejectedList.length}
            </span>
          </button>
        </div>

        {/* Tab Subtitle & Resource Filter */}
        <div className="flex items-center justify-between text-xs pt-0.5">
          <span className="text-[11px] text-slate-500 font-medium">
            {activeTab === 'needs_attention' && 'Unallocated demands requiring triage & dispatch'}
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
      <div className="flex-1 overflow-y-auto space-y-2.5 pr-1">
        {filtered.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center p-6 space-y-2 bg-slate-50/60 rounded-xl border border-dashed border-slate-200">
            {activeTab === 'needs_attention' && (
              <>
                <div className="w-10 h-10 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center">
                  <Sparkles className="w-5 h-5" />
                </div>
                <div className="font-bold text-slate-800 text-xs">No Pending Requests!</div>
                <p className="text-[11px] text-slate-500 max-w-xs">
                  All relief demands have been addressed and moved to partial, full allocation, or rejected.
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
          <AnimatePresence>
            {filtered.map((req, idx) => {
              const isSelected = selectedRequestId === req.id;
              const isCritical = req.priorityScore >= 85;
              const isHigh = req.priorityScore >= 70 && req.priorityScore < 85;
              const isPending = req.verificationStatus === 'pending';
              const isRejected = req.requestStatus === 'rejected';

              return (
                <motion.div
                  key={req.id}
                  layout
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  transition={{ type: 'spring', damping: 25, stiffness: 250 }}
                  onClick={() => onSelectRequest(req)}
                  className={`p-3.5 rounded-xl border transition-all cursor-pointer text-xs space-y-2.5 ${
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
                      <div className="flex items-center space-x-1.5 font-bold text-slate-900">
                        {getResourceIcon(req.resourceType)}
                        <span className="capitalize">{req.resourceType.replace(/_/g, ' ')}</span>
                      </div>
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
                      ) : activeTab === 'needs_attention' ? (
                        isPending ? (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-200 flex items-center space-x-1">
                            <Clock className="w-3 h-3 text-amber-600" />
                            <span>Triage Pending</span>
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-200 flex items-center space-x-1">
                            <AlertTriangle className="w-3 h-3 text-rose-500" />
                            <span>Unallocated</span>
                          </span>
                        )
                      ) : activeTab === 'partially_allocated' ? (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-200 flex items-center space-x-1">
                          <Hourglass className="w-3 h-3 text-amber-600" />
                          <span>Deficit Remaining</span>
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200 flex items-center space-x-1">
                          <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                          <span>100% Fulfilled</span>
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

                  {/* Stock Allocation Progress Bar (hidden for rejected) */}
                  {!isRejected && (
                    <div className="space-y-1 pt-1 border-t border-slate-100">
                      <div className="flex justify-between items-center text-[11px]">
                        <span className="font-mono text-slate-700 font-semibold">
                          {req.allocatedQty} / {req.requestedQty} Units
                        </span>
                        {req.unfulfilledQty > 0 ? (
                          <span className="text-[10px] text-amber-700 font-bold bg-amber-50 px-1.5 py-0.2 rounded border border-amber-200">
                            {req.unfulfilledQty} unmet deficit
                          </span>
                        ) : (
                          <span className="text-[10px] text-emerald-700 font-semibold bg-emerald-50 px-1.5 py-0.2 rounded border border-emerald-200">
                            ✓ Full Stock Reserved
                          </span>
                        )}
                      </div>

                      <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden flex border border-slate-200/50">
                        <div
                          style={{ width: `${(req.allocatedQty / req.requestedQty) * 100}%` }}
                          className="bg-emerald-500 h-full transition-all"
                        />
                        <div
                          style={{ width: `${(req.unfulfilledQty / req.requestedQty) * 100}%` }}
                          className="bg-amber-400/80 h-full transition-all"
                        />
                      </div>
                    </div>
                  )}

                  {/* Bottom Action / Trigger Bar */}
                  <div className="flex items-center justify-between pt-0.5 text-[11px]">
                    <span className="font-mono text-slate-400 text-[10px]">
                      {req.id} • {req.requesterName}
                    </span>

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
                              className="text-emerald-700 bg-emerald-50 hover:bg-emerald-100 px-2.5 py-1 rounded-md font-bold flex items-center space-x-1 border border-emerald-200 transition-colors"
                            >
                              <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                              <span>Verify</span>
                            </button>
                          ) : (
                            <span className="text-blue-600 font-semibold flex items-center space-x-0.5 hover:underline">
                              <span>Allocate</span>
                              <ChevronRight className="w-3.5 h-3.5" />
                            </span>
                          )}
                        </>
                      ) : (
                        <span className="text-blue-600 font-semibold flex items-center space-x-0.5 hover:underline">
                          <span>{activeTab === 'fully_allocated' ? 'View Record' : 'Allocate'}</span>
                          <ChevronRight className="w-3.5 h-3.5" />
                        </span>
                      )}
                    </div>
                  </div>
                </motion.div>
              );
            })}
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
