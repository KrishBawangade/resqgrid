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
import { Info } from 'lucide-react';

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

export default function CoordinatorOperationsPage() {
  const [requests, setRequests] = useState<ReliefRequest[]>(INITIAL_REQUESTS);
  const [depots, setDepots] = useState<ReliefDepot[]>(INITIAL_DEPOTS);
  const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>(INITIAL_AUDIT_LOGS);
  const [selectedRequest, setSelectedRequest] = useState<ReliefRequest | null>(null);
  const [queueTab, setQueueTab] = useState<QueueTabType>('needs_attention');
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 4000);
  };

  // 1. Verify Request
  const handleVerify = (id: string) => {
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
  };

  // 2. Stock-Aware Resource Allocation
  const handleAllocate = (id: string) => {
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
  };

  // 3. Coordinator Priority Override
  const handleOverrideScore = (id: string, newScore: number, reason: string) => {
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
  };

  // 4. Reject Request
  const handleReject = (id: string, reason: string) => {
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
  };

  // 5. Restore Rejected Request
  const handleRestore = (id: string) => {
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
