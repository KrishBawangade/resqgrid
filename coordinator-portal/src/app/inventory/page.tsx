'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import Link from 'next/link';
import { 
  INITIAL_DEPOTS, 
  INITIAL_REPLENISHMENT, 
  INITIAL_REQUESTS 
} from '@/lib/data/initialScenario';
import { 
  ReliefDepot, 
  ReplenishmentOrder, 
  ResourceType, 
  ReliefRequest 
} from '@/lib/types';
import { 
  Boxes, 
  Plus, 
  AlertTriangle, 
  Truck, 
  CheckCircle2, 
  X, 
  Droplets,
  HeartPulse,
  Utensils,
  Tent,
  Check,
  RefreshCw,
  ShieldCheck,
  PackageCheck,
  Clock,
  Sparkles,
  Layers
} from 'lucide-react';

export const MIN_SAFETY_BUFFER: Record<ResourceType, number> = {
  drinking_water: 150,
  food_rations: 100,
  medical_supplies: 25,
  shelter_kits: 15,
};

const RESOURCE_DEFS = [
  { key: 'drinking_water' as const, label: 'Water', unit: 'Liters', icon: Droplets, color: 'text-blue-600' },
  { key: 'food_rations' as const, label: 'Rations', unit: 'Packs', icon: Utensils, color: 'text-amber-600' },
  { key: 'medical_supplies' as const, label: 'Medical', unit: 'Kits', icon: HeartPulse, color: 'text-rose-600' },
  { key: 'shelter_kits' as const, label: 'Shelter', unit: 'Tents', icon: Tent, color: 'text-purple-600' },
];

function playSuccessChime() {
  try {
    const AudioContextClass =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof window.AudioContext }).webkitAudioContext;
    if (!AudioContextClass) return;
    const ctx = new AudioContextClass();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(523.25, ctx.currentTime); // C5
    osc.frequency.setValueAtTime(659.25, ctx.currentTime + 0.1); // E5
    osc.frequency.setValueAtTime(783.99, ctx.currentTime + 0.2); // G5
    osc.frequency.setValueAtTime(1046.5, ctx.currentTime + 0.3); // C6

    gain.gain.setValueAtTime(0.15, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.55);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start();
    osc.stop(ctx.currentTime + 0.55);
  } catch {
    // Silently ignore if blocked
  }
}

