import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { INITIAL_DEPOTS } from '@/lib/data/initialScenario';
import { ReliefDepot, ResourceType, InventoryItem } from '@/lib/types';
import { broadcastRealtimeEvent } from '@/lib/events';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PATCH, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

const RESOURCE_UNITS: Record<ResourceType, string> = {
  drinking_water: 'Liters',
  food_rations: 'Packs',
  medical_supplies: 'Kits',
  shelter_kits: 'Tents',
};

export function formatDbDepot(row: {
  id: string;
  name: string;
  lat: number;
  lng: number;
  zoneName: string;
  status: string;
  stocks: Array<{
    resourceType: string;
    totalStock: number;
    allocatedStock: number;
    availableStock: number;
  }>;
}): ReliefDepot {
  const inventory: Record<ResourceType, InventoryItem> = {
    drinking_water: {
      resourceType: 'drinking_water',
      totalCapacity: 1000,
      availableStock: 0,
      allocatedStock: 0,
      unit: 'Liters',
    },
    food_rations: {
      resourceType: 'food_rations',
      totalCapacity: 1000,
      availableStock: 0,
      allocatedStock: 0,
      unit: 'Packs',
    },
    medical_supplies: {
      resourceType: 'medical_supplies',
      totalCapacity: 250,
      availableStock: 0,
      allocatedStock: 0,
      unit: 'Kits',
    },
    shelter_kits: {
      resourceType: 'shelter_kits',
      totalCapacity: 150,
      availableStock: 0,
      allocatedStock: 0,
      unit: 'Tents',
    },
  };

  row.stocks.forEach((s) => {
    const resType = s.resourceType as ResourceType;
    if (inventory[resType]) {
      inventory[resType] = {
        resourceType: resType,
        totalCapacity: s.totalStock,
        availableStock: s.availableStock,
        allocatedStock: s.allocatedStock,
        unit: RESOURCE_UNITS[resType] || 'Units',
      };
    }
  });

  return {
    id: row.id,
    name: row.name,
    zoneName: row.zoneName,
    lat: row.lat,
    lng: row.lng,
    status: row.status as ReliefDepot['status'],
    inventory,
  };
}

export async function getFormattedDepots(): Promise<ReliefDepot[]> {
  const rows = await db.reliefDepot.findMany({
    include: { stocks: true },
    orderBy: { id: 'asc' },
  });

  if (rows.length === 0) {
    // If empty, auto-seed initial scenario depots and stock
    for (const depot of INITIAL_DEPOTS) {
      await db.reliefDepot.upsert({
        where: { id: depot.id },
        update: {
          name: depot.name,
          zoneName: depot.zoneName,
          lat: depot.lat,
          lng: depot.lng,
          status: depot.status,
        },
        create: {
          id: depot.id,
          name: depot.name,
          zoneName: depot.zoneName,
          lat: depot.lat,
          lng: depot.lng,
          status: depot.status,
        },
      });

      for (const [resType, item] of Object.entries(depot.inventory)) {
        await db.depotStock.upsert({
          where: {
            depotId_resourceType: {
              depotId: depot.id,
              resourceType: resType,
            },
          },
          update: {
            totalStock: item.totalCapacity,
            availableStock: item.availableStock,
            allocatedStock: item.allocatedStock,
          },
          create: {
            depotId: depot.id,
            resourceType: resType,
            totalStock: item.totalCapacity,
            availableStock: item.availableStock,
            allocatedStock: item.allocatedStock,
            lowStockThreshold: 50,
          },
        });
      }
    }

    const reloaded = await db.reliefDepot.findMany({
      include: { stocks: true },
      orderBy: { id: 'asc' },
    });
    return reloaded.map(formatDbDepot);
  }

  return rows.map(formatDbDepot);
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: CORS_HEADERS,
  });
}

// GET /api/depots - Fetch all depots and live stock from Neon DB
export async function GET() {
  try {
    const formatted = await getFormattedDepots();
    return NextResponse.json(formatted, { headers: CORS_HEADERS });
  } catch (err: unknown) {
    console.error('Error fetching depots from Neon DB:', err);
    return NextResponse.json(INITIAL_DEPOTS, { headers: CORS_HEADERS });
  }
}

