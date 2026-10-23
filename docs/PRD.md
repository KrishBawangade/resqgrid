# ResQGrid — Product Requirements Document (PRD)

**Project Name:** ResQGrid  
**Formal Title:** ResQGrid — Intelligent Emergency Relief Coordination Platform  
**Tagline:** Connect Needs. Coordinate Relief.  
**Context:** 24-Hour Hackathon Demo  
**Scope Status:** LOCKED (Zero scope expansion permitted)  

---

## 1. System Vision & Problem Statement

During emergency disaster response (e.g. flash floods, earthquakes, severe storms), relief efforts suffer from critical coordination bottlenecks:
- Inability to know who needs assistance first based on genuine human criticality.
- Misallocation of scarce depot supplies (e.g., sending supplies to low-urgency areas while acute medical needs go unmet).
- Double-allocation of the same stock across multiple dispatchers.
- Invisibility of critical supply shortages preventing timely replenishment.

**ResQGrid** connects incoming relief requests with available resources, prioritizes unmet needs through an explainable multi-factor engine, strictly prevents double-allocation while preserving unfulfilled demand, and coordinates supplier replenishment with verified delivery confirmation.

---

## 2. Core System Architecture: Two Synchronized Platforms

The system delivers two distinct, user-tailored platforms running against a **single source of truth** (PostgreSQL via Next.js Route Handlers/Server Actions):

```mermaid
graph LR
    subgraph Platform 1: Citizen / Volunteer Portal
        CP1[Submit Relief Request] --> API[Next.js Server API]
        CP2[Live Request Tracker] <-- API
    end

    subgraph Platform 2: Emergency Command Center
        CC1[Interactive Disaster Map] <--> API
        CC2[Prioritized Queue & Score Inspector] <--> API
        CC3[Stock-Aware Allocation Engine] <--> API
        CC4[Replenishment & Supplier Logistics] <--> API
    end

    API <--> DB[(PostgreSQL Database via Prisma)]
    API <--> Audit[(Append-Only Transaction Log)]
```

### Platform 1: Citizen & Volunteer Relief Portal (`/portal`)
- **Target Users:** Stranded citizens, local volunteer groups, community wardens.
- **Capabilities:**
  1. **Relief Request Submission**:
     - Unique Request ID generation (`REQ-XXXX`).
     - Resource selection: *Drinking Water*, *Food Rations*, *Medical Supplies*, *Shelter Kits*.
     - Quantity requested.
     - Affected zone / location selection with simulated coordinate anchoring.
     - Headcount of people affected.
     - Vulnerability checklist (presence of infants/children, elderly, acute injured/infirm, medical clinics).
     - Need criticality indicators (immediate threat to life vs. severe hardship vs. moderate depletion).
  2. **Public Status Tracker (`/portal/track`)**:
     - Lookup by Request ID.
     - Live visual progress stepper: `Submitted` → `Under Verification` → `Prioritized & Queued` → `Partially / Fully Allocated` → `Dispatched` → `Delivered`.
     - Displays allocated quantities vs. remaining tracked demand with complete transparency.

