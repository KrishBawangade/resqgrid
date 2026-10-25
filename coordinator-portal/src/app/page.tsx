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
import { Info, RefreshCw, RotateCcw } from 'lucide-react';

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

  // Initial fetch on mount for requests, depots, and audit trail
  const loadInitialRequests = React.useCallback(async (isManual = false) => {
    if (isFetchingRef.current) return;
    isFetchingRef.current = true;
    if (isManual) setIsRefreshingManually(true);

    try {
      const [reqRes, depotsRes, auditRes] = await Promise.all([
        fetch('/api/requests', { cache: 'no-store' }),
        fetch('/api/depots', { cache: 'no-store' }),
        fetch('/api/audit', { cache: 'no-store' }),
      ]);

      if (reqRes.ok) {
        const data: ReliefRequest[] = await reqRes.json();
        if (Array.isArray(data)) {
          const seen = new Set<string>();
          const unique = data.filter((r) => {
            if (seen.has(r.id)) return false;
            seen.add(r.id);
            return true;
          });
          setRequests(unique);
          unique.forEach((r) => knownRequestIdsRef.current.add(r.id));
        }
      }

      if (depotsRes.ok) {
        const data: ReliefDepot[] = await depotsRes.json();
        if (Array.isArray(data) && data.length > 0) {
          setDepots(data);
        }
      }

      if (auditRes.ok) {
        const data: AuditLogEntry[] = await auditRes.json();
        if (Array.isArray(data) && data.length > 0) {
          setAuditLogs(data);
        }
      }

      setIsLiveActive(true);
      setLastSyncTime(new Date());
    } catch (e) {
      console.warn('Initial data load error:', e);
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
            if (Array.isArray(payload.data)) {
              setRequests(payload.data as ReliefRequest[]);
            } else {
              const updated = payload.data as ReliefRequest;
              setRequests((prev) =>
                prev.map((r) => (r.id === updated.id ? { ...r, ...updated } : r))
              );
              setSelectedRequest((curr) =>
                curr && curr.id === updated.id ? { ...curr, ...updated } : curr
              );
            }
          } else if (payload.type === 'REQUESTS_RESET' && payload.data) {
            const resetList = payload.data as ReliefRequest[];
            if (Array.isArray(resetList)) {
              setRequests(resetList);
              showToast('🔄 Real-Time Sync: Relief requests reset to benchmark state.');
            }
          } else if (payload.type === 'REQUEST_DELETED' && payload.data) {
            const deletedId = (payload.data as { id?: string })?.id;
            if (deletedId) {
              setRequests((prev) => prev.filter((r) => r.id !== deletedId));
              setSelectedRequest((curr) => (curr?.id === deletedId ? null : curr));
            }
          } else if (payload.type === 'DEPOTS_UPDATED' && payload.data) {
            const updatedDepots = payload.data as ReliefDepot[];
            if (Array.isArray(updatedDepots)) {
              setDepots(updatedDepots);
              showToast('📦 Real-Time Sync: Depot inventory updated across operational grid.');
            }
          } else if (payload.type === 'AUDIT_LOG_ADDED' && payload.data) {
            const newLog = payload.data as AuditLogEntry;
            setAuditLogs((prev) => [newLog, ...prev]);
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
          } else if (event.data?.type === 'DEPOTS_UPDATED' && event.data?.data) {
            setDepots(event.data.data as ReliefDepot[]);
          } else if (event.data?.type === 'REQUEST_UPDATED' && event.data?.data) {
            const updated = event.data.data as ReliefRequest;
            setRequests((prev) => prev.map((r) => (r.id === updated.id ? updated : r)));
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
    const nowIso = new Date().toISOString();
    const req = requests.find((r) => r.id === id);
    const updatedTimestamps = {
      ...(req?.stageTimestamps || {}),
      submitted: req?.stageTimestamps?.submitted || req?.timestamp || nowIso,
      verified: nowIso,
      prioritized: nowIso,
    };
    const updatedReq: ReliefRequest | null = req ? {
      ...req,
      verificationStatus: 'verified',
      requestStatus: req.requestStatus === 'submitted' ? 'queued' : req.requestStatus,
      stageTimestamps: updatedTimestamps,
    } : null;

    setRequests((prev) =>
      prev.map((r) => (r.id === id && updatedReq ? updatedReq : r))
    );
    if (selectedRequest && selectedRequest.id === id && updatedReq) {
      setSelectedRequest(updatedReq);
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
        body: JSON.stringify({
          id,
          verificationStatus: 'verified',
          requestStatus: updatedReq?.requestStatus,
          stageTimestamps: updatedTimestamps,
        }),
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

    const nowIso = new Date().toISOString();
    const updatedWithTimestamps: ReliefRequest = {
      ...updatedRequest,
      stageTimestamps: {
        ...(updatedRequest.stageTimestamps || req.stageTimestamps || {}),
        allocated: nowIso,
      },
    };

    setDepots(updatedDepots);
    setRequests((prev) => prev.map((r) => (r.id === id ? updatedWithTimestamps : r)));
    if (selectedRequest && selectedRequest.id === id) {
      setSelectedRequest(updatedWithTimestamps);
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

    // Cross-tab broadcast for instant reflect
    if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
      try {
        const ch = new BroadcastChannel('resqgrid_realtime');
        ch.postMessage({ type: 'DEPOTS_UPDATED', data: updatedDepots });
        ch.postMessage({ type: 'REQUEST_UPDATED', data: updatedWithTimestamps });
        ch.close();
      } catch {}
    }

    // Persist to Neon DB: both the request and the depot stock levels
    try {
      await fetch('/api/requests', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id,
          requestStatus: updatedWithTimestamps.requestStatus,
          allocatedDepotId: updatedWithTimestamps.allocatedDepotId,
          allocatedQty: updatedWithTimestamps.allocatedQty,
          unfulfilledQty: updatedWithTimestamps.unfulfilledQty,
          requestedResources: updatedWithTimestamps.requestedResources,
          depotAllocations: result.allocations || [],
          stageTimestamps: updatedWithTimestamps.stageTimestamps,
        }),
      });

      if (result.allocations && result.allocations.length > 0) {
        for (const alloc of result.allocations) {
          if (alloc.quantity > 0) {
            await fetch('/api/depots', {
              method: 'PATCH',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                action: 'allocate',
                depotId: alloc.depotId,
                resourceType: alloc.resourceType,
                quantity: alloc.quantity,
                requestId: req.id,
                actor: 'Stock Allocation Engine',
                details: `Allocated ${alloc.quantity} ${alloc.resourceType.replace('_', ' ')} from ${alloc.depotName}`,
              }),
            });
          }
        }
      }
    } catch (err) {
      console.error('Failed to persist allocation to Neon DB:', err);
    }
  };

  // 3. Dispatch Relief Package to Field (Stage 2: In Transit Corridor)
  const handleDispatch = async (id: string) => {
    const req = requests.find((r) => r.id === id);
    if (!req) return;

    const nowIso = new Date().toISOString();
    const updatedTimestamps = {
      ...(req.stageTimestamps || {}),
      dispatched: nowIso,
    };
    const updatedRequest: ReliefRequest = {
      ...req,
      requestStatus: 'dispatched',
      stageTimestamps: updatedTimestamps,
    };
    setRequests((prev) => prev.map((r) => (r.id === id ? updatedRequest : r)));
    if (selectedRequest && selectedRequest.id === id) {
      setSelectedRequest(updatedRequest);
    }

    const log: AuditLogEntry = {
      id: `AUD-${Math.floor(800 + Math.random() * 200)}`,
      timestamp: new Date().toLocaleTimeString() + ' UTC',
      category: 'ALLOCATION',
      action: 'RELIEF_DISPATCHED',
      actor: 'Chief Coordinator Vance',
      details: `Dispatched ${req.allocatedQty} units of ${req.resourceType.replace('_', ' ')} for ${req.requesterName} from ${req.allocatedDepotId || 'Depot'}. Cargo en route in transit corridor.`,
      delta: `Dispatched ${req.id}`,
    };
    setAuditLogs((prev) => [log, ...prev]);
    showToast(`🚚 Relief package for ${id} dispatched into field corridor!`);

    // Cross-tab broadcast
    if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
      try {
        const ch = new BroadcastChannel('resqgrid_realtime');
        ch.postMessage({ type: 'REQUEST_UPDATED', data: updatedRequest });
        ch.close();
      } catch {}
    }

    try {
      await fetch('/api/requests', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id,
          requestStatus: 'dispatched',
          allocatedDepotId: req.allocatedDepotId,
          allocatedQty: req.allocatedQty,
          resourceType: req.resourceType,
          stageTimestamps: updatedTimestamps,
        }),
      });
    } catch (err) {
      console.error('Failed to persist dispatch to Neon DB:', err);
    }
  };

  // 4. Confirm Citizen Field Delivery & Fulfill Demand (Stage 3: 100% Fulfilled & Reservation Cleared)
  const handleDeliver = async (id: string) => {
    const req = requests.find((r) => r.id === id);
    if (!req) return;

    const nowIso = new Date().toISOString();
    const updatedTimestamps = {
      ...(req.stageTimestamps || {}),
      delivered: nowIso,
    };
    const updatedRequest: ReliefRequest = {
      ...req,
      requestStatus: 'delivered',
      stageTimestamps: updatedTimestamps,
    };
    setRequests((prev) => prev.map((r) => (r.id === id ? updatedRequest : r)));
    if (selectedRequest && selectedRequest.id === id) {
      setSelectedRequest(updatedRequest);
    }

    // Deduct reserved stock in frontend state so it immediately shows as unreserved
    let updatedDepots = depots;
    const itemsToClear = (req.requestedResources && req.requestedResources.length > 0)
      ? req.requestedResources
      : [{ resourceType: req.resourceType, allocatedQty: req.allocatedQty, requestedQty: req.requestedQty, unfulfilledQty: 0 }];

    if (req.allocatedDepotId) {
      updatedDepots = depots.map((d) => {
        if (d.id === req.allocatedDepotId) {
          const newInv = { ...d.inventory };
          for (const item of itemsToClear) {
            if (item.allocatedQty > 0 && newInv[item.resourceType]) {
              newInv[item.resourceType] = {
                ...newInv[item.resourceType],
                allocatedStock: Math.max(0, newInv[item.resourceType].allocatedStock - item.allocatedQty),
              };
            }
          }
          return { ...d, inventory: newInv };
        }
        return d;
      });
      setDepots(updatedDepots);
    }

    const log: AuditLogEntry = {
      id: `AUD-${Math.floor(800 + Math.random() * 200)}`,
      timestamp: new Date().toLocaleTimeString() + ' UTC',
      category: 'ALLOCATION',
      action: 'DELIVERY_FULFILLED',
      actor: 'Field Operations Crew',
      details: `Confirmed delivery of ${req.allocatedQty} total units across ${itemsToClear.length} categories to ${req.requesterName}. Demand 100% fulfilled. Reserved stock cleared.`,
      delta: `Delivered ${req.id}`,
    };
    setAuditLogs((prev) => [log, ...prev]);
    showToast(`✓ Demand ${id} successfully delivered & 100% fulfilled in field!`);

    // Cross-tab broadcast: broadcast BOTH request AND depots so inventory page updates instantly
    if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
      try {
        const ch = new BroadcastChannel('resqgrid_realtime');
        ch.postMessage({ type: 'REQUEST_UPDATED', data: updatedRequest });
        ch.postMessage({ type: 'DEPOTS_UPDATED', data: updatedDepots });
        ch.close();
      } catch {}
    }

    try {
      await fetch('/api/requests', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id,
          requestStatus: 'delivered',
          allocatedDepotId: req.allocatedDepotId,
          allocatedQty: req.allocatedQty,
          resourceType: req.resourceType,
          requestedResources: req.requestedResources,
        }),
      });

      if (req.allocatedDepotId) {
        for (const item of itemsToClear) {
          if (item.allocatedQty > 0) {
            await fetch('/api/depots', {
              method: 'PATCH',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                action: 'deliver',
                depotId: req.allocatedDepotId,
                resourceType: item.resourceType,
                quantity: item.allocatedQty,
                requestId: req.id,
                actor: 'Field Operations Crew',
                details: `Delivered ${item.allocatedQty} ${item.resourceType.replace('_', ' ')} for ${req.id}. Warehouse reservation cleared.`,
              }),
            });
          }
        }
      }
    } catch (err) {
      console.error('Failed to persist delivery to Neon DB:', err);
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
    const nowIso = new Date().toISOString();
    const req = requests.find((r) => r.id === id);
    const updatedTimestamps = {
      ...(req?.stageTimestamps || {}),
      rejected: nowIso,
    };

    setRequests((prev) =>
      prev.map((r) =>
        r.id === id
          ? {
              ...r,
              verificationStatus: 'rejected',
              requestStatus: 'rejected',
              rejectionReason: reason,
              rejectedAt: new Date().toLocaleTimeString() + ' UTC',
              stageTimestamps: updatedTimestamps,
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
              stageTimestamps: updatedTimestamps,
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
          stageTimestamps: updatedTimestamps,
        }),
      });
    } catch (err) {
      console.error('Failed to persist rejection to Neon DB:', err);
    }
  };

  // 5. Restore Rejected Request
  const handleRestore = async (id: string) => {
    const nowIso = new Date().toISOString();
    const req = requests.find((r) => r.id === id);
    const updatedTimestamps = {
      ...(req?.stageTimestamps || {}),
      verified: nowIso,
      prioritized: nowIso,
      rejected: undefined,
    };
    const updatedReq: ReliefRequest | null = req
      ? {
          ...req,
          verificationStatus: 'verified',
          requestStatus: 'queued',
          rejectionReason: undefined,
          rejectedAt: undefined,
          stageTimestamps: updatedTimestamps,
        }
      : null;

    setRequests((prev) =>
      prev.map((r) => (r.id === id && updatedReq ? updatedReq : r))
    );
    if (selectedRequest && selectedRequest.id === id && updatedReq) {
      setSelectedRequest(updatedReq);
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
          requestStatus: 'queued',
          rejectionReason: null,
          stageTimestamps: updatedTimestamps,
        }),
      });
    } catch (err) {
      console.error('Failed to persist restore to Neon DB:', err);
    }
  };

  // 6. Reset Demo Scenario to Pristine Benchmark
  const [isResettingScenario, setIsResettingScenario] = useState(false);

  const handleResetScenario = async () => {
    setIsResettingScenario(true);
    try {
      const res = await fetch('/api/scenario/reset', { method: 'POST' });
      if (res.ok) {
        const data = await res.json();
        if (data.requests) {
          setRequests(data.requests);
        }
        if (data.depots) {
          setDepots(data.depots);
        }
        setSelectedRequest(null);
        showToast('✓ Disaster scenario reset to benchmark baseline: all 5 initial requests restored in Neon DB.');
        loadInitialRequests(false);
      } else {
        showToast('Failed to reset scenario. Check server logs.');
      }
    } catch (err) {
      console.error('Reset scenario error:', err);
      showToast('Network error while resetting scenario.');
    } finally {
      setIsResettingScenario(false);
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

        <div className="flex items-center space-x-2">
          <button
            onClick={handleResetScenario}
            disabled={isResettingScenario}
            className="inline-flex items-center space-x-1.5 px-3 py-1 rounded-lg text-xs font-semibold text-slate-700 bg-white border border-slate-200/90 hover:bg-slate-50 hover:text-slate-900 transition-colors shadow-2xs disabled:opacity-50"
            title="Reset requests, depot inventory, and orders to benchmark starting state in Neon DB"
          >
            <RotateCcw className={`w-3.5 h-3.5 ${isResettingScenario ? 'animate-spin text-amber-600' : 'text-slate-500'}`} />
            <span>{isResettingScenario ? 'Resetting...' : 'Reset Scenario'}</span>
          </button>

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
      </div>

      {/* Top Operations KPI Metrics Ribbon */}
      <OperationsSummaryRibbon
        requests={requests}
        depots={depots}
        onSelectPendingVerification={() => {
          setSelectedRequest(null);
          setQueueTab('needs_attention');
        }}
        onSelectCriticalTriage={() => {
          setSelectedRequest(null);
          setQueueTab('needs_attention');
        }}
        onSelectActiveDemands={() => {
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
            onResetScenario={handleResetScenario}
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
                onDispatch={handleDispatch}
                onDeliver={handleDeliver}
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
                onDispatch={handleDispatch}
                onDeliver={handleDeliver}
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
