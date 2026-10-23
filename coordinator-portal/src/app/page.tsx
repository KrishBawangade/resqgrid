'use client';

import React, { useState } from 'react';
import dynamic from 'next/dynamic';
import { AnimatePresence } from 'framer-motion';
import { 
  INITIAL_REQUESTS, 
  INITIAL_DEPOTS, 
  INITIAL_AUDIT_LOGS 
} from '@/lib/data/initialScenario';
import { ReliefRequest, ReliefDepot, AuditLogEntry } from '@/lib/types';
import { allocateResources } from '@/lib/engines/allocation';
import OperationsSummaryRibbon from '@/components/dashboard/OperationsSummaryRibbon';
import PrioritizedQueueTable, { QueueTabType } from '@/components/dashboard/PrioritizedQueueTable';
import ScoreInspectorDrawer from '@/components/dashboard/ScoreInspectorDrawer';
import IncidentBriefingBanner from '@/components/dashboard/IncidentBriefingBanner';
import { Info, RefreshCw } from 'lucide-react';

// Dynamically import Leaflet map for SSR safety
const InteractiveDisasterMap = dynamic(
  () => import('@/components/dashboard/InteractiveDisasterMap'),
  { 
    ssr: false,
    loading: () => (
      <div className="w-full h-full min-h-[580px] rounded-2xl bg-slate-100 flex items-center justify-center text-slate-400 text-xs font-semibold animate-pulse border border-slate-200">
        Loading Disaster Zone Map (Leaflet)...
      </div>
    )
  }
);

// Soft Web Audio API alert chime for new incoming requests
function playAlertChime() {
  try {
    const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof window.AudioContext }).webkitAudioContext;
    if (!AudioContextClass) return;
    const ctx = new AudioContextClass();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(587.33, ctx.currentTime); // D5
    osc.frequency.setValueAtTime(880, ctx.currentTime + 0.12); // A5

    gain.gain.setValueAtTime(0.12, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.45);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start();
    osc.stop(ctx.currentTime + 0.45);
  } catch {
    // Silently ignore if audio autoplay blocked by browser policy
  }
}

