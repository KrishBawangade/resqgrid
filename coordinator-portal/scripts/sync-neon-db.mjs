// sync-neon-db.mjs - Reconcile and verify Neon PostgreSQL database state
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import dns from 'dns';
import pg from 'pg';
const { Pool } = pg;

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
  console.error('ERROR: DATABASE_URL is not defined in environment.');
  process.exit(1);
}

const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);
const db = new PrismaClient({ adapter });

const INITIAL_REQUESTS = [
  {
    id: 'REQ-1042',
    timestamp: '2026-10-23T16:15:00Z',
    requesterName: 'Dr. Sunita Kulkarni (Community Clinic Ward)',
    contactNumber: '+91 98201 92834',
    resourceType: 'drinking_water',
    requestedQty: 200,
    allocatedQty: 0,
    unfulfilledQty: 200,
    locationZoneName: 'Sector 4 - Kurla West & Kranti Nagar (Mithi Overflow)',
    locationLat: 19.0715,
    locationLng: 72.8785,
    locationAccessibility: 'flooded_boat_only',
    peopleAffected: 65,
    vulnerability: { hasChildren: true, hasElderly: true, hasInjured: false, isClinic: true },
    urgencyLevel: 'immediate',
    scoreBreakdown: { criticalityScore: 55, vulnerabilityScore: 20, peopleAffectedScore: 10, waitingTimeScore: 7.4, totalScore: 92.4 },
    priorityScore: 92.4,
    verificationStatus: 'verified',
    requestStatus: 'submitted',
    allocatedDepotId: null,
    notes: 'Ground-floor clean water tanks contaminated by rising Mithi River floodwaters. 4 newborn infants and elderly patients at risk of acute dehydration.',
    waitingMinutes: 45,
    aiTriageInsight: 'AI Triage: Verified acute neonatal and geriatric dehydration hazard in Kurla West. Flood depth 4.5ft. Prioritized for immediate aquatic dispatch.',
    aiConfidence: 97,
  },
  {
    id: 'REQ-1039',
    timestamp: '2026-10-23T15:55:00Z',
    requesterName: 'Dr. Rajesh Deshmukh',
    contactNumber: '+91 98204 99210',
    resourceType: 'medical_supplies',
    requestedQty: 45,
    allocatedQty: 45,
    unfulfilledQty: 0,
    locationZoneName: 'Sector 2 - Sion Hospital & Kalanagar Trauma Clinic',
    locationLat: 19.0390,
    locationLng: 72.8610,
    locationAccessibility: 'debris_delay',
    peopleAffected: 30,
    vulnerability: { hasChildren: false, hasElderly: false, hasInjured: true, isClinic: true },
    urgencyLevel: 'immediate',
    scoreBreakdown: { criticalityScore: 55, vulnerabilityScore: 20, peopleAffectedScore: 6, waitingTimeScore: 8.1, totalScore: 89.1 },
    priorityScore: 89.1,
    verificationStatus: 'verified',
    requestStatus: 'fully_allocated',
    allocatedDepotId: 'DEPOT-ALPHA',
    notes: 'Emergency trauma dressings and IV hydration packs required for flood casualty triage near Sion Hospital junction.',
    waitingMinutes: 65,
    aiTriageInsight: 'AI Triage: Multiple trauma casualties with acute bleeding. Priority high-clearance dispatch confirmed.',
    aiConfidence: 94,
  },
  {
    id: 'REQ-1045',
    timestamp: '2026-10-23T16:30:00Z',
    requesterName: 'Vikram Patil (Relief Camp Warden)',
    contactNumber: '+91 98208 77123',
    resourceType: 'food_rations',
    requestedQty: 300,
    allocatedQty: 0,
    unfulfilledQty: 300,
    locationZoneName: 'Sector 7 - BKC MMRDA Evacuation Grounds & High School',
    locationLat: 19.0620,
    locationLng: 72.8660,
    locationAccessibility: 'accessible',
    peopleAffected: 140,
    vulnerability: { hasChildren: true, hasElderly: false, hasInjured: false, isClinic: false },
    urgencyLevel: 'high',
    scoreBreakdown: { criticalityScore: 40, vulnerabilityScore: 10, peopleAffectedScore: 15, waitingTimeScore: 5.5, totalScore: 70.5 },
    priorityScore: 70.5,
    verificationStatus: 'verified',
    requestStatus: 'submitted',
    allocatedDepotId: null,
    notes: 'Overcrowded high school shelter housing displaced families from Dharavi and Kurla. Hot meals exhausted.',
    waitingMinutes: 30,
    aiTriageInsight: 'AI Triage: Mass food deficit in transit shelter. Standard logistics corridor accessible via Western Express Highway.',
    aiConfidence: 91,
  },
  {
    id: 'REQ-1048',
    timestamp: '2026-10-23T16:45:00Z',
    requesterName: 'Amina Sheikh',
    contactNumber: '+91 98203 11456',
    resourceType: 'shelter_kits',
    requestedQty: 25,
    allocatedQty: 0,
    unfulfilledQty: 25,
    locationZoneName: 'Sector 3 - Chunabhatti Lowlands & Railway Colony',
    locationLat: 19.0510,
    locationLng: 72.8730,
    locationAccessibility: 'debris_delay',
    peopleAffected: 45,
    vulnerability: { hasChildren: true, hasElderly: true, hasInjured: false, isClinic: false },
    urgencyLevel: 'high',
    scoreBreakdown: { criticalityScore: 40, vulnerabilityScore: 15, peopleAffectedScore: 8, waitingTimeScore: 4.2, totalScore: 67.2 },
    priorityScore: 67.2,
    verificationStatus: 'pending',
    requestStatus: 'submitted',
    allocatedDepotId: null,
    notes: 'Roofs collapsed on 8 makeshift shanties due to torrential gale-force rains. 12 children exposed to open downpour.',
    waitingMinutes: 20,
    aiTriageInsight: 'AI Triage: Severe weather exposure risk. Structural shelter tarpaulins required immediately.',
    aiConfidence: 88,
  },
  {
    id: 'REQ-1051',
    timestamp: '2026-10-23T16:50:00Z',
    requesterName: 'Ganesh Shinde',
    contactNumber: '+91 98207 44590',
    resourceType: 'drinking_water',
    requestedQty: 50,
    allocatedQty: 0,
    unfulfilledQty: 50,
    locationZoneName: 'Sector 6 - Chembur Camp & Colony Shelter',
    locationLat: 19.0550,
    locationLng: 72.8900,
    locationAccessibility: 'accessible',
    peopleAffected: 25,
    vulnerability: { hasChildren: false, hasElderly: false, hasInjured: false, isClinic: false },
    urgencyLevel: 'moderate',
    scoreBreakdown: { criticalityScore: 25, vulnerabilityScore: 0, peopleAffectedScore: 5, waitingTimeScore: 2.8, totalScore: 32.8 },
    priorityScore: 32.8,
    verificationStatus: 'pending',
    requestStatus: 'submitted',
    allocatedDepotId: null,
    notes: 'Municipal water tap pressure lost. Dry ration stock intact. Bottled water buffer requested.',
    waitingMinutes: 10,
    aiTriageInsight: 'AI Triage: Non-critical municipal disruption. Secondary priority dispatch routing suggested.',
    aiConfidence: 85,
  },
];

