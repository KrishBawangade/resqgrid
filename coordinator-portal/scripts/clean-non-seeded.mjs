// clean-non-seeded.mjs - Remove all non-seeded items and requests from Neon DB and display them
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import dns from 'dns';
import pg from 'pg';
const { Pool } = pg;

// Resilient DNS resolution
const origLookup = dns.lookup;
const resolver = new dns.Resolver();
resolver.setServers(['8.8.8.8', '1.1.1.1']);

dns.lookup = function (hostname, options, callback) {
  if (typeof options === 'function') {
    callback = options;
    options = {};
  }
  if (hostname && hostname.includes('neon.tech')) {
    resolver.resolve4(hostname, (err, addrs) => {
      if (!err && addrs && addrs.length > 0) {
        if (options && options.all) {
          return callback(null, addrs.map((a) => ({ address: a, family: 4 })));
        }
        return callback(null, addrs[0], 4);
      }
      return origLookup(hostname, options, callback);
    });
  } else {
    return origLookup(hostname, options, callback);
  }
};

const connectionString = process.env.DATABASE_URL || process.env.DIRECT_URL;
if (!connectionString) {
  console.error('ERROR: DATABASE_URL not found.');
  process.exit(1);
}

const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);
const db = new PrismaClient({ adapter });

// Official Seeded IDs from initialScenario.ts
const SEEDED_REQUEST_IDS = new Set([
  'REQ-1042',
  'REQ-1039',
  'REQ-1045',
  'REQ-1048',
  'REQ-1033',
]);

const SEEDED_DEPOT_IDS = new Set([
  'DEPOT-ALPHA',
  'DEPOT-BETA',
  'DEPOT-GAMMA',
]);

const SEEDED_REPLENISHMENT_IDS = new Set([
  'REP-501',
]);

async function main() {
  console.log('--- Scanning Neon PostgreSQL for Non-Seeded Records ---\n');

  // 1. Scan Relief Requests
  const allRequests = await db.reliefRequest.findMany({
    orderBy: { createdAt: 'desc' },
  });

  const nonSeededRequests = allRequests.filter((r) => !SEEDED_REQUEST_IDS.has(r.id));
  const seededRequests = allRequests.filter((r) => SEEDED_REQUEST_IDS.has(r.id));

  console.log(`Found ${allRequests.length} total relief requests:`);
  console.log(`  - Seeded benchmark requests: ${seededRequests.length}`);
  console.log(`  - Non-seeded requests to remove: ${nonSeededRequests.length}`);

  if (nonSeededRequests.length > 0) {
    console.log('\n[NON-SEEDED REQUESTS TO REMOVE]:');
    console.table(
      nonSeededRequests.map((r) => ({
        id: r.id,
        requesterName: r.requesterName,
        resourceType: r.resourceType,
        requestedQty: r.requestedQty,
        requestStatus: r.requestStatus,
        createdAt: r.createdAt.toISOString(),
      }))
    );

    // Delete non-seeded requests
    for (const req of nonSeededRequests) {
      await db.reliefRequest.delete({ where: { id: req.id } });
      console.log(`  ✓ Removed non-seeded request: ${req.id}`);
    }
  } else {
    console.log('  ✓ No non-seeded relief requests found.');
  }

  // 2. Scan Replenishment Orders
  const allOrders = await db.replenishmentOrder.findMany({
    orderBy: { createdAt: 'desc' },
  });

  const nonSeededOrders = allOrders.filter((o) => !SEEDED_REPLENISHMENT_IDS.has(o.id));
  const seededOrders = allOrders.filter((o) => SEEDED_REPLENISHMENT_IDS.has(o.id));

  console.log(`\nFound ${allOrders.length} total replenishment orders:`);
  console.log(`  - Seeded benchmark orders: ${seededOrders.length}`);
  console.log(`  - Non-seeded orders to remove: ${nonSeededOrders.length}`);

  if (nonSeededOrders.length > 0) {
    console.log('\n[NON-SEEDED REPLENISHMENT ORDERS TO REMOVE]:');
    console.table(
      nonSeededOrders.map((o) => ({
        id: o.id,
        depotId: o.targetDepotId,
        resourceType: o.resourceType,
        quantity: o.quantity,
        status: o.status,
        supplierName: o.supplierName,
      }))
    );

    for (const ord of nonSeededOrders) {
      await db.replenishmentOrder.delete({ where: { id: ord.id } });
      console.log(`  ✓ Removed non-seeded replenishment order: ${ord.id}`);
    }
  } else {
    console.log('  ✓ No non-seeded replenishment orders found.');
  }

  // 3. Scan Depots and Depot Stock
  const allDepots = await db.reliefDepot.findMany({
    include: { stocks: true },
  });

  const nonSeededDepots = allDepots.filter((d) => !SEEDED_DEPOT_IDS.has(d.id));
  if (nonSeededDepots.length > 0) {
    console.log('\n[NON-SEEDED DEPOTS TO REMOVE]:');
    console.table(nonSeededDepots.map((d) => ({ id: d.id, name: d.name })));
    for (const dep of nonSeededDepots) {
      await db.reliefDepot.delete({ where: { id: dep.id } });
      console.log(`  ✓ Removed non-seeded depot: ${dep.id}`);
    }
  }

  // 4. Print Clean Benchmark State
  console.log('\n======================================================');
  console.log('--- CLEAN BENCHMARK STATE IN NEON POSTGRESQL ---');
  console.log('======================================================');

  const finalRequests = await db.reliefRequest.findMany({
    orderBy: { priorityScore: 'desc' },
    select: {
      id: true,
      requesterName: true,
      resourceType: true,
      requestedQty: true,
      allocatedQty: true,
      requestStatus: true,
      allocatedDepotId: true,
      priorityScore: true,
    },
  });

  console.log('\n[ACTIVE SEEDED RELIEF REQUESTS]:');
  console.table(finalRequests);

  const finalStocks = await db.depotStock.findMany({
    orderBy: [{ depotId: 'asc' }, { resourceType: 'asc' }],
    select: {
      depotId: true,
      resourceType: true,
      availableStock: true,
      allocatedStock: true,
      totalStock: true,
    },
  });

  console.log('\n[ACTIVE SEEDED DEPOT STOCK LEVELS]:');
  console.table(finalStocks);

  await db.$disconnect();
  await pool.end();
}

main().catch((err) => {
  console.error('Error during cleanup:', err);
  process.exit(1);
});
