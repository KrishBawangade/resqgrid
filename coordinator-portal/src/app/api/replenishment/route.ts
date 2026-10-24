import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { INITIAL_REPLENISHMENT, INITIAL_DEPOTS } from '@/lib/data/initialScenario';
import { ReplenishmentOrder, ResourceType } from '@/lib/types';
import { broadcastRealtimeEvent } from '@/lib/events';
import { getFormattedDepots } from '@/app/api/depots/route';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PATCH, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

function getDepotName(depotId: string): string {
  const depot = INITIAL_DEPOTS.find((d) => d.id === depotId);
  return depot?.name || `${depotId} Logistics Hub`;
}

function formatDbOrder(row: {
  id: string;
  resourceType: string;
  quantity: number;
  supplierName: string;
  targetDepotId: string;
  status: string;
  requestedAt: Date;
  notes: string | null;
  confirmedAt: Date | null;
}): ReplenishmentOrder {
  let priority: ReplenishmentOrder['priority'] = 'emergency';
  if (row.notes && row.notes.toLowerCase().includes('high')) priority = 'high';
  if (row.notes && row.notes.toLowerCase().includes('standard')) priority = 'standard';

  return {
    id: row.id,
    resourceType: row.resourceType as ResourceType,
    quantity: row.quantity,
    depotId: row.targetDepotId,
    depotName: getDepotName(row.targetDepotId),
    supplierName: row.supplierName,
    priority,
    status: row.status as ReplenishmentOrder['status'],
    requestedAt: row.requestedAt.toISOString(),
    dispatchedAt: row.requestedAt.toISOString(),
    deliveredAt: row.confirmedAt ? row.confirmedAt.toISOString() : undefined,
  };
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: CORS_HEADERS,
  });
}

// GET /api/replenishment - Fetch all replenishment orders
export async function GET() {
  try {
    const rows = await db.replenishmentOrder.findMany({
      orderBy: { requestedAt: 'desc' },
    });

    if (rows.length === 0) {
      // Seed initial replenishment order
      for (const order of INITIAL_REPLENISHMENT) {
        await db.replenishmentOrder.upsert({
          where: { id: order.id },
          update: {
            resourceType: order.resourceType,
            quantity: order.quantity,
            supplierName: order.supplierName,
            targetDepotId: order.depotId,
            status: order.status,
            requestedAt: new Date(order.requestedAt),
            notes: `Priority: ${order.priority}`,
          },
          create: {
            id: order.id,
            resourceType: order.resourceType,
            quantity: order.quantity,
            supplierName: order.supplierName,
            targetDepotId: order.depotId,
            status: order.status,
            requestedAt: new Date(order.requestedAt),
            notes: `Priority: ${order.priority}`,
          },
        });
      }

      const seededRows = await db.replenishmentOrder.findMany({
        orderBy: { requestedAt: 'desc' },
      });
      return NextResponse.json(seededRows.map(formatDbOrder), { headers: CORS_HEADERS });
    }

    return NextResponse.json(rows.map(formatDbOrder), { headers: CORS_HEADERS });
  } catch (err: unknown) {
    console.error('Error fetching replenishment orders from Neon DB:', err);
    return NextResponse.json(INITIAL_REPLENISHMENT, { headers: CORS_HEADERS });
  }
}

// POST /api/replenishment - Issue new supplier replenishment order
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const {
      resourceType,
      quantity,
      depotId,
      depotName,
      supplierName,
      priority = 'emergency',
    } = body;

    if (!resourceType || !quantity || !depotId) {
      return NextResponse.json(
        { error: 'resourceType, quantity, and depotId are required' },
        { status: 400, headers: CORS_HEADERS }
      );
    }

    const orderId = `REP-${Math.floor(510 + Math.random() * 480)}`;
    const now = new Date();

    const created = await db.replenishmentOrder.create({
      data: {
        id: orderId,
        resourceType,
        quantity: parseInt(String(quantity), 10),
        supplierName: supplierName || 'National Disaster Reserve Hub',
        targetDepotId: depotId,
        status: 'in_transit', // simulated instant dispatch from NDRF reserve
        requestedAt: now,
        notes: `Priority: ${priority}`,
      },
    });

    // Write audit log
    const auditDetails = `Requisitioned ${quantity} units of ${resourceType.replace(
      '_',
      ' '
    )} for ${depotName || depotId} from ${supplierName}. Shipment In-Transit.`;

    const auditEntry = await db.auditLog.create({
      data: {
        action: 'REPLENISHMENT',
        actor: 'Coordinator Vance',
        details: auditDetails,
        requestId: orderId,
      },
    });

    const formattedOrder = formatDbOrder(created);

    // Broadcast updates
    const allOrders = (await db.replenishmentOrder.findMany({ orderBy: { requestedAt: 'desc' } })).map(
      formatDbOrder
    );

    broadcastRealtimeEvent('REPLENISHMENT_UPDATED', allOrders);
    broadcastRealtimeEvent('AUDIT_LOG_ADDED', {
      id: auditEntry.id,
      timestamp: now.toLocaleTimeString() + ' UTC',
      category: 'REPLENISHMENT',
      action: 'REPLENISHMENT_ORDERED',
      actor: 'Coordinator Vance',
      details: auditDetails,
      delta: `Order ${orderId}`,
    });

    return NextResponse.json(formattedOrder, { status: 201, headers: CORS_HEADERS });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Failed to create replenishment order';
    console.error('Error creating replenishment order:', err);
    return NextResponse.json({ error: msg }, { status: 500, headers: CORS_HEADERS });
  }
}

