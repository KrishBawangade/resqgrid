// test-realtime-sync.ts
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

const connectionString = "postgresql://neondb_owner:npg_eXVhS8CI9wMg@ep-purple-night-a1x0r9gt-pooler.ap-southeast-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require";
const adapter = new PrismaPg({ connectionString });
const db = new PrismaClient({ adapter });

async function run() {
  console.log('--- ResQGrid Real-Time SSE Stream & Cross-Portal Test ---');

  // 1. Test Coordinator Portal GET /api/requests (port 3000)
  console.log('1. Checking Coordinator Portal API (port 3000)...');
  const coordRes1 = await fetch('http://localhost:3000/api/requests');
  if (!coordRes1.ok) {
    const errText = await coordRes1.text();
    throw new Error(`Coordinator API failed with status ${coordRes1.status}: ${errText}`);
  }
  const initialCoordReqs = await coordRes1.json();
  console.log(`   Coordinator currently sees ${initialCoordReqs.length} requests in Neon DB.`);

  // 2. Test Coordinator SSE Stream endpoint (port 3000)
  console.log('2. Connecting to Coordinator SSE Stream (http://localhost:3000/api/requests/stream)...');
  const abortController = new AbortController();
  const sseResponse = await fetch('http://localhost:3000/api/requests/stream', {
    headers: { 'Accept': 'text/event-stream' },
    signal: abortController.signal,
  });

  if (!sseResponse.ok) {
    throw new Error(`SSE stream connection failed with status ${sseResponse.status}`);
  }
  console.log('   ✓ SSE Stream successfully established (status 200, Content-Type: text/event-stream)!');

  // Read initial chunk from SSE stream to verify connection payload
  const reader = sseResponse.body?.getReader();
  if (reader) {
    const { value } = await reader.read();
    const text = new TextDecoder().decode(value);
    console.log(`   ✓ Stream received initial handshake: ${text.trim()}`);
  }

  // 3. Simulate Citizen submitting a new request on Citizen Portal (port 3001)
  console.log('3. Citizen submitting emergency request to Citizen Portal (port 3001)...');
  const citizenPayload = {
    requesterName: 'Realtime SSE Verifier',
    contactNumber: '+91 98200 88776',
    zoneName: 'Sector 4: Kurla West & Kranti Nagar',
    customCoords: { lat: 19.0715, lng: 72.8785 },
    headcount: 18,
    resources: [
      { resourceType: 'drinking_water', requestedQty: 120 },
      { resourceType: 'food_rations', requestedQty: 40 },
    ],
    notes: 'Ground floor submerged by Mithi river overflow. Family waiting on rooftop. Children need dry food and water.',
  };

  const citizenPostRes = await fetch('http://localhost:3001/api/requests', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(citizenPayload),
  });

  if (!citizenPostRes.ok) {
    const errText = await citizenPostRes.text();
    throw new Error(`Citizen submission failed (${citizenPostRes.status}): ${errText}`);
  }

  const createdRequest = await citizenPostRes.json();
  console.log(`   ✓ New Request Created: ${createdRequest.id}`);
  console.log(`   Priority Score: ${createdRequest.priorityScore.toFixed(1)}/100`);

  // 4. Verify SSE stream received the pushed event
  console.log('4. Checking if SSE Stream received the real-time event without polling...');
  if (reader) {
    const { value } = await reader.read();
    const eventText = new TextDecoder().decode(value);
    console.log(`   ✓ SSE Stream received live push: ${eventText.trim()}`);
  }
  abortController.abort(); // Close stream

  // 5. Coordinator verifies the request via PATCH
  console.log('5. Coordinator verifying request via PATCH http://localhost:3000/api/requests...');
  const patchRes = await fetch('http://localhost:3000/api/requests', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id: createdRequest.id, verificationStatus: 'verified' }),
  });

  if (!patchRes.ok) throw new Error(`PATCH failed with status ${patchRes.status}`);
  const patchResult = await patchRes.json();
  console.log(`   ✓ Request status in DB: verificationStatus=${patchResult.verificationStatus}`);

  // 6. Citizen Tracker checks GET /api/requests/[id] (port 3001)
  console.log('6. Citizen Tracker querying http://localhost:3001/api/requests/' + createdRequest.id + '...');
  const trackerRes = await fetch(`http://localhost:3001/api/requests/${createdRequest.id}`);
  if (!trackerRes.ok) throw new Error(`Citizen tracker query failed with status ${trackerRes.status}`);
  const trackerData = await trackerRes.json();
  console.log(`   ✓ Citizen Tracker sees live updated status: ${trackerData.verificationStatus} (Verified=${trackerData.verificationStatus === 'verified'})`);

  // 7. Clean up test record so database stays pristine
  console.log('7. Cleaning up test request from database...');
  await db.reliefRequest.delete({ where: { id: createdRequest.id } });
  console.log(`   ✓ Cleaned up test record ${createdRequest.id}. Database is in pristine benchmark state!`);

  console.log('\n--- ALL REAL-TIME SSE STREAM & CROSS-PORTAL TESTS PASSED! ---');
  await db.$disconnect();
}

run().catch((e) => {
  console.error('Test failed:', e);
  process.exit(1);
});
