'use client';

import { useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import {
  Search,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Truck,
  PackageCheck,
  Building2,
  MapPin,
  RefreshCw,
  XCircle,
  Loader2,
  History,
  ShieldCheck,
  Layers,
  PhoneCall,
  User,
  HeartPulse,
} from 'lucide-react';
import { ReliefRequest } from '@/lib/types';
import { useCitizenStore } from '@/lib/store/useCitizenStore';
import {
  deriveStageTimestamps,
  formatStageTime,
  formatStageDateTime,
  getStageElapsed,
} from '@/lib/utils/stageTimestamps';

// The 6 Progressive Stages for Live Citizen Tracking
interface ResolvedStage {
  key: string;
  label: string;
  shortLabel: string;
  description: string;
  actor: string;
  isCompleted: boolean;
  isCurrent: boolean;
  isPending: boolean;
  isPartial?: boolean;
  timeFormatted?: string;
  dateTimeFormatted?: string;
  elapsed?: string;
  operationalNote: string;
}

function resolveTrackingStages(req: ReliefRequest): {
  stages: ResolvedStage[];
  highestCompletedIndex: number;
  currentActiveIndex: number;
  isRejected: boolean;
  isPartial: boolean;
  rejectionInfo?: { reason: string; timestamp?: string; dateTime?: string; elapsed?: string };
} {
  const isRejected = req.requestStatus === 'rejected' || req.verificationStatus === 'rejected';
  const timestamps = deriveStageTimestamps(req);
  const baseTimeIso = timestamps.submitted || req.timestamp;

  const isDelivered = req.requestStatus === 'delivered';
  const isDispatched = isDelivered || req.requestStatus === 'dispatched';
  const isAllocated =
    isDispatched ||
    req.requestStatus === 'fully_allocated' ||
    req.requestStatus === 'partially_allocated' ||
    (typeof req.allocatedQty === 'number' && req.allocatedQty > 0);
  const isPrioritized =
    isAllocated || req.requestStatus === 'queued' || req.verificationStatus === 'verified';
  const isVerified = isPrioritized || req.verificationStatus === 'verified';

  const isPartial =
    req.requestStatus === 'partially_allocated' ||
    (req.allocatedQty > 0 && req.unfulfilledQty > 0);

  // Highest completed milestone index (0 to 5)
  // Stage 0: Intake / Submitted
  // Stage 1: Verified
  // Stage 2: Prioritized & Queued
  // Stage 3: Stock Allocated
  // Stage 4: In Transit / Dispatched
  // Stage 5: Delivered & Confirmed
  let highestCompletedIndex = -1;
  let currentActiveIndex = -1;

  if (!isRejected) {
    if (isDelivered) {
      highestCompletedIndex = 5;
      currentActiveIndex = -1; // All completed
    } else if (isDispatched) {
      // Dispatch is FINISHED and confirmed! Convoy is on the road.
      highestCompletedIndex = 4;
      currentActiveIndex = 5; // Delivered & Confirmed is currently in progress
    } else if (isAllocated) {
      // Stock allocation is FINISHED! Awaiting staging & dispatch.
      highestCompletedIndex = 3;
      currentActiveIndex = 4; // In Transit / Dispatched is awaiting convoy departure
    } else if (isPrioritized) {
      highestCompletedIndex = 2;
      currentActiveIndex = 3; // Stock Allocation is in progress
    } else if (isVerified) {
      highestCompletedIndex = 1;
      currentActiveIndex = 2; // Prioritization calculation is in progress
    } else {
      highestCompletedIndex = 0;
      currentActiveIndex = 1; // Under Verification is in progress
    }
  }

  const STAGE_CONFIGS = [
    {
      key: 'submitted',
      label: 'Submitted',
      shortLabel: 'Intake',
      description: 'Received by ResQGrid and assigned unique Request ID.',
      actor: 'ResQGrid Disaster Gateway',
      iso: timestamps.submitted,
      completed: highestCompletedIndex >= 0,
      current: currentActiveIndex === 0,
      isPartial: false,
      note: `Relief intake registered for ${req.peopleAffected} individuals in ${req.location.zoneName}.`,
    },
    {
      key: 'verified',
      label: 'Under Verification',
      shortLabel: 'Verified',
      description: 'Field scouts / satellite feeds confirm need & access route.',
      actor: 'Field Scout & Satellite Link',
      iso: timestamps.verified,
      completed: highestCompletedIndex >= 1,
      current: currentActiveIndex === 1,
      isPartial: false,
      note: isVerified
        ? `Field scouts verified location access (${req.location.accessibility.replace(/_/g, ' ')}) and civilian safety condition.`
        : 'Field volunteers assessing local flood line and access route accessibility.',
    },
    {
      key: 'prioritized',
      label: 'Prioritized & Queued',
      shortLabel: 'Prioritized',
      description: 'Ranked in coordinator dispatch queue via 55/20/15/10 engine.',
      actor: 'Algorithmic Triage Engine',
      iso: timestamps.prioritized,
      completed: highestCompletedIndex >= 2,
      current: currentActiveIndex === 2,
      isPartial: false,
      note: isPrioritized
        ? `Evaluated with Priority Score ${req.priorityScore.toFixed(1)}/100; ranked in regional dispatch queue.`
        : 'Awaiting prioritization calculation once field verification clears.',
    },
    {
      key: 'allocated',
      label: isPartial && highestCompletedIndex >= 3 ? 'Stock Allocated (Partial)' : 'Stock Allocated',
      shortLabel: isPartial ? 'Partial Stock' : 'Allocated',
      description: isPartial
        ? `Depot reserved ${req.allocatedQty}/${req.requestedQty} units; ${req.unfulfilledQty} deficit queued.`
        : 'Depot inventory reserved; 100% demand fulfilled.',
      actor: 'Warehouse Logistics Hub',
      iso: timestamps.allocated,
      completed: highestCompletedIndex >= 3,
      current: currentActiveIndex === 3,
      isPartial: isPartial && highestCompletedIndex >= 3,
      note: isAllocated
        ? isPartial
          ? `⚡ Partial stock reserved: ${req.allocatedQty} of ${req.requestedQty} units reserved${req.allocatedDepotId ? ' at ' + req.allocatedDepotId : ''}. Unmet deficit (${req.unfulfilledQty} units) preserved at Rank #1.`
          : `${req.allocatedQty} of ${req.requestedQty} units reserved${req.allocatedDepotId ? ' at ' + req.allocatedDepotId : ''} (100% Demand Met).`
        : 'Stock allocation pending available warehouse reserve.',
    },
    {
      key: 'dispatched',
      label: isPartial && highestCompletedIndex >= 4 ? 'Dispatched (Partial Batch)' : 'In Transit / Dispatched',
      shortLabel: 'Dispatched',
      description: isDispatched
        ? isPartial
          ? `Relief convoy en route with ${req.allocatedQty} units; ${req.unfulfilledQty} deficit prioritized for next run.`
          : `Relief convoy or emergency boat en route to ${req.location.zoneName} (${req.allocatedQty} units).`
        : 'Awaiting staging and transport dispatch convoy.',
      actor: 'Rapid Response Transport Unit',
      iso: timestamps.dispatched,
      completed: highestCompletedIndex >= 4,
      current: currentActiveIndex === 4,
      isPartial: isPartial && highestCompletedIndex >= 4,
      note: isDispatched
        ? isPartial
          ? `✓ Dispatched: First batch of ${req.allocatedQty} units departed depot; en route to ${req.location.zoneName}. Deficit (${req.unfulfilledQty} units) locked at Rank #1.`
          : `✓ Dispatched: Relief convoy departed depot; en route to ${req.location.zoneName} with full ${req.allocatedQty} units.`
        : 'Awaiting transport convoy departure.',
    },
    {
      key: 'delivered',
      label: 'Delivered & Confirmed',
      shortLabel: 'Delivered',
      description: isDelivered
        ? 'Supplies received on site; verified by local wardens.'
        : isDispatched
        ? `Relief convoy actively en route to ${req.location.zoneName}; awaiting on-site handover.`
        : 'Handover awaiting field convoy arrival.',
      actor: 'On-Site Relief Warden',
      iso: timestamps.delivered,
      completed: highestCompletedIndex >= 5,
      current: currentActiveIndex === 5,
      isPartial: false,
      note: isDelivered
        ? `Relief supplies safely delivered to ${req.location.zoneName} and confirmed on-site.`
        : isDispatched
        ? `Convoy en route to ${req.location.zoneName}. On-site relief wardens alerted for imminent handover.`
        : 'Handover awaiting field convoy arrival.',
    },
  ];

  const stages: ResolvedStage[] = STAGE_CONFIGS.map((cfg) => {
    const isCompleted = cfg.completed;
    const isCurrent = cfg.current;
    const isPending = !isCompleted && !isCurrent;

    return {
      key: cfg.key,
      label: cfg.label,
      shortLabel: cfg.shortLabel,
      description: cfg.description,
      actor: cfg.actor,
      isCompleted,
      isCurrent,
      isPending,
      isPartial: cfg.isPartial,
      timeFormatted: cfg.iso ? formatStageTime(cfg.iso) : undefined,
      dateTimeFormatted: cfg.iso ? formatStageDateTime(cfg.iso) : undefined,
      elapsed: cfg.iso ? getStageElapsed(cfg.iso, baseTimeIso) : undefined,
      operationalNote: cfg.note,
    };
  });

  const rejectionInfo = isRejected
    ? {
        reason: req.rejectionReason || 'Outside active disaster perimeter or non-relief commercial request.',
        timestamp: timestamps.rejected ? formatStageTime(timestamps.rejected) : req.rejectedAt,
        dateTime: timestamps.rejected ? formatStageDateTime(timestamps.rejected) : undefined,
        elapsed: timestamps.rejected ? getStageElapsed(timestamps.rejected, baseTimeIso) : undefined,
      }
    : undefined;

  return {
    stages,
    highestCompletedIndex,
    currentActiveIndex,
    isRejected,
    isPartial,
    rejectionInfo,
  };
}

export default function RequestTrackerView() {
  const searchParams = useSearchParams();
  const { requests, getRequestById } = useCitizenStore();

  const [searchId, setSearchId] = useState('');
  const [selectedRequest, setSelectedRequest] = useState<ReliefRequest | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isSearchingDb, setIsSearchingDb] = useState(false);

  // Check URL query param on mount or change - keep empty unless ?id= is specified
  useEffect(() => {
    const queryId = searchParams.get('id');
    if (!queryId) {
      // Keep completely empty by default; do not auto-select any request
      setSelectedRequest(null);
      setSearchId('');
      return;
    }

    const cleanId = queryId.trim().toUpperCase();
    setSearchId(cleanId);
    const found = getRequestById(cleanId);
    if (found && !selectedRequest) {
      setSelectedRequest(found);
      setErrorMsg(null);
    }

    // Always revalidate live against Neon DB to get the latest allocation/dispatch status
    fetch(`/api/requests/${encodeURIComponent(cleanId)}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data && data.id) {
          setSelectedRequest(data);
          setErrorMsg(null);
        } else if (!found) {
          setErrorMsg(`Request ID "${cleanId}" not found in current disaster database.`);
        }
      })
      .catch(() => {});
  }, [searchParams, getRequestById]);

  // Real-time live status tracking via Server-Sent Events (SSE) Stream + Live Polling Fallback
  useEffect(() => {
    if (!selectedRequest?.id) return;
    const reqId = selectedRequest.id;

    let es: EventSource | null = null;
    try {
      const coordinatorUrl = process.env.NEXT_PUBLIC_COORDINATOR_URL || 'https://resqgrid-main.vercel.app';
      es = new EventSource(`${coordinatorUrl}/api/requests/stream`);

      es.onmessage = (event) => {
        if (!event.data) return;
        try {
          const payload = JSON.parse(event.data);
          if (payload.type === 'REQUEST_UPDATED') {
            const updated = payload.data as ReliefRequest;
            if (updated && updated.id === reqId) {
              setSelectedRequest(updated);
            }
          } else if (payload.type === 'REQUESTS_RESET') {
            if (Array.isArray(payload.data)) {
              const matched = payload.data.find((r: ReliefRequest) => r.id === reqId);
              if (matched) setSelectedRequest(matched);
            }
          }
        } catch (_) {}
      };
    } catch (e) {
      console.warn('Tracker EventSource error:', e);
    }

    // Active revalidation poller (every 2.5s) while request is in progress to ensure 100% instant sync
    const poller = setInterval(() => {
      fetch(`/api/requests/${encodeURIComponent(reqId)}`)
        .then((res) => (res.ok ? res.json() : null))
        .then((data) => {
          if (data && data.id) {
            if (
              data.requestStatus !== selectedRequest.requestStatus ||
              data.allocatedQty !== selectedRequest.allocatedQty ||
              data.unfulfilledQty !== selectedRequest.unfulfilledQty ||
              data.verificationStatus !== selectedRequest.verificationStatus
            ) {
              setSelectedRequest(data);
            }
          }
        })
        .catch(() => {});
    }, 2500);

    // BroadcastChannel fallback for instant inter-tab reflection
    let channel: BroadcastChannel | null = null;
    if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
      try {
        channel = new BroadcastChannel('resqgrid_realtime');
        channel.onmessage = (event) => {
          if (event.data?.type === 'REQUEST_UPDATED' && event.data?.request?.id === reqId) {
            setSelectedRequest(event.data.request as ReliefRequest);
          } else if (event.data?.type === 'REQUEST_UPDATED' && event.data?.data?.id === reqId) {
            setSelectedRequest(event.data.data as ReliefRequest);
          }
        };
      } catch (_) {}
    }

    return () => {
      if (es) es.close();
      if (channel) channel.close();
      clearInterval(poller);
    };
  }, [selectedRequest?.id, selectedRequest?.requestStatus, selectedRequest?.allocatedQty, selectedRequest?.unfulfilledQty, selectedRequest?.verificationStatus]);

  const handleSearch = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!searchId.trim()) return;

    const term = searchId.trim().toUpperCase();
    setIsSearchingDb(true);
    try {
      const res = await fetch(`/api/requests/${encodeURIComponent(term)}`);
      if (res.ok) {
        const data = await res.json();
        setSelectedRequest(data);
        setErrorMsg(null);
      } else {
        const found = getRequestById(term);
        if (found) {
          setSelectedRequest(found);
          setErrorMsg(null);
        } else {
          setSelectedRequest(null);
          setErrorMsg(`No emergency request found matching "${term}". Please verify your Request ID.`);
        }
      }
    } catch {
      const found = getRequestById(term);
      if (found) {
        setSelectedRequest(found);
        setErrorMsg(null);
      } else {
        setSelectedRequest(null);
        setErrorMsg(`No emergency request found matching "${term}". Please verify your Request ID.`);
      }
    } finally {
      setIsSearchingDb(false);
    }
  };

  const handleSelectSample = (id: string) => {
    setSearchId(id);
    const found = getRequestById(id);
    if (found) {
      setSelectedRequest(found);
      setErrorMsg(null);
    }
    // Revalidate live from DB immediately so we never display stale cached status
    fetch(`/api/requests/${encodeURIComponent(id.trim().toUpperCase())}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data && data.id) {
          setSelectedRequest(data);
          setErrorMsg(null);
        }
      })
      .catch(() => {});
  };

  const formatResource = (res: string) => res.replace(/_/g, ' ');

  // Resolve Stage Information & Timestamps for selected request
  const stageInfo = selectedRequest ? resolveTrackingStages(selectedRequest) : null;
  const isRejected = stageInfo?.isRejected || false;

  return (
    <div className="space-y-8">
      {/* Search Header */}
      <div className="bg-white rounded-2xl p-6 sm:p-8 border border-slate-200/90 shadow-xs">
        <div className="max-w-2xl">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200/80 mb-3">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
            <span>Public Transparency & Real-Time Tracking</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
            Live Request Status Tracker
          </h1>
          <p className="mt-2 text-sm text-slate-600 leading-relaxed">
            Track your emergency relief request in real time with exact timestamps at every stage: verification, priority queue ranking, warehouse stock allocation, and field dispatch.
          </p>
        </div>

        {/* Search Bar */}
        <form onSubmit={handleSearch} className="mt-6 flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="w-5 h-5 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchId}
              onChange={(e) => setSearchId(e.target.value)}
              placeholder="Enter Request ID (e.g. REQ-1042, REQ-1052)"
              className="w-full pl-11 pr-4 py-3 rounded-xl border border-slate-300 text-sm font-mono uppercase font-bold text-slate-900 placeholder:normal-case placeholder:font-normal placeholder:text-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 focus:outline-hidden"
            />
          </div>
          <button
            type="submit"
            disabled={isSearchingDb}
            className="px-6 py-3 rounded-xl bg-blue-600 text-white font-bold text-sm hover:bg-blue-700 transition-colors shadow-xs flex items-center justify-center gap-2 disabled:opacity-70"
          >
            {isSearchingDb ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Checking Database...</span>
              </>
            ) : (
              <>
                <Search className="w-4 h-4" />
                <span>Track Request</span>
              </>
            )}
          </button>
        </form>

        {/* Quick Demo Pickers */}
        <div className="mt-5 flex items-center gap-2 flex-wrap text-xs text-slate-500">
          <span className="font-semibold text-slate-700">Quick Scenario Lookups:</span>
          {requests.map((req) => {
            const isMulti = req.requestedResources && req.requestedResources.length > 1;
            const isSelected = selectedRequest?.id === req.id;
            return (
              <button
                key={req.id}
                onClick={() => handleSelectSample(req.id)}
                className={`px-2.5 py-1.5 rounded-lg border font-mono font-medium transition-all flex items-center gap-1.5 ${
                  isSelected
                    ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                    : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                }`}
              >
                <span>{req.id}</span>
                {isMulti ? (
                  <span
                    className={`px-1.5 py-0.2 rounded text-[10px] font-bold ${
                      isSelected ? 'bg-blue-500 text-white' : 'bg-purple-100 text-purple-700'
                    }`}
                  >
                    {req.requestedResources?.length} Items
                  </span>
                ) : (
                  <span
                    className={`px-1.5 py-0.2 rounded text-[10px] font-bold ${
                      isSelected
                        ? 'bg-blue-500 text-white'
                        : req.requestStatus === 'delivered'
                        ? 'bg-emerald-100 text-emerald-700'
                        : req.requestStatus === 'rejected'
                        ? 'bg-rose-100 text-rose-700'
                        : 'bg-slate-200 text-slate-700'
                    }`}
                  >
                    {req.requestStatus.replace(/_/g, ' ')}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Error Message */}
      {errorMsg && (
        <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-sm flex items-center gap-3">
          <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Empty State when no request is selected */}
      {!selectedRequest && !errorMsg && (
        <div className="bg-white rounded-2xl p-10 sm:p-14 border border-slate-200/90 shadow-xs text-center flex flex-col items-center justify-center space-y-3.5">
          <div className="w-14 h-14 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center border border-blue-100 shadow-2xs">
            <Search className="w-7 h-7" />
          </div>
          <div className="space-y-1">
            <h3 className="text-base sm:text-lg font-bold text-slate-900">
              No Request Selected
            </h3>
            <p className="text-xs sm:text-sm text-slate-500 max-w-md mx-auto">
              Enter your tracking Request ID above, or click any of the scenario sample lookups to view live lifecycle milestones and dispatch timestamps.
            </p>
          </div>
        </div>
      )}

      {/* Selected Request Content */}
      {selectedRequest && stageInfo && (
        <div className="space-y-6 animate-in fade-in duration-200">
          {/* 1. Request Identity & Urgency Header Card */}
          <div className="bg-white rounded-2xl p-6 border border-slate-200/90 shadow-xs">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-slate-100">
              <div>
                <div className="flex items-center gap-3 flex-wrap">
                  <span className="text-2xl font-black text-slate-900 font-mono tracking-tight">
                    {selectedRequest.id}
                  </span>
                  <span
                    className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${
                      selectedRequest.urgencyLevel === 'immediate'
                        ? 'bg-rose-100 text-rose-800 border border-rose-200'
                        : selectedRequest.urgencyLevel === 'high'
                        ? 'bg-amber-100 text-amber-800 border border-amber-200'
                        : 'bg-blue-100 text-blue-800 border border-blue-200'
                    }`}
                  >
                    {selectedRequest.urgencyLevel} Urgency
                  </span>
                  <span className="px-3 py-1 rounded-full text-xs font-bold bg-slate-100 text-slate-800 border border-slate-200">
                    Priority Score: {selectedRequest.priorityScore.toFixed(1)} / 100
                  </span>
                  {selectedRequest.requestedResources && selectedRequest.requestedResources.length > 1 && (
                    <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-purple-100 text-purple-800 border border-purple-200">
                      Multi-Resource ({selectedRequest.requestedResources.length} Categories)
                    </span>
                  )}
                </div>
                <div className="text-xs text-slate-500 mt-2 flex items-center gap-3 flex-wrap">
                  <span className="flex items-center gap-1">
                    <User className="w-3.5 h-3.5 text-slate-400" />
                    <strong>Requester:</strong> {selectedRequest.requesterName}
                  </span>
                  <span>•</span>
                  <span className="flex items-center gap-1">
                    <PhoneCall className="w-3.5 h-3.5 text-slate-400" />
                    <strong>Contact:</strong> {selectedRequest.contactNumber}
                  </span>
                  <span>•</span>
                  <span className="flex items-center gap-1">
                    <Clock className="w-3.5 h-3.5 text-slate-400" />
                    <span>
                      Registered:{' '}
                      {selectedRequest.stageTimestamps?.submitted
                        ? formatStageDateTime(selectedRequest.stageTimestamps.submitted)
                        : new Date(selectedRequest.timestamp).toLocaleString()}
                    </span>
                  </span>
                </div>
              </div>

              {/* Status Badge */}
              <div className="flex items-center gap-2">
                <span
                  className={`px-4 py-2 rounded-xl text-xs font-extrabold uppercase tracking-wider shadow-2xs ${
                    isRejected
                      ? 'bg-rose-100 text-rose-800 border border-rose-200'
                      : selectedRequest.requestStatus === 'delivered'
                      ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                      : selectedRequest.requestStatus === 'dispatched'
                      ? 'bg-blue-100 text-blue-800 border border-blue-200'
                      : selectedRequest.requestStatus === 'fully_allocated'
                      ? 'bg-indigo-100 text-indigo-800 border border-indigo-200'
                      : selectedRequest.requestStatus === 'partially_allocated'
                      ? 'bg-amber-100 text-amber-800 border border-amber-200'
                      : 'bg-slate-100 text-slate-800 border border-slate-200'
                  }`}
                >
                  {selectedRequest.requestStatus.replace(/_/g, ' ')}
                </span>
              </div>
            </div>

            {/* Rejection Alert (If Rejected) */}
            {isRejected && (
              <div className="mt-4 p-4 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-900">
                <div className="flex items-center justify-between font-bold mb-1">
                  <div className="flex items-center gap-2">
                    <XCircle className="w-4 h-4 text-rose-600" />
                    <span>Request Rejection Recorded</span>
                  </div>
                  {stageInfo.rejectionInfo?.dateTime && (
                    <span className="text-rose-700 font-mono text-[11px]">
                      {stageInfo.rejectionInfo.dateTime}
                    </span>
                  )}
                </div>
                <p className="mt-1">
                  <strong>Reason:</strong> {stageInfo.rejectionInfo?.reason}
                </p>
                <div className="mt-2 text-[11px] text-rose-700 flex items-center gap-2">
                  <span>If you believe this was in error, contact the Emergency Operations Desk at +91 22 2400 9999.</span>
                </div>
              </div>
            )}

            {/* ADR-007 Partial Stock Allocation Notice */}
            {stageInfo.isPartial && !isRejected && (
              <div className="mt-5 p-4 rounded-xl bg-amber-50/90 border border-amber-200/90 flex items-start gap-3.5">
                <div className="w-9 h-9 rounded-xl bg-amber-500 text-white flex items-center justify-center shrink-0 shadow-xs mt-0.5">
                  <AlertTriangle className="w-5 h-5" />
                </div>
                <div className="flex-1 text-xs text-amber-900">
                  <div className="flex items-center gap-2 font-bold text-sm text-amber-950">
                    <span>Partial Fulfillment Protocol Active (ADR-007)</span>
                    <span className="px-2 py-0.5 rounded-full text-[10px] bg-amber-200/80 text-amber-900 uppercase font-black tracking-wide">
                      Split Batch Allocation
                    </span>
                  </div>
                  <p className="mt-1 leading-relaxed text-amber-900/90">
                    Due to depot stock limits, <strong className="font-bold text-amber-950">{selectedRequest.allocatedQty} of {selectedRequest.requestedQty} units</strong> have been released in this batch to prevent complete supply shortages.
                    {selectedRequest.requestStatus === 'dispatched'
                      ? ` Active relief convoy is currently transporting the first ${selectedRequest.allocatedQty} units to ${selectedRequest.location.zoneName}.`
                      : ` This first batch is reserved at ${selectedRequest.allocatedDepotId || 'the depot'} and prepared for dispatch.`}
                  </p>
                  <div className="mt-2.5 flex items-center gap-2 text-[11px] font-semibold text-amber-800 bg-amber-100/70 px-3 py-1.5 rounded-lg border border-amber-200/60 w-fit">
                    <ShieldCheck className="w-4 h-4 text-amber-700 shrink-0" />
                    <span>Unmet deficit of {selectedRequest.unfulfilledQty} units is locked at Priority Rank #1 for automatic dispatch upon depot restocking.</span>
                  </div>
                </div>
              </div>
            )}

            {/* 2. Visual 6-Stage Progress Stepper with Timestamps */}
            {!isRejected && (
              <div className="mt-8">
                <div className="flex items-center justify-between mb-6">
                  <div className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-2">
                    <History className="w-4 h-4 text-blue-600" />
                    <span>Lifecycle Dispatch Progress & Timestamps</span>
                  </div>
                  <div className="text-xs text-slate-400">
                    {stageInfo.currentActiveIndex >= 0
                      ? `Stage ${stageInfo.currentActiveIndex + 1} of ${stageInfo.stages.length} (In Progress)`
                      : `Stage 6 of 6 (Fully Completed)`}
                  </div>
                </div>

                <div className="relative">
                  {/* Stepper Nodes with Precise Gap-Only Segment Connectors */}
                  <div className="grid grid-cols-1 md:grid-cols-6 gap-4 relative">
                    {stageInfo.stages.map((stage, idx) => {
                      return (
                        <div
                          key={stage.key}
                          className="relative flex md:flex-col items-start md:items-center gap-3 md:text-center"
                        >
                          {/* Horizontal connector line strictly between circle outer boundaries (Desktop: md+) */}
                          {idx < stageInfo.stages.length - 1 && (
                            <div
                              className="hidden md:block absolute top-5 h-1 -z-0 pointer-events-none"
                              style={{
                                left: 'calc(50% + 22px)',
                                width: 'calc(100% + 1rem - 44px)',
                              }}
                            >
                              <div
                                className={`h-full transition-colors duration-500 rounded-full ${
                                  idx <= stageInfo.highestCompletedIndex ? 'bg-blue-600' : 'bg-slate-200'
                                }`}
                              />
                            </div>
                          )}

                          {/* Vertical connector line strictly between circle outer boundaries (Mobile: < md) */}
                          {idx < stageInfo.stages.length - 1 && (
                            <div
                              className="md:hidden absolute left-5 w-0.5 -z-0 pointer-events-none"
                              style={{
                                top: 'calc(2.5rem + 4px)',
                                height: 'calc(100% + 1rem - 48px)',
                              }}
                            >
                              <div
                                className={`w-full h-full transition-colors duration-500 rounded-full ${
                                  idx <= stageInfo.highestCompletedIndex ? 'bg-blue-600' : 'bg-slate-200'
                                }`}
                              />
                            </div>
                          )}

                          {/* Node Circle with Solid Background & Separate Ping Ring */}
                          <div className="relative flex items-center justify-center shrink-0">
                            {/* Outer Ping Wave for Active Stage (balanced 1.8s radar wave) */}
                            {stage.isCurrent && (
                              <span
                                className="absolute -inset-1.5 rounded-full bg-blue-500/30 animate-ping pointer-events-none"
                                style={{ animationDuration: '1.8s', animationTimingFunction: 'cubic-bezier(0, 0, 0.2, 1)' }}
                              />
                            )}

                            {/* 100% Solid Circle - Never translucent, z-10 on top */}
                            <div
                              className={`relative z-10 h-10 w-10 rounded-full flex items-center justify-center font-bold text-xs shrink-0 transition-all shadow-xs ${
                                stage.isCompleted
                                  ? stage.isPartial
                                    ? 'bg-amber-500 text-white shadow-amber-200 ring-2 ring-amber-300'
                                    : 'bg-blue-600 text-white shadow-blue-200'
                                  : stage.isCurrent
                                  ? 'bg-white border-2 border-blue-600 text-blue-600 ring-4 ring-blue-100 shadow-sm'
                                  : 'bg-white text-slate-400 border border-slate-300'
                              }`}
                            >
                              {stage.isCompleted ? (
                                stage.isPartial ? (
                                  <AlertTriangle className="w-5 h-5 text-white" />
                                ) : (
                                  <CheckCircle2 className="w-5 h-5 text-white" />
                                )
                              ) : (
                                idx + 1
                              )}
                            </div>
                          </div>

                          {/* Node Text & Timestamps */}
                          <div className="flex-1">
                            <div
                              className={`text-xs font-bold ${
                                stage.isCurrent
                                  ? 'text-blue-700'
                                  : stage.isCompleted
                                  ? stage.isPartial
                                    ? 'text-amber-800'
                                    : 'text-slate-900'
                                  : 'text-slate-400'
                              }`}
                            >
                              {stage.label}
                            </div>

                            {/* Timestamp Pill for Each Stage */}
                            <div className="mt-1 flex md:justify-center">
                              {stage.isCompleted && stage.timeFormatted ? (
                                <span
                                  className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold border ${
                                    stage.isPartial
                                      ? 'bg-amber-50 text-amber-800 border-amber-300'
                                      : 'bg-emerald-50 text-emerald-700 border-emerald-200/80'
                                  }`}
                                >
                                  {stage.isPartial ? (
                                    <AlertTriangle className="w-2.5 h-2.5 text-amber-600" />
                                  ) : (
                                    <Clock className="w-2.5 h-2.5 text-emerald-600" />
                                  )}
                                  <span>{stage.isPartial ? `Partial (${stage.timeFormatted})` : stage.timeFormatted}</span>
                                </span>
                              ) : stage.isCurrent ? (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-blue-50 text-blue-700 border border-blue-200">
                                  <Clock className="w-2.5 h-2.5 text-blue-600 animate-spin" />
                                  <span>In Progress {stage.timeFormatted ? `(${stage.timeFormatted})` : ''}</span>
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-slate-50 text-slate-400 border border-slate-200/60">
                                  <span>Pending</span>
                                </span>
                              )}
                            </div>

                            <div className="text-[11px] text-slate-500 mt-1 leading-snug">
                              {stage.description}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* 3. Detailed Chronological Lifecycle Stage Audit Timeline */}
          <div className="bg-white rounded-2xl p-6 border border-slate-200/90 shadow-xs space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <History className="w-5 h-5 text-blue-600" />
                <h3 className="text-base font-bold text-slate-900">
                  State Transition & Timestamp Audit Trail
                </h3>
              </div>
              <span className="text-xs text-slate-500 font-medium">
                Live Serverless Ledger Sync
              </span>
            </div>

            <div className="space-y-3 pt-1">
              {stageInfo.stages.map((stg, i) => {
                const isReached = stg.isCompleted || stg.isCurrent;
                return (
                  <div
                    key={stg.key}
                    className={`p-3.5 rounded-xl border transition-all ${
                      stg.isCurrent
                        ? 'bg-blue-50/70 border-blue-200 ring-2 ring-blue-100'
                        : stg.isCompleted
                        ? stg.isPartial
                          ? 'bg-amber-50/70 border-amber-200'
                          : 'bg-slate-50/80 border-slate-200'
                        : 'bg-white border-slate-100 opacity-60'
                    }`}
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div className="flex items-start sm:items-center gap-3">
                        <div
                          className={`w-7 h-7 rounded-lg flex items-center justify-center font-bold text-xs shrink-0 ${
                            stg.isCompleted
                              ? stg.isPartial
                                ? 'bg-amber-500 text-white'
                                : 'bg-blue-600 text-white'
                              : stg.isCurrent
                              ? 'bg-blue-600 text-white shadow-xs'
                              : 'bg-slate-200 text-slate-500'
                          }`}
                        >
                          {stg.isCompleted ? (
                            stg.isPartial ? <AlertTriangle className="w-4 h-4" /> : <CheckCircle2 className="w-4 h-4" />
                          ) : (
                            i + 1
                          )}
                        </div>

                        <div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-sm font-bold text-slate-900">{stg.label}</span>
                            <span
                              className={`px-2 py-0.5 rounded-md text-[10px] font-extrabold uppercase ${
                                stg.isCompleted
                                  ? stg.isPartial
                                    ? 'bg-amber-100 text-amber-800'
                                    : 'bg-emerald-100 text-emerald-800'
                                  : stg.isCurrent
                                  ? 'bg-blue-100 text-blue-800'
                                  : 'bg-slate-100 text-slate-500'
                              }`}
                            >
                              {stg.isCompleted
                                ? stg.isPartial
                                  ? 'Partially Allocated'
                                  : 'Completed'
                                : stg.isCurrent
                                ? 'In Progress'
                                : 'Awaiting'}
                            </span>
                            <span className="text-[11px] font-medium text-slate-500 bg-white px-2 py-0.5 rounded border border-slate-200">
                              {stg.actor}
                            </span>
                          </div>
                          <p className="text-xs text-slate-600 mt-1">{stg.operationalNote}</p>
                        </div>
                      </div>

                      {/* Timestamps on Right */}
                      <div className="sm:text-right shrink-0 pl-10 sm:pl-0">
                        {isReached && stg.dateTimeFormatted ? (
                          <>
                            <div className="text-xs font-mono font-bold text-slate-800 flex items-center sm:justify-end gap-1.5">
                              <Clock className="w-3.5 h-3.5 text-blue-600" />
                              <span>{stg.dateTimeFormatted}</span>
                            </div>
                            {stg.elapsed && (
                              <div className="text-[11px] text-slate-500 font-mono mt-0.5">
                                {stg.elapsed}
                              </div>
                            )}
                          </>
                        ) : (
                          <span className="text-xs text-slate-400 font-mono">--:--:--</span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}

              {/* Rejection Stage Milestone (If Rejected) */}
              {isRejected && stageInfo.rejectionInfo && (
                <div className="p-3.5 rounded-xl border bg-rose-50 border-rose-200">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div className="flex items-start sm:items-center gap-3">
                      <div className="w-7 h-7 rounded-lg bg-rose-600 text-white flex items-center justify-center shrink-0">
                        <XCircle className="w-4 h-4" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-bold text-rose-900">Request Rejected</span>
                          <span className="px-2 py-0.5 rounded-md text-[10px] font-extrabold uppercase bg-rose-200 text-rose-900">
                            Rejected
                          </span>
                        </div>
                        <p className="text-xs text-rose-800 mt-1">
                          {stageInfo.rejectionInfo.reason}
                        </p>
                      </div>
                    </div>
                    <div className="sm:text-right shrink-0 pl-10 sm:pl-0">
                      <div className="text-xs font-mono font-bold text-rose-900">
                        {stageInfo.rejectionInfo.dateTime || stageInfo.rejectionInfo.timestamp || 'Recorded'}
                      </div>
                      {stageInfo.rejectionInfo.elapsed && (
                        <div className="text-[11px] text-rose-700 font-mono mt-0.5">
                          {stageInfo.rejectionInfo.elapsed}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* 4. Stock Allocation Transparency Gauge Card (Multi-Resource Support) */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Fulfillment Status Gauge */}
            <div className="md:col-span-2 bg-white rounded-2xl p-6 border border-slate-200/90 shadow-xs space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <PackageCheck className="w-5 h-5 text-blue-600" />
                  <span>Supply Fulfillment Transparency</span>
                </h3>
                <span className="text-xs font-bold text-slate-500 capitalize">
                  {selectedRequest.requestedResources && selectedRequest.requestedResources.length > 1
                    ? `${selectedRequest.requestedResources.length} Multi-Resource Categories`
                    : formatResource(selectedRequest.resourceType)}
                </span>
              </div>

              {/* Overall Progress Bar */}
              <div>
                <div className="flex justify-between text-xs font-bold text-slate-700 mb-2">
                  <span>
                    Fulfilled:{' '}
                    <strong className="text-emerald-600">
                      {selectedRequest.allocatedQty} units
                    </strong>{' '}
                    of {selectedRequest.requestedQty}
                  </span>
                  <span className="text-blue-600 font-mono">
                    {Math.round((selectedRequest.allocatedQty / Math.max(1, selectedRequest.requestedQty)) * 100)}% Complete
                  </span>
                </div>

                <div className="h-3 w-full bg-slate-100 rounded-full overflow-hidden flex">
                  {/* Allocated Portion */}
                  <div
                    className="h-full bg-emerald-500 transition-all duration-500"
                    style={{
                      width: `${Math.min(
                        100,
                        (selectedRequest.allocatedQty / Math.max(1, selectedRequest.requestedQty)) * 100
                      )}%`,
                    }}
                  />
                  {/* Unmet Portion */}
                  {selectedRequest.unfulfilledQty > 0 && (
                    <div
                      className="h-full bg-amber-400/80 transition-all duration-500"
                      style={{
                        width: `${Math.min(
                          100,
                          (selectedRequest.unfulfilledQty / Math.max(1, selectedRequest.requestedQty)) * 100
                        )}%`,
                      }}
                    />
                  )}
                </div>
              </div>

              {/* 3 Metrics Cards */}
              <div className="grid grid-cols-3 gap-3 pt-2">
                <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-center">
                  <span className="text-[11px] text-slate-500 block">Demanded Total</span>
                  <span className="text-lg font-black text-slate-900 font-mono">
                    {selectedRequest.requestedQty}
                  </span>
                </div>

                <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-center">
                  <span className="text-[11px] text-emerald-700 block">Warehouse Reserved</span>
                  <span className="text-lg font-black text-emerald-800 font-mono">
                    {selectedRequest.allocatedQty}
                  </span>
                </div>

                <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-center">
                  <span className="text-[11px] text-amber-700 block">Unmet Deficit</span>
                  <span className="text-lg font-black text-amber-800 font-mono">
                    {selectedRequest.unfulfilledQty}
                  </span>
                </div>
              </div>

              {/* Multi-Resource Category Breakdown */}
              {selectedRequest.requestedResources && selectedRequest.requestedResources.length > 1 && (
                <div className="pt-3 border-t border-slate-100 space-y-2">
                  <div className="text-xs font-bold text-slate-800 flex items-center justify-between">
                    <span>Itemized Resource Allocation ({selectedRequest.requestedResources.length} items):</span>
                    <span className="text-slate-400 font-normal">Per-category fulfillment</span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    {selectedRequest.requestedResources.map((res) => {
                      const itemPercent = Math.round(
                        (res.allocatedQty / Math.max(1, res.requestedQty)) * 100
                      );
                      return (
                        <div
                          key={res.resourceType}
                          className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs space-y-1.5"
                        >
                          <div className="flex items-center justify-between font-semibold">
                            <span className="capitalize text-slate-900">
                              {formatResource(res.resourceType)}
                            </span>
                            <span className="font-mono text-blue-600 font-bold">{itemPercent}%</span>
                          </div>
                          <div className="h-2 w-full bg-slate-200 rounded-full overflow-hidden flex">
                            <div
                              className="h-full bg-emerald-500 transition-all duration-300"
                              style={{ width: `${itemPercent}%` }}
                            />
                            {res.unfulfilledQty > 0 && (
                              <div
                                className="h-full bg-amber-400"
                                style={{ width: `${100 - itemPercent}%` }}
                              />
                            )}
                          </div>
                          <div className="flex items-center justify-between text-[11px] text-slate-500">
                            <span>
                              Allocated:{' '}
                              <strong className="text-emerald-700">{res.allocatedQty}</strong> / {res.requestedQty}
                            </span>
                            {res.unfulfilledQty > 0 ? (
                              <span className="text-amber-700 font-medium">
                                -{res.unfulfilledQty} deficit
                              </span>
                            ) : (
                              <span className="text-emerald-700 font-bold">Fulfilled</span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Partial Fulfillment Explanation Notice */}
              {selectedRequest.requestStatus === 'partially_allocated' && (
                <div className="p-3.5 rounded-xl bg-amber-50/80 border border-amber-200 text-xs text-amber-900 flex items-start gap-2.5">
                  <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                  <div>
                    <strong>Partial Stock Fulfillment Rule (ADR-007):</strong> The initial {selectedRequest.allocatedQty} units are dispatched immediately. The remaining unmet deficit of{' '}
                    <strong>{selectedRequest.unfulfilledQty} units</strong> is strictly preserved at the top of the coordinator priority queue and will be fulfilled upon incoming replenishment.
                  </div>
                </div>
              )}

              {/* Full Allocation Notice */}
              {(selectedRequest.requestStatus === 'fully_allocated' || (selectedRequest.unfulfilledQty === 0 && selectedRequest.allocatedQty > 0)) && (
                <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-900 flex items-start gap-2.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                  <div>
                    <strong>100% Demand Fulfilled:</strong> All {selectedRequest.requestedQty} demanded units have been successfully allocated from regional warehouse stock.
                  </div>
                </div>
              )}
            </div>

            {/* Logistics & Location Details Card */}
            <div className="bg-white rounded-2xl p-6 border border-slate-200/90 shadow-xs space-y-4">
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <MapPin className="w-4 h-4 text-blue-600" />
                <span>Dispatch Logistics</span>
              </h3>

              <div className="space-y-3 text-xs">
                <div>
                  <span className="text-slate-500 block mb-0.5">Assigned Sector:</span>
                  <span className="font-bold text-slate-800">
                    {selectedRequest.location.zoneName}
                  </span>
                </div>

                <div>
                  <span className="text-slate-500 block mb-0.5">Accessibility Status:</span>
                  <span
                    className={`inline-block font-semibold px-2 py-0.5 rounded-full text-[10px] uppercase ${
                      selectedRequest.location.accessibility === 'flooded_boat_only'
                        ? 'bg-rose-100 text-rose-800'
                        : selectedRequest.location.accessibility === 'debris_delay'
                        ? 'bg-amber-100 text-amber-800'
                        : 'bg-emerald-100 text-emerald-800'
                    }`}
                  >
                    {selectedRequest.location.accessibility.replace(/_/g, ' ')}
                  </span>
                </div>

                <div>
                  <span className="text-slate-500 block mb-0.5">Fulfilling Depot:</span>
                  <span className="font-bold text-slate-800 flex items-center gap-1.5">
                    <Building2 className="w-3.5 h-3.5 text-slate-400" />
                    <span>
                      {selectedRequest.allocatedDepotId || 'Awaiting Depot Assignment'}
                    </span>
                  </span>
                </div>

                <div>
                  <span className="text-slate-500 block mb-0.5">People Protected:</span>
                  <span className="font-bold text-slate-800">
                    {selectedRequest.peopleAffected} individuals
                  </span>
                </div>

                {selectedRequest.notes && (
                  <div className="pt-2 border-t border-slate-100">
                    <span className="text-slate-500 block mb-0.5 font-semibold">
                      Field Situation Notes:
                    </span>
                    <p className="text-slate-700 italic bg-slate-50 p-2.5 rounded-lg border border-slate-100">
                      "{selectedRequest.notes}"
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>


        </div>
      )}
    </div>
  );
}
