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

---

## Build Milestones & Phase Progress

| Phase | Description | Status | Verification Checkpoint |
| :--- | :--- | :--- | :--- |
| **Phase 0** | Scope confirmation, PRD, and Project History initialization | **Completed** | `docs/PRD.md` & `docs/PROJECT_HISTORY.md` established |
| **Phase 1** | Project Scaffolding & Multi-App Separation (`citizen-portal` & `coordinator-portal`) | **Completed** | Both standalone apps scaffolded with Tailwind v4; root `.gitignore` configured |
| **Phase 2** | UI Platform 1: Citizen / Volunteer Portal (`citizen-portal`) | **Pending** | Request form with validation & live status tracker |
| **Phase 3** | UI Platform 2: Command Center Dashboard (`coordinator-portal`) | **Completed** | OSM HOT disaster map, flood polygon, 4-tier lifecycle queue, score inspector |
| **Phase 4** | UI Platform 2: Inventory, Shortage Alert & Replenishment Center | **Completed** | Multi-depot stock matrix, shortage calculator, supplier replenishment dispatch |
| **Phase 5** | Core Prioritization (55/20/15/10) & Stock-Aware Allocation Engines | **Completed** | Deterministic mathematical scoring, stock reservation, partial fulfillment |
| **Phase 6** | Neon PostgreSQL + Prisma Integration & Server Route Handlers | **Pending** | Cloud database connection & persistence |
| **Phase 7** | End-to-End Demo Scenario Controller & Verification | **Pending** | Complete 6-stage hackathon narrative walkthrough |