// PATCH /api/replenishment - Confirm receipt and restock depot inventory
export async function PATCH(request: Request) {
  try {
    const body = await request.json();
    const { id, action = 'confirm_delivery' } = body;

    if (!id) {
      return NextResponse.json({ error: 'Order ID is required' }, { status: 400, headers: CORS_HEADERS });
    }

    const existingOrder = await db.replenishmentOrder.findUnique({
      where: { id },
    });

    if (!existingOrder) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404, headers: CORS_HEADERS });
    }

    if (action === 'confirm_delivery') {
      const now = new Date();

      // 1. Update order status to delivered
      const updatedOrder = await db.replenishmentOrder.update({
        where: { id },
        data: {
          status: 'delivered',
          confirmedAt: now,
        },
      });

      // 2. Increment target depot inventory in Neon DB
      const currentStock = await db.depotStock.findUnique({
        where: {
          depotId_resourceType: {
            depotId: existingOrder.targetDepotId,
            resourceType: existingOrder.resourceType,
          },
        },
      });

      const currentAvailable = currentStock ? currentStock.availableStock : 0;
      const currentAllocated = currentStock ? currentStock.allocatedStock : 0;
      const currentTotal = currentStock ? currentStock.totalStock : 1000;

      const newAvailable = currentAvailable + existingOrder.quantity;
      const newTotal = Math.max(currentTotal, newAvailable + currentAllocated);

      await db.depotStock.upsert({
        where: {
          depotId_resourceType: {
            depotId: existingOrder.targetDepotId,
            resourceType: existingOrder.resourceType,
          },
        },
        update: {
          availableStock: newAvailable,
          totalStock: newTotal,
        },
        create: {
          depotId: existingOrder.targetDepotId,
          resourceType: existingOrder.resourceType,
          availableStock: newAvailable,
          allocatedStock: currentAllocated,
          totalStock: newTotal,
        },
      });

      // 3. Log to audit trail
      const auditDetails = `Verified delivery receipt of ${existingOrder.quantity} units (${existingOrder.resourceType.replace(
        '_',
        ' '
      )}) for ${existingOrder.targetDepotId}. Available inventory updated.`;

      const auditEntry = await db.auditLog.create({
        data: {
          action: 'DELIVERY_CONFIRMED',
          actor: 'Coordinator Vance',
          details: auditDetails,
          requestId: existingOrder.id,
        },
      });

      // 4. Fetch updated depots and all orders
      const updatedDepots = await getFormattedDepots();
      const allOrders = (await db.replenishmentOrder.findMany({ orderBy: { requestedAt: 'desc' } })).map(
        formatDbOrder
      );

      // 5. Broadcast real-time SSE events so Operations Console, Inventory Page, and Map instantly reflect new stock!
      broadcastRealtimeEvent('DEPOTS_UPDATED', updatedDepots);
      broadcastRealtimeEvent('REPLENISHMENT_UPDATED', allOrders);
      broadcastRealtimeEvent('AUDIT_LOG_ADDED', {
        id: auditEntry.id,
        timestamp: now.toLocaleTimeString() + ' UTC',
        category: 'REPLENISHMENT',
        action: 'DELIVERY_CONFIRMED',
        actor: 'Coordinator Vance',
        details: auditDetails,
        delta: `+${existingOrder.quantity} Units (${existingOrder.targetDepotId})`,
      });

      return NextResponse.json(
        {
          success: true,
          order: formatDbOrder(updatedOrder),
          depots: updatedDepots,
          orders: allOrders,
        },
        { headers: CORS_HEADERS }
      );
    }

    return NextResponse.json({ error: 'Unsupported action' }, { status: 400, headers: CORS_HEADERS });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Failed to update replenishment order';
    console.error('Error confirming replenishment delivery:', err);
    return NextResponse.json({ error: msg }, { status: 500, headers: CORS_HEADERS });
  }
}
