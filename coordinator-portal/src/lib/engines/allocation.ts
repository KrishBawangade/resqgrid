// Stock-Aware Resource Allocation Engine
// Hard Constraints:
// 1. Double allocation is strictly prohibited.
// 2. Partial fulfillment is supported when depot inventory < requested amount.
// 3. Unfulfilled remainder remains prioritized in queue.
// 4. Depot selection balances stock availability and accessibility.
// 5. Multi-resource support: all requested resources in package are allocated from optimal operational depots.

import { ReliefRequest, ReliefDepot, ResourceType } from '../types';

export interface DepotAllocationItem {
  depotId: string;
  depotName: string;
  resourceType: ResourceType;
  quantity: number;
}

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
  allocations: DepotAllocationItem[];
}

export function allocateResources(
  request: ReliefRequest,
  depots: ReliefDepot[]
): { result: AllocationResult; updatedDepots: ReliefDepot[]; updatedRequest: ReliefRequest } {
  let currentDepots = [...depots];
  const allocations: DepotAllocationItem[] = [];

  // Identify all resources in requisition package
  const resourcesToAllocate = (request.requestedResources && request.requestedResources.length > 0)
    ? request.requestedResources.map((r) => ({ ...r }))
    : [{
        resourceType: request.resourceType,
        requestedQty: request.requestedQty,
        allocatedQty: request.allocatedQty,
        unfulfilledQty: request.unfulfilledQty > 0 ? request.unfulfilledQty : (request.allocatedQty > 0 ? 0 : request.requestedQty),
      }];

  const updatedRequestedResources = resourcesToAllocate.map((resItem) => {
    const deficit = resItem.unfulfilledQty > 0
      ? resItem.unfulfilledQty
      : (resItem.allocatedQty > 0 ? 0 : resItem.requestedQty);

    if (deficit <= 0) {
      return { ...resItem };
    }

    // Find available operational depots with stock for this resource
    const candidates = currentDepots
      .filter((d) => d.status !== 'isolated')
      .map((d) => ({
        depot: d,
        available: d.inventory[resItem.resourceType]?.availableStock || 0,
      }))
      .filter((c) => c.available > 0)
      .sort((a, b) => b.available - a.available);

    if (candidates.length === 0) {
      return { ...resItem, unfulfilledQty: deficit };
    }

    let remainingDeficit = deficit;
    let newlyAllocatedForItem = 0;

    for (const cand of candidates) {
      if (remainingDeficit <= 0) break;
      const allocAmount = Math.min(remainingDeficit, cand.available);
      if (allocAmount <= 0) continue;

      remainingDeficit -= allocAmount;
      newlyAllocatedForItem += allocAmount;
      cand.available -= allocAmount;

      allocations.push({
        depotId: cand.depot.id,
        depotName: cand.depot.name,
        resourceType: resItem.resourceType,
        quantity: allocAmount,
      });

      // Update currentDepots inventory immutably
      currentDepots = currentDepots.map((d) => {
        if (d.id === cand.depot.id) {
          const invItem = d.inventory[resItem.resourceType];
          return {
            ...d,
            inventory: {
              ...d.inventory,
              [resItem.resourceType]: {
                ...invItem,
                availableStock: invItem.availableStock - allocAmount,
                allocatedStock: invItem.allocatedStock + allocAmount,
              },
            },
          };
        }
        return d;
      });
    }

    return {
      ...resItem,
      allocatedQty: resItem.allocatedQty + newlyAllocatedForItem,
      unfulfilledQty: remainingDeficit,
    };
  });

  const totalRequested = updatedRequestedResources.reduce((sum, r) => sum + r.requestedQty, 0);
  const totalAllocated = updatedRequestedResources.reduce((sum, r) => sum + r.allocatedQty, 0);
  const totalUnfulfilled = updatedRequestedResources.reduce((sum, r) => sum + r.unfulfilledQty, 0);

  const newlyAllocatedTotal = allocations.reduce((sum, a) => sum + a.quantity, 0);
  const isPartial = totalUnfulfilled > 0;
  const isFull = totalUnfulfilled === 0;

  const primaryDepot = allocations.length > 0 ? allocations[0] : null;

  let message = '';
  if (allocations.length === 0) {
    message = `Stock Deficit: Insufficient warehouse inventory across active depots to fulfill remaining demand.`;
  } else if (isFull) {
    const depotNames = Array.from(new Set(allocations.map((a) => a.depotName))).join(', ');
    message = updatedRequestedResources.length > 1
      ? `Fully allocated ${newlyAllocatedTotal} units across ${updatedRequestedResources.length} resources from ${depotNames}.`
      : `Fully allocated ${newlyAllocatedTotal} units from ${depotNames}.`;
  } else {
    message = `Partially allocated ${newlyAllocatedTotal} units. Deficit of ${totalUnfulfilled} units remains in queue.`;
  }

  const updatedRequest: ReliefRequest = {
    ...request,
    requestedQty: totalRequested > 0 ? totalRequested : request.requestedQty,
    allocatedQty: totalAllocated,
    unfulfilledQty: totalUnfulfilled,
    requestedResources: updatedRequestedResources,
    allocatedDepotId: primaryDepot ? primaryDepot.depotId : request.allocatedDepotId,
    requestStatus: isFull ? 'fully_allocated' : totalAllocated > 0 ? 'partially_allocated' : request.requestStatus,
  };

  return {
    result: {
      success: allocations.length > 0,
      requestId: request.id,
      depotId: primaryDepot ? primaryDepot.depotId : null,
      depotName: primaryDepot ? primaryDepot.depotName : null,
      requestedQty: totalRequested > 0 ? totalRequested : request.requestedQty,
      allocatedQty: newlyAllocatedTotal,
      unfulfilledQty: totalUnfulfilled,
      isPartial,
      message,
      allocations,
    },
    updatedDepots: currentDepots,
    updatedRequest,
  };
}
