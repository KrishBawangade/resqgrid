// ResQGrid Coordinator Console - TypeScript Definitions

export type ResourceType = 'drinking_water' | 'food_rations' | 'medical_supplies' | 'shelter_kits';

export type UrgencyLevel = 'immediate' | 'high' | 'moderate' | 'low';

export type AccessibilityStatus = 'accessible' | 'debris_delay' | 'flooded_boat_only';

export type VerificationStatus = 'pending' | 'verified' | 'flagged' | 'rejected';

export type RequestStatus = 
  | 'submitted' 
  | 'queued'
  | 'verified' 
  | 'partially_allocated' 
  | 'fully_allocated' 
  | 'dispatched' 
  | 'delivered'
  | 'rejected';

export type ReplenishmentStatus = 'requested' | 'accepted' | 'in_transit' | 'delivered';

export interface LocationData {
  zoneName: string;
  lat: number;
  lng: number;
  isSimulated: true;
  accessibility: AccessibilityStatus;
}

export interface VulnerabilityFactors {
  hasChildren: boolean;
  hasElderly: boolean;
  hasInjured: boolean;
  isClinic: boolean;
}

export interface ScoreBreakdown {
  criticalityScore: number;     // 0 - 100
  criticalityWeight: number;    // 0.55
  vulnerabilityScore: number;   // 0 - 100
  vulnerabilityWeight: number;  // 0.20
  peopleScore: number;          // 0 - 100
  peopleWeight: number;         // 0.15
  waitingScore: number;         // 0 - 100
  waitingWeight: number;        // 0.10
  totalScore: number;           // 0 - 100
}

export interface PriorityOverride {
  id: string;
  requestId: string;
  originalScore: number;
  overriddenScore: number;
  reason: string;
  coordinator: string;
  timestamp: string;
}

export interface ReliefRequest {
  id: string; // e.g. "REQ-1042"
  timestamp: string; // ISO String
  requesterName: string;
  contactNumber: string;
  resourceType: ResourceType;
  requestedQty: number;
  allocatedQty: number;
  unfulfilledQty: number;
  requestedResources?: Array<{
    resourceType: ResourceType;
    requestedQty: number;
    allocatedQty: number;
    unfulfilledQty: number;
  }>;
  location: LocationData;
  peopleAffected: number;
  vulnerability: VulnerabilityFactors;
  urgencyLevel: UrgencyLevel;
  scoreBreakdown: ScoreBreakdown;
  priorityScore: number;
  verificationStatus: VerificationStatus;
  requestStatus: RequestStatus;
  allocatedDepotId: string | null;
  priorityOverride?: PriorityOverride;
  notes?: string;
  waitingMinutes: number;
  rejectionReason?: string;
  rejectedAt?: string;
  aiTriageInsight?: string;
  aiConfidence?: number;
  aiTriageDetails?: {
    criticalityScore?: number;
    criticalityReason?: string;
    vulnerabilityScore?: number;
    vulnerabilityReason?: string;
    recommendedDispatch?: string;
    engineUsed?: 'gemini-llm' | 'local-nlp';
  };
}

export interface InventoryItem {
  resourceType: ResourceType;
  totalCapacity: number;
  availableStock: number;
  allocatedStock: number; // Reserved for pending deliveries
  unit: string;
}

export interface ReliefDepot {
  id: string; // e.g. "DEPOT-ALPHA"
  name: string;
  zoneName: string;
  lat: number;
  lng: number;
  status: 'operational' | 'constrained' | 'isolated';
  inventory: Record<ResourceType, InventoryItem>;
}

export interface ReplenishmentOrder {
  id: string; // e.g. "REP-501"
  resourceType: ResourceType;
  quantity: number;
  depotId: string;
  depotName: string;
  supplierName: string;
  priority: 'emergency' | 'high' | 'standard';
  status: ReplenishmentStatus;
  requestedAt: string;
  acceptedAt?: string;
  dispatchedAt?: string;
  deliveredAt?: string;
}

export interface AuditLogEntry {
  id: string;
  timestamp: string;
  category: 'OVERRIDE' | 'ALLOCATION' | 'REPLENISHMENT' | 'VERIFICATION';
  action: string;
  actor: string;
  details: string;
  delta?: string;
}
