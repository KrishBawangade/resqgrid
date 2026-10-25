import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { 
  INITIAL_REQUESTS, 
  INITIAL_DEPOTS, 
  INITIAL_REPLENISHMENT 
} from '@/lib/data/initialScenario';
import { broadcastRealtimeEvent } from '@/lib/events';
import { formatDbRequest } from '@/app/api/requests/route';
import { getFormattedDepots } from '@/app/api/depots/route';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: CORS_HEADERS,
  });
}

// POST /api/scenario/reset - Re-seed the database back to pristine initial benchmark state
export async function POST() {
  try {
    // 1. Reset Relief Requests
    await db.reliefRequest.deleteMany({});
    for (const req of INITIAL_REQUESTS) {
      await db.reliefRequest.create({
        data: {
          id: req.id,
          timestamp: new Date(req.timestamp),
          requesterName: req.requesterName,
          contactNumber: req.contactNumber,
          resourceType: req.resourceType,
          requestedQty: req.requestedQty,
          allocatedQty: req.allocatedQty,
          unfulfilledQty: req.unfulfilledQty,
          requestedResources: (req.requestedResources && req.requestedResources.length > 0)
            ? (req.requestedResources as object)
            : [{
                resourceType: req.resourceType,
                requestedQty: req.requestedQty,
                allocatedQty: req.allocatedQty,
                unfulfilledQty: req.unfulfilledQty,
              }],
          locationZoneName: req.location.zoneName,
          locationLat: req.location.lat,
          locationLng: req.location.lng,
          locationAccessibility: req.location.accessibility,
          peopleAffected: req.peopleAffected,
          vulnerability: req.vulnerability as unknown as object,
          urgencyLevel: req.urgencyLevel,
          scoreBreakdown: req.scoreBreakdown as unknown as object,
          priorityScore: req.priorityScore,
          verificationStatus: req.verificationStatus,
          requestStatus: req.requestStatus,
          allocatedDepotId: req.allocatedDepotId,
          notes: req.notes || null,
          waitingMinutes: req.waitingMinutes,
          aiTriageInsight: req.aiTriageInsight || null,
          aiConfidence: req.aiConfidence || null,
          rejectionReason: req.rejectionReason || null,
        },
      });
    }

    // 2. Reset Depots and Depot Stocks
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

    // 3. Reset Replenishments
    await db.replenishmentOrder.deleteMany({});
    for (const rep of INITIAL_REPLENISHMENT) {
      await db.replenishmentOrder.create({
        data: {
          id: rep.id,
          resourceType: rep.resourceType,
          quantity: rep.quantity,
          supplierName: rep.supplierName,
          targetDepotId: rep.depotId,
          status: rep.status,
          requestedAt: new Date(rep.requestedAt),
          estimatedMinutes: 45,
        },
      });
    }

    // 4. Log Immutable Reset Event
    await db.auditLog.create({
      data: {
        action: 'SCENARIO_RESET',
        actor: 'Chief Incident Coordinator',
        details: 'Benchmark disaster scenario reset to baseline state. All 5 initial requests, depot stocks, and supplier pipelines re-initialized.',
      },
    });

    const rows = await db.reliefRequest.findMany({ orderBy: { priorityScore: 'desc' } });
    const formattedRequests = rows.map(formatDbRequest);
    const formattedDepots = await getFormattedDepots();

    broadcastRealtimeEvent('REQUESTS_RESET', formattedRequests);
    broadcastRealtimeEvent('DEPOTS_UPDATED', formattedDepots);

    return NextResponse.json(
      {
        success: true,
        message: 'Scenario reset successfully',
        requests: formattedRequests,
        depots: formattedDepots,
      },
      { headers: CORS_HEADERS }
    );
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Scenario reset failed';
    console.error('Failed to reset scenario in Neon DB:', err);
    return NextResponse.json({ error: message }, { status: 500, headers: CORS_HEADERS });
  }
}
