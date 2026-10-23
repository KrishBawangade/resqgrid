# ResQGrid — Project History & Build Journal

This living document logs all major architectural decisions (ADRs), milestone progress, and validation results across the ResQGrid build phases.

---

## Architecture Decision Records (ADRs)

### ADR-001: Next.js Full-Stack Architecture vs. Separate Express Backend
- **Date:** 2026-10-23
- **Status:** Accepted
- **Context:** Deciding between a standalone Express.js backend + frontend vs. a unified Next.js App Router fullstack application.
- **Decision:** Use **Next.js App Router (Fullstack)** with native Route Handlers (`app/api/`) and Server Actions.
- **Rationale:**
  1. Next.js runs full Node.js API routes with zero CORS configuration hurdles.
  2. Eliminates running and managing two concurrent development servers (`localhost:3000` + `localhost:5000`).
  3. Shared TypeScript models and schema validation between frontend and backend prevent drift.
  4. Prisma ORM works directly inside Next.js with connection pooling.
  5. Faster delivery, cleaner deployment, and zero latency between UI and backend controllers.

### ADR-002: Neon Serverless PostgreSQL with Prisma ORM
- **Date:** 2026-10-23
- **Status:** Accepted
- **Context:** Selecting database and ORM provider for disaster response data.
- **Decision:** Use **Neon Serverless PostgreSQL** via standard `DATABASE_URL` with Prisma ORM.
- **Rationale:** Instant cloud provisioning, auto-scaling, zero local installation hassle, and native connection pooling for Next.js.

### ADR-003: Explainable Multi-Factor Prioritization Formula (55/20/15/10)
- **Date:** 2026-10-23
- **Status:** Accepted
- **Context:** Establishing how requests are ranked without unexplainable AI black boxes.
- **Decision:** Implement deterministic 4-factor scoring:
  - Need Criticality (55%)
  - Vulnerability (20%)
  - People Affected (15%) [Logarithmically scaled]
  - Waiting Time (10%)
- **Rationale:** Provides 100% auditability for hackathon judges, full explainability in the UI, and prevents remote or low-headcount acute emergencies from being unfairly deprioritized.

### ADR-004: Frontend-First UI & Interactive Store before Cloud DB Hookup
- **Date:** 2026-10-23
- **Status:** Accepted
- **Context:** Choosing build sequence between Backend-first vs Frontend-first.
- **Decision:** Build the complete **Frontend UI & Reactive State Engine** with rich mock data and exact TypeScript models first, followed by Neon PostgreSQL + Prisma persistence.
- **Rationale:**
  1. Gives instant visual feedback and allows fine-tuning UI aesthetics, Leaflet disaster map, and forms without database setup latency.
  2. The UI naturally clarifies the exact data contracts required by the backend.
  3. Guarantees a functional demo at every step of development.
  4. Connecting Neon PostgreSQL later is a clean, seamless drop-in via Next.js Route Handlers.


### ADR-005: Dual Independent Application Folders (citizen-portal & coordinator-portal)
- **Date:** 2026-10-23
- **Status:** Accepted
- **Context:** Organizing the two platforms (Citizen/Volunteer Portal and Emergency Command Center).
- **Decision:** Scaffold two distinct standalone Next.js applications in dedicated directories:
  - `citizen-portal/`: Public-facing request intake and live status tracker.
  - `coordinator-portal/`: Authorized tactical command center (triage queue, map, inventory, replenishment).
- **Rationale:**
  1. Complete architectural and dependency isolation between public citizen intake and coordinator operations.
  2. Prevents route collisions and layout bleed.
  3. Clean root repository managing both applications and unified documentation.

### ADR-006: Humanitarian OpenStreetMap (HOT) Disaster Cartography
- **Date:** 2026-10-23
- **Status:** Accepted
- **Context:** CartoDB unauthenticated tile requests overlay an "API KEY REQUIRED" watermark, and Mapbox requires paid API keys.
- **Decision:** Utilize **Humanitarian OpenStreetMap (HOT)** tiles (`https://{s}.tile.openstreetmap.fr/hot/{z}/{x}/{y}.png`) paired with Leaflet vectors and styled custom HTML markers.
- **Rationale:**
  1. 100% open and free with zero API key dependencies and zero watermarks.
  2. Cartography styled specifically for disaster response and humanitarian crisis logistics.
  3. Supports rich interactive GIS vector overlays (Sector 4 Flash Flood Inundation Polygon and Evacuation Alert Perimeter).
  4. Fully responsive with client-side dynamic imports and `fitBounds` auto-framing.

### ADR-007: Four-Tier Lifecycle Queue Architecture (Needs Attention, Partially Allocated, Fully Allocated, Rejected)
- **Date:** 2026-10-23
- **Status:** Accepted
- **Context:** Coordinators need an uncluttered operational interface where completed or denied requests don't obscure acute relief emergencies.
- **Decision:** Segment the priority dispatch queue into four dedicated lifecycle tabs:
  1. **Needs Attention**: Unallocated raw/verified demands requiring immediate triage & depot assignment.
  2. **Partially Allocated**: Demands partially fulfilled, with unmet deficits strictly preserved in the queue.
  3. **Fully Allocated**: 100% fulfilled relief demands archived for audit.
  4. **Rejected**: Denied, duplicate, or out-of-zone requests with recorded justification and one-click restoration.
- **Rationale:**
  1. Drastically reduces cognitive load during high-stress incident response.
  2. Guarantees that partial stock fulfillment never loses the remaining unmet deficit.
  3. Maintains a permanent audit ledger of all denials for emergency accountability.

