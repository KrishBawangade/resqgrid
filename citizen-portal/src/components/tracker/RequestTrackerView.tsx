'use client';

import { useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import {
  Search,
  CheckCircle2,
  Clock,
  ShieldAlert,
  AlertTriangle,
  Truck,
  PackageCheck,
  Building2,
  MapPin,
  Calendar,
  Sparkles,
  RefreshCw,
  HelpCircle,
  XCircle,
  ExternalLink,
  Loader2,
} from 'lucide-react';
import { ReliefRequest, RequestStatus } from '@/lib/types';
import { useCitizenStore } from '@/lib/store/useCitizenStore';

// The 6 Progressive Stages for Live Citizen Tracking
interface StageDef {
  key: string;
  label: string;
  description: string;
}

const TRACKING_STAGES: StageDef[] = [
  {
    key: 'submitted',
    label: 'Submitted',
    description: 'Received by ResQGrid and assigned unique Request ID.',
  },
  {
    key: 'verified',
    label: 'Under Verification',
    description: 'Field scouts / satellite feeds confirm need & access route.',
  },
  {
    key: 'prioritized',
    label: 'Prioritized & Queued',
    description: 'Ranked in the coordinator dispatch queue via 55/20/15/10 engine.',
  },
  {
    key: 'allocated',
    label: 'Stock Allocated',
    description: 'Depot inventory reserved; partial deficits remain queued.',
  },
  {
    key: 'dispatched',
    label: 'In Transit / Dispatched',
    description: 'Relief convoy or emergency boat en route to location.',
  },
  {
    key: 'delivered',
    label: 'Delivered & Confirmed',
    description: 'Supplies received on site; verified by local wardens.',
  },
];

function getStageIndex(status: RequestStatus): number {
  switch (status) {
    case 'submitted':
      return 0;
    case 'verified':
      return 1;
    case 'partially_allocated':
    case 'fully_allocated':
      return 3; // Step 4 (index 3)
    case 'dispatched':
      return 4; // Step 5 (index 4)
    case 'delivered':
      return 5; // Step 6 (index 5)
    case 'rejected':
      return -1;
    default:
      return 0;
  }
}

export default function RequestTrackerView() {
  const searchParams = useSearchParams();
  const { requests, getRequestById, resetDemoState } = useCitizenStore();

  const [searchId, setSearchId] = useState('');
  const [selectedRequest, setSelectedRequest] = useState<ReliefRequest | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isSearchingDb, setIsSearchingDb] = useState(false);

  // Check URL query param on mount or change
  useEffect(() => {
    const queryId = searchParams.get('id');
    if (queryId) {
      setSearchId(queryId);
      const found = getRequestById(queryId);
      if (found) {
        setSelectedRequest(found);
        setErrorMsg(null);
      } else {
        // Query Neon PostgreSQL database live
        fetch(`/api/requests/${encodeURIComponent(queryId.trim().toUpperCase())}`)
          .then((res) => (res.ok ? res.json() : null))
          .then((data) => {
            if (data && data.id) {
              setSelectedRequest(data);
              setErrorMsg(null);
            } else {
              setErrorMsg(`Request ID "${queryId}" not found in current disaster database.`);
            }
          })
          .catch(() => {
            setErrorMsg(`Request ID "${queryId}" not found in current disaster database.`);
          });
      }
    } else if (requests.length > 0 && !selectedRequest) {
      // Default to the first request (e.g. REQ-1042)
      setSelectedRequest(requests[0]);
      setSearchId(requests[0].id);
    }
  }, [searchParams, requests, getRequestById]);

  // Real-time live status tracking via Server-Sent Events (SSE) Stream (Zero Polling)
  useEffect(() => {
    if (!selectedRequest?.id) return;
    const reqId = selectedRequest.id;

    let es: EventSource | null = null;
    try {
      es = new EventSource('http://localhost:3000/api/requests/stream');

      es.onmessage = (event) => {
        if (!event.data) return;
        try {
          const payload = JSON.parse(event.data);
          if (payload.type === 'REQUEST_UPDATED' && payload.data?.id === reqId) {
            setSelectedRequest(payload.data as ReliefRequest);
          }
        } catch (_) {}
      };
    } catch (e) {
      console.warn('Tracker EventSource error:', e);
    }

    // BroadcastChannel fallback for instant inter-tab reflection
    let channel: BroadcastChannel | null = null;
    if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
      try {
        channel = new BroadcastChannel('resqgrid_realtime');
        channel.onmessage = (event) => {
          if (event.data?.type === 'REQUEST_UPDATED' && event.data?.request?.id === reqId) {
            setSelectedRequest(event.data.request as ReliefRequest);
          }
        };
      } catch (_) {}
    }

    return () => {
      if (es) es.close();
      if (channel) channel.close();
    };
  }, [selectedRequest?.id]);

  const handleSearch = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!searchId.trim()) return;

    const term = searchId.trim().toUpperCase();
    const found = getRequestById(term);
    if (found) {
      setSelectedRequest(found);
      setErrorMsg(null);
      return;
    }

    setIsSearchingDb(true);
    try {
      const res = await fetch(`/api/requests/${encodeURIComponent(term)}`);
      if (res.ok) {
        const data = await res.json();
        setSelectedRequest(data);
        setErrorMsg(null);
      } else {
        setSelectedRequest(null);
        setErrorMsg(`No emergency request found matching "${term}". Please verify your ID.`);
      }
    } catch {
      setSelectedRequest(null);
      setErrorMsg(`No emergency request found matching "${term}". Please verify your ID.`);
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
    } else {
      fetch(`/api/requests/${encodeURIComponent(id.trim().toUpperCase())}`)
        .then((res) => (res.ok ? res.json() : null))
        .then((data) => {
          if (data && data.id) {
            setSelectedRequest(data);
            setErrorMsg(null);
          }
        })
        .catch(() => {});
    }
  };

  const currentStageIdx = selectedRequest ? getStageIndex(selectedRequest.requestStatus) : 0;
  const isRejected = selectedRequest?.requestStatus === 'rejected';

  const formatResource = (res: string) => res.replace(/_/g, ' ');

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
            Track your emergency relief request in real time. Full transparency on verification, warehouse stock allocation, and dispatch progress.
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
              placeholder="Enter Request ID (e.g. REQ-1042)"
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
        <div className="mt-4 flex items-center gap-2 flex-wrap text-xs text-slate-500">
          <span className="font-semibold text-slate-700">Quick Demo Lookups:</span>
          {requests.slice(0, 5).map((req) => (
            <button
              key={req.id}
              onClick={() => handleSelectSample(req.id)}
              className={`px-2.5 py-1 rounded-md border font-mono font-medium transition-colors ${
                selectedRequest?.id === req.id
                  ? 'bg-blue-600 text-white border-blue-600'
                  : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
              }`}
            >
              {req.id} ({req.requestStatus.replace(/_/g, ' ')})
            </button>
          ))}
        </div>
      </div>

      {/* Error Message */}
      {errorMsg && (
        <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-sm flex items-center gap-3">
          <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Selected Request Content */}
      {selectedRequest && (
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
                    Priority Score: {selectedRequest.priorityScore} / 100
                  </span>
                </div>
                <div className="text-xs text-slate-500 mt-1 flex items-center gap-3 flex-wrap">
                  <span>
                    <strong>Requester:</strong> {selectedRequest.requesterName}
                  </span>
                  <span>•</span>
                  <span>
                    <strong>Contact:</strong> {selectedRequest.contactNumber}
                  </span>
                  <span>•</span>
                  <span className="flex items-center gap-1">
                    <Clock className="w-3.5 h-3.5" />
                    <span>Registered: {new Date(selectedRequest.timestamp).toLocaleTimeString()}</span>
                  </span>
                </div>
              </div>

              {/* Status Badge */}
              <div className="flex items-center gap-2">
                <span
                  className={`px-4 py-2 rounded-xl text-xs font-extrabold uppercase tracking-wider ${
                    isRejected
                      ? 'bg-rose-100 text-rose-800 border border-rose-200'
                      : selectedRequest.requestStatus === 'delivered'
                      ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                      : selectedRequest.requestStatus === 'dispatched'
                      ? 'bg-blue-100 text-blue-800 border border-blue-200'
                      : selectedRequest.requestStatus === 'partially_allocated'
                      ? 'bg-amber-100 text-amber-800 border border-amber-200'
                      : 'bg-indigo-100 text-indigo-800 border border-indigo-200'
                  }`}
                >
                  {selectedRequest.requestStatus.replace(/_/g, ' ')}
                </span>
              </div>
            </div>

            {/* Rejection Alert (If Rejected) */}
            {isRejected && (
              <div className="mt-4 p-4 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-900">
                <div className="flex items-center gap-2 font-bold mb-1">
                  <XCircle className="w-4 h-4 text-rose-600" />
                  <span>Request Rejection Recorded</span>
                </div>
                <p>
                  <strong>Reason:</strong> {selectedRequest.rejectionReason || 'Non-disaster zone or duplicate submission.'}
                </p>
                {selectedRequest.rejectedAt && (
                  <p className="text-rose-700 mt-0.5">Timestamp: {selectedRequest.rejectedAt}</p>
                )}
              </div>
            )}

            {/* 2. Visual 6-Stage Progress Stepper */}
            {!isRejected && (
              <div className="mt-8">
                <div className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-6">
                  Lifecycle Dispatch Progress
                </div>

                <div className="relative">
                  {/* Background Connector Line */}
                  <div className="absolute top-5 left-4 right-4 h-1 bg-slate-100 -z-0 hidden md:block" />
                  <div
                    className="absolute top-5 left-4 h-1 bg-blue-600 transition-all duration-500 -z-0 hidden md:block"
                    style={{
                      width: `${Math.min(100, (currentStageIdx / (TRACKING_STAGES.length - 1)) * 100)}%`,
                    }}
                  />

                  {/* Stepper Nodes */}
                  <div className="grid grid-cols-1 md:grid-cols-6 gap-4 relative z-10">
                    {TRACKING_STAGES.map((stage, idx) => {
                      const isCompleted = idx < currentStageIdx;
                      const isCurrent = idx === currentStageIdx;
                      const isUpcoming = idx > currentStageIdx;

                      return (
                        <div
                          key={stage.key}
                          className="flex md:flex-col items-start md:items-center gap-3 md:text-center"
                        >
                          {/* Node Circle */}
                          <div
                            className={`h-10 w-10 rounded-full flex items-center justify-center font-bold text-xs shrink-0 transition-all shadow-xs ${
                              isCompleted
                                ? 'bg-blue-600 text-white'
                                : isCurrent
                                ? 'bg-white border-2 border-blue-600 text-blue-600 ring-4 ring-blue-100 animate-pulse'
                                : 'bg-slate-100 text-slate-400 border border-slate-200'
                            }`}
                          >
                            {isCompleted ? <CheckCircle2 className="w-5 h-5" /> : idx + 1}
                          </div>

                          {/* Node Text */}
                          <div className="flex-1">
                            <div
                              className={`text-xs font-bold ${
                                isCurrent
                                  ? 'text-blue-700'
                                  : isCompleted
                                  ? 'text-slate-900'
                                  : 'text-slate-400'
                              }`}
                            >
                              {stage.label}
                            </div>
                            <div className="text-[11px] text-slate-500 mt-0.5 leading-snug">
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

          {/* 3. Stock Allocation Transparency Gauge Card */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Fulfillment Status Gauge */}
            <div className="md:col-span-2 bg-white rounded-2xl p-6 border border-slate-200/90 shadow-xs space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <PackageCheck className="w-5 h-5 text-blue-600" />
                  <span>Supply Fulfillment Transparency</span>
                </h3>
                <span className="text-xs font-bold text-slate-500 capitalize">
                  {formatResource(selectedRequest.resourceType)}
                </span>
              </div>

              {/* Progress Bar */}
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
                    {Math.round((selectedRequest.allocatedQty / selectedRequest.requestedQty) * 100)}% Complete
                  </span>
                </div>

                <div className="h-3 w-full bg-slate-100 rounded-full overflow-hidden flex">
                  {/* Allocated Portion */}
                  <div
                    className="h-full bg-emerald-500 transition-all duration-500"
                    style={{
                      width: `${Math.min(
                        100,
                        (selectedRequest.allocatedQty / selectedRequest.requestedQty) * 100
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
                          (selectedRequest.unfulfilledQty / selectedRequest.requestedQty) * 100
                        )}%`,
                      }}
                    />
                  )}
                </div>
              </div>

              {/* 3 Metrics Cards */}
              <div className="grid grid-cols-3 gap-3 pt-2">
                <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-center">
                  <span className="text-[11px] text-slate-500 block">Requested</span>
                  <span className="text-lg font-black text-slate-900 font-mono">
                    {selectedRequest.requestedQty}
                  </span>
                </div>

                <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-center">
                  <span className="text-[11px] text-emerald-700 block">Allocated</span>
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

              {/* If multiple resources requested, show breakdown list */}
              {selectedRequest.requestedResources && selectedRequest.requestedResources.length > 1 && (
                <div className="pt-2 border-t border-slate-100">
                  <div className="text-xs font-bold text-slate-700 mb-2">
                    All Requested Resources ({selectedRequest.requestedResources.length} items):
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {selectedRequest.requestedResources.map((res) => (
                      <div
                        key={res.resourceType}
                        className="p-2.5 rounded-lg bg-slate-50 border border-slate-200 text-xs flex items-center justify-between"
                      >
                        <span className="font-semibold text-slate-800 capitalize">
                          {formatResource(res.resourceType)}
                        </span>
                        <span className="font-mono text-slate-700 font-bold">
                          {res.requestedQty} units
                        </span>
                      </div>
                    ))}
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
              {selectedRequest.requestStatus === 'fully_allocated' && (
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
                      Field Notes:
                    </span>
                    <p className="text-slate-700 italic bg-slate-50 p-2.5 rounded-lg border border-slate-100">
                      "{selectedRequest.notes}"
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* 4. AI Triage Insight Banner (If Available) */}
          {(selectedRequest.aiTriageInsight || selectedRequest.aiTriageDetails) && (
            <div className="bg-linear-to-r from-indigo-50 to-blue-50 rounded-2xl p-5 border border-indigo-200/90 shadow-2xs flex items-start gap-3 text-xs text-indigo-950">
              <div className="h-8 w-8 rounded-lg bg-indigo-600 flex items-center justify-center text-white shrink-0 mt-0.5 shadow-2xs">
                <Sparkles className="w-4 h-4" />
              </div>
              <div className="flex-1 space-y-1.5">
                <div className="flex items-center justify-between mb-1">
                  <span className="font-bold uppercase tracking-wider text-indigo-800 text-[10px]">
                    AI Clinical Triage Evaluation
                  </span>
                  <div className="flex items-center gap-2">
                    {selectedRequest.aiTriageDetails?.engineUsed && (
                      <span className="text-[10px] font-semibold text-indigo-700 bg-white/80 px-2 py-0.5 rounded-sm border border-indigo-200">
                        {selectedRequest.aiTriageDetails.engineUsed === 'gemini-llm' ? 'Gemini 2.5 Flash' : 'NLP Engine'}
                      </span>
                    )}
                    {selectedRequest.aiConfidence && (
                      <span className="font-semibold text-indigo-700">
                        Confidence: {selectedRequest.aiConfidence}%
                      </span>
                    )}
                  </div>
                </div>
                {selectedRequest.aiTriageInsight && (
                  <p className="leading-relaxed font-medium">{selectedRequest.aiTriageInsight}</p>
                )}
                {selectedRequest.aiTriageDetails && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1 border-t border-indigo-200/60 text-[11px]">
                    {selectedRequest.aiTriageDetails.criticalityReason && (
                      <div>
                        <span className="font-bold text-indigo-900 block">
                          Criticality Evaluation ({selectedRequest.aiTriageDetails.criticalityScore}/100):
                        </span>
                        <span className="text-indigo-800">{selectedRequest.aiTriageDetails.criticalityReason}</span>
                      </div>
                    )}
                    {selectedRequest.aiTriageDetails.vulnerabilityReason && (
                      <div>
                        <span className="font-bold text-indigo-900 block">
                          Vulnerability Evaluation ({selectedRequest.aiTriageDetails.vulnerabilityScore}/100):
                        </span>
                        <span className="text-indigo-800">{selectedRequest.aiTriageDetails.vulnerabilityReason}</span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
