'use client';

import React, { useState } from 'react';
import { 
  INITIAL_DEPOTS, 
  INITIAL_REPLENISHMENT 
} from '@/lib/data/initialScenario';
import { ReliefDepot, ReplenishmentOrder, ResourceType } from '@/lib/types';
import { 
  Boxes, 
  Plus, 
  AlertTriangle, 
  Truck, 
  CheckCircle2, 
  X, 
  ArrowRight,
  Droplets,
  HeartPulse,
  Utensils,
  Tent,
  Check
} from 'lucide-react';

export default function CoordinatorInventoryPage() {
  const [depots, setDepots] = useState<ReliefDepot[]>(INITIAL_DEPOTS);
  const [replenishments, setReplenishments] = useState<ReplenishmentOrder[]>(INITIAL_REPLENISHMENT);
  const [showOrderModal, setShowOrderModal] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Form states
  const [selectedResource, setSelectedResource] = useState<ResourceType>('drinking_water');
  const [orderQty, setOrderQty] = useState('500');
  const [selectedDepotId, setSelectedDepotId] = useState('DEPOT-ALPHA');
  const [selectedSupplier, setSelectedSupplier] = useState('National Disaster Reserve Hub');
  const [orderPriority, setOrderPriority] = useState<'emergency' | 'high' | 'standard'>('emergency');

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 4000);
  };

  const handleCreateOrder = (e: React.FormEvent) => {
    e.preventDefault();
    const depot = depots.find((d) => d.id === selectedDepotId);
    const newOrder: ReplenishmentOrder = {
      id: `REP-${Math.floor(510 + Math.random() * 400)}`,
      resourceType: selectedResource,
      quantity: parseInt(orderQty, 10),
      depotId: selectedDepotId,
      depotName: depot?.name || 'Central Depot',
      supplierName: selectedSupplier,
      priority: orderPriority,
      status: 'in_transit', // simulated immediate supplier acceptance and dispatch
      requestedAt: new Date().toISOString(),
      dispatchedAt: new Date().toISOString(),
    };

    setReplenishments([newOrder, ...replenishments]);
    setShowOrderModal(false);
    showToast(`✓ Order ${newOrder.id} dispatched! Status: In Transit from ${selectedSupplier}.`);
  };

  const handleConfirmDelivery = (orderId: string) => {
    const order = replenishments.find((r) => r.id === orderId);
    if (!order) return;

    // Strict Rule: Stock ONLY increases when coordinator confirms receipt
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
              },
            },
          };
        }
        return d;
      })
    );

    setReplenishments((prev) =>
      prev.map((o) => (o.id === orderId ? { ...o, status: 'delivered', deliveredAt: new Date().toISOString() } : o))
    );

    showToast(`✓ Confirmed receipt of ${order.quantity} units for ${order.depotName}! Available stock updated.`);
  };

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

  return (
    <div className="space-y-6">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-5 right-5 z-50 bg-slate-900 text-white px-4 py-2.5 rounded-xl shadow-xl text-xs font-semibold border border-slate-700 animate-bounce">
          {toastMessage}
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-extrabold text-slate-900 tracking-tight flex items-center space-x-2">
            <span>Depot Inventory & Replenishment Logistics</span>
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 font-mono font-bold border border-blue-200">
              Stock-Aware Control
            </span>
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Real-time warehouse inventories, deficit monitoring, and verified supplier shipment receipts.
          </p>
        </div>

        <button
          onClick={() => setShowOrderModal(true)}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition-all shadow-sm hover:shadow flex items-center space-x-1.5 self-start sm:self-auto"
        >
          <Plus className="w-4 h-4" />
          <span>Issue Replenishment Order</span>
        </button>
      </div>

      {/* Shortage Warning Advisory */}
      <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-xs">
        <div className="flex items-start space-x-3">
          <div className="w-8 h-8 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center font-bold">
            <AlertTriangle className="w-4 h-4" />
          </div>
          <div>
            <h2 className="text-xs font-bold text-amber-900">
              Active Regional Shortage: Drinking Water at Depot Alpha
            </h2>
            <p className="text-[11px] text-amber-800 mt-0.5">
              Available: <strong className="font-mono text-amber-950">80 Liters</strong> • Unfulfilled Queue: <strong className="font-mono text-rose-800">120 Liters</strong> • Net Deficit: <strong className="font-mono text-rose-800">-40 Liters</strong>
            </p>
          </div>
        </div>

        <span className="text-[11px] font-bold text-amber-900 bg-amber-100 px-3 py-1 rounded-lg border border-amber-300">
          Shipment REP-501 (500 L) In Transit
        </span>
      </div>

      {/* Depots Inventory Matrix */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {depots.map((depot) => (
          <div key={depot.id} className="bg-white border border-slate-200/90 rounded-2xl p-5 shadow-xs space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div>
                <span className="font-mono text-[10px] font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
                  {depot.id}
                </span>
                <h3 className="text-sm font-bold text-slate-900 mt-1">{depot.name}</h3>
                <span className="text-[11px] text-slate-500">{depot.zoneName}</span>
              </div>
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                depot.status === 'operational'
                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                  : 'bg-amber-50 text-amber-700 border-amber-200'
              }`}>
                {depot.status === 'operational' ? 'Operational' : 'Constrained Access'}
              </span>
            </div>

            {/* 4 Resources Matrix */}
            <div className="grid grid-cols-2 gap-2.5 text-xs">
              {/* Drinking Water */}
              <div className={`p-3 rounded-xl border ${
                depot.inventory.drinking_water.availableStock < 100
                  ? 'bg-amber-50/70 border-amber-300'
                  : 'bg-slate-50/70 border-slate-200/70'
              }`}>
                <div className="flex justify-between items-center">
                  <span className="flex items-center space-x-1 font-semibold text-slate-700">
                    <Droplets className="w-3.5 h-3.5 text-blue-600" />
                    <span>Drinking Water</span>
                  </span>
                  {depot.inventory.drinking_water.availableStock < 100 && (
                    <span className="text-[9px] font-bold text-amber-800 bg-amber-100 px-1.5 py-0.2 rounded uppercase">
                      Low
                    </span>
                  )}
                </div>
                <div className="mt-2 font-mono">
                  <span className="text-xl font-extrabold text-slate-900">
                    {depot.inventory.drinking_water.availableStock}
                  </span>
                  <span className="text-slate-400 text-xs"> / {depot.inventory.drinking_water.totalCapacity} L</span>
                </div>
              </div>

              {/* Food Rations */}
              <div className="p-3 rounded-xl bg-slate-50/70 border border-slate-200/70">
                <span className="flex items-center space-x-1 font-semibold text-slate-700">
                  <Utensils className="w-3.5 h-3.5 text-amber-600" />
                  <span>Food Rations</span>
                </span>
                <div className="mt-2 font-mono">
                  <span className="text-xl font-extrabold text-slate-900">
                    {depot.inventory.food_rations.availableStock}
                  </span>
                  <span className="text-slate-400 text-xs"> / {depot.inventory.food_rations.totalCapacity} Packs</span>
                </div>
              </div>

              {/* Medical Supplies */}
              <div className="p-3 rounded-xl bg-slate-50/70 border border-slate-200/70">
                <span className="flex items-center space-x-1 font-semibold text-slate-700">
                  <HeartPulse className="w-3.5 h-3.5 text-rose-600" />
                  <span>Medical Supplies</span>
                </span>
                <div className="mt-2 font-mono">
                  <span className="text-xl font-extrabold text-slate-900">
                    {depot.inventory.medical_supplies.availableStock}
                  </span>
                  <span className="text-slate-400 text-xs"> / {depot.inventory.medical_supplies.totalCapacity} Kits</span>
                </div>
              </div>

              {/* Shelter Kits */}
              <div className="p-3 rounded-xl bg-slate-50/70 border border-slate-200/70">
                <span className="flex items-center space-x-1 font-semibold text-slate-700">
                  <Tent className="w-3.5 h-3.5 text-purple-600" />
                  <span>Shelter Kits</span>
                </span>
                <div className="mt-2 font-mono">
                  <span className="text-xl font-extrabold text-slate-900">
                    {depot.inventory.shelter_kits.availableStock}
                  </span>
                  <span className="text-slate-400 text-xs"> / {depot.inventory.shelter_kits.totalCapacity} Tents</span>
                </div>
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
          {replenishments.map((order) => (
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
                  Supplier: <strong className="text-slate-700">{order.supplierName}</strong> → Destination Depot: <strong className="text-slate-700">{order.depotName}</strong>
                </div>
              </div>

              <div className="flex items-center space-x-2.5">
                <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase border ${
                  order.status === 'in_transit'
                    ? 'bg-amber-100 text-amber-800 border-amber-300 animate-pulse'
                    : order.status === 'delivered'
                    ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                    : 'bg-blue-100 text-blue-800 border-blue-300'
                }`}>
                  {order.status.replace('_', ' ')}
                </span>

                {order.status === 'in_transit' && (
                  <button
                    onClick={() => handleConfirmDelivery(order.id)}
                    className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-xs transition-all shadow-xs hover:shadow flex items-center space-x-1"
                  >
                    <Check className="w-3.5 h-3.5" />
                    <span>Confirm Delivery & Restock</span>
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
          ))}
        </div>
      </div>

      {/* Replenishment Order Modal */}
      {showOrderModal && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <form
            onSubmit={handleCreateOrder}
            className="bg-white border border-slate-200 rounded-2xl max-w-md w-full p-6 space-y-4 shadow-xl"
          >
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-slate-900">Create Supplier Replenishment Request</h3>
              <button
                type="button"
                onClick={() => setShowOrderModal(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-slate-600">
              Requisition critical stock from regional stockpiles and certified suppliers for affected depots.
            </p>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Resource Required</label>
                <select
                  value={selectedResource}
                  onChange={(e) => setSelectedResource(e.target.value as ResourceType)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-slate-900 focus:outline-none"
                >
                  <option value="drinking_water">Drinking Water (Liters)</option>
                  <option value="medical_supplies">Medical Supplies (Kits)</option>
                  <option value="food_rations">Food Rations (Packs)</option>
                  <option value="shelter_kits">Shelter Kits (Tents)</option>
                </select>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Quantity</label>
                <input
                  type="number"
                  min="50"
                  required
                  value={orderQty}
                  onChange={(e) => setOrderQty(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-900 focus:outline-none"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Destination Depot</label>
                <select
                  value={selectedDepotId}
                  onChange={(e) => setSelectedDepotId(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-slate-900 focus:outline-none"
                >
                  {depots.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Supplier / Stockpile</label>
                <select
                  value={selectedSupplier}
                  onChange={(e) => setSelectedSupplier(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-slate-900 focus:outline-none"
                >
                  <option value="National Disaster Reserve Hub">National Disaster Reserve Hub</option>
                  <option value="Red Cross Regional Logistics Center">Red Cross Regional Logistics Center</option>
                  <option value="State Emergency Medical Stockpile">State Emergency Medical Stockpile</option>
                </select>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setShowOrderModal(false)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold shadow-sm"
              >
                Transmit Order
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
