// Standalone Test Runner for ResQGrid LLM Triage & 55/20/15/10 Scoring Engine
// Run with: node scripts/test-triage.mjs

const TEST_CASES = [
  {
    name: 'Test 1: Acute Flooded Clinic (Life Threat)',
    requesterName: 'Maria Gomez (Clinic Nurse)',
    contactNumber: '+1 (555) 019-2834',
    zoneName: 'Sector 4 - Riverside Colony',
    headcount: 65,
    resources: [
      { resourceType: 'drinking_water', requestedQty: 200 },
      { resourceType: 'medical_supplies', requestedQty: 25 },
    ],
    notes:
      'Ground-floor community clinic is flooded with 3.5ft of rising water. We have 4 newborn infants and 12 elderly patients with no clean drinking water. Clean water tanks contaminated, electricity dead, acute dehydration and hypothermia danger.',
  },
  {
    name: 'Test 2: Trauma Casualties from Storm Debris',
    requesterName: 'Dr. Aaron Vance',
    contactNumber: '+1 (555) 014-9921',
    zoneName: 'Sector 2 - North Bridge Clinic',
    headcount: 30,
    resources: [
      { resourceType: 'medical_supplies', requestedQty: 45 },
    ],
    notes:
      'Triage outpost has 30 patients injured by collapsing structures and flying storm debris. Multiple active bleeding casualties, open fractures, and deep lacerations. Urgent surgical dressings and IV hydration packs required now.',
  },
  {
    name: 'Test 3: Large Evacuation Shelter (Food Depletion)',
    requesterName: 'David Chen (Community Warden)',
    contactNumber: '+1 (555) 018-7712',
    zoneName: 'Sector 7 - East High School Relief Camp',
    headcount: 180,
    resources: [
      { resourceType: 'food_rations', requestedQty: 300 },
      { resourceType: 'drinking_water', requestedQty: 200 },
    ],
    notes:
      'Sheltering 180 displaced residents in school gymnasium. High school cafeteria provisions exhausted yesterday. Many families with young children and seniors experiencing severe hunger.',
  },
  {
    name: 'Test 4: Non-Impacted Area (Routine Restocking)',
    requesterName: 'Marcus Bennett',
    contactNumber: '+1 (555) 011-8842',
    zoneName: 'Sector 9 - Highland Ridge (Non-Impacted)',
    headcount: 12,
    resources: [
      { resourceType: 'food_rations', requestedQty: 50 },
    ],
    notes:
      'Neighborhood residential group outside flood zone looking for extra emergency canned food rations to replenish pantry storage in case roads close later.',
  },
];

function calculatePeopleScore(headcount) {
  if (headcount <= 0) return 0;
  const maxScale = Math.log10(500);
  const current = Math.log10(headcount + 1);
  return Math.min(100, Math.round(((current / maxScale) * 100) * 10) / 10);
}

function computeScore(crit, vuln, people, wait = 0) {
  const critPts = 0.55 * crit;
  const vulnPts = 0.20 * vuln;
  const peoplePts = 0.15 * people;
  const waitPts = 0.10 * wait;
  const total = critPts + vulnPts + peoplePts + waitPts;
  return {
    critPts: Math.round(critPts * 10) / 10,
    vulnPts: Math.round(vulnPts * 10) / 10,
    peoplePts: Math.round(peoplePts * 10) / 10,
    waitPts: Math.round(waitPts * 10) / 10,
    total: Math.round(total * 10) / 10,
  };
}

function getTier(total) {
  if (total >= 75) return { tier: 'TIER 1', label: 'ACUTE EMERGENCY (IMMEDIATE DISPATCH)', color: '\x1b[31m' };
  if (total >= 55) return { tier: 'TIER 2', label: 'URGENT HARDSHIP (EXPEDITED)', color: '\x1b[33m' };
  return { tier: 'TIER 3', label: 'STANDARD RELIEF (BATCH RESTOCK)', color: '\x1b[34m' };
}

async function runTests() {
  console.log('\n================================================================================');
  console.log('🚀 RESQGRID LLM TRIAGE & 55/20/15/10 SCORING ENGINE TEST HARNESS');
  console.log('================================================================================\n');

  for (let i = 0; i < TEST_CASES.length; i++) {
    const tc = TEST_CASES[i];
    console.log(`\n--------------------------------------------------------------------------------`);
    console.log(`🧪 [${i + 1}/${TEST_CASES.length}] ${tc.name}`);
    console.log(`👤 Requester: ${tc.requesterName} | Sector: ${tc.zoneName}`);
    console.log(`👥 Headcount: ${tc.headcount} | Demanded: ${tc.resources.map((r) => `${r.requestedQty} ${r.resourceType}`).join(', ')}`);
    console.log(`📝 Note: "${tc.notes}"`);
    console.log(`--------------------------------------------------------------------------------`);

    try {
      const response = await fetch('http://localhost:3001/api/triage', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          notes: tc.notes,
          resources: tc.resources,
          headcount: tc.headcount,
          zoneName: tc.zoneName,
        }),
      });

      if (!response.ok) {
        console.error(`❌ HTTP Error: ${response.status} ${response.statusText}`);
        continue;
      }

      const result = await response.json();

      console.log(`🧠 LLM / NLP Output:`);
      console.log(`   • Engine:             ${result.engineUsed === 'gemini-llm' ? '✨ Google Gemini 2.5 Flash' : '🛡️ Smart Local NLP Engine'}`);
      console.log(`   • Urgency:            ${result.urgencyLevel.toUpperCase()}`);
      console.log(`   • Criticality:        ${result.criticalityScore} / 100 ("${result.criticalityReason}")`);
      console.log(`   • Vulnerability:      ${result.vulnerabilityScore} / 100 ("${result.vulnerabilityReason}")`);
      console.log(`   • Vulnerability Flags:`, result.vulnerability);
      console.log(`   • Primary Resource:   ${result.primaryResourceType}`);
      console.log(`   • Dispatch Method:    ${result.recommendedDispatch}`);
      console.log(`   • AI Clinical Note:   "${result.aiTriageInsight}"`);

      // Compute mathematical breakdown
      const pScore = calculatePeopleScore(tc.headcount);
      const score = computeScore(result.criticalityScore, result.vulnerabilityScore, pScore, 0);
      const tier = getTier(score.total);

      console.log(`\n📐 55/20/15/10 Mathematical Synthesis:`);
      console.log(`   Factor 1 (55%): Criticality    = 0.55 × ${result.criticalityScore} = ${score.critPts.toFixed(1)} pts`);
      console.log(`   Factor 2 (20%): Vulnerability  = 0.20 × ${result.vulnerabilityScore} = ${score.vulnPts.toFixed(1)} pts`);
      console.log(`   Factor 3 (15%): Headcount (${tc.headcount}) = 0.15 × ${pScore.toFixed(1)} = ${score.peoplePts.toFixed(1)} pts`);
      console.log(`   Factor 4 (10%): Wait Time (0m) = 0.10 ×   0.0 =  0.0 pts`);
      console.log(`   ─────────────────────────────────────────────────────────────`);
      console.log(`   🎯 FINAL PRIORITY SCORE: ${tier.color}${score.total} / 100\x1b[0m  [ ${tier.tier} — ${tier.label} ]`);
    } catch (err) {
      console.error(`❌ Request Failed:`, err.message);
    }
  }

  console.log('\n================================================================================');
  console.log('✅ ALL TEST SCENARIOS COMPLETED');
  console.log('================================================================================\n');
}

runTests();
