import { db } from '../src/lib/db';
import { INITIAL_DEPOTS, INITIAL_REQUESTS, INITIAL_REPLENISHMENT, INITIAL_AUDIT_LOGS } from '../../coordinator-portal/src/lib/data/initialScenario';

async function seedMumbaiDisasterScenario() {
  console.log('================================================================');
  console.log('🌧️ SEEDING MUMBAI METROPOLITAN DISASTER SCENARIO (MITHI RIVER)');
  console.log('================================================================\n');

  try {
    // 1. Seed Relief Depots & Stock
    console.log('1. Seeding Strategic Relief Depots & Inventory Stocks...');
    for (const depot of INITIAL_DEPOTS) {
      const savedDepot = await db.reliefDepot.upsert({
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
      console.log(`  ✓ Depot Upserted: ${savedDepot.id} - ${savedDepot.name}`);

      // Upsert Stocks for this depot
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
      console.log(`    ↳ Stocks synchronized for ${depot.id} across 4 resource types.`);
    }

    // 2. Seed Initial Benchmark Relief Requests
    console.log('\n2. Seeding Benchmark Relief Requests in Mumbai Flood Sectors...');
    for (const req of INITIAL_REQUESTS) {
      const primaryRes = req.resourceType;
      const primaryQty = req.requestedQty;
      const requestedList = req.requestedResources || [
        {
          resourceType: primaryRes,
          requestedQty: primaryQty,
          allocatedQty: req.allocatedQty,
          unfulfilledQty: req.unfulfilledQty,
        },
      ];

      const savedReq = await db.reliefRequest.upsert({
        where: { id: req.id },
        update: {
          timestamp: new Date(req.timestamp),
          requesterName: req.requesterName,
          contactNumber: req.contactNumber,
          resourceType: primaryRes,
          requestedQty: primaryQty,
          allocatedQty: req.allocatedQty,
          unfulfilledQty: req.unfulfilledQty,
          requestedResources: requestedList,
          locationZoneName: req.location.zoneName,
          locationLat: req.location.lat,
          locationLng: req.location.lng,
          locationAccessibility: req.location.accessibility,
          peopleAffected: req.peopleAffected,
          vulnerability: req.vulnerability as any,
          urgencyLevel: req.urgencyLevel,
          scoreBreakdown: req.scoreBreakdown as any,
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
        create: {
          id: req.id,
          timestamp: new Date(req.timestamp),
          requesterName: req.requesterName,
          contactNumber: req.contactNumber,
          resourceType: primaryRes,
          requestedQty: primaryQty,
          allocatedQty: req.allocatedQty,
          unfulfilledQty: req.unfulfilledQty,
          requestedResources: requestedList,
          locationZoneName: req.location.zoneName,
          locationLat: req.location.lat,
          locationLng: req.location.lng,
          locationAccessibility: req.location.accessibility,
          peopleAffected: req.peopleAffected,
          vulnerability: req.vulnerability as any,
          urgencyLevel: req.urgencyLevel,
          scoreBreakdown: req.scoreBreakdown as any,
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
      console.log(`  ✓ Request Upserted: ${savedReq.id} - ${savedReq.locationZoneName} (Score: ${savedReq.priorityScore})`);
    }

    // 3. Seed Replenishment Order
    console.log('\n3. Seeding Active Replenishment Order...');
    for (const rep of INITIAL_REPLENISHMENT) {
      await db.replenishmentOrder.upsert({
        where: { id: rep.id },
        update: {
          resourceType: rep.resourceType,
          quantity: rep.quantity,
          supplierName: rep.supplierName,
          targetDepotId: rep.depotId,
          status: rep.status,
          requestedAt: new Date(rep.requestedAt),
          estimatedMinutes: 45,
          notes: 'Emergency water tankers dispatched from National Disaster Reserve Hub via Eastern Freeway.',
        },
        create: {
          id: rep.id,
          resourceType: rep.resourceType,
          quantity: rep.quantity,
          supplierName: rep.supplierName,
          targetDepotId: rep.depotId,
          status: rep.status,
          requestedAt: new Date(rep.requestedAt),
          estimatedMinutes: 45,
          notes: 'Emergency water tankers dispatched from National Disaster Reserve Hub via Eastern Freeway.',
        },
      });
      console.log(`  ✓ Replenishment Order Upserted: ${rep.id} (${rep.quantity} ${rep.resourceType}) to ${rep.depotId}`);
    }

    // 4. Seed Audit Logs
    console.log('\n4. Seeding Initial Audit Ledger Entries...');
    for (const log of INITIAL_AUDIT_LOGS) {
      await db.auditLog.create({
        data: {
          timestamp: new Date(),
          action: log.action,
          actor: log.actor,
          details: log.details,
          requestId: log.details.includes('REQ-') ? log.details.match(/REQ-\d+/)?.[0] : null,
        },
      });
    }
    console.log(`  ✓ Audit Ledger initialized with ${INITIAL_AUDIT_LOGS.length} verified operations.`);

    // 5. Verification summary
    const depotCount = await db.reliefDepot.count();
    const stockCount = await db.depotStock.count();
    const reqCount = await db.reliefRequest.count();
    const repCount = await db.replenishmentOrder.count();
    const auditCount = await db.auditLog.count();

    console.log('\n================================================================');
    console.log('✅ MUMBAI METROPOLITAN SEEDING COMPLETE IN NEON POSTGRESQL');
    console.log(`   • Relief Depots:       ${depotCount}`);
    console.log(`   • Inventory Stock Rows:${stockCount}`);
    console.log(`   • Relief Requests:     ${reqCount}`);
    console.log(`   • Replenishment Orders:${repCount}`);
    console.log(`   • Audit Ledger Entries:${auditCount}`);
    console.log('================================================================\n');

  } catch (error) {
    console.error('Seed Error:', error);
  } finally {
    await db.$disconnect();
  }
}

seedMumbaiDisasterScenario();
