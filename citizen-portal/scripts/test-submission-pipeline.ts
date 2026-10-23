import { db } from '../src/lib/db';
import { runAiTriage } from '../src/lib/engines/triage';
import { computePriorityScore } from '../src/lib/engines/prioritization';

async function testSubmission() {
  console.log('======================================================');
  console.log('🧪 Testing End-to-End AI Triage + Neon DB Submission');
  console.log('======================================================\n');

  const testPayload = {
    requesterName: 'Nurse Elena Rostova',
    contactNumber: '+1 (555) 948-2211',
    zoneName: 'Sector 4 - Riverside Colony',
    headcount: 45,
    resources: [
      { resourceType: 'medical_supplies' as const, requestedQty: 30 },
      { resourceType: 'drinking_water' as const, requestedQty: 150 },
    ],
    notes: 'Urgent: Clinic perimeter breach due to 4ft water level. 8 elderly patients with hypothermia, 3 trauma casualties needing surgical dressings. Drinking water completely exhausted.',
  };

  console.log('1. Passing input to AI Triage Engine...');
  const triageResult = await runAiTriage({
    notes: testPayload.notes,
    resources: testPayload.resources,
    headcount: testPayload.headcount,
    zoneName: testPayload.zoneName,
  });
  console.log('✓ AI Triage Result:', {
    urgencyLevel: triageResult.urgencyLevel,
    criticalityScore: triageResult.criticalityScore,
    vulnerabilityScore: triageResult.vulnerabilityScore,
    engineUsed: triageResult.engineUsed,
    recommendedDispatch: triageResult.recommendedDispatch,
  });

  console.log('\n2. Computing 55/20/15/10 Priority Score...');
  const scoreBreakdown = computePriorityScore(
    triageResult.primaryResourceType,
    triageResult.urgencyLevel,
    triageResult.vulnerability,
    testPayload.headcount,
    0,
    {
      criticalityScore: triageResult.criticalityScore,
      vulnerabilityScore: triageResult.vulnerabilityScore,
    }
  );
  console.log('✓ Computed Priority Score:', scoreBreakdown.totalScore, '/ 100');

  console.log('\n3. Inserting into Neon PostgreSQL database...');
  const testId = `REQ-${Math.floor(1000 + Math.random() * 9000)}`;
  const saved = await db.reliefRequest.create({
    data: {
      id: testId,
      requesterName: testPayload.requesterName,
      contactNumber: testPayload.contactNumber,
      resourceType: triageResult.primaryResourceType,
      requestedQty: 30,
      allocatedQty: 0,
      unfulfilledQty: 30,
      requestedResources: testPayload.resources,
      locationZoneName: testPayload.zoneName,
      locationLat: 13.0827,
      locationLng: 80.2707,
      locationAccessibility: 'flooded_boat_only',
      peopleAffected: testPayload.headcount,
      vulnerability: triageResult.vulnerability,
      urgencyLevel: triageResult.urgencyLevel,
      scoreBreakdown: scoreBreakdown as unknown as object,
      priorityScore: scoreBreakdown.totalScore,
      verificationStatus: 'pending',
      requestStatus: 'submitted',
      notes: testPayload.notes,
      waitingMinutes: 0,
      aiTriageInsight: triageResult.aiTriageInsight,
      aiConfidence: triageResult.aiConfidence,
      aiTriageDetails: {
        criticalityScore: triageResult.criticalityScore,
        criticalityReason: triageResult.criticalityReason,
        vulnerabilityScore: triageResult.vulnerabilityScore,
        vulnerabilityReason: triageResult.vulnerabilityReason,
        recommendedDispatch: triageResult.recommendedDispatch,
        engineUsed: triageResult.engineUsed,
      },
    },
  });
  console.log(`✓ Successfully stored record ${saved.id} in Neon PostgreSQL!`);

  console.log('\n4. Logging to Neon AuditLog table...');
  const audit = await db.auditLog.create({
    data: {
      action: 'INTAKE_SUBMISSION',
      actor: `${testPayload.requesterName} (Citizen Intake)`,
      details: `Emergency request ${testId} submitted in ${testPayload.zoneName}. AI Urgency: ${triageResult.urgencyLevel.toUpperCase()}, Score: ${scoreBreakdown.totalScore}`,
      requestId: testId,
    },
  });
  console.log(`✓ AuditLog recorded (ID: ${audit.id})`);

  console.log('\n5. Verifying Neon database record count...');
  const totalCount = await db.reliefRequest.count();
  console.log(`✓ Total ReliefRequests in Neon PostgreSQL: ${totalCount}`);

  await db.$disconnect();
  console.log('\n🎉 End-to-end AI triage + database storage test PASSED!');
}

testSubmission().catch(console.error);
