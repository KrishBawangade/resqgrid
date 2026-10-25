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
    requestedResources: [
      { resourceType: 'drinking_water', requestedQty: 200, allocatedQty: 0, unfulfilledQty: 200 },
    ],
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
    id: 'REQ-1052',
    timestamp: '2026-10-23T16:20:00Z',
    requesterName: 'Sister Theresa (St. Jude Relief Base)',
    contactNumber: '+91 98205 66712',
    resourceType: 'medical_supplies',
    requestedQty: 310,
    allocatedQty: 0,
    unfulfilledQty: 310,
    requestedResources: [
      { resourceType: 'medical_supplies', requestedQty: 40, allocatedQty: 0, unfulfilledQty: 40 },
      { resourceType: 'drinking_water', requestedQty: 180, allocatedQty: 0, unfulfilledQty: 180 },
      { resourceType: 'food_rations', requestedQty: 90, allocatedQty: 0, unfulfilledQty: 90 },
    ],
    locationZoneName: 'Sector 1 - Mahim Creek & Dharavi Lowlands',
    locationLat: 19.0440,
    locationLng: 72.8520,
    locationAccessibility: 'flooded_boat_only',
    peopleAffected: 85,
    vulnerability: { hasChildren: false, hasElderly: true, hasInjured: true, isClinic: true },
    urgencyLevel: 'immediate',
    scoreBreakdown: { criticalityScore: 55, vulnerabilityScore: 20, peopleAffectedScore: 8.5, waitingTimeScore: 7.0, totalScore: 90.5 },
    priorityScore: 90.5,
    verificationStatus: 'verified',
    requestStatus: 'submitted',
    allocatedDepotId: null,
    notes: 'Makeshift triage center surrounded by 4ft surge near Mahim Creek confluence. 14 trauma cuts, diabetic elderly needing insulin cooling, dry food rations, and antiseptic dressings.',
    waitingMinutes: 50,
    aiTriageInsight: 'AI Triage: Multi-category acute clinical crisis near Mahim Creek. Dehydration hazard, infected flood abrasions, and food shortage confirmed. Aquatic boat dispatch required.',
    aiConfidence: 96,
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
    requestedResources: [
      { resourceType: 'medical_supplies', requestedQty: 45, allocatedQty: 45, unfulfilledQty: 0 },
    ],
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
    requestedQty: 350,
    allocatedQty: 0,
    unfulfilledQty: 350,
    requestedResources: [
      { resourceType: 'food_rations', requestedQty: 200, allocatedQty: 0, unfulfilledQty: 200 },
      { resourceType: 'drinking_water', requestedQty: 150, allocatedQty: 0, unfulfilledQty: 150 },
    ],
    locationZoneName: 'Sector 7 - BKC MMRDA Evacuation Grounds & High School',
    locationLat: 19.0625,
    locationLng: 72.8640,
    locationAccessibility: 'accessible',
    peopleAffected: 180,
    vulnerability: { hasChildren: true, hasElderly: true, hasInjured: false, isClinic: false },
    urgencyLevel: 'high',
    scoreBreakdown: { criticalityScore: 40, vulnerabilityScore: 10, peopleAffectedScore: 15, waitingTimeScore: 5.5, totalScore: 78.6 },
    priorityScore: 78.6,
    verificationStatus: 'verified',
    requestStatus: 'submitted',
    allocatedDepotId: null,
    notes: '180 displaced evacuees sheltering in BKC school gymnasium; community kitchen provisions exhausted. Dry rations and clean drinking water needed immediately.',
    waitingMinutes: 25,
    aiTriageInsight: 'AI Triage: High headcount displacement with children and elderly; verified multi-resource deficit. Direct road transit corridor accessible.',
    aiConfidence: 93,
  },
  {
    id: 'REQ-1055',
    timestamp: '2026-10-23T16:35:00Z',
    requesterName: 'Anand Joshi (Chunabhatti Transit Camp)',
    contactNumber: '+91 98207 88410',
    resourceType: 'shelter_kits',
    requestedQty: 145,
    allocatedQty: 0,
    unfulfilledQty: 145,
    requestedResources: [
      { resourceType: 'shelter_kits', requestedQty: 25, allocatedQty: 0, unfulfilledQty: 25 },
      { resourceType: 'drinking_water', requestedQty: 120, allocatedQty: 0, unfulfilledQty: 120 },
    ],
    locationZoneName: 'Sector 3 - Chunabhatti Lowlands & Railway Colony',
    locationLat: 19.0520,
    locationLng: 72.8720,
    locationAccessibility: 'debris_delay',
    peopleAffected: 60,
    vulnerability: { hasChildren: true, hasElderly: true, hasInjured: false, isClinic: false },
    urgencyLevel: 'high',
    scoreBreakdown: { criticalityScore: 40, vulnerabilityScore: 15, peopleAffectedScore: 8, waitingTimeScore: 4.2, totalScore: 73.5 },
    priorityScore: 73.5,
    verificationStatus: 'pending',
    requestStatus: 'submitted',
    allocatedDepotId: null,
    notes: 'Squall winds ripped roofs from shanties along the railway line. 8 families exposed to monsoon downpour without potable drinking water.',
    waitingMinutes: 30,
    aiTriageInsight: 'AI Triage: Structural exposure and potable water contamination in railway corridor. Accessible via LBS Marg high-clearance utility truck.',
    aiConfidence: 89,
  },
  {
    id: 'REQ-1048',
    timestamp: '2026-10-23T16:40:00Z',
    requesterName: 'Pooja Sharma (Community Volunteer)',
    contactNumber: '+91 98202 33451',
    resourceType: 'shelter_kits',
    requestedQty: 25,
    allocatedQty: 0,
    unfulfilledQty: 25,
    requestedResources: [
      { resourceType: 'shelter_kits', requestedQty: 25, allocatedQty: 0, unfulfilledQty: 25 },
    ],
    locationZoneName: 'Sector 5 - Kalina University Campus & CST Road Bypass',
    locationLat: 19.0760,
    locationLng: 72.8600,
    locationAccessibility: 'accessible',
    peopleAffected: 40,
    vulnerability: { hasChildren: false, hasElderly: true, hasInjured: false, isClinic: false },
    urgencyLevel: 'moderate',
    scoreBreakdown: { criticalityScore: 25, vulnerabilityScore: 10, peopleAffectedScore: 6, waitingTimeScore: 2.2, totalScore: 61.2 },
    priorityScore: 61.2,
    verificationStatus: 'verified',
    requestStatus: 'submitted',
    allocatedDepotId: null,
    notes: 'Temporary waterproof tarpaulin kits needed for families whose residential roofs were blown off during the squall.',
    waitingMinutes: 15,
    aiTriageInsight: 'AI Triage: Roof loss displacement in Kalina; non-critical temperature conditions.',
    aiConfidence: 88,
  },
  {
    id: 'REQ-1033',
    timestamp: '2026-10-23T15:10:00Z',
    requesterName: 'Amitabh Sen',
    contactNumber: '+91 98201 18842',
    resourceType: 'food_rations',
    requestedQty: 50,
    allocatedQty: 0,
    unfulfilledQty: 50,
    requestedResources: [
      { resourceType: 'food_rations', requestedQty: 50, allocatedQty: 0, unfulfilledQty: 50 },
    ],
    locationZoneName: 'Sector 9 - Chembur High Ground & Eastern Freeway (Non-Impacted)',
    locationLat: 19.0550,
    locationLng: 72.9000,
    locationAccessibility: 'accessible',
    peopleAffected: 12,
    vulnerability: { hasChildren: false, hasElderly: false, hasInjured: false, isClinic: false },
    urgencyLevel: 'low',
    scoreBreakdown: { criticalityScore: 15, vulnerabilityScore: 0, peopleAffectedScore: 3, waitingTimeScore: 9.0, totalScore: 32.5 },
    priorityScore: 32.5,
    verificationStatus: 'rejected',
    requestStatus: 'rejected',
    allocatedDepotId: null,
    notes: 'Neighborhood residential group outside flood zone looking for extra emergency canned food rations to replenish pantry storage in case roads close later.',
    waitingMinutes: 90,
    aiTriageInsight: 'AI Triage: Non-impacted peripheral zone. Request flagged for commercial routing.',
    aiConfidence: 95,
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
          aiTriageDetails: req.stageTimestamps ? { stageTimestamps: req.stageTimestamps } : null,
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
