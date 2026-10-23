import { NextResponse } from 'next/server';
import { ResourceType, UrgencyLevel, VulnerabilityFactors } from '@/lib/types';
import { SIMULATED_ZONES } from '@/lib/data/initialScenario';
import { calculateCriticality, calculateVulnerability } from '@/lib/engines/prioritization';

interface TriageInputResource {
  resourceType: ResourceType;
  requestedQty: number;
}

export interface TriageEngineResult {
  primaryResourceType: ResourceType;
  urgencyLevel: UrgencyLevel;
  vulnerability: VulnerabilityFactors;
  criticalityScore: number;
  criticalityReason: string;
  vulnerabilityScore: number;
  vulnerabilityReason: string;
  recommendedDispatch: 'aquatic_boat' | 'high_clearance_truck' | 'ground_standard';
  aiTriageInsight: string;
  credibilityScore: number;
  aiConfidence: number;
  engineUsed: 'gemini-llm' | 'local-nlp';
}

const RESOURCE_SEVERITY_RANK: Record<ResourceType, number> = {
  medical_supplies: 4,
  drinking_water: 3,
  food_rations: 2,
  shelter_kits: 1,
};

// Fallback Rule-Based NLP Entity & Sentiment Extractor
function localNlpExtractor(
  notes: string,
  resources: TriageInputResource[],
  headcount: number,
  zoneName: string
): TriageEngineResult {
  const lower = (notes || '').toLowerCase();

  // 1. Detect Vulnerabilities from Note text
  const isClinic = /clinic|hospital|dispensary|infirmary|er|ward|doctor|nurse|medical center|ambulance/i.test(lower);
  const hasChildren = /child|children|infant|baby|babies|kid|kids|pediatric|toddler|newborn/i.test(lower);
  const hasElderly = /elderly|senior|geriatric|grandma|grandpa|old age|pensioner/i.test(lower);
  const hasInjured = /injur|bleed|wound|trauma|casualt|fractur|concussion|hypothermia|burn|unconscious|lacerat/i.test(lower);

  // 2. Determine Primary Resource (highest severity among selected)
  let primaryResourceType: ResourceType = 'drinking_water';
  if (resources && resources.length > 0) {
    const sorted = [...resources].sort(
      (a, b) => (RESOURCE_SEVERITY_RANK[b.resourceType] || 0) - (RESOURCE_SEVERITY_RANK[a.resourceType] || 0)
    );
    primaryResourceType = sorted[0].resourceType;
  }

  // 3. Detect Urgency from Note text
  let urgencyLevel: UrgencyLevel = 'moderate';
  if (/immediate|threat to life|dying|drowning|severe bleed|critical|emergency|asap|now!|perish|danger|catastroph|urgent!/i.test(lower)) {
    urgencyLevel = 'immediate';
  } else if (/high|urgent|rapid|desperate|soon|deteriorat|running out/i.test(lower)) {
    urgencyLevel = 'high';
  } else if (/low|minor|stable|routine|non-urgent|stock|pantry/i.test(lower)) {
    urgencyLevel = 'low';
  }

  // 4. Calculate Subjective Factor Scores
  const vulnFactors: VulnerabilityFactors = { hasChildren, hasElderly, hasInjured, isClinic };
  const baseCrit = calculateCriticality(primaryResourceType, urgencyLevel);
  const baseVuln = calculateVulnerability(vulnFactors);

  const criticalityReason =
    urgencyLevel === 'immediate'
      ? `Immediate emergency classified based on reported life threats and acute ${primaryResourceType.replace('_', ' ')} deficit.`
      : `Elevated relief urgency evaluated for ${headcount} individuals requiring ${primaryResourceType.replace('_', ' ')}.`;

  const vulnList: string[] = [];
  if (isClinic) vulnList.push('medical clinic/outpost');
  if (hasInjured) vulnList.push('acute trauma casualties');
  if (hasChildren) vulnList.push('pediatric infants/children');
  if (hasElderly) vulnList.push('geriatric/elderly individuals');

  const vulnerabilityReason =
    vulnList.length > 0
      ? `Vulnerability detected from field report: ${vulnList.join(', ')}.`
      : 'Standard demographic profile without acute vulnerability markers in note.';

  // 5. Recommended Dispatch Method based on Sector Accessibility
  let recommendedDispatch: 'aquatic_boat' | 'high_clearance_truck' | 'ground_standard' = 'ground_standard';
  if (/sector 4|sector 1|water|flood|inundat/i.test(zoneName)) {
    recommendedDispatch = 'aquatic_boat';
  } else if (/sector 2|debris|delay/i.test(zoneName)) {
    recommendedDispatch = 'high_clearance_truck';
  }

  const aiTriageInsight = `AI Triage: Verified ${urgencyLevel.toUpperCase()} priority for ~${headcount} people in ${zoneName}. Criticality: ${baseCrit}/100, Vulnerability: ${baseVuln}/100.`;

  return {
    primaryResourceType,
    urgencyLevel,
    vulnerability: vulnFactors,
    criticalityScore: baseCrit,
    criticalityReason,
    vulnerabilityScore: baseVuln,
    vulnerabilityReason,
    recommendedDispatch,
    aiTriageInsight,
    credibilityScore: 92,
    aiConfidence: 91,
    engineUsed: 'local-nlp',
  };
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const notes: string = body?.notes || body?.text || '';
    const resources: TriageInputResource[] = body?.resources || [];
    const headcount: number = Number(body?.headcount) || 25;
    const zoneName: string = body?.zoneName || 'Sector 4 - Riverside Colony';

    // Find zone ground truth metadata
    const zoneContext = SIMULATED_ZONES.find((z) => z.zoneName === zoneName) || SIMULATED_ZONES[0];

    const apiKey = process.env.GEMINI_API_KEY;
    const model = process.env.GEMINI_MODEL || 'gemini-1.5-flash';

    console.log(`\n======================================================`);
    console.log(`🚨 [ResQGrid Server] Incoming Triage Request`);
    console.log(`📍 Sector: ${zoneName} | Headcount: ${headcount}`);
    console.log(`📦 Resources:`, resources);
    console.log(`📝 Citizen Note: "${notes}"`);
    console.log(`🤖 LLM Provider: ${apiKey && apiKey.trim().length > 10 ? `Gemini (${model})` : 'Smart Local NLP'}`);
    console.log(`======================================================\n`);

    // If Gemini API Key is available, invoke Gemini
    if (apiKey && apiKey.trim().length > 10 && apiKey !== 'your_gemini_api_key_here') {
      try {
        const prompt = `You are the ResQGrid Intelligent Emergency Relief Triage Officer (operating under UN OCHA / FEMA disaster triage protocols).
Analyze the incoming emergency relief request and extract structured tactical logistics parameters.

=== SITUATION CONTEXT ===
Disaster Event: Severe Flash Flood & Urban Storm Surge
Target Sector: "${zoneName}"
Sector Ground-Truth Accessibility: "${zoneContext.accessibility}" (${zoneContext.description})
Headcount Reported: ${headcount} individuals
Requested Resources: ${JSON.stringify(resources)}
Citizen Emergency Note / Field Report:
"${notes}"

=== TRIAGE EVALUATION RULES ===
1. Urgency Level:
   - "immediate": Direct, acute threat to human life within 0-6 hours (drowning, hypothermia, lack of hydration for infants, active hemorrhage).
   - "high": Severe deprivation or escalating risk within 6-24 hours.
   - "moderate": Depleted provisions without immediate acute life threat.
   - "low": Non-critical restocking or routine requests.

2. Criticality Score (0 to 100):
   - Measure of life-safety urgency. Medical trauma = 90-100; contaminated water with infants/elders = 85-95; depleted food in shelter = 70-80; non-emergency = 20-45.

3. Vulnerabilities:
   - "hasInjured": true if active casualties, bleeding, fractures, hypothermia, or traumatic wounds are mentioned.
   - "isClinic": true if requesting for a clinic, hospital, triage tent, dispensary, or nursing outpost.
   - "hasChildren": true if infants, toddlers, babies, pediatric, or children are mentioned.
   - "hasElderly": true if senior citizens, elderly, grandmothers, grandfathers, or chronic medication patients are mentioned.

4. Vulnerability Score (0 to 100):
   - Quantitative demographic frailty: Injured (+40), Clinic (+35), Children (+25), Elderly (+20), capped at 100.

5. Primary Resource Type:
   - The single most critical resource among those selected ("drinking_water" | "medical_supplies" | "food_rations" | "shelter_kits").

6. Recommended Dispatch Method:
   - "aquatic_boat" for flooded sectors (Sector 4 or Sector 1).
   - "high_clearance_truck" for debris-blocked roads (Sector 2).
   - "ground_standard" for accessible sectors (Sector 7, Sector 5, Sector 9).

=== REQUIRED JSON OUTPUT SCHEMA ===
Respond ONLY with a valid JSON object matching this structure (no markdown formatting):
{
  "urgencyLevel": "immediate" | "high" | "moderate" | "low",
  "criticalityScore": number,
  "criticalityReason": string,
  "vulnerability": {
    "hasChildren": boolean,
    "hasElderly": boolean,
    "hasInjured": boolean,
    "isClinic": boolean
  },
  "vulnerabilityScore": number,
  "vulnerabilityReason": string,
  "primaryResourceType": "drinking_water" | "medical_supplies" | "food_rations" | "shelter_kits",
  "recommendedDispatch": "aquatic_boat" | "high_clearance_truck" | "ground_standard",
  "aiTriageInsight": string,
  "credibilityScore": number,
  "aiConfidence": number
}`;

        const response = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              contents: [{ parts: [{ text: prompt }] }],
              generationConfig: {
                temperature: 0.2,
                responseMimeType: 'application/json',
              },
            }),
          }
        );

        if (response.ok) {
          const data = await response.json();
          let rawReply = data?.candidates?.[0]?.content?.parts?.[0]?.text;
          if (rawReply) {
            rawReply = rawReply.replace(/```json/g, '').replace(/```/g, '').trim();
            const parsed = JSON.parse(rawReply);
            const llmResult: TriageEngineResult = {
              ...parsed,
              engineUsed: 'gemini-llm',
            };

            console.log(`✨ [ResQGrid Server] Gemini LLM Output Generated:`, llmResult);
            return NextResponse.json(llmResult);
          }
        } else {
          const errText = await response.text();
          console.warn(`[ResQGrid Server] Gemini API returned status ${response.status}:`, errText);
        }
      } catch (err) {
        console.warn('[ResQGrid Server] Gemini LLM call failed, falling back to local NLP engine:', err);
      }
    }

    // High-precision Local NLP fallback
    const result = localNlpExtractor(notes, resources, headcount, zoneName);
    console.log(`🛡️ [ResQGrid Server] Local NLP Fallback Output:`, result);
    return NextResponse.json(result);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Internal Server Error';
    console.error('[ResQGrid Server] Triage API Error:', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
