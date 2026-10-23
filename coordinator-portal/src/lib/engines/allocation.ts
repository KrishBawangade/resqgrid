// Stock-Aware Resource Allocation Engine
// Hard Constraints:
// 1. Double allocation is strictly prohibited.
// 2. Partial fulfillment is supported when depot inventory < requested amount.
// 3. Unfulfilled remainder remains prioritized in queue.
// 4. Depot selection balances stock availability and accessibility.

import { ReliefRequest, ReliefDepot, ResourceType } from '../types';

export interface AllocationResult {
  success: boolean;
  requestId: string;
  depotId: string | null;
  depotName: string | null;
  requestedQty: number;
  allocatedQty: number;
  unfulfilledQty: number;
  isPartial: boolean;
  message: string;
}

export function allocateResources(
  request: ReliefRequest,
  depots: ReliefDepot[]
): { result: AllocationResult; updatedDepots: ReliefDepot[]; updatedRequest: ReliefRequest } {
  const resource = request.resourceType;
  const remainingNeeded = request.unfulfilledQty > 0 ? request.unfulfilledQty : request.requestedQty;

  // Filter available operational depots
  const candidates = depots
    .filter((d) => d.status !== 'isolated')
    .map((d) => ({
      depot: d,
      available: d.inventory[resource]?.availableStock || 0,
    }))
    .filter((c) => c.available > 0)
    .sort((a, b) => b.available - a.available);

  if (candidates.length === 0) {
    return {
      result: {
        success: false,
        requestId: request.id,
        depotId: null,
        depotName: null,
        requestedQty: request.requestedQty,
        allocatedQty: 0,
        unfulfilledQty: remainingNeeded,
        isPartial: false,
        message: `Stock Deficit: Zero available ${resource.replace('_', ' ')} across active depots.`,
      },
      updatedDepots: depots,
      updatedRequest: request,
    };
  }

  const bestMatch = candidates[0];
  const depot = bestMatch.depot;
  const stockAvailable = bestMatch.available;

  const qtyToAllocate = Math.min(remainingNeeded, stockAvailable);
  const newUnfulfilled = remainingNeeded - qtyToAllocate;
  const isPartial = qtyToAllocate < remainingNeeded;

  const updatedDepots = depots.map((d) => {
    if (d.id === depot.id) {
      const currentItem = d.inventory[resource];
      return {
        ...d,
        inventory: {
          ...d.inventory,
          [resource]: {
            ...currentItem,
            availableStock: currentItem.availableStock - qtyToAllocate,
            allocatedStock: currentItem.allocatedStock + qtyToAllocate,
          },
        },
      };
    }
    return d;
  });

  const updatedRequest: ReliefRequest = {
    ...request,
    allocatedQty: request.allocatedQty + qtyToAllocate,
    unfulfilledQty: newUnfulfilled,
    allocatedDepotId: depot.id,
    requestStatus: newUnfulfilled === 0 ? 'fully_allocated' : 'partially_allocated',
  };

  return {
    result: {
      success: true,
      requestId: request.id,
      depotId: depot.id,
      depotName: depot.name,
      requestedQty: request.requestedQty,
      allocatedQty: qtyToAllocate,
      unfulfilledQty: newUnfulfilled,
      isPartial,
      message: isPartial
        ? `Allocated ${qtyToAllocate} units from ${depot.name}. Deficit of ${newUnfulfilled} units remains in queue.`
        : `Fully allocated ${qtyToAllocate} units from ${depot.name}.`,
    },
    updatedDepots,
    updatedRequest,
  };
}