// PATCH /api/depots - Allocate, replenish, or deliver stock
export async function PATCH(request: Request) {
  try {
    const body = await request.json();
    const {
      action = 'allocate',
      depotId,
      resourceType,
      quantity = 0,
      requestId,
      actor = 'Chief Coordinator Vance',
      details,
      depots: updatedDepotsInput,
    } = body;

    // Direct multi-depot overwrite mode if depots array passed
    if (Array.isArray(updatedDepotsInput)) {
      for (const d of updatedDepotsInput) {
        for (const [resType, item] of Object.entries(d.inventory as Record<string, InventoryItem>)) {
          await db.depotStock.upsert({
            where: {
              depotId_resourceType: {
                depotId: d.id,
                resourceType: resType,
              },
            },
            update: {
              availableStock: item.availableStock,
              allocatedStock: item.allocatedStock,
              totalStock: item.totalCapacity,
            },
            create: {
              depotId: d.id,
              resourceType: resType,
              availableStock: item.availableStock,
              allocatedStock: item.allocatedStock,
              totalStock: item.totalCapacity,
            },
          });
        }
      }

      const allDepots = await getFormattedDepots();
      broadcastRealtimeEvent('DEPOTS_UPDATED', allDepots);
      return NextResponse.json({ success: true, depots: allDepots }, { headers: CORS_HEADERS });
    }

    if (!depotId || !resourceType) {
      return NextResponse.json(
        { error: 'depotId and resourceType are required' },
        { status: 400, headers: CORS_HEADERS }
      );
    }

    const currentStock = await db.depotStock.findUnique({
      where: {
        depotId_resourceType: {
          depotId,
          resourceType,
        },
      },
    });

    const currentAvailable = currentStock ? currentStock.availableStock : 0;
    const currentAllocated = currentStock ? currentStock.allocatedStock : 0;
    const currentTotal = currentStock ? currentStock.totalStock : 1000;

    let newAvailable = currentAvailable;
    let newAllocated = currentAllocated;
    let newTotal = currentTotal;
    let logAction = 'ALLOCATION';
    let logDelta = '';
    const unitLabel = RESOURCE_UNITS[resourceType as ResourceType] || 'units';

    if (action === 'allocate') {
      // Meeting demand: available drops, allocated (reserved) increases
      newAvailable = Math.max(0, currentAvailable - quantity);
      newAllocated = currentAllocated + quantity;
      logAction = 'ALLOCATION';
      logDelta = `-${quantity} ${unitLabel} (${depotId})`;
    } else if (action === 'deliver' || action === 'fulfill') {
      // Final citizen delivery: reserved stock leaves the depot
      newAllocated = Math.max(0, currentAllocated - quantity);
      logAction = 'DELIVERY_CONFIRMED';
      logDelta = `Delivered ${quantity} ${unitLabel} (${depotId})`;
    } else if (action === 'replenish') {
      // Restocking: available stock increases
      newAvailable = currentAvailable + quantity;
      newTotal = Math.max(currentTotal, newAvailable + currentAllocated);
      logAction = 'REPLENISHMENT';
      logDelta = `+${quantity} ${unitLabel} (${depotId})`;
    } else if (action === 'adjust') {
      if (body.availableStock !== undefined) newAvailable = body.availableStock;
      if (body.allocatedStock !== undefined) newAllocated = body.allocatedStock;
      if (body.totalStock !== undefined) newTotal = body.totalStock;
      logAction = 'INVENTORY_ADJUSTMENT';
      logDelta = `Adjusted (${depotId})`;
    }

    await db.depotStock.upsert({
      where: {
        depotId_resourceType: {
          depotId,
          resourceType,
        },
      },
      update: {
        availableStock: newAvailable,
        allocatedStock: newAllocated,
        totalStock: newTotal,
      },
      create: {
        depotId,
        resourceType,
        availableStock: newAvailable,
        allocatedStock: newAllocated,
        totalStock: newTotal,
      },
    });

    // Write to immutable Neon audit log
    const auditText =
      details ||
      `${logAction}: ${quantity} ${unitLabel} of ${resourceType.replace('_', ' ')} at ${depotId}${
        requestId ? ` for request ${requestId}` : ''
      }.`;

    const auditEntry = await db.auditLog.create({
      data: {
        action: logAction,
        actor,
        details: auditText,
        requestId: requestId || null,
      },
    });

    const allDepots = await getFormattedDepots();

    // Broadcast live event to all SSE clients (Operations Console, Inventory Page, Map)
    broadcastRealtimeEvent('DEPOTS_UPDATED', allDepots);
    broadcastRealtimeEvent('AUDIT_LOG_ADDED', {
      id: auditEntry.id,
      timestamp: new Date().toLocaleTimeString() + ' UTC',
      category: logAction,
      action: logAction,
      actor,
      details: auditText,
      delta: logDelta,
    });

    return NextResponse.json({ success: true, depots: allDepots }, { headers: CORS_HEADERS });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Inventory update failed';
    console.error('Error updating depot stock:', err);
    return NextResponse.json({ error: message }, { status: 500, headers: CORS_HEADERS });
  }
}