### Platform 2: Emergency Command Center (`/command`)
- **Target Users:** Authorized disaster response coordinators and dispatch managers.
- **Capabilities:**
  1. **Summary & KPI Ribbon**:
     - Active Requests, Critical Needs, Pending Verification, Total Unmet Resource Deficits, Total Depot Stock.
  2. **Interactive Disaster Zone Map**:
     - CartoDB Dark Matter / Leaflet map rendering simulated incident zones and supply depots.
     - Color-coded pins (Red: Critical, Amber: High, Blue: Moderate/Low; Green: Depot).
     - Pulsating aura on high-criticality unfulfilled requests.
     - Click pin to view details and trigger allocation directly.
  3. **Explainable Prioritized Request Queue**:
     - Ranked strictly by the multi-factor prioritization engine.
     - Multi-criteria filtering: Resource Type, Priority Tier, Verification Status, Zone.
     - Interactive **Score Breakdown Inspector** revealing the exact mathematical formula.
     - Authorized Coordinator Override with mandatory justification audit logging.
  4. **Stock-Aware Allocation Manager**:
     - Checks depot inventory by resource type.
     - Strictly enforces stock availability (cannot allocate stock that doesn't exist).
     - Prevents double allocation by reserving stock atomically.
     - Supports partial fulfillment; keeps unfulfilled demand in queue with priority intact.
  5. **Depot Logistics, Shortage Detection & Replenishment (`/command/inventory`)**:
     - Global and per-depot inventory matrix with low-stock warnings.
     - Deficit calculator showing unmet demand vs. available stock.
     - Create Replenishment Order (`REP-XXXX`) to simulated suppliers.
     - Supplier transit simulation (`Requested` → `Accepted` → `In Transit` → `Delivered`).
     - **Strict Rule:** Stock updates *only* when coordinator clicks "Confirm Delivery & Inspect".
     - Automatic prompt to re-allocate newly arrived stock to waiting requests.
  6. **Interactive Demo Scenario Stepper**:
     - Coordinator bar allowing judges to jump to any of the 6 key demonstration phases.

---

## 3. Algorithmic Specifications

### A. Need-Prioritization Engine
Proposed Hackathon Weights:
- **Need Criticality**: **55%**
- **Vulnerability**: **20%**
- **Number of People Affected**: **15%**
- **Waiting Time**: **10%**

#### Formula Breakdown:
1. **Criticality ($C \in [0, 100]$)**:
   - Resource Base: `Medical Supplies` = 95, `Drinking Water` = 90, `Food Rations` = 75, `Shelter Kits` = 65.
   - Urgency Multiplier: `Immediate (Threat to Life)` = 1.0, `High` = 0.85, `Moderate` = 0.65, `Low` = 0.45.
   - $C = \text{Base} \times \text{Multiplier}$.
2. **Vulnerability ($V \in [0, 100]$)**:
   - $\min(100, \sum(\text{Injured}: +40, \text{Medical Facility}: +35, \text{Children}: +25, \text{Elderly}: +20))$.
3. **People Affected ($P \in [0, 100]$)**:
   - Sensible logarithmic scaling: $P = \min\left(100, \frac{\log_{10}(\text{headcount} + 1)}{\log_{10}(500)} \times 100\right)$.
   - Prevents a large group needing food from drowning out 15 critically injured patients needing blood/medical supplies.
4. **Waiting Time ($W \in [0, 100]$)**:
   - $W = \min(100, \text{Minutes Waiting} \times 0.5)$ (Gradual increase, capped at 100).

$$\mathbf{Total\ Priority\ Score} = 0.55 \times C + 0.20 \times V + 0.15 \times P + 0.10 \times W$$

### B. Stock-Aware Allocation Engine
- Available Stock $S_{avail} = S_{total} - S_{allocated}$.
- If Request demands $Q_{req}$:
  - If $S_{avail} \ge Q_{req}$:
    - $Q_{alloc} = Q_{req}$; Request status → `Fully Allocated`.
    - $S_{avail} = S_{avail} - Q_{req}$.
  - If $0 < S_{avail} < Q_{req}$:
    - $Q_{alloc} = S_{avail}$; Remaining $Q_{unmet} = Q_{req} - S_{avail}$.
    - Request status → `Partially Allocated`.
    - Request remains at top of queue for $Q_{unmet}$.
  - If $S_{avail} = 0$:
    - $Q_{alloc} = 0$; Request status → `Shortage / Pending Stock`.
    - Shortage alert flagged for coordinator replenishment.

---

## 4. End-to-End Demonstration Narrative

The prototype proves a coherent 6-step workflow for the hackathon demo:
1. **Initial Disaster State**: Flood impacts North & East sectors; Depots Alpha & Beta have limited stock; multiple requests queued.
2. **Citizen Submission**: Volunteer files high-urgency medical & water request for Sector 4 Clinic on public portal.
3. **Command Triage**: Coordinator reviews the request, inspects the 55/20/15/10 score breakdown, and verifies it. It ranks #1 in queue.
4. **Allocation & Shortage**: Coordinator triggers allocation. Water depot has partial stock (allocates 80 of 200). Unfulfilled 120 remains tracked; shortage is flagged!
5. **Replenishment Initiated**: Coordinator orders 300 units of water from National Reserve. Order moves to `In Transit`.
6. **Delivery Confirmation & Restock**: Shipment arrives. Coordinator confirms receipt → Inventory increases → Re-allocation auto-fulfills the remaining 120 units!

---

## 5. Scope Guardrails & Non-Goals
- **No live external APIs** (no real Twilio, satellite imagery, or live government systems).
- **No complex multi-agent LLM hallucinations**; scoring is deterministic, explainable, and reliable.
- **Simulated map data** is clearly labeled with simulated tags.
