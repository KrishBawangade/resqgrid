import { ReliefRequest, StageTimestamps } from '../types';

/**
 * Derives comprehensive, realistic sequential timestamps for every stage
 * of a relief request based on its current lifecycle status and submission time.
 */
export function deriveStageTimestamps(req: {
  timestamp?: string | Date;
  verificationStatus?: string;
  requestStatus?: string;
  allocatedQty?: number;
  unfulfilledQty?: number;
  rejectedAt?: string;
  stageTimestamps?: StageTimestamps;
}): StageTimestamps {
  const existing = req.stageTimestamps || {};
  const baseIso = req.timestamp ? new Date(req.timestamp).toISOString() : new Date().toISOString();
  const baseTime = new Date(baseIso).getTime();

  const submitted = existing.submitted || baseIso;

  // Handle rejected lifecycle
  if (req.requestStatus === 'rejected' || req.verificationStatus === 'rejected') {
    return {
      submitted,
      ...(existing.verified ? { verified: existing.verified } : {}),
      rejected: existing.rejected || (req.rejectedAt ? new Date(req.rejectedAt).toISOString() : new Date(baseTime + 8 * 60 * 1000).toISOString()),
    };
  }

  const isDelivered = req.requestStatus === 'delivered';
  const isDispatched = isDelivered || req.requestStatus === 'dispatched';
  const isAllocated = isDispatched || req.requestStatus === 'fully_allocated' || req.requestStatus === 'partially_allocated' || ((req.allocatedQty ?? 0) > 0);
  const isPrioritized = isAllocated || req.requestStatus === 'queued' || req.verificationStatus === 'verified';
  const isVerified = isPrioritized || req.verificationStatus === 'verified';

  return {
    submitted,
    verified: existing.verified || (isVerified ? new Date(baseTime + 4 * 60 * 1000).toISOString() : undefined),
    prioritized: existing.prioritized || (isPrioritized ? new Date(baseTime + 6 * 60 * 1000).toISOString() : undefined),
    allocated: existing.allocated || (isAllocated ? new Date(baseTime + 14 * 60 * 1000).toISOString() : undefined),
    dispatched: existing.dispatched || (isDispatched ? new Date(baseTime + 26 * 60 * 1000).toISOString() : undefined),
    delivered: existing.delivered || (isDelivered ? new Date(baseTime + 42 * 60 * 1000).toISOString() : undefined),
  };
}

/**
 * Format timestamp into human-readable 12-hour local time (e.g., 04:25:12 PM)
 */
export function formatStageTime(isoString?: string): string {
  if (!isoString) return '';
  const d = new Date(isoString);
  if (isNaN(d.getTime())) return String(isoString);
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

/**
 * Format timestamp into human-readable date + time (e.g., Oct 25, 2026, 04:25 PM)
 */
export function formatStageDateTime(isoString?: string): string {
  if (!isoString) return '';
  const d = new Date(isoString);
  if (isNaN(d.getTime())) return String(isoString);
  return d.toLocaleString([], {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/**
 * Calculates relative time difference between stage and submission time (e.g. "+4m from intake")
 */
export function getStageElapsed(stageIso?: string, baseIso?: string): string {
  if (!stageIso || !baseIso) return '';
  const tStage = new Date(stageIso).getTime();
  const tBase = new Date(baseIso).getTime();
  if (isNaN(tStage) || isNaN(tBase)) return '';
  const diffSec = Math.floor((tStage - tBase) / 1000);
  if (diffSec <= 0) return 'Immediate (Intake)';
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `+${diffMin}m from intake`;
  const diffHours = Math.floor(diffMin / 60);
  return `+${diffHours}h ${diffMin % 60}m from intake`;
}