export default function CoordinatorOperationsPage() {
  const [requests, setRequests] = useState<ReliefRequest[]>(INITIAL_REQUESTS);
  const [depots, setDepots] = useState<ReliefDepot[]>(INITIAL_DEPOTS);
  const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>(INITIAL_AUDIT_LOGS);
  const [selectedRequest, setSelectedRequest] = useState<ReliefRequest | null>(null);
  const [queueTab, setQueueTab] = useState<QueueTabType>('needs_attention');
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [isLiveActive, setIsLiveActive] = useState(true);
  const [lastSyncTime, setLastSyncTime] = useState<Date | null>(null);
  const [isRefreshingManually, setIsRefreshingManually] = useState(false);

  const initialLoadDoneRef = React.useRef(false);
  const knownRequestIdsRef = React.useRef<Set<string>>(new Set(INITIAL_REQUESTS.map((r) => r.id)));
  const isFetchingRef = React.useRef(false);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 4000);
  };

  // Initial fetch on mount
  const loadInitialRequests = React.useCallback(async (isManual = false) => {
    if (isFetchingRef.current) return;
    isFetchingRef.current = true;
    if (isManual) setIsRefreshingManually(true);

    try {
      const res = await fetch('/api/requests', { cache: 'no-store' });
      if (!res.ok) throw new Error('Failed to fetch requests');
      const data: ReliefRequest[] = await res.json();
      if (Array.isArray(data)) {
        setRequests(data);
        data.forEach((r) => knownRequestIdsRef.current.add(r.id));
      }
      setIsLiveActive(true);
      setLastSyncTime(new Date());
    } catch (e) {
      console.warn('Initial request load error:', e);
    } finally {
      isFetchingRef.current = false;
      if (isManual) setIsRefreshingManually(false);
    }
  }, []);

  // 1. Establish Real-Time Server-Sent Events (SSE) Stream
  React.useEffect(() => {
    loadInitialRequests();

    // Connect to persistent SSE Stream (0 polling, 100% event-driven)
    let eventSource: EventSource | null = null;
    try {
      eventSource = new EventSource('/api/requests/stream');

      eventSource.onopen = () => {
        setIsLiveActive(true);
        setLastSyncTime(new Date());
      };

      eventSource.onmessage = (event) => {
        setLastSyncTime(new Date());
        if (!event.data) return;

        try {
          const payload = JSON.parse(event.data);

          if (payload.type === 'NEW_REQUEST' && payload.data) {
            const newReq = payload.data as ReliefRequest;
            setRequests((prev) => {
              if (prev.some((r) => r.id === newReq.id)) return prev;
              playAlertChime();
              showToast(`🚨 Real-Time Stream: New Request ${newReq.id} received in ${newReq.location.zoneName} (${newReq.peopleAffected} people)`);
              knownRequestIdsRef.current.add(newReq.id);
              return [newReq, ...prev];
            });
          } else if (payload.type === 'REQUEST_UPDATED' && payload.data) {
            const updated = payload.data as ReliefRequest;
            setRequests((prev) =>
              prev.map((r) => (r.id === updated.id ? { ...r, ...updated } : r))
            );
            setSelectedRequest((curr) =>
              curr && curr.id === updated.id ? { ...curr, ...updated } : curr
            );
          }
        } catch {
          // Ignored for keepalive ping
        }
      };

      eventSource.onerror = () => {
        setIsLiveActive(false);
      };
    } catch (err) {
      console.warn('EventSource initialization error:', err);
    }

    // Immediate sync on tab focus or visibility resume
    const handleFocus = () => loadInitialRequests();
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        loadInitialRequests();
      }
    };

    window.addEventListener('focus', handleFocus);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    // Cross-tab broadcast channel for local instant reflection
    let channel: BroadcastChannel | null = null;
    if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
      try {
        channel = new BroadcastChannel('resqgrid_realtime');
        channel.onmessage = (event) => {
          if (event.data?.type === 'NEW_REQUEST_SUBMITTED' && event.data?.request) {
            const newReq = event.data.request as ReliefRequest;
            setRequests((prev) => {
              if (prev.some((r) => r.id === newReq.id)) return prev;
              playAlertChime();
              showToast(`🚨 New Request ${newReq.id} received in ${newReq.location.zoneName}`);
              return [newReq, ...prev];
            });
          }
        };
      } catch (err) {
        console.warn('BroadcastChannel error:', err);
      }
    }

    return () => {
      if (eventSource) {
        eventSource.close();
      }
      window.removeEventListener('focus', handleFocus);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      if (channel) {
        channel.close();
      }
    };
  }, [loadInitialRequests]);

  // 1. Verify Request
  const handleVerify = async (id: string) => {
    setRequests((prev) =>
      prev.map((r) => (r.id === id ? { ...r, verificationStatus: 'verified' } : r))
    );
    if (selectedRequest && selectedRequest.id === id) {
      setSelectedRequest((prev) => (prev ? { ...prev, verificationStatus: 'verified' } : null));
    }
    const log: AuditLogEntry = {
      id: `AUD-${Math.floor(800 + Math.random() * 200)}`,
      timestamp: new Date().toLocaleTimeString() + ' UTC',
      category: 'VERIFICATION',
      action: 'REQUEST_VERIFIED',
      actor: 'Coordinator Vance',
      details: `Request ${id} verified via field volunteer radio report.`,
    };
    setAuditLogs((prev) => [log, ...prev]);
    showToast(`✓ Request ${id} verified. Priority score active in dispatch queue.`);

    // Persist to Neon DB
    try {
      await fetch('/api/requests', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, verificationStatus: 'verified' }),
      });
    } catch (err) {
      console.error('Failed to persist verification to Neon DB:', err);
    }
  };

  // 2. Stock-Aware Resource Allocation
  const handleAllocate = async (id: string) => {
    const req = requests.find((r) => r.id === id);
    if (!req) return;

    const { result, updatedDepots, updatedRequest } = allocateResources(req, depots);

    setDepots(updatedDepots);
    setRequests((prev) => prev.map((r) => (r.id === id ? updatedRequest : r)));
    if (selectedRequest && selectedRequest.id === id) {
      setSelectedRequest(updatedRequest);
    }

    const log: AuditLogEntry = {
      id: `AUD-${Math.floor(800 + Math.random() * 200)}`,
      timestamp: new Date().toLocaleTimeString() + ' UTC',
      category: 'ALLOCATION',
      action: result.isPartial ? 'PARTIAL_STOCK_ALLOCATION' : 'FULL_STOCK_ALLOCATION',
      actor: 'Stock Allocation Engine',
      details: result.message,
      delta: result.depotName ? `-${result.allocatedQty} Units (${result.depotName})` : undefined,
    };
    setAuditLogs((prev) => [log, ...prev]);
    showToast(result.message);

    // Persist to Neon DB
    try {
      await fetch('/api/requests', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id,
          requestStatus: updatedRequest.requestStatus,
          allocatedDepotId: updatedRequest.allocatedDepotId,
          allocatedQty: updatedRequest.allocatedQty,
          unfulfilledQty: updatedRequest.unfulfilledQty,
          requestedResources: updatedRequest.requestedResources,
        }),
      });
    } catch (err) {
      console.error('Failed to persist allocation to Neon DB:', err);
    }
  };

  // 3. Coordinator Priority Override
  const handleOverrideScore = async (id: string, newScore: number, reason: string) => {
    setRequests((prev) =>
      prev.map((r) => {
        if (r.id === id) {
          return {
            ...r,
            priorityScore: newScore,
            priorityOverride: {
              id: `OVR-${Math.floor(100 + Math.random() * 900)}`,
              requestId: id,
              originalScore: r.priorityScore,
              overriddenScore: newScore,
              reason,
              coordinator: 'Chief Coordinator Vance',
              timestamp: new Date().toISOString(),
            },
          };
        }
        return r;
      })
    );

    if (selectedRequest && selectedRequest.id === id) {
      setSelectedRequest((prev) => (prev ? { ...prev, priorityScore: newScore } : null));
    }

    const log: AuditLogEntry = {
      id: `AUD-${Math.floor(800 + Math.random() * 200)}`,
      timestamp: new Date().toLocaleTimeString() + ' UTC',
      category: 'OVERRIDE',
      action: 'PRIORITY_OVERRIDE_APPROVED',
      actor: 'Chief Coordinator Vance',
      details: `Score for ${id} overridden to ${newScore.toFixed(1)}. Justification: "${reason}"`,
    };
    setAuditLogs((prev) => [log, ...prev]);
    showToast(`✓ Priority score overridden to ${newScore.toFixed(1)}. Reason logged to audit ledger.`);

    // Persist to Neon DB
    try {
      await fetch('/api/requests', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, priorityScore: newScore }),
      });
    } catch (err) {
      console.error('Failed to persist override to Neon DB:', err);
    }
  };

  // 4. Reject Request
  const handleReject = async (id: string, reason: string) => {
    setRequests((prev) =>
      prev.map((r) =>
        r.id === id
          ? {
              ...r,
              verificationStatus: 'rejected',
              requestStatus: 'rejected',
              rejectionReason: reason,
              rejectedAt: new Date().toLocaleTimeString() + ' UTC',
            }
          : r
      )
    );
    if (selectedRequest && selectedRequest.id === id) {
      setSelectedRequest((prev) =>
        prev
          ? {
              ...prev,
              verificationStatus: 'rejected',
              requestStatus: 'rejected',
              rejectionReason: reason,
              rejectedAt: new Date().toLocaleTimeString() + ' UTC',
            }
          : null
      );
    }
    const log: AuditLogEntry = {
      id: `AUD-${Math.floor(800 + Math.random() * 200)}`,
      timestamp: new Date().toLocaleTimeString() + ' UTC',
      category: 'VERIFICATION',
      action: 'REQUEST_REJECTED',
      actor: 'Coordinator Vance',
      details: `Request ${id} rejected. Reason: "${reason}"`,
    };
    setAuditLogs((prev) => [log, ...prev]);
    showToast(`Request ${id} marked as rejected. Reason logged to audit ledger.`);

    // Persist to Neon DB
    try {
      await fetch('/api/requests', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id,
          verificationStatus: 'rejected',
          requestStatus: 'rejected',
          rejectionReason: reason,
        }),
      });
    } catch (err) {
      console.error('Failed to persist rejection to Neon DB:', err);
    }
  };

  // 5. Restore Rejected Request
  const handleRestore = async (id: string) => {
    setRequests((prev) =>
      prev.map((r) =>
        r.id === id
          ? {
              ...r,
              verificationStatus: 'verified',
              requestStatus: 'submitted',
              rejectionReason: undefined,
              rejectedAt: undefined,
            }
          : r
      )
    );
    if (selectedRequest && selectedRequest.id === id) {
      setSelectedRequest((prev) =>
        prev
          ? {
              ...prev,
              verificationStatus: 'verified',
              requestStatus: 'submitted',
              rejectionReason: undefined,
              rejectedAt: undefined,
            }
          : null
      );
    }
    showToast(`✓ Request ${id} restored to active dispatch queue.`);

    // Persist to Neon DB
    try {
      await fetch('/api/requests', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id,
          verificationStatus: 'verified',
          requestStatus: 'submitted',
          rejectionReason: null,
        }),
      });
    } catch (err) {
      console.error('Failed to persist restore to Neon DB:', err);
    }
  };

  return (
    <div className="space-y-4">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-5 right-5 z-50 bg-slate-900 text-white px-4 py-2.5 rounded-xl shadow-xl text-xs font-semibold flex items-center space-x-2 border border-slate-700 animate-bounce">
          <Info className="w-4 h-4 text-blue-400" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Active Incident Headline Briefing */}
      <IncidentBriefingBanner />

      {/* Real-time Neon PostgreSQL Live Sync Indicator */}
      <div className="flex flex-wrap items-center justify-between gap-2 px-1 py-0.5">
        <div className="flex items-center space-x-2 text-xs">
          <span className="flex h-2.5 w-2.5 relative items-center justify-center">
            <span className={`inline-flex rounded-full h-2 w-2 ${isLiveActive ? 'bg-emerald-500' : 'bg-amber-500'}`}></span>
          </span>
          <span className="font-semibold text-slate-800">
            {isLiveActive ? 'Live Real-Time SSE Stream Active' : 'Connecting to Real-Time Feed...'}
          </span>
          <span className="text-slate-300">•</span>
          <span className="text-slate-500 font-mono text-[11px]">
            Neon PostgreSQL • Persistent SSE Stream (Zero Polling) • Last synced: {lastSyncTime ? lastSyncTime.toLocaleTimeString() : 'Connecting...'}
          </span>
        </div>

        <button
          onClick={() => loadInitialRequests(true)}
          disabled={isRefreshingManually}
          className="inline-flex items-center space-x-1.5 px-3 py-1 rounded-lg text-xs font-semibold text-slate-700 bg-white border border-slate-200/90 hover:bg-slate-50 hover:text-slate-900 transition-colors shadow-2xs disabled:opacity-50"
          title="Manually trigger immediate Neon PostgreSQL database fetch"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isRefreshingManually ? 'animate-spin text-blue-600' : 'text-slate-500'}`} />
          <span>{isRefreshingManually ? 'Syncing...' : 'Sync Now'}</span>
        </button>
      </div>

      {/* Top Operations KPI Metrics Ribbon */}
      <OperationsSummaryRibbon
        requests={requests}
        depots={depots}
        onSelectPendingVerification={() => {
          setSelectedRequest(null);
          setQueueTab('needs_attention');
        }}
      />

      {/* Map-First Tactical Split: Left (60% Map) & Right (40% Queue with Inline Expansion) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
        {/* Left Column (60% Map): Large Interactive Disaster Zone Map (Always 100% visible) */}
        <div className="lg:col-span-7 h-[600px] sticky top-16">
          <InteractiveDisasterMap
            requests={requests}
            depots={depots}
            selectedRequestId={selectedRequest?.id || null}
            onSelectRequest={(req) => setSelectedRequest(req)}
          />
        </div>

        {/* Right Column (40% Column): Queue List OR Selected Card Full View */}
        <div className="lg:col-span-5 h-[600px] relative">
          <AnimatePresence mode="wait">
            {!selectedRequest ? (
              <PrioritizedQueueTable
                key="queue-table"
                requests={requests}
                selectedRequestId={null}
                activeTab={queueTab}
                onTabChange={setQueueTab}
                onSelectRequest={(req) => setSelectedRequest(req)}
                onVerify={handleVerify}
                onReject={handleReject}
                onRestore={handleRestore}
              />
            ) : (
              <ScoreInspectorDrawer
                key="score-inspector"
                request={selectedRequest}
                requests={requests}
                depots={depots}
                onClose={() => setSelectedRequest(null)}
                onSelectRequest={(req) => setSelectedRequest(req)}
                onVerify={handleVerify}
                onAllocate={handleAllocate}
                onOverrideScore={handleOverrideScore}
                onReject={handleReject}
                onRestore={handleRestore}
              />
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
