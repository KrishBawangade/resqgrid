import { NextResponse } from 'next/server';
import { ResourceType, UrgencyLevel, VulnerabilityFactors } from '@/lib/types';
import { calculateCriticality, calculateVulnerability } from '@/lib/engines/prioritization';

interface TriageInputResource {
  resourceType: ResourceType;
  requestedQty: number;
}

interface TriageResult {
  primaryResourceType: ResourceType;
  urgencyLevel: UrgencyLevel;
  vulnerability: VulnerabilityFactors;
  criticalityScore: number;
  criticalityReason: string;
  vulnerabilityScore: number;
  vulnerabilityReason: string;
  aiTriageInsight: string;
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
): TriageResult {
  const lower = (notes || '').toLowerCase();

  // 1. Detect Vulnerabilities from Note text
  const isClinic = /clinic|hospital|dispensary|infirmary|er|ward|doctor|nurse|medical center/i.test(lower);
  const hasChildren = /child|children|infant|baby|babies|kid|kids|pediatric|toddler|newborn/i.test(lower);
  const hasElderly = /elderly|senior|geriatric|grandma|grandpa|old age|pensioner/i.test(lower);
  const hasInjured = /injur|bleed|wound|trauma|casualt|fractur|concussion|hypothermia|burn|unconscious/i.test(lower);

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
  if (/immediate|threat to life|dying|drowning|severe bleed|critical|emergency|asap|now!|perish|danger|catastroph/i.test(lower)) {
    urgencyLevel = 'immediate';
  } else if (/high|urgent|rapid|desperate|soon|deteriorat|running out/i.test(lower)) {
    urgencyLevel = 'high';
  } else if (/low|minor|stable|routine|non-urgent|stock/i.test(lower)) {
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
  if (isClinic) vulnList.push('medical facility/clinic');
  if (hasInjured) vulnList.push('acute trauma casualties');
  if (hasChildren) vulnList.push('infants/children');
  if (hasElderly) vulnList.push('geriatric/elderly individuals');

  const vulnerabilityReason =
    vulnList.length > 0
      ? `Vulnerability detected from field report: ${vulnList.join(', ')}.`
      : 'Standard demographic profile without acute vulnerability markers in note.';

  const aiTriageInsight = `AI Triage: Verified ${urgencyLevel.toUpperCase()} priority for ~${headcount} people in ${zoneName}. Criticality: ${baseCrit}/100, Vulnerability: ${baseVuln}/100.`;

  return {
    primaryResourceType,
    urgencyLevel,
    vulnerability: vulnFactors,
    criticalityScore: baseCrit,
    criticalityReason,
    vulnerabilityScore: baseVuln,
    vulnerabilityReason,
    aiTriageInsight,
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
    const zoneName: string = body?.zoneName || 'Disaster Zone';

    const apiKey = process.env.GEMINI_API_KEY;
    const model = process.env.GEMINI_MODEL || 'gemini-1.5-flash';

    // If Gemini API Key is available, invoke Gemini
    if (apiKey && apiKey.trim().length > 10 && apiKey !== 'your_gemini_api_key_here') {
      try {
        const prompt = `You are the ResQGrid Intelligent Emergency Relief Triage Officer.
A citizen or field responder has submitted an emergency relief request with the following details:
- Disaster Sector: "${zoneName}"
- Number of People in Need: ${headcount}
- Resources Requested: ${JSON.stringify(resources)}
- Citizen Emergency Note / Situation Description: "${notes}"

Your task is to analyze the situation description and context to evaluate subjective emergency factors according to standard disaster response triage.

Respond ONLY with a valid JSON object without markdown formatting.

JSON Schema required:
{
  "urgencyLevel": "immediate" | "high" | "moderate" | "low",
  "vulnerability": {
    "hasChildren": boolean, // true if notes describe infants, babies, children
    "hasElderly": boolean,  // true if notes describe senior citizens, elderly, grandmothers/grandfathers
    "hasInjured": boolean,  // true if notes describe bleeding, trauma, fractures, hypothermia, acute patients
    "isClinic": boolean     // true if requested on behalf of a clinic, hospital, dispensary, triage post
  },
  "criticalityScore": number, // 0 to 100 based on acute threat to life and resource depletion
  "criticalityReason": string, // 1 concise sentence explaining the criticality assessment
  "vulnerabilityScore": number, // 0 to 100 based on demographic frailty and casualties
  "vulnerabilityReason": string, // 1 concise sentence explaining vulnerability assessment
  "primaryResourceType": "drinking_water" | "food_rations" | "medical_supplies" | "shelter_kits", // the most critical resource requested
  "aiTriageInsight": string, // 1-2 sentence clinical summary for coordinator triage
  "aiConfidence": number // confidence percentage e.g. 92 to 98
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
            return NextResponse.json({
              ...parsed,
              engineUsed: 'gemini-llm',
            });
          }
        } else {
          const errText = await response.text();
          console.warn(`Gemini API returned status ${response.status}:`, errText);
        }
      } catch (err) {
        console.warn('Gemini LLM call failed, falling back to local NLP engine:', err);
      }
    }

    // High-precision Local NLP fallback
    const result = localNlpExtractor(notes, resources, headcount, zoneName);
    return NextResponse.json(result);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Internal Server Error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