export default function CoordinatorInventoryPage() {
  const [depots, setDepots] = useState<ReliefDepot[]>(INITIAL_DEPOTS);
  const [replenishments, setReplenishments] = useState<ReplenishmentOrder[]>(INITIAL_REPLENISHMENT);
  const [requests, setRequests] = useState<ReliefRequest[]>(INITIAL_REQUESTS);
  const [showOrderDrawer, setShowOrderDrawer] = useState(false);
  const showOrderModal = showOrderDrawer;
  const setShowOrderModal = setShowOrderDrawer;
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [isLiveActive, setIsLiveActive] = useState(true);
  const [lastSyncTime, setLastSyncTime] = useState<Date | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const [processingOrderId, setProcessingOrderId] = useState<string | null>(null);
  const [demandFilterTab, setDemandFilterTab] = useState<'all' | 'active' | 'delivered'>('all');

  // Form states
  const [selectedResource, setSelectedResource] = useState<ResourceType>('drinking_water');
  const [orderQty, setOrderQty] = useState('500');
  const [selectedDepotId, setSelectedDepotId] = useState('DEPOT-ALPHA');
  const [selectedSupplier, setSelectedSupplier] = useState('National Disaster Reserve Hub');
  const [orderPriority, setOrderPriority] = useState<'emergency' | 'high' | 'standard'>('emergency');
  const [isSubmittingOrder, setIsSubmittingOrder] = useState(false);

  const handleOpenRestock = (depotId: string, resourceKey: ResourceType) => {
    setSelectedDepotId(depotId);
    setSelectedResource(resourceKey);

    const defaultQtys: Record<ResourceType, string> = {
      drinking_water: '500',
      food_rations: '300',
      medical_supplies: '100',
      shelter_kits: '50',
    };
    setOrderQty(defaultQtys[resourceKey] || '200');
    setShowOrderDrawer(true);
  };

  const currentTargetDepot = depots.find((d) => d.id === selectedDepotId);
  const currentTargetStock = currentTargetDepot?.inventory[selectedResource];
  const currentTargetBuffer = MIN_SAFETY_BUFFER[selectedResource];

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 4500);
  };

  // 1. Initial Load from Neon PostgreSQL APIs
  const loadInventoryData = useCallback(async (isManual = false) => {
    if (isManual) setIsSyncing(true);
    try {
      const [depotsRes, repRes, reqRes] = await Promise.all([
        fetch('/api/depots', { cache: 'no-store' }),
        fetch('/api/replenishment', { cache: 'no-store' }),
        fetch('/api/requests', { cache: 'no-store' }),
      ]);

      if (depotsRes.ok) {
        const depotsData = await depotsRes.json();
        if (Array.isArray(depotsData) && depotsData.length > 0) {
          setDepots(depotsData);
        }
      }

      if (repRes.ok) {
        const repData = await repRes.json();
        if (Array.isArray(repData)) {
          setReplenishments(repData);
        }
      }

      if (reqRes.ok) {
        const reqData = await reqRes.json();
        if (Array.isArray(reqData)) {
          setRequests(reqData);
        }
      }

      setIsLiveActive(true);
      setLastSyncTime(new Date());
    } catch (err) {
      console.warn('Failed to load inventory data:', err);
    } finally {
      if (isManual) setIsSyncing(false);
    }
  }, []);

  // 2. Establish Real-Time SSE Stream & BroadcastChannel
  useEffect(() => {
    loadInventoryData();

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

          if (payload.type === 'DEPOTS_UPDATED' && payload.data) {
            const updated = payload.data as ReliefDepot[];
            if (Array.isArray(updated)) {
              setDepots(updated);
              showToast('📦 Real-time inventory sync: Depot stock updated.');
            }
          } else if (payload.type === 'REPLENISHMENT_UPDATED' && payload.data) {
            const updated = payload.data as ReplenishmentOrder[];
            if (Array.isArray(updated)) {
              setReplenishments(updated);
            }
          } else if (payload.type === 'REQUEST_UPDATED' && payload.data) {
            if (Array.isArray(payload.data)) {
              setRequests(payload.data as ReliefRequest[]);
            } else {
              const updatedReq = payload.data as ReliefRequest;
              setRequests((prev) =>
                prev.map((r) => (r.id === updatedReq.id ? { ...r, ...updatedReq } : r))
              );
            }
          } else if (payload.type === 'REQUESTS_RESET' && payload.data) {
            const resetList = payload.data as ReliefRequest[];
            if (Array.isArray(resetList)) {
              setRequests(resetList);
            }
          } else if (payload.type === 'REQUEST_DELETED' && payload.data) {
            const deletedId = (payload.data as { id?: string })?.id;
            if (deletedId) {
              setRequests((prev) => prev.filter((r) => r.id !== deletedId));
            }
          } else if (payload.type === 'NEW_REQUEST' && payload.data) {
            const newReq = payload.data as ReliefRequest;
            setRequests((prev) => [newReq, ...prev]);
          }
        } catch {
          // Keepalive ping
        }
      };

      eventSource.onerror = () => {
        setIsLiveActive(false);
      };
    } catch (err) {
      console.warn('SSE stream error in inventory:', err);
    }

    // Cross-tab broadcast channel for local instant reflection
    let channel: BroadcastChannel | null = null;
    if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
      try {
        channel = new BroadcastChannel('resqgrid_realtime');
        channel.onmessage = (event) => {
          if (event.data?.type === 'DEPOTS_UPDATED' && event.data?.data) {
            setDepots(event.data.data as ReliefDepot[]);
          } else if (event.data?.type === 'REPLENISHMENT_UPDATED' && event.data?.data) {
            setReplenishments(event.data.data as ReplenishmentOrder[]);
          } else if (event.data?.type === 'REQUEST_UPDATED' && event.data?.data) {
            const updatedReq = event.data.data as ReliefRequest;
            setRequests((prev) =>
              prev.map((r) => (r.id === updatedReq.id ? { ...r, ...updatedReq } : r))
            );
          }
        };
      } catch (err) {
        console.warn('BroadcastChannel error:', err);
      }
    }

    return () => {
      if (eventSource) eventSource.close();
      if (channel) channel.close();
    };
  }, [loadInventoryData]);

  // 3. Issue New Replenishment Order
  const handleCreateOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmittingOrder) return;
    setIsSubmittingOrder(true);

    const depot = depots.find((d) => d.id === selectedDepotId);
    const parsedQty = parseInt(orderQty, 10);

    const payload = {
      resourceType: selectedResource,
      quantity: parsedQty,
      depotId: selectedDepotId,
      depotName: depot?.name || `${selectedDepotId} Hub`,
      supplierName: selectedSupplier,
      priority: orderPriority,
    };

    try {
      const res = await fetch('/api/replenishment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) throw new Error('Order creation failed');
      const newOrder: ReplenishmentOrder = await res.json();

      setReplenishments((prev) => [newOrder, ...prev.filter((o) => o.id !== newOrder.id)]);
      setShowOrderDrawer(false);
      showToast(`✓ Order ${newOrder.id} dispatched! Status: In Transit from ${selectedSupplier}.`);

      if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
        try {
          const ch = new BroadcastChannel('resqgrid_realtime');
          ch.postMessage({ type: 'REPLENISHMENT_UPDATED', data: [newOrder, ...replenishments] });
          ch.close();
        } catch {}
      }
    } catch (err) {
      console.error('Failed to issue replenishment order:', err);
      showToast('⚠️ Could not connect to order dispatch server.');
    } finally {
      setIsSubmittingOrder(false);
    }
  };

  // 4. Confirm Delivery Receipt & Auto-Restock Depot Inventory
  const handleConfirmDelivery = async (orderId: string) => {
    const order = replenishments.find((r) => r.id === orderId);
    if (!order || processingOrderId === orderId) return;

    setProcessingOrderId(orderId);

    try {
      const res = await fetch('/api/replenishment', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: orderId, action: 'confirm_delivery' }),
      });

      if (!res.ok) throw new Error('Delivery confirmation failed');
      const data = await res.json();

      if (data.depots) {
        setDepots(data.depots);
      } else {
        // Fallback optimistic update
        setDepots((prev) =>
          prev.map((d) => {
            if (d.id === order.depotId) {
              const currentItem = d.inventory[order.resourceType];
              return {
                ...d,
                inventory: {
                  ...d.inventory,
                  [order.resourceType]: {
                    ...currentItem,
                    availableStock: currentItem.availableStock + order.quantity,
                    totalCapacity: Math.max(currentItem.totalCapacity, currentItem.availableStock + order.quantity),
                  },
                },
              };
            }
            return d;
          })
        );
      }

      if (data.orders) {
        setReplenishments(data.orders);
      } else {
        setReplenishments((prev) =>
          prev.map((o) =>
            o.id === orderId ? { ...o, status: 'delivered', deliveredAt: new Date().toISOString() } : o
          )
        );
      }

      playSuccessChime();
      showToast(
        `✓ Confirmed receipt of ${order.quantity} units for ${order.depotName}! Available stock updated in Neon DB.`
      );

      // Broadcast update across all tabs
      if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
        try {
          const ch = new BroadcastChannel('resqgrid_realtime');
          if (data.depots) ch.postMessage({ type: 'DEPOTS_UPDATED', data: data.depots });
          if (data.orders) ch.postMessage({ type: 'REPLENISHMENT_UPDATED', data: data.orders });
          ch.close();
        } catch {}
      }
    } catch (err) {
      console.error('Failed to confirm delivery:', err);
      showToast('⚠️ Could not confirm delivery with database.');
    } finally {
      setProcessingOrderId(null);
    }
  };

  // 5. Citizen Relief Demand Delivery & Fulfillment Controls
  const handleDeliverDemand = async (id: string) => {
    const req = requests.find((r) => r.id === id);
    if (!req) return;

    const updatedRequest: ReliefRequest = { ...req, requestStatus: 'delivered' };
    setRequests((prev) => prev.map((r) => (r.id === id ? updatedRequest : r)));

    // Clear reserved stock in local depots state so reservation disappears immediately
    let updatedDepots = depots;
    if (req.allocatedDepotId) {
      updatedDepots = depots.map((d) => {
        if (d.id === req.allocatedDepotId) {
          const currentItem = d.inventory[req.resourceType];
          return {
            ...d,
            inventory: {
              ...d.inventory,
              [req.resourceType]: {
                ...currentItem,
                allocatedStock: Math.max(0, currentItem.allocatedStock - req.allocatedQty),
              },
            },
          };
        }
        return d;
      });
      setDepots(updatedDepots);
    }

    playSuccessChime();
    showToast(`✓ Demand ${id} successfully delivered! Warehouse reservation cleared at ${req.allocatedDepotId || 'depot'}.`);

    // Broadcast across tabs
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
        }),
      });

      if (req.allocatedDepotId && req.allocatedQty > 0) {
        await fetch('/api/depots', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'deliver',
            depotId: req.allocatedDepotId,
            resourceType: req.resourceType,
            quantity: req.allocatedQty,
            requestId: req.id,
            actor: 'Field Operations Crew',
            details: `Confirmed delivery of ${req.allocatedQty} units of ${req.resourceType.replace('_', ' ')} for ${req.requesterName}. Demand 100% fulfilled. Reserved stock cleared.`,
          }),
        });
      }
    } catch (err) {
      console.error('Failed to confirm demand delivery in Neon DB:', err);
    }
  };

  const handleDispatchDemand = async (id: string) => {
    const req = requests.find((r) => r.id === id);
    if (!req) return;

    const updatedRequest: ReliefRequest = { ...req, requestStatus: 'dispatched' };
    setRequests((prev) => prev.map((r) => (r.id === id ? updatedRequest : r)));

    showToast(`🚚 Relief cargo for ${id} dispatched into transit corridor!`);

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
        }),
      });
    } catch (err) {
      console.error('Failed to dispatch demand in Neon DB:', err);
    }
  };



  // Helper icons
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

  // Active requests needing fulfillment
  const activeRequests = requests.filter(
    (r) => r.requestStatus !== 'rejected' && r.requestStatus !== 'delivered'
  );

  // TRUE DEMAND DEFICIT CALCULATION:
  // "Low stock" (stock < safety buffer) is indicated by badges on the depot cards.
  // "Deficit" strictly means active citizen queue demand exceeds available stock (Demand > Available Stock).
  // Once a restock order has been placed (status === 'in_transit'), the deficit is being addressed and the banner is removed!
  const activeDeficits = RESOURCE_DEFS.map((def) => {
    // 1. Total unfulfilled citizen demand for this resource across active requests
    const unfulfilledDemand = activeRequests
      .filter((r) => r.resourceType === def.key)
      .reduce((sum, r) => sum + r.unfulfilledQty, 0);

    // 2. Total available stock across all staging depots
    const totalAvailable = depots.reduce(
      (sum, d) => sum + (d.inventory[def.key]?.availableStock ?? 0),
      0
    );

    // Check localized assigned demand exceeding depot available stock
    const depotWithLocalizedDeficit = depots.find((d) => {
      const depotAvailable = d.inventory[def.key]?.availableStock ?? 0;
      const depotUnfulfilled = activeRequests
        .filter((r) => r.resourceType === def.key && r.allocatedDepotId === d.id)
        .reduce((sum, r) => sum + r.unfulfilledQty, 0);
      return depotUnfulfilled > depotAvailable;
    });

    const isSystemDeficit = unfulfilledDemand > totalAvailable;
    const isLocalizedDeficit = !!depotWithLocalizedDeficit;

    // If demand does not exceed available stock, there is NO deficit (no banner!)
    if (!isSystemDeficit && !isLocalizedDeficit) return null;

    // Has a restock order already been placed for this resource?
    const hasActiveRestock = replenishments.some(
      (r) => r.resourceType === def.key && r.status === 'in_transit'
    );

    // Once restock request is made, remove the banner!
    if (hasActiveRestock) return null;

    const targetDepot = depotWithLocalizedDeficit || depots[0];
    const targetDepotStock = targetDepot?.inventory[def.key]?.availableStock ?? 0;
    const targetDepotDemand = activeRequests
      .filter((r) => r.resourceType === def.key && (r.allocatedDepotId === targetDepot.id || !r.allocatedDepotId))
      .reduce((sum, r) => sum + r.unfulfilledQty, 0);

    const deficitQty = isSystemDeficit
      ? unfulfilledDemand - totalAvailable
      : Math.max(1, targetDepotDemand - targetDepotStock);

    return {
      id: `deficit-${def.key}`,
      resourceType: def.key,
      label: def.label,
      unit: def.unit,
      targetDepotId: targetDepot.id,
      targetDepotName: targetDepot.name,
      availableStock: isSystemDeficit ? totalAvailable : targetDepotStock,
      unfulfilledDemand,
      deficit: deficitQty,
      icon: def.icon,
      color: def.color,
      isSystemDeficit,
    };
  }).filter(Boolean) as {
    id: string;
    resourceType: ResourceType;
    label: string;
    unit: string;
    targetDepotId: string;
    targetDepotName: string;
    availableStock: number;
    unfulfilledDemand: number;
    deficit: number;
    icon: any;
    color: string;
    isSystemDeficit: boolean;
  }[];

  // System-wide combined inventory aggregates across all active depots
  const combinedInventory = RESOURCE_DEFS.map((def) => {
    const totalAvailable = depots.reduce(
      (sum, d) => sum + (d.inventory[def.key]?.availableStock ?? 0),
      0
    );

    // Active citizen demand reservations (allocated or dispatched requests, NOT delivered or rejected)
    const activeRequestsReserved = requests
      .filter(
        (r) =>
          r.resourceType === def.key &&
          r.requestStatus !== 'delivered' &&
          r.requestStatus !== 'rejected' &&
          (r.requestStatus === 'fully_allocated' ||
            r.requestStatus === 'partially_allocated' ||
            r.requestStatus === 'dispatched' ||
            r.allocatedQty > 0)
      )
      .reduce((sum, r) => sum + r.allocatedQty, 0);

    const depotReportedAllocated = depots.reduce(
      (sum, d) => sum + (d.inventory[def.key]?.allocatedStock ?? 0),
      0
    );

    // Total reserved stock: reflects live staged + dispatched transit reservations
    const totalAllocated = Math.max(depotReportedAllocated, activeRequestsReserved);

    const inTransitQty = replenishments
      .filter((r) => r.resourceType === def.key && r.status === 'in_transit')
      .reduce((sum, r) => sum + r.quantity, 0);

    const minSystemBuffer = MIN_SAFETY_BUFFER[def.key] * depots.length;
    const isSystemLow = totalAvailable < minSystemBuffer;

    return {
      ...def,
      totalAvailable,
      totalAllocated,
      inTransitQty,
      minSystemBuffer,
      isSystemLow,
    };
  });

  return (
    <div className="space-y-6 pb-12">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-5 right-5 z-50 bg-slate-900 text-white px-4 py-2.5 rounded-xl shadow-xl text-xs font-semibold border border-slate-700 animate-bounce flex items-center space-x-2">
          <Sparkles className="w-4 h-4 text-amber-400" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-extrabold text-slate-900 tracking-tight flex items-center space-x-2">
            <span>Depot Inventory & Replenishment Logistics</span>
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 font-mono font-bold border border-blue-200">
              Live Neon Sync
            </span>
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Real-time warehouse inventories, automated demand deduction, and verified supplier shipment receipts.
          </p>
        </div>

        <div className="flex items-center space-x-2.5 self-start sm:self-auto">
          <button
            onClick={() => loadInventoryData(true)}
            disabled={isSyncing}
            className="px-3 py-2 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 rounded-xl text-xs font-semibold transition-all shadow-2xs flex items-center space-x-1.5 cursor-pointer disabled:opacity-50"
            title="Reload from Neon PostgreSQL"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-slate-500 ${isSyncing ? 'animate-spin text-blue-600' : ''}`} />
            <span>{isSyncing ? 'Syncing...' : 'Sync Now'}</span>
          </button>

          <button
            onClick={() => setShowOrderDrawer(true)}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition-all shadow-sm hover:shadow flex items-center space-x-1.5 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Issue Replenishment Order</span>
          </button>
        </div>
      </div>

      {/* Live Stream Connectivity Indicator */}
      <div className="flex items-center justify-between px-1 text-[11px] text-slate-500 font-mono">
        <div className="flex items-center space-x-2">
          <span className="flex h-2 w-2 relative">
            <span className={`inline-flex rounded-full h-2 w-2 ${isLiveActive ? 'bg-emerald-500' : 'bg-amber-500'}`}></span>
          </span>
          <span>{isLiveActive ? 'Real-Time Inventory Stream Active (SSE & BroadcastChannel)' : 'Reconnecting...'}</span>
        </div>
        <span>Last synced: {lastSyncTime ? lastSyncTime.toLocaleTimeString() : 'Connecting...'}</span>
      </div>

      {/* Active Demand Deficit Banners (ONLY shown when citizen demand in active queue exceeds available stock AND no restock order placed yet) */}
      {activeDeficits.length > 0 && (
        <div className="space-y-2.5">
          {activeDeficits.map((deficit) => {
            const Icon = deficit.icon;
            return (
              <div
                key={deficit.id}
                className="bg-amber-50 border border-amber-300 rounded-2xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-xs animate-in fade-in duration-200"
              >
                <div className="flex items-start space-x-3">
                  <div className="w-8 h-8 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center font-bold flex-shrink-0 mt-0.5 sm:mt-0">
                    <AlertTriangle className="w-4 h-4 text-amber-600" />
                  </div>
                  <div>
                    <div className="flex items-center space-x-2">
                      <h2 className="text-xs font-bold text-amber-950 flex items-center space-x-1.5">
                        <Icon className={`w-3.5 h-3.5 ${deficit.color}`} />
                        <span>Critical Demand Deficit: {deficit.label}</span>
                      </h2>
                      <span className="text-[10px] font-mono font-bold bg-amber-200/80 text-amber-900 px-1.5 py-0.2 rounded border border-amber-300">
                        -{deficit.deficit} {deficit.unit} Unmet Demand
                      </span>
                    </div>
                    <p className="text-[11px] text-amber-800 mt-0.5">
                      Citizen Queue Demand: <strong className="font-mono text-amber-950">{deficit.unfulfilledDemand} {deficit.unit}</strong> • Available Stock: <strong className="font-mono text-amber-950">{deficit.availableStock} {deficit.unit}</strong> • Target Hub: <span className="font-medium text-amber-950">{deficit.targetDepotName}</span>
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => handleOpenRestock(deficit.targetDepotId, deficit.resourceType)}
                  className="text-xs font-bold text-white bg-amber-600 hover:bg-amber-700 px-4 py-2 rounded-xl transition-all shadow-xs hover:shadow flex items-center space-x-1.5 cursor-pointer whitespace-nowrap self-stretch sm:self-auto justify-center"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Restock {deficit.label} &rarr;</span>
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/* System-Wide Combined Inventory */}
      <div className="space-y-3">
        <div className="flex items-center justify-between px-1">
          <div className="flex items-center space-x-2">
            <Layers className="w-4 h-4 text-blue-600" />
            <h2 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
              Total Combined Regional Stock ({depots.length} Active Depots)
            </h2>
          </div>
          <span className="text-[11px] text-slate-500 font-medium">
            Aggregated Across All Staging Hubs
          </span>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          {combinedInventory.map((item) => {
            const Icon = item.icon;
            return (
              <div
                key={item.key}
                className="bg-white border border-slate-200/90 rounded-2xl p-4 shadow-xs hover:border-slate-300 transition-all flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <div className="w-7 h-7 rounded-lg bg-slate-50 border border-slate-100 flex items-center justify-center">
                        <Icon className={`w-3.5 h-3.5 ${item.color}`} />
                      </div>
                      <span className="text-xs font-bold text-slate-800">{item.label}</span>
                    </div>
                    <span
                      className={`text-[9px] font-bold px-1.5 py-0.5 rounded uppercase border ${
                        item.isSystemLow
                          ? 'bg-amber-50 text-amber-800 border-amber-200'
                          : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                      }`}
                    >
                      {item.isSystemLow ? 'Buffer Low' : 'Adequate'}
                    </span>
                  </div>

                  <div className="mt-3 flex items-baseline">
                    <span className="text-2xl font-black text-slate-900 tracking-tight font-mono">
                      {item.totalAvailable.toLocaleString()}
                    </span>
                    <span className="text-slate-500 font-medium text-xs ml-1.5">{item.unit}</span>
                  </div>
                </div>

                <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-between text-[10.5px]">
                  <div className="text-slate-500 font-mono text-[10px]">
                    {item.totalAllocated > 0 ? (
                      <span className="text-blue-600 font-bold font-mono">
                        {item.totalAllocated.toLocaleString()} {item.unit} reserved
                      </span>
                    ) : (
                      <span className="text-slate-400 font-mono text-[10px]">0 reserved</span>
                    )}
                  </div>
                  <div className="flex items-center space-x-2">
                    {item.inTransitQty > 0 && (
                      <span className="text-amber-800 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded font-mono text-[9.5px] font-bold flex items-center space-x-1 animate-pulse">
                        <Truck className="w-2.5 h-2.5 text-amber-600" />
                        <span>+{item.inTransitQty.toLocaleString()}</span>
                      </span>
                    )}
                    <button
                      type="button"
                      onClick={() => {
                        const lowestDepot = [...depots].sort(
                          (a, b) => (a.inventory[item.key]?.availableStock ?? 0) - (b.inventory[item.key]?.availableStock ?? 0)
                        )[0];
                        handleOpenRestock(lowestDepot ? lowestDepot.id : 'DEPOT-ALPHA', item.key);
                      }}
                      className="px-2 py-0.5 bg-blue-50 hover:bg-blue-100 text-blue-700 font-semibold rounded text-[10px] border border-blue-200 flex items-center space-x-0.5 transition-colors cursor-pointer"
                    >
                      <Plus className="w-3 h-3" />
                      <span>Restock</span>
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Depots Inventory Matrix Header */}
      <div className="flex items-center justify-between px-1 pt-1">
        <h2 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
          Individual Staging Depot Inventories
        </h2>
        <span className="text-[11px] text-slate-500">
          Distribution across sector hubs
        </span>
      </div>

      {/* Depots Inventory Matrix */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {depots.map((depot) => (
          <div key={depot.id} className="bg-white border border-slate-200/90 rounded-2xl p-5 shadow-xs space-y-3 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <div>
                  <span className="font-mono text-[10px] font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
                    {depot.id}
                  </span>
                  <h3 className="text-sm font-bold text-slate-900 mt-1 line-clamp-1">{depot.name}</h3>
                  <span className="text-[11px] text-slate-500">{depot.zoneName}</span>
                </div>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border flex-shrink-0 ${
                  depot.status === 'operational'
                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                    : 'bg-amber-50 text-amber-700 border-amber-200'
                }`}>
                  {depot.status === 'operational' ? 'Operational' : 'Constrained'}
                </span>
              </div>

              {/* 4 Resources Matrix */}
              <div className="grid grid-cols-2 gap-2.5 text-xs mt-3">
                {RESOURCE_DEFS.map(({ key, label, unit, icon: Icon, color }) => {
                  const stock = depot.inventory[key];
                  const minBuffer = MIN_SAFETY_BUFFER[key];
                  const isLow = stock.availableStock < minBuffer;

                  return (
                    <div
                      key={key}
                      className={`p-3 rounded-xl border flex flex-col justify-between transition-colors ${
                        isLow
                          ? 'bg-amber-50/80 border-amber-300 ring-1 ring-amber-200/50'
                          : 'bg-slate-50/70 border-slate-200/70'
                      }`}
                    >
                      <div>
                        <div className="flex justify-between items-center">
                          <span className="flex items-center space-x-1.5 font-semibold text-slate-700">
                            <Icon className={`w-3.5 h-3.5 ${color}`} />
                            <span>{label}</span>
                          </span>
                          {isLow ? (
                            <span className="text-[9px] font-bold text-amber-800 bg-amber-100 px-1.5 py-0.2 rounded uppercase border border-amber-200">
                              Low
                            </span>
                          ) : (
                            <span className="text-[9px] font-semibold text-emerald-700 bg-emerald-50 px-1.5 py-0.2 rounded border border-emerald-200">
                              Adequate
                            </span>
                          )}
                        </div>

                        <div className="mt-2 font-mono flex items-baseline">
                          <span className="text-xl font-extrabold text-slate-900 tracking-tight">
                            {stock.availableStock}
                          </span>
                          <span className="text-slate-500 font-medium text-xs ml-1.5">{unit}</span>
                        </div>

                        <div className="mt-1.5 space-y-0.5 text-[10.5px]">
                          <div className="text-slate-500 font-mono text-[10px]">
                            Min safety: {minBuffer} {unit}
                          </div>
                          {(() => {
                            const depotReqAllocated = requests
                              .filter(
                                (r) =>
                                  r.resourceType === key &&
                                  (r.allocatedDepotId === depot.id || (!r.allocatedDepotId && depot.id === 'DEPOT-ALPHA')) &&
                                  r.requestStatus !== 'delivered' &&
                                  r.requestStatus !== 'rejected' &&
                                  (r.requestStatus === 'fully_allocated' ||
                                    r.requestStatus === 'partially_allocated' ||
                                    r.requestStatus === 'dispatched' ||
                                    r.allocatedQty > 0)
                              )
                              .reduce((sum, r) => sum + r.allocatedQty, 0);
                            const effectiveAllocated = Math.max(stock.allocatedStock ?? 0, depotReqAllocated);

                            if (effectiveAllocated <= 0) return null;
                            return (
                              <div className="text-blue-600 font-semibold font-mono text-[10px]">
                                {effectiveAllocated} {unit} reserved
                              </div>
                            );
                          })()}
                        </div>
                      </div>

                      {/* Restock Button that opens the drawer */}
                      <button
                        type="button"
                        onClick={() => handleOpenRestock(depot.id, key)}
                        className={`mt-2.5 w-full py-1.5 px-2 rounded-lg text-[10.5px] font-bold flex items-center justify-center space-x-1 transition-all cursor-pointer ${
                          isLow
                            ? 'bg-amber-600 hover:bg-amber-700 text-white shadow-2xs hover:shadow-xs'
                            : 'bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 hover:border-slate-300 shadow-2xs'
                        }`}
                        title={`Request replenishment for ${label} at ${depot.id}`}
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>Restock {label}</span>
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Active Replenishments & Supplier Shipments */}
      <div className="bg-white border border-slate-200/90 rounded-2xl p-5 shadow-xs space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div>
            <h2 className="text-sm font-bold text-slate-900 flex items-center space-x-2">
              <Truck className="w-4 h-4 text-blue-600" />
              <span>Active Supplier Replenishment Orders</span>
            </h2>
            <p className="text-[11px] text-slate-500 mt-0.5">
              Strict Verification: Depot inventory increases <strong>only</strong> after coordinator confirms delivery receipt.
            </p>
          </div>
        </div>

        <div className="space-y-3">
          {replenishments.length === 0 ? (
            <div className="p-6 text-center text-xs text-slate-400 bg-slate-50 rounded-xl border border-dashed border-slate-200">
              No active replenishment orders. Click "Issue Replenishment Order" to requisition stock.
            </div>
          ) : (
            replenishments.map((order) => (
              <div
                key={order.id}
                className="bg-slate-50/80 border border-slate-200 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
              >
                <div>
                  <div className="flex items-center space-x-2">
                    <span className="font-mono font-bold text-blue-600 bg-white px-2 py-0.5 rounded border border-slate-200">
                      {order.id}
                    </span>
                    <span className="font-bold text-slate-900 text-sm">
                      {order.quantity} Units of {order.resourceType.replace('_', ' ')}
                    </span>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-200 uppercase">
                      {order.priority}
                    </span>
                  </div>
                  <div className="text-[11px] text-slate-500 mt-1">
                    Supplier: <strong className="text-slate-700">{order.supplierName}</strong> → Destination Depot:{' '}
                    <strong className="text-slate-700">{order.depotName}</strong>
                    {order.deliveredAt && (
                      <span className="ml-2 font-mono text-[10.5px] text-emerald-700">
                        (Restocked: {new Date(order.deliveredAt).toLocaleTimeString()})
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex items-center space-x-2.5">
                  <span
                    className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase border ${
                      order.status === 'in_transit'
                        ? 'bg-amber-100 text-amber-800 border-amber-300 animate-pulse'
                        : order.status === 'delivered'
                        ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                        : 'bg-blue-100 text-blue-800 border-blue-300'
                    }`}
                  >
                    {order.status.replace('_', ' ')}
                  </span>

                  {order.status === 'in_transit' && (
                    <button
                      onClick={() => handleConfirmDelivery(order.id)}
                      disabled={processingOrderId === order.id}
                      className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-xs transition-all shadow-xs hover:shadow flex items-center space-x-1 cursor-pointer disabled:opacity-50"
                    >
                      <Check className="w-3.5 h-3.5" />
                      <span>{processingOrderId === order.id ? 'Restocking...' : 'Confirm Delivery & Restock'}</span>
                    </button>
                  )}

                  {order.status === 'delivered' && (
                    <span className="text-emerald-700 font-bold text-xs flex items-center space-x-1">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                      <span>Restocked</span>
                    </span>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Linked Demands & Deficit Queue */}
      {(() => {
        const linkedDemands = requests.filter(
          (r) => r.requestStatus !== 'rejected' && (r.allocatedQty > 0 || r.requestStatus === 'delivered')
        );
        const displayedDemands =
          demandFilterTab === 'active'
            ? linkedDemands.filter((r) => r.requestStatus !== 'delivered')
            : demandFilterTab === 'delivered'
            ? linkedDemands.filter((r) => r.requestStatus === 'delivered')
            : linkedDemands;

        const activeCount = linkedDemands.filter((r) => r.requestStatus !== 'delivered').length;
        const fulfilledCount = linkedDemands.filter((r) => r.requestStatus === 'delivered').length;

        return (
          <div className="bg-white border border-slate-200/90 rounded-2xl p-5 shadow-xs space-y-4">
            <div className="pb-3 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h2 className="text-sm font-bold text-slate-900 flex items-center space-x-2">
                  <Boxes className="w-4 h-4 text-indigo-600" />
                  <span>Live Demand Delivery & Fulfillment Pipeline</span>
                </h2>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Track warehouse staging, transit corridors, and confirm citizen handover to release depot reservations.
                </p>
              </div>

              {/* Filter Tabs */}
              <div className="flex items-center space-x-1 bg-slate-100 p-0.5 rounded-xl text-xs font-semibold self-start sm:self-auto">
                <button
                  type="button"
                  onClick={() => setDemandFilterTab('active')}
                  className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer flex items-center space-x-1.5 ${
                    demandFilterTab === 'active'
                      ? 'bg-white text-blue-700 shadow-2xs font-bold'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <span>Active Demands</span>
                  <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-blue-100 text-blue-800 font-mono font-bold">
                    {activeCount}
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => setDemandFilterTab('delivered')}
                  className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer flex items-center space-x-1.5 ${
                    demandFilterTab === 'delivered'
                      ? 'bg-white text-emerald-700 shadow-2xs font-bold'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <span>Fulfilled</span>
                  <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-emerald-100 text-emerald-800 font-mono font-bold">
                    {fulfilledCount}
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => setDemandFilterTab('all')}
                  className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer ${
                    demandFilterTab === 'all'
                      ? 'bg-white text-slate-900 shadow-2xs font-bold'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <span>All ({linkedDemands.length})</span>
                </button>
              </div>
            </div>

            <div className="space-y-2">
              {displayedDemands.length === 0 ? (
                <div className="p-6 text-center text-xs text-slate-400">
                  {demandFilterTab === 'active'
                    ? 'No active in-flight demands currently reserving depot stock. All demands are fulfilled!'
                    : demandFilterTab === 'delivered'
                    ? 'No fulfilled demands recorded yet.'
                    : 'No linked demands recorded.'}
                </div>
              ) : (
                displayedDemands.map((req) => (
                  <div
                    key={req.id}
                    className="bg-slate-50/80 border border-slate-200/90 rounded-xl p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
                  >
                    <div className="flex items-center space-x-2.5 flex-wrap">
                      <span className="font-mono font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-200/70">
                        {req.id}
                      </span>
                      <span className="font-semibold text-slate-900 capitalize">
                        {req.resourceType.replace('_', ' ')}
                      </span>
                      <span className="text-slate-400">•</span>
                      <span className="text-slate-600 font-medium">{req.location.zoneName}</span>
                      <span className="text-slate-400">•</span>
                      <span className="text-slate-600">{req.requesterName}</span>
                    </div>

                    <div className="flex items-center space-x-2.5 flex-wrap sm:flex-nowrap justify-between sm:justify-end">
                      <div className="flex items-center space-x-2 text-[11px]">
                        <span className="text-emerald-700 font-bold bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                          Allocated: {req.allocatedQty}
                        </span>
                        {req.unfulfilledQty > 0 ? (
                          <span className="text-amber-800 font-bold bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                            Deficit: {req.unfulfilledQty}
                          </span>
                        ) : (
                          <span className="text-emerald-800 font-bold bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                            100% Met
                          </span>
                        )}
                      </div>

                      {req.allocatedDepotId && (
                        <span className="font-mono text-[10px] text-slate-600 bg-white px-2 py-0.5 rounded border border-slate-200">
                          {req.allocatedDepotId}
                        </span>
                      )}

                      {/* Delivery Stage Indicator */}
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-bold border flex items-center space-x-1 ${
                          req.requestStatus === 'delivered'
                            ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                            : req.requestStatus === 'dispatched'
                            ? 'bg-sky-50 text-sky-800 border-sky-200 animate-pulse'
                            : req.requestStatus === 'fully_allocated'
                            ? 'bg-blue-50 text-blue-800 border-blue-200'
                            : 'bg-amber-50 text-amber-800 border-amber-200'
                        }`}
                      >
                        {req.requestStatus === 'delivered' ? (
                          <>
                            <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                            <span>Stage 3: Fulfilled</span>
                          </>
                        ) : req.requestStatus === 'dispatched' ? (
                          <>
                            <Truck className="w-3 h-3 text-sky-600" />
                            <span>Stage 2: In Transit</span>
                          </>
                        ) : req.requestStatus === 'fully_allocated' ? (
                          <>
                            <Boxes className="w-3 h-3 text-blue-600" />
                            <span>Stage 1: Staged</span>
                          </>
                        ) : (
                          <span>{req.requestStatus.replace('_', ' ')}</span>
                        )}
                      </span>

                      {/* Direct Fulfillment & Dispatch Actions */}
                      {req.requestStatus === 'dispatched' ? (
                        <button
                          type="button"
                          onClick={() => handleDeliverDemand(req.id)}
                          className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold transition-all shadow-2xs hover:shadow flex items-center space-x-1 cursor-pointer whitespace-nowrap"
                          title="Confirm citizen delivery & clear reserved warehouse stock"
                        >
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>Confirm Delivery</span>
                        </button>
                      ) : req.requestStatus === 'fully_allocated' ? (
                        <button
                          type="button"
                          onClick={() => handleDispatchDemand(req.id)}
                          className="px-2.5 py-1 bg-sky-600 hover:bg-sky-700 text-white rounded-lg text-xs font-bold transition-all shadow-2xs hover:shadow flex items-center space-x-1 cursor-pointer whitespace-nowrap"
                          title="Dispatch relief cargo into transit corridor"
                        >
                          <Truck className="w-3.5 h-3.5" />
                          <span>Dispatch</span>
                        </button>
                      ) : req.requestStatus === 'delivered' ? (
                        <span className="text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-lg text-[10.5px] font-bold flex items-center space-x-1">
                          <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                          <span>100% Fulfilled</span>
                        </span>
                      ) : null}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        );
      })()}

      {/* Replenishment Order Right Drawer */}
      {showOrderDrawer && (
        <div 
          className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs z-50 flex justify-end animate-in fade-in duration-200"
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowOrderDrawer(false);
          }}
        >
          <div className="bg-white w-full max-w-md h-full shadow-2xl border-l border-slate-200 flex flex-col justify-between overflow-y-auto animate-in slide-in-from-right duration-300">
            {/* Drawer Header */}
            <div>
              <div className="p-5 border-b border-slate-100 flex items-center justify-between">
                <div>
                  <h3 className="text-base font-bold text-slate-900 flex items-center space-x-2">
                    <Truck className="w-4 h-4 text-blue-600" />
                    <span>Issue Replenishment Request</span>
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Requisition emergency stock to restock staging warehouse inventory.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowOrderDrawer(false)}
                  className="w-8 h-8 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600 flex items-center justify-center cursor-pointer transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Context Summary Pill */}
              <div className="p-5 bg-slate-50 border-b border-slate-200/80 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                    Target Depot & Resource
                  </span>
                  <span className="font-mono text-[10px] font-bold text-blue-700 bg-blue-100/70 px-2 py-0.5 rounded border border-blue-200">
                    {currentTargetDepot?.id}
                  </span>
                </div>
                <div className="text-xs font-bold text-slate-900">
                  {currentTargetDepot?.name}
                </div>
                <div className="grid grid-cols-3 gap-2 pt-2 text-[11px]">
                  <div className="bg-white p-2 rounded-lg border border-slate-200">
                    <span className="text-slate-400 block text-[10px]">Current Stock</span>
                    <strong className="text-slate-900 font-mono text-xs">
                      {currentTargetStock?.availableStock ?? 0}
                    </strong>
                  </div>
                  <div className="bg-white p-2 rounded-lg border border-slate-200">
                    <span className="text-slate-400 block text-[10px]">Safety Buffer</span>
                    <strong className="text-slate-900 font-mono text-xs">
                      {currentTargetBuffer}
                    </strong>
                  </div>
                  <div className="bg-white p-2 rounded-lg border border-slate-200">
                    <span className="text-slate-400 block text-[10px]">Projected Stock</span>
                    <strong className="text-emerald-700 font-mono text-xs">
                      {(currentTargetStock?.availableStock ?? 0) + (parseInt(orderQty, 10) || 0)}
                    </strong>
                  </div>
                </div>
              </div>

              {/* Form Content */}
              <form id="replenish-form" onSubmit={handleCreateOrder} className="p-5 space-y-4 text-xs">
                {/* 1. Resource Selector */}
                <div>
                  <label className="block font-bold text-slate-700 mb-2">Select Resource</label>
                  <div className="grid grid-cols-2 gap-2">
                    {RESOURCE_DEFS.map(({ key, label, unit, icon: Icon, color }) => {
                      const isSelected = selectedResource === key;
                      return (
                        <button
                          key={key}
                          type="button"
                          onClick={() => setSelectedResource(key)}
                          className={`p-2.5 rounded-xl border flex items-center space-x-2 text-left transition-all cursor-pointer ${
                            isSelected
                              ? 'bg-blue-50/80 border-blue-400 ring-2 ring-blue-500/20 text-blue-950 font-bold'
                              : 'bg-slate-50/60 border-slate-200 hover:bg-slate-100 text-slate-700'
                          }`}
                        >
                          <Icon className={`w-4 h-4 ${color}`} />
                          <div>
                            <div className="text-xs leading-none">{label}</div>
                            <span className="text-[10px] text-slate-400 font-normal">{unit}</span>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* 2. Destination Depot Selector */}
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Destination Depot</label>
                  <select
                    value={selectedDepotId}
                    onChange={(e) => setSelectedDepotId(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold text-slate-900 focus:outline-none focus:border-blue-500"
                  >
                    {depots.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.id} — {d.name} ({d.zoneName})
                      </option>
                    ))}
                  </select>
                </div>

                {/* 3. Quantity input & Quick Chips */}
                <div>
                  <div className="flex justify-between items-center mb-1">
                    <label className="font-bold text-slate-700">Requisition Quantity</label>
                    <span className="text-[10px] text-slate-400">
                      Unit: {RESOURCE_DEFS.find((r) => r.key === selectedResource)?.unit}
                    </span>
                  </div>
                  <input
                    type="number"
                    min="10"
                    step="10"
                    required
                    value={orderQty}
                    onChange={(e) => setOrderQty(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm font-mono font-bold text-slate-900 focus:outline-none focus:border-blue-500"
                  />
                  <div className="flex items-center space-x-1.5 mt-2">
                    {['+100', '+250', '+500', '+1000'].map((chip) => {
                      const addVal = parseInt(chip.replace('+', ''), 10);
                      return (
                        <button
                          key={chip}
                          type="button"
                          onClick={() => {
                            const cur = parseInt(orderQty, 10) || 0;
                            setOrderQty(String(cur + addVal));
                          }}
                          className="px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-mono text-[10px] font-bold rounded-md border border-slate-200 transition-colors cursor-pointer"
                        >
                          {chip}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* 4. Supplier / Stockpile */}
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Supplier / Strategic Stockpile</label>
                  <select
                    value={selectedSupplier}
                    onChange={(e) => setSelectedSupplier(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold text-slate-900 focus:outline-none focus:border-blue-500"
                  >
                    <option value="National Disaster Reserve Hub">National Disaster Reserve Hub (Central)</option>
                    <option value="Red Cross Regional Logistics Center">Red Cross Regional Logistics Center</option>
                    <option value="State Emergency Medical Stockpile">State Emergency Medical Stockpile</option>
                    <option value="Armed Forces Staging Command">Armed Forces Staging Command</option>
                  </select>
                </div>

                {/* 5. Priority */}
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Logistics Priority</label>
                  <select
                    value={orderPriority}
                    onChange={(e) => setOrderPriority(e.target.value as 'emergency' | 'high' | 'standard')}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold text-slate-900 focus:outline-none focus:border-blue-500"
                  >
                    <option value="emergency">🚨 Emergency (Immediate Dispatch)</option>
                    <option value="high">⚡ High Priority (Within 2 Hours)</option>
                    <option value="standard">📦 Standard Buffer Replenishment</option>
                  </select>
                </div>
              </form>
            </div>

            {/* Drawer Footer Actions */}
            <div className="p-5 border-t border-slate-100 bg-slate-50/50 flex items-center justify-end space-x-2.5">
              <button
                type="button"
                onClick={() => setShowOrderDrawer(false)}
                className="px-4 py-2 bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-xl text-xs font-semibold transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                form="replenish-form"
                disabled={isSubmittingOrder}
                className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition-all shadow-sm hover:shadow flex items-center space-x-1.5 cursor-pointer disabled:opacity-50"
              >
                <Truck className="w-3.5 h-3.5" />
                <span>{isSubmittingOrder ? 'Transmitting Order...' : 'Dispatch Shipment'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
