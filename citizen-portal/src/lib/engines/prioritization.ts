// Need-Prioritization Engine (Deterministic 55/20/15/10 Formula)
// 1. Need Criticality: 55%
// 2. Vulnerability: 20%
// 3. Number of People Affected: 15% (Logarithmically scaled)
// 4. Waiting Time: 10%

import { ResourceType, UrgencyLevel, VulnerabilityFactors, ScoreBreakdown, ReliefRequest } from '../types';

export const RESOURCE_BASE_CRITICALITY: Record<ResourceType, number> = {
  medical_supplies: 95,
  drinking_water: 90,
  food_rations: 75,
  shelter_kits: 65,
};

export const URGENCY_MULTIPLIERS: Record<UrgencyLevel, number> = {
  immediate: 1.0,
  high: 0.85,
  moderate: 0.65,
  low: 0.45,
};

export function calculateCriticality(resource: ResourceType, urgency: UrgencyLevel): number {
  const base = RESOURCE_BASE_CRITICALITY[resource] || 70;
  const multiplier = URGENCY_MULTIPLIERS[urgency] || 0.65;
  return Math.min(100, Math.round(base * multiplier * 10) / 10);
}

export function calculateVulnerability(vuln: VulnerabilityFactors): number {
  let score = 0;
  if (vuln.hasInjured) score += 40;
  if (vuln.isClinic) score += 35;
  if (vuln.hasChildren) score += 25;
  if (vuln.hasElderly) score += 20;
  return Math.min(100, score);
}

export function calculatePeopleScore(headcount: number): number {
  if (headcount <= 0) return 0;
  const maxScale = Math.log10(500);
  const current = Math.log10(headcount + 1);
  const normalized = (current / maxScale) * 100;
  return Math.min(100, Math.round(normalized * 10) / 10);
}

export function calculateWaitingScore(minutesWaiting: number): number {
  const score = minutesWaiting * 0.5; // +5 pts per 10 mins
  return Math.min(100, Math.round(score * 10) / 10);
}

export function computePriorityScore(
  resource: ResourceType,
  urgency: UrgencyLevel,
  vuln: VulnerabilityFactors,
  headcount: number,
  minutesWaiting: number = 0,
  aiOverrides?: {
    criticalityScore?: number;
    vulnerabilityScore?: number;
  }
): ScoreBreakdown {
  const crit =
    aiOverrides?.criticalityScore !== undefined
      ? Math.min(100, Math.max(0, Math.round(aiOverrides.criticalityScore * 10) / 10))
      : calculateCriticality(resource, urgency);

  const vScore =
    aiOverrides?.vulnerabilityScore !== undefined
      ? Math.min(100, Math.max(0, Math.round(aiOverrides.vulnerabilityScore * 10) / 10))
      : calculateVulnerability(vuln);

  const pScore = calculatePeopleScore(headcount);
  const wScore = calculateWaitingScore(minutesWaiting);

  const total = 0.55 * crit + 0.20 * vScore + 0.15 * pScore + 0.10 * wScore;

  return {
    criticalityScore: crit,
    criticalityWeight: 0.55,
    vulnerabilityScore: vScore,
    vulnerabilityWeight: 0.20,
    peopleScore: pScore,
    peopleWeight: 0.15,
    waitingScore: wScore,
    waitingWeight: 0.10,
    totalScore: Math.round(total * 10) / 10,
  };
}

export function getPriorityTier(score: number): { tier: string; label: string; color: string } {
  if (score >= 75) {
    return { tier: 'Tier 1', label: 'Acute Emergency', color: 'rose' };
  } else if (score >= 55) {
    return { tier: 'Tier 2', label: 'Urgent Hardship', color: 'amber' };
  } else {
    return { tier: 'Tier 3', label: 'Standard Relief', color: 'blue' };
  }
}