async function main() {
  console.log('Connecting to Neon PostgreSQL...');

  // 1. Ensure all initial scenario requests exist in Neon DB
  console.log('1. Checking and upserting initial scenario requests...');
  for (const req of INITIAL_REQUESTS) {
    const existing = await db.reliefRequest.findUnique({ where: { id: req.id } });
    if (!existing) {
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
          requestedResources: [{
            resourceType: req.resourceType,
            requestedQty: req.requestedQty,
            allocatedQty: req.allocatedQty,
            unfulfilledQty: req.unfulfilledQty,
          }],
          locationZoneName: req.locationZoneName,
          locationLat: req.locationLat,
          locationLng: req.locationLng,
          locationAccessibility: req.locationAccessibility,
          peopleAffected: req.peopleAffected,
          vulnerability: req.vulnerability,
          urgencyLevel: req.urgencyLevel,
          scoreBreakdown: req.scoreBreakdown,
          priorityScore: req.priorityScore,
          verificationStatus: req.verificationStatus,
          requestStatus: req.requestStatus,
          allocatedDepotId: req.allocatedDepotId,
          notes: req.notes,
          waitingMinutes: req.waitingMinutes,
          aiTriageInsight: req.aiTriageInsight,
          aiConfidence: req.aiConfidence,
        },
      });
      console.log(`   + Created initial request: ${req.id}`);
    } else {
      console.log(`   ✓ Request exists: ${req.id} (Status: ${existing.requestStatus}, Allocated: ${existing.allocatedQty})`);
    }
  }

  // 2. Reconcile DEPOT-ALPHA stock levels
  console.log('2. Reconciling DEPOT-ALPHA stock levels with active allocations...');
  const alphaMedical = await db.depotStock.findUnique({
    where: {
      depotId_resourceType: {
        depotId: 'DEPOT-ALPHA',
        resourceType: 'medical_supplies',
      },
    },
  });

  const req1039 = await db.reliefRequest.findUnique({ where: { id: 'REQ-1039' } });
  const isReq1039Active = req1039 && req1039.requestStatus !== 'delivered' && req1039.requestStatus !== 'rejected';

  if (isReq1039Active) {
    await db.depotStock.upsert({
      where: {
        depotId_resourceType: {
          depotId: 'DEPOT-ALPHA',
          resourceType: 'medical_supplies',
        },
      },
      update: {
        availableStock: 45,
        allocatedStock: 45,
        totalStock: 250,
      },
      create: {
        depotId: 'DEPOT-ALPHA',
        resourceType: 'medical_supplies',
        availableStock: 45,
        allocatedStock: 45,
        totalStock: 250,
        lowStockThreshold: 50,
      },
    });
    console.log('   ✓ DEPOT-ALPHA medical_supplies synchronized: available=45, allocated=45 (REQ-1039 active)');
  } else if (req1039 && req1039.requestStatus === 'delivered') {
    await db.depotStock.update({
      where: {
        depotId_resourceType: {
          depotId: 'DEPOT-ALPHA',
          resourceType: 'medical_supplies',
        },
      },
      data: {
        allocatedStock: 0,
      },
    });
    console.log('   ✓ DEPOT-ALPHA medical_supplies: allocated=0 (REQ-1039 fulfilled)');
  }

  // 3. Print summary of all depot stocks
  const allStocks = await db.depotStock.findMany({
    orderBy: [{ depotId: 'asc' }, { resourceType: 'asc' }],
    select: {
      depotId: true,
      resourceType: true,
      availableStock: true,
      allocatedStock: true,
      totalStock: true,
    },
  });

  console.log('\n--- Current Live Depot Stock Levels in Neon DB ---');
  console.table(allStocks);

  const allRequests = await db.reliefRequest.findMany({
    orderBy: { priorityScore: 'desc' },
    select: {
      id: true,
      resourceType: true,
      requestedQty: true,
      allocatedQty: true,
      requestStatus: true,
      allocatedDepotId: true,
    },
  });

  console.log('\n--- Current Live Relief Requests in Neon DB ---');
  console.table(allRequests);

  await db.$disconnect();
}

main().catch((err) => {
  console.error('Database sync error:', err);
  process.exit(1);
});
