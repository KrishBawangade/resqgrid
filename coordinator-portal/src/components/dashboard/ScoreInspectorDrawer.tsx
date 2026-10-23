'use client';

import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { ReliefRequest, ReliefDepot } from '@/lib/types';
import { 
  X, 
  CheckCircle2, 
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  ShieldAlert, 
  HeartHandshake, 
  Users,
  Clock,
  Layers, 
  Edit3, 
  Boxes,
  MapPin,
  Phone,
  Building2,
  Ban,
  XCircle,
  RotateCcw
} from 'lucide-react';

interface ScoreInspectorDrawerProps {
  request: ReliefRequest | null;
  requests: ReliefRequest[];
  depots: ReliefDepot[];
  onClose: () => void;
  onSelectRequest: (req: ReliefRequest) => void;
  onVerify: (id: string) => void;
  onAllocate: (id: string) => void;
  onOverrideScore: (id: string, newScore: number, reason: string) => void;
  onReject?: (id: string, reason: string) => void;
  onRestore?: (id: string) => void;
}

export default function ScoreInspectorDrawer({
  request,
  requests,
  depots,
  onClose,
  onSelectRequest,
  onVerify,
  onAllocate,
  onOverrideScore,
  onReject,
  onRestore,
}: ScoreInspectorDrawerProps) {
  const [showOverrideModal, setShowOverrideModal] = useState(false);
  const [overrideScoreInput, setOverrideScoreInput] = useState('');
  const [overrideReasonInput, setOverrideReasonInput] = useState('');

  // Rejection modal state inside drawer
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [rejectionReasonInput, setRejectionReasonInput] = useState('');

  if (!request) return null;

  const isRejected = request.requestStatus === 'rejected';
  const isCritical = request.priorityScore >= 85;
  const isHigh = request.priorityScore >= 70 && request.priorityScore < 85;
  const b = request.scoreBreakdown;

  // Sorted list for Prev / Next navigation
  const sortedRequests = [...requests].sort((a, b) => b.priorityScore - a.priorityScore);
  const currentIndex = sortedRequests.findIndex((r) => r.id === request.id);
  const prevReq = currentIndex > 0 ? sortedRequests[currentIndex - 1] : null;
  const nextReq = currentIndex < sortedRequests.length - 1 ? sortedRequests[currentIndex + 1] : null;

  const handleOpenOverride = () => {
    setOverrideScoreInput(request.priorityScore.toString());
    setOverrideReasonInput('');
    setShowOverrideModal(true);
  };

  const handleConfirmOverride = (e: React.FormEvent) => {
    e.preventDefault();
    const scoreNum = parseFloat(overrideScoreInput);
    if (isNaN(scoreNum) || scoreNum < 0 || scoreNum > 100 || !overrideReasonInput.trim()) return;
    onOverrideScore(request.id, scoreNum, overrideReasonInput.trim());
    setShowOverrideModal(false);
  };

  const handleConfirmReject = (e: React.FormEvent) => {
    e.preventDefault();
    if (!rejectionReasonInput.trim() || !onReject) return;
    onReject(request.id, rejectionReasonInput.trim());
    setShowRejectModal(false);
  };

  const matchingDepots = depots.filter((d) => {
    const item = d.inventory[request.resourceType];
    return item && item.availableStock > 0;
  });

  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 20 }}
      transition={{ type: 'spring', damping: 25, stiffness: 280 }}
      className="bg-white border border-slate-200/90 rounded-2xl shadow-xs flex flex-col h-[600px] overflow-hidden"
    >
      {/* Fixed Sticky Header with Back Button and Stepper */}
      <div className="p-3 border-b border-slate-100 flex-shrink-0 bg-slate-50/90 flex items-center justify-between">
        <button
          onClick={onClose}
          className="flex items-center space-x-1.5 px-3 py-1.5 bg-white hover:bg-slate-100 text-slate-800 rounded-lg border border-slate-200 text-xs font-bold transition-colors shadow-2xs cursor-pointer"
        >
          <ArrowLeft className="w-3.5 h-3.5 text-slate-600" />
          <span>Back to Queue</span>
        </button>

        {/* Stepper Navigation */}
        <div className="flex items-center space-x-1.5">
          <span className="text-[11px] font-mono text-slate-500 font-semibold">
            {currentIndex + 1} of {sortedRequests.length}
          </span>
          <div className="flex items-center space-x-0.5 bg-white border border-slate-200 rounded-lg p-0.5">
            <button
              onClick={() => prevReq && onSelectRequest(prevReq)}
              disabled={!prevReq}
              className={`p-1 rounded ${
                prevReq ? 'text-slate-700 hover:bg-slate-100 cursor-pointer' : 'text-slate-300 cursor-not-allowed'
              }`}
              title={prevReq ? `Previous: ${prevReq.id}` : 'First'}
            >
              <ChevronLeft className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => nextReq && onSelectRequest(nextReq)}
              disabled={!nextReq}
              className={`p-1 rounded ${
                nextReq ? 'text-slate-700 hover:bg-slate-100 cursor-pointer' : 'text-slate-300 cursor-not-allowed'
              }`}
              title={nextReq ? `Next: ${nextReq.id}` : 'Last'}
            >
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
            title="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Smoothly Scrollable Body */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 pb-16">
        {/* Title & Priority Badge Banner */}
        <div className="space-y-1.5 pb-1 border-b border-slate-100">
          <div className="flex items-center space-x-2">
            <span className="font-mono font-bold text-xs text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-200/70">
              {request.id}
            </span>

            {isRejected ? (
              <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-rose-50 text-rose-800 border border-rose-200 flex items-center space-x-1">
                <XCircle className="w-3 h-3 text-rose-600" />
                <span>Rejected Demand</span>
              </span>
            ) : (
              <>
                <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${
                  isCritical 
                    ? 'bg-rose-50 text-rose-700 border-rose-200' 
                    : isHigh 
                    ? 'bg-amber-50 text-amber-700 border-amber-200' 
                    : 'bg-blue-50 text-blue-700 border-blue-200'
                }`}>
                  Priority Score: {request.priorityScore.toFixed(1)} / 100
                </span>
                {request.verificationStatus === 'verified' ? (
                  <span className="px-2 py-0.5 rounded-full text-[10.5px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center space-x-1">
                    <CheckCircle2 className="w-3 h-3" />
                    <span>Verified</span>
                  </span>
                ) : (
                  <span className="px-2 py-0.5 rounded-full text-[10.5px] font-bold bg-amber-50 text-amber-700 border border-amber-200 flex items-center space-x-1">
                    <Clock className="w-3 h-3" />
                    <span>Pending Triage</span>
                  </span>
                )}
              </>
            )}
          </div>

          <h2 className="text-base font-bold text-slate-900 capitalize pt-1">
            {request.resourceType.replace(/_/g, ' ')} Demand
          </h2>

          <div className="flex items-center space-x-1.5 text-xs text-slate-500">
            <MapPin className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
            <span className="font-medium text-slate-700">{request.location.zoneName}</span>
          </div>
        </div>

        {/* Rejection Justification Notice (if rejected) */}
        {isRejected && (
          <div className="bg-rose-50 border border-rose-200 rounded-xl p-3 text-xs space-y-1.5">
            <div className="flex items-center space-x-1.5 font-bold text-rose-900 text-[11.5px]">
              <Ban className="w-4 h-4 text-rose-600" />
              <span>Request Denied & Archived</span>
              {request.rejectedAt && (
                <span className="font-mono text-[10px] text-rose-600 font-normal">({request.rejectedAt})</span>
              )}
            </div>
            <p className="text-rose-800 text-[11px] leading-relaxed italic bg-white p-2 rounded-lg border border-rose-200/60">
              "{request.rejectionReason || 'Marked as ineligible / outside operational scope.'}"
            </p>
          </div>
        )}

        {/* Override banner if present */}
        {!isRejected && request.priorityOverride && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-xs space-y-1">
            <div className="flex items-center space-x-1.5 font-bold text-amber-900">
              <Edit3 className="w-3.5 h-3.5 text-amber-700" />
              <span>Coordinator Score Override Applied</span>
            </div>
            <p className="text-amber-800 text-[11px] leading-relaxed">
              Adjusted to <strong>{request.priorityOverride.overriddenScore.toFixed(1)}</strong> by{' '}
              <em>{request.priorityOverride.coordinator}</em>.
            </p>
            <p className="text-[11px] text-amber-700 italic border-t border-amber-200/60 pt-1">
              "{request.priorityOverride.reason}"
            </p>
          </div>
        )}

        {/* Requester Contact & Route Intelligence */}
        <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-3.5 text-xs space-y-2">
          <div className="flex justify-between items-center text-slate-700">
            <div>
              <span className="text-slate-400 block text-[9.5px] uppercase font-bold">Requester</span>
              <span className="font-semibold text-slate-900 text-sm">{request.requesterName}</span>
            </div>
            <div className="font-mono text-slate-600 flex items-center space-x-1 bg-white px-2 py-0.5 rounded border border-slate-200 text-xs">
              <Phone className="w-3 h-3 text-slate-400" />
              <span>{request.contactNumber}</span>
            </div>
          </div>

          <div className="flex items-center space-x-2 pt-1 border-t border-slate-200/70 text-[11px]">
            <span className="text-slate-400 font-semibold uppercase text-[10px]">Route Access:</span>
            <span className="px-2 py-0.5 rounded bg-amber-100/80 text-amber-900 font-semibold border border-amber-200 text-[10.5px]">
              {request.location.accessibility.replace(/_/g, ' ')}
            </span>
            <span className="text-slate-300">•</span>
            <span className="text-slate-700 font-medium">{request.peopleAffected} People Impacted</span>
          </div>

          {request.notes && (
            <div className="pt-1.5 border-t border-slate-200/60">
              <span className="text-slate-400 block text-[9.5px] uppercase font-bold mb-0.5">Scout Notes</span>
              <p className="text-[11.5px] text-slate-700 italic bg-white p-2.5 rounded-lg border border-slate-200/60 leading-relaxed">
                "{request.notes}"
              </p>
            </div>
          )}
        </div>

        {/* Explainable 4-Factor Prioritization Breakdown */}
        <div className="bg-white border border-slate-200 rounded-xl p-3.5 space-y-3 shadow-2xs">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-1.5 text-xs font-bold text-slate-900">
              <Layers className="w-4 h-4 text-blue-600" />
              <span>Explainable Prioritization Formula</span>
            </div>
            {!isRejected && (
              <button
                onClick={handleOpenOverride}
                className="text-[11px] text-blue-600 hover:text-blue-800 font-semibold flex items-center space-x-1 hover:underline cursor-pointer"
              >
                <Edit3 className="w-3 h-3" />
                <span>Override Score</span>
              </button>
            )}
          </div>

          <div className="grid grid-cols-2 gap-2 text-xs">
            {/* Criticality */}
            <div className="bg-slate-50/90 p-2.5 rounded-lg border border-slate-200/70">
              <div className="flex items-center justify-between text-slate-500 text-[10.5px]">
                <span className="flex items-center space-x-1 font-medium">
                  <ShieldAlert className="w-3 h-3 text-rose-600" />
                  <span>Criticality (55%)</span>
                </span>
                <span className="font-mono font-bold text-slate-700">{b.criticalityScore} pts</span>
              </div>
              <div className="text-xs font-bold text-rose-700 mt-1">
                +{(b.criticalityScore * 0.55).toFixed(1)} score
              </div>
              <span className="text-[9.5px] text-slate-400 capitalize">{request.urgencyLevel} urgency</span>
            </div>

            {/* Vulnerability */}
            <div className="bg-slate-50/90 p-2.5 rounded-lg border border-slate-200/70">
              <div className="flex items-center justify-between text-slate-500 text-[10.5px]">
                <span className="flex items-center space-x-1 font-medium">
                  <HeartHandshake className="w-3 h-3 text-purple-600" />
                  <span>Vulnerability (20%)</span>
                </span>
                <span className="font-mono font-bold text-slate-700">{b.vulnerabilityScore} pts</span>
              </div>
              <div className="text-xs font-bold text-purple-700 mt-1">
                +{(b.vulnerabilityScore * 0.20).toFixed(1)} score
              </div>
              <span className="text-[9.5px] text-slate-400 truncate block">
                {[
                  request.vulnerability.hasInjured && 'Injured',
                  request.vulnerability.isClinic && 'Clinic',
                  request.vulnerability.hasChildren && 'Children',
                  request.vulnerability.hasElderly && 'Elderly',
                ].filter(Boolean).join(', ') || 'Standard Demographics'}
              </span>
            </div>

            {/* People */}
            <div className="bg-slate-50/90 p-2.5 rounded-lg border border-slate-200/70">
              <div className="flex items-center justify-between text-slate-500 text-[10.5px]">
                <span className="flex items-center space-x-1 font-medium">
                  <Users className="w-3 h-3 text-amber-600" />
                  <span>People (15%)</span>
                </span>
                <span className="font-mono font-bold text-slate-700">{b.peopleScore} pts</span>
              </div>
              <div className="text-xs font-bold text-amber-700 mt-1">
                +{(b.peopleScore * 0.15).toFixed(1)} score
              </div>
              <span className="text-[9.5px] text-slate-400">Log: {request.peopleAffected} persons</span>
            </div>

            {/* Waiting Time */}
            <div className="bg-slate-50/90 p-2.5 rounded-lg border border-slate-200/70">
              <div className="flex items-center justify-between text-slate-500 text-[10.5px]">
                <span className="flex items-center space-x-1 font-medium">
                  <Clock className="w-3 h-3 text-blue-600" />
                  <span>Wait (10%)</span>
                </span>
                <span className="font-mono font-bold text-slate-700">{b.waitingScore} pts</span>
              </div>
              <div className="text-xs font-bold text-blue-700 mt-1">
                +{(b.waitingScore * 0.10).toFixed(1)} score
              </div>
              <span className="text-[9.5px] text-slate-400">{request.waitingMinutes}m waiting</span>
            </div>
          </div>
        </div>

        {/* Stock Allocation & Depot Availability Checker */}
        {!isRejected && (
          <div className="bg-white border border-slate-200 rounded-xl p-3.5 space-y-3 shadow-2xs">
            <div className="flex justify-between items-center text-xs">
              <span className="font-bold text-slate-900 flex items-center space-x-1.5">
                <Boxes className="w-4 h-4 text-slate-600" />
                <span>Stock Fulfillment Status</span>
              </span>
              <span className="font-mono font-bold text-slate-900 text-sm">
                {request.allocatedQty} / {request.requestedQty} Units
              </span>
            </div>

            <div className="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden flex border border-slate-200/60">
              <div
                style={{ width: `${(request.allocatedQty / request.requestedQty) * 100}%` }}
                className="bg-emerald-500 h-full transition-all"
              />
              <div
                style={{ width: `${(request.unfulfilledQty / request.requestedQty) * 100}%` }}
                className="bg-amber-400/80 h-full transition-all"
              />
            </div>

            <div className="flex justify-between text-[11px]">
              <span className="text-emerald-700 font-semibold">Allocated: {request.allocatedQty} units</span>
              {request.unfulfilledQty > 0 ? (
                <span className="text-amber-700 font-bold bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                  {request.unfulfilledQty} unmet deficit
                </span>
              ) : (
                <span className="text-emerald-700 font-bold bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                  ✓ 100% Fulfilled
                </span>
              )}
            </div>

            {/* Depot Availability Checker */}
            <div className="pt-2 border-t border-slate-100">
              <span className="text-slate-400 block text-[10px] uppercase font-bold mb-1.5">
                Available Depot Stock ({request.resourceType.replace(/_/g, ' ')})
              </span>
              <div className="space-y-1.5 text-xs">
                {matchingDepots.length > 0 ? (
                  matchingDepots.map((d) => {
                    const item = d.inventory[request.resourceType];
                    return (
                      <div key={d.id} className="flex items-center justify-between bg-slate-50 p-2 rounded-lg border border-slate-200/70 text-[11px]">
                        <div className="flex items-center space-x-2">
                          <Building2 className="w-3.5 h-3.5 text-slate-500" />
                          <span className="font-medium text-slate-800">{d.name}</span>
                        </div>
                        <span className="font-mono font-bold text-slate-900 bg-white px-2 py-0.5 rounded border border-slate-200">
                          {item.availableStock} {item.unit}
                        </span>
                      </div>
                    );
                  })
                ) : (
                  <div className="text-[11px] text-rose-600 bg-rose-50 p-2 rounded-lg border border-rose-200">
                    No active depots currently hold available stock for this resource.
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Action Controls Section */}
        <div className="pt-2 border-t border-slate-100 flex items-center justify-between gap-2.5">
          {isRejected ? (
            <button
              onClick={() => onRestore && onRestore(request.id)}
              className="w-full py-2.5 px-4 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition-all shadow-2xs flex items-center justify-center space-x-2 cursor-pointer"
            >
              <RotateCcw className="w-4 h-4" />
              <span>Restore Request to Active Queue</span>
            </button>
          ) : (
            <>
              {request.verificationStatus === 'pending' ? (
                <button
                  onClick={() => onVerify(request.id)}
                  className="flex-1 py-2.5 px-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-all shadow-2xs flex items-center justify-center space-x-1.5 cursor-pointer"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Verify Need</span>
                </button>
              ) : (
                <div className="py-2 px-3 bg-emerald-50 text-emerald-800 border border-emerald-200 rounded-xl text-xs font-bold flex items-center justify-center space-x-1.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  <span>Verified</span>
                </div>
              )}

              <button
                onClick={() => onAllocate(request.id)}
                disabled={request.unfulfilledQty === 0}
                className={`flex-1 py-2.5 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center space-x-1.5 cursor-pointer ${
                  request.unfulfilledQty === 0
                    ? 'bg-slate-200 text-slate-400 border border-slate-300 cursor-not-allowed'
                    : 'bg-blue-600 hover:bg-blue-700 text-white shadow-2xs hover:shadow-xs'
                }`}
              >
                <Boxes className="w-4 h-4" />
                <span>{request.allocatedQty > 0 ? 'Allocate Remaining' : 'Allocate Stock'}</span>
              </button>

              <button
                onClick={() => setShowRejectModal(true)}
                className="py-2.5 px-3 bg-slate-100 hover:bg-rose-50 text-slate-600 hover:text-rose-700 rounded-xl text-xs font-semibold transition-colors border border-slate-200 hover:border-rose-200 cursor-pointer"
                title="Reject this request"
              >
                Reject
              </button>
            </>
          )}
        </div>
      </div>

      {/* Coordinator Score Override Modal */}
      {showOverrideModal && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <motion.form
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            onSubmit={handleConfirmOverride}
            className="bg-white border border-slate-200 rounded-2xl max-w-md w-full p-6 space-y-4 shadow-xl"
          >
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-slate-900">Coordinator Priority Override</h3>
              <button
                type="button"
                onClick={() => setShowOverrideModal(false)}
                className="text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">
              You can manually adjust the priority score for <strong>{request.id}</strong>. A mandatory reason must be recorded for the permanent audit trail.
            </p>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Adjusted Priority Score (0.0 - 100.0)
                </label>
                <input
                  type="number"
                  step="0.1"
                  min="0"
                  max="100"
                  required
                  value={overrideScoreInput}
                  onChange={(e) => setOverrideScoreInput(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-900 focus:outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Mandatory Justification / On-Ground Intelligence *
                </label>
                <textarea
                  rows={3}
                  required
                  value={overrideReasonInput}
                  onChange={(e) => setOverrideReasonInput(e.target.value)}
                  placeholder="e.g. Field scouts report riverbank embankment breaching; clinic water reserves at zero."
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-900 focus:outline-none focus:border-blue-500 resize-none"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setShowOverrideModal(false)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold shadow-sm cursor-pointer"
              >
                Save & Audit Log
              </button>
            </div>
          </motion.form>
        </div>
      )}

      {/* Reject Request Modal */}
      {showRejectModal && (
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
                onClick={() => setShowRejectModal(false)}
                className="text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">
              Rejecting request <strong>{request.id}</strong> ({request.requesterName} — {request.resourceType.replace(/_/g, ' ')}). Reason will be recorded in the official audit trail.
            </p>

            <div className="space-y-2 text-xs">
              <label className="block font-semibold text-slate-700">
                Common Rejection Presets:
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
                onClick={() => setShowRejectModal(false)}
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
    </motion.div>
  );
}