### ADR-008: Dual-Layer AI Natural Language Triage & Anti-Gaming Intake Architecture
- **Date:** 2026-10-24
- **Status:** Accepted
- **Context:** Self-reported checkboxes (e.g. "Select Urgency: Immediate Threat to Life" and demographic checklists) suffer from severe game-theory failure during crises: panicked applicants check every box to get aid first, flooding the queue with false critical tags. Additionally, real citizens in disasters describe situations in unstructured human language rather than bureaucratic codes.
- **Decision:**
  1. Strip all gameable inputs (urgency dropdowns, vulnerability checklists) and raw numeric point meters from the public citizen interface.
  2. Implement multi-resource selection (Drinking Water, Food Rations, Medical Supplies, Shelter Kits) with individual quantity inputs.
  3. Deploy a server-side **Dual-Engine Triage API** (`/api/triage`) pairing Google Gemini 2.5 Flash with an instant local NLP entity extractor fallback.
  4. The LLM reads the freeform situation description to assess true hazard urgency, detect demographic vulnerabilities (infants, elderly, casualties, medical facility), and assign subjective `criticalityScore (0-100)` and `vulnerabilityScore (0-100)` with clinical justification notes.
  5. The deterministic 55/20/15/10 engine combines these AI scores with logarithmic headcount (15%) and anti-starvation waiting time (10%) for a 100% auditable ranking.
  6. Provide an interactive "🛠️ Demo Mode: Show Algorithmic Inspector" toggle specifically for hackathon judges to inspect the mathematical breakdown on demand.
- **Rationale:**
  1. Guarantees triage integrity and eliminates perverse incentives.
  2. Puts Generative AI in its highest-value role (interpreting unstructured human distress) while preserving deterministic mathematical fairness.
  3. Guarantees zero downtime during live demos via the local NLP fallback.

### ADR-009: Interactive Citizen Cartography with Flood-Zone GPS Simulation
- **Date:** 2026-10-24
- **Status:** Accepted
- **Context:** Rather than forcing citizens in distress to choose from an administrative list of operational sectors or manually enter coordinates, the public intake form needed an intuitive, visual location selection method matching the coordinator tactical map. In addition, the platform required a realistic GPS simulation for demo testing that places users directly inside the active flood hazard zone.
- **Decision:**
  1. Replace static sector dropdowns with an interactive Leaflet cartography component (`LocationMapPicker.tsx`) directly embedded in the intake form.
  2. Render the identical **Sector 4 Flash Flood Inundation Polygon** (red dashed boundary with sky-blue fill) and **Advisory Evacuation Buffer** (amber boundary) matching the coordinator tactical map.
  3. Support click-to-pin and drag-to-place anywhere on the map, with automatic real-time proximity calculation to the nearest operational sector and accessibility hazard detection (`flooded_boat_only`, `debris_delay`, `accessible`).
  4. Provide a dedicated **"📍 Fetch Current Location"** button simulating device GPS fix: randomly samples realistic flood-impact hotspots within the Sector 4 flood corridor (e.g., 4th St Bridge Underpass, East Riverbed Lowland, Cesar Chavez Wash, Olympic Blvd Basin) with microscopic coordinate jitter.
  5. Implement `ResizeObserver` and automated staggered `map.invalidateSize()` triggers to eliminate Leaflet tile clipping across dynamic Next.js responsive layouts.
  6. Remove redundant preset sector buttons to maintain a clean, frictionless citizen user experience.
- **Rationale:**
  1. High usability: citizens or field volunteers tap directly on the map or click one button to acquire an immediate GPS fix.
  2. 100% spatial parity between citizen intake coordinates and coordinator tactical GIS layers.
  3. Bulletproof presentation narrative for hackathon judges demonstrating instant disaster zone geolocation.

---

## Build Milestones & Phase Progress

| Phase | Description | Status | Verification Checkpoint |
| :--- | :--- | :--- | :--- |
| **Phase 0** | Scope confirmation, PRD, and Project History initialization | **Completed** | `docs/PRD.md` & `docs/PROJECT_HISTORY.md` established |
| **Phase 1** | Project Scaffolding & Multi-App Separation (`citizen-portal` & `coordinator-portal`) | **Completed** | Both standalone apps scaffolded with Tailwind v4; root `.gitignore` configured |
| **Phase 2** | UI Platform 1: Citizen / Volunteer Portal (`citizen-portal`) | **Completed** | Multi-resource intake, AI triage engine, interactive Leaflet map picker with flood-zone GPS fetch, anti-gaming design, and live 6-stage status tracker |
| **Phase 3** | UI Platform 2: Command Center Dashboard (`coordinator-portal`) | **Completed** | OSM HOT disaster map, flood polygon, 4-tier lifecycle queue, score inspector |
| **Phase 4** | UI Platform 2: Inventory, Shortage Alert & Replenishment Center | **Completed** | Multi-depot stock matrix, shortage calculator, supplier replenishment dispatch |
| **Phase 5** | Core Prioritization (55/20/15/10) & Stock-Aware Allocation Engines | **Completed** | Deterministic mathematical scoring, stock reservation, partial fulfillment |
| **Phase 6** | Neon PostgreSQL + Prisma Integration & Server Route Handlers | **Pending** | Cloud database connection & persistence |
| **Phase 7** | End-to-End Demo Scenario Controller & Verification | **Pending** | Complete 6-stage hackathon narrative walkthrough |



