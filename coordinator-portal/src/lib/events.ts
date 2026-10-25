import { EventEmitter } from 'events';

declare global {
  // eslint-disable-next-line no-var
  var __resqgrid_emitter: EventEmitter | undefined;
}

if (!globalThis.__resqgrid_emitter) {
  globalThis.__resqgrid_emitter = new EventEmitter();
  globalThis.__resqgrid_emitter.setMaxListeners(200);
}

export const realtimeEmitter: EventEmitter = globalThis.__resqgrid_emitter;

export type RealtimeEventType = 
  | 'NEW_REQUEST' 
  | 'REQUEST_UPDATED' 
  | 'REQUEST_DELETED'
  | 'REQUESTS_RESET'
  | 'DEPOTS_UPDATED'
  | 'REPLENISHMENT_UPDATED'
  | 'AUDIT_LOG_ADDED';

export interface RealtimeEventPayload {
  type: RealtimeEventType;
  data: unknown;
  timestamp: string;
}

export function broadcastRealtimeEvent(type: RealtimeEventType, data: unknown) {
  try {
    realtimeEmitter.emit('dispatch-event', {
      type,
      data,
      timestamp: new Date().toISOString(),
    } as RealtimeEventPayload);
  } catch (err) {
    console.error('Error broadcasting realtime event:', err);
  }
}