// Rich Console Logger for auditing triage extraction & score breakdown
export function logTriageAndScore(request: ReliefRequest): void {
  const sb = request.scoreBreakdown;
  const tier = getPriorityTier(request.priorityScore);
  const critPts = Math.round(sb.criticalityScore * sb.criticalityWeight * 10) / 10;
  const vulnPts = Math.round(sb.vulnerabilityScore * sb.vulnerabilityWeight * 10) / 10;
  const peoplePts = Math.round(sb.peopleScore * sb.peopleWeight * 10) / 10;
  const waitPts = Math.round(sb.waitingScore * sb.waitingWeight * 10) / 10;

  console.log(`%c================================================================================`, 'color: #2563eb; font-weight: bold;');
  console.log(`%c📋 RESQGRID TRIAGE & PRIORITIZATION ENGINE — AUDIT RECORD: ${request.id}`, 'color: #1d4ed8; font-weight: bold; font-size: 13px;');
  console.log(`%c================================================================================`, 'color: #2563eb; font-weight: bold;');
  console.log(`👤 Requester: ${request.requesterName} | 📞 Contact: ${request.contactNumber}`);
  console.log(`📍 Hazard Sector: ${request.location.zoneName} (${request.location.accessibility})`);
  console.log(`👥 Headcount Affected: ${request.peopleAffected} individuals`);
  console.log(`📦 Primary Resource: ${request.resourceType.toUpperCase()} | Demanded Qty: ${request.requestedQty}`);
  if (request.requestedResources && request.requestedResources.length > 1) {
    console.log(`📦 All Requested Resources:`, request.requestedResources.map((r) => `${r.requestedQty} ${r.resourceType}`).join(', '));
  }
  console.log(`📝 Citizen Situation Note: "${request.notes || 'N/A'}"`);
  console.log(`--------------------------------------------------------------------------------`);
  console.log(`🧠 LLM / NLP TRIAGE EXTRACTION:`);
  console.log(`   • Urgency Level:      ${request.urgencyLevel.toUpperCase()}`);
  console.log(`   • Criticality Factor: ${sb.criticalityScore} / 100 ${request.aiTriageDetails?.criticalityReason ? `("${request.aiTriageDetails.criticalityReason}")` : ''}`);
  console.log(`   • Vulnerability Flags:`, request.vulnerability);
  console.log(`   • Vulnerability Score:${sb.vulnerabilityScore} / 100 ${request.aiTriageDetails?.vulnerabilityReason ? `("${request.aiTriageDetails.vulnerabilityReason}")` : ''}`);
  if (request.aiTriageInsight) {
    console.log(`   • AI Clinical Summary:"${request.aiTriageInsight}"`);
  }
  if (request.aiTriageDetails?.engineUsed) {
    console.log(`   • Engine Utilized:    ${request.aiTriageDetails.engineUsed === 'gemini-llm' ? 'Google Gemini 2.5 Flash' : 'Smart Local NLP Engine'}`);
  }
  console.log(`--------------------------------------------------------------------------------`);
  console.log(`📐 55/20/15/10 DETERMINISTIC MATHEMATICAL FORMULA BREAKDOWN:`);
  console.log(`   Factor 1 (55%): Need Criticality    = 0.55 × ${sb.criticalityScore.toFixed(1)} = ${critPts.toFixed(1)} pts`);
  console.log(`   Factor 2 (20%): Vulnerability       = 0.20 × ${sb.vulnerabilityScore.toFixed(1)} = ${vulnPts.toFixed(1)} pts`);
  console.log(`   Factor 3 (15%): People Scale (${request.peopleAffected}) = 0.15 × ${sb.peopleScore.toFixed(1)} = ${peoplePts.toFixed(1)} pts`);
  console.log(`   Factor 4 (10%): Waiting Time (${request.waitingMinutes}m) = 0.10 × ${sb.waitingScore.toFixed(1)} = ${waitPts.toFixed(1)} pts`);
  console.log(`   ─────────────────────────────────────────────────────────────────────────────`);
  console.log(`   🎯 AUDITED TOTAL PRIORITY SCORE: ${request.priorityScore.toFixed(1)} / 100  [ ${tier.tier.toUpperCase()} — ${tier.label.toUpperCase()} ]`);
  console.log(`%c================================================================================\n`, 'color: #2563eb; font-weight: bold;');
}
