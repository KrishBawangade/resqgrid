// Need-Prioritization Engine
// Formula Weights (Strictly from PRD):
// 1. Need Criticality: 55%
// 2. Vulnerability: 20%
// 3. Number of People Affected: 15% (Logarithmically scaled)
// 4. Waiting Time: 10%

import { ResourceType, UrgencyLevel, VulnerabilityFactors, ScoreBreakdown } from '../types';

const RESOURCE_BASE_CRITICALITY: Record<ResourceType, number> = {
  medical_supplies: 95,
  drinking_water: 90,
  food_rations: 75,
  shelter_kits: 65,
};

const URGENCY_MULTIPLIERS: Record<UrgencyLevel, number> = {
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
  minutesWaiting: number
): ScoreBreakdown {
  const crit = calculateCriticality(resource, urgency);
  const vScore = calculateVulnerability(vuln);
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
