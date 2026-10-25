# ResQGrid — Intelligent Emergency Relief Coordination & Autonomous Disaster Logistics Platform

<div align="center">

![ResQGrid Banner](https://img.shields.io/badge/ResQGrid-Emergency%20Relief%20Grid-0ea5e9?style=for-the-badge&logo=shield&logoColor=white)
<br/>
**Connect Needs. Coordinate Relief. Save Lives.**

[![Next.js 16](https://img.shields.io/badge/Next.js-16.4.2-black?style=flat-square&logo=next.js)](https://nextjs.org/)
[![React 19](https://img.shields.io/badge/React-19.3.0-blue?style=flat-square&logo=react)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-blue?style=flat-square&logo=typescript)](https://www.typescriptlang.org/)
[![Tailwind CSS v4](https://img.shields.io/badge/Tailwind_CSS-v4-38bdf8?style=flat-square&logo=tailwind-css)](https://tailwindcss.com/)
[![Neon Database](https://img.shields.io/badge/Neon-Serverless%20PostgreSQL-00e599?style=flat-square&logo=postgresql)](https://neon.tech/)
[![Prisma ORM](https://img.shields.io/badge/Prisma-7.10-2d3748?style=flat-square&logo=prisma)](https://www.prisma.io/)
[![Google Gemini](https://img.shields.io/badge/AI_Triage-Gemini%202.5%20Flash-4285f4?style=flat-square&logo=google)](https://ai.google.dev/)
[![ESP32 IoT](https://img.shields.io/badge/Hardware-ESP32%20DisasterSense-e02424?style=flat-square&logo=espressif)](https://www.espressif.com/)
[![Leaflet GIS](https://img.shields.io/badge/GIS-Leaflet%20%2B%20HOT%20OSM-199900?style=flat-square&logo=leaflet)](https://www.hotosm.org/)

</div>

---

## 📌 Executive Summary & Problem Statement

During major disaster events (flash floods, cyclones, earthquakes, and humanitarian crises), emergency relief operations face severe coordination bottlenecks:

1. **Triage Distortion & Game-Theory Failure:** Panicked citizens check every "immediate life threat" box on public forms, flooding queue tables with false critical priorities.
2. **Scarce Depot Misallocation:** High-value medical kits or drinking water are dispatched to low-urgency areas while acute clinic trauma cases go unassisted.
3. **Double-Allocation Risk:** Multiple dispatchers concurrently assign the same physical warehouse pallet, causing stock failures in the field.
4. **Supply Chain Blindness:** Stock depletion happens unannounced; relief coordinators cannot track live demand deficits or requisition supplier replenishments in advance.
5. **Logistics Impasse:** Relief trucks and ambulances unknowingly drive into flooded underpasses and impassable corridors, stranding critical supplies.

**ResQGrid** is a mission-critical, full-stack disaster response and resource dispatch grid. It unites **public citizen intake**, an **AI-powered clinical triage engine**, an **explainable 55/20/15/10 mathematical prioritization matrix**, an **atomic stock-aware allocation engine**, **real-time Server-Sent Events (SSE) synchronization**, and **live ESP32 IoT edge hydrological telemetry with closed-loop dynamic safe route dispatching**.

---

## 🏛️ System Architecture & Platform Topology

ResQGrid is structured as a synchronized monorepo operating against a single cloud source of truth (**Neon Serverless PostgreSQL** via **Prisma ORM**):

```mermaid
graph TB
    subgraph Platform_1 ["Platform 1: Citizen & Volunteer Relief Portal (Port 3001)"]
        CP_Intake["Relief Intake Form<br/>• Natural Language Distress Description<br/>• Multi-Resource Need Selector<br/>• GIS Map Picker + Flood-Zone GPS Fix"]
        CP_Triage["Dual-Engine Triage API (/api/triage)<br/>• Google Gemini 2.5 Flash<br/>• Smart Local NLP Entity Fallback"]
        CP_Track["Public Request Tracker (/track)<br/>• 6-Stage Milestone Stepper<br/>• Split-Batch Deficit Guarantee<br/>• Live SSE + DB Revalidation"]
        CP_Intake --> CP_Triage
    end

    subgraph Platform_2 ["Platform 2: Emergency Command Center (Port 3000)"]
        CC_Map["Interactive Tactical Disaster Map<br/>• Humanitarian OSM (HOT) Cartography<br/>• Mithi River Flood Inundation Corridor<br/>• Real-Time Fleet Route Polylines"]
        CC_Queue["Explainable 4-Tier Lifecycle Queue<br/>• Needs Attention | To Verify<br/>• Partially Allocated | Fully Allocated<br/>• 55/20/15/10 Score Inspector Drawer"]
        CC_Alloc["Stock-Aware Allocation Engine<br/>• Atomic Stock Reservation<br/>• Split-Batch Fulfillment<br/>• Priority Rank #1 Retention"]
        CC_Inv["Depot Logistics & Replenishment (/inventory)<br/>• Safety Buffers (Water, Food, Meds, Tents)<br/>• Slide-Over Supplier Requisition<br/>• Verified Delivery Restock Workflow"]
        CC_Sensors["DisasterSense Diagnostic Hub (/sensors)<br/>• Live Hydrological Matrix<br/>• Road Submergence Early Warning<br/>• Pinout & Waveform Telemetry"]
        CC_Audit["Immutable Audit Ledger (/audit)<br/>• Append-Only Action Ledger"]
    end

    subgraph IoT_Edge ["DisasterSense IoT Edge Hardware"]
        ESP32["ESP32 Microcontroller Node<br/>• HC-SR04 Ultrasonic Water Clearance<br/>• Capacitive Soil Saturation Probe<br/>• DHT11 Meteorological Sensor"]
        Actuators["Dual-Color Actuator LEDs<br/>• 🟢 Green: Open Corridor<br/>• 🔴 Red: Road Submerged"]
        ESP32 -->|"HTTP POST /api/flood/telemetry (every 3s)"| Ingest["Ingestion Route Handlers"]
        Ingest -->|"Closed-Loop JSON Response<br/>{led_color, active_route, is_critical}"| Actuators
    end

    subgraph Data_Layer ["Data & Communication Layer"]
        NeonDB[("Neon Serverless PostgreSQL<br/>• ReliefRequest | ReliefDepot<br/>• DepotStock | ReplenishmentOrder<br/>• AuditLog")]
        SSE["Server-Sent Events Stream (/api/requests/stream)<br/>• Real-Time Node.js EventEmitter<br/>• Sub-10ms Cross-Portal Push"]
    end

    CP_Intake -->|"POST /api/requests"| NeonDB
    CP_Intake -->|"Push Event"| SSE
    SSE -->|"Broadcast Live Updates"| CC_Map
    SSE -->|"Broadcast Live Updates"| CC_Queue
    SSE -->|"Broadcast Status Transitions"| CP_Track
    CC_Alloc <-->|"Atomic Stock Mutex"| NeonDB
    CC_Inv <-->|"Supplier Requisitions"| NeonDB
    Ingest -->|"Dynamic Safe Route Reroute"| CC_Map
```

---

## 🌟 Core Features & Modules

### 1. Citizen & Volunteer Portal (`citizen-portal` / Port 3001)
- **Natural Language Distress Intake:** Replaces self-reported urgency checkboxes with an open-ended narrative input. Panicked citizens describe their crisis in plain human language without being able to artificially inflate priority tags.
- **Dual-Engine Serverless AI Triage:**
  - Evaluates situation descriptions via **Google Gemini 2.5 Flash** to extract clinical urgency, demographic vulnerabilities, and critical factors.
  - Features an instant, deterministic **Local Rule-Based NLP Entity Extractor fallback**, ensuring 100% uptime even during network failures or API quota limits.
- **Interactive Location Picker with Flood GPS Simulation:**
  - Embedded Leaflet map rendering the **Sector 4 Mithi River Flash Flood Inundation Polygon** (dashed red boundary with sky-blue fill) and evacuation buffer.
  - One-click **"📍 Fetch Current Location"** button simulating GPS fixes within the active flood hazard zone (e.g., 4th St Bridge Underpass, Kurla Basin, Cesar Chavez Wash).
  - Real-time road accessibility analysis (`flooded_boat_only`, `debris_delay`, `accessible`).
- **Multi-Resource Itemized Intake:** Simultaneously request **Drinking Water**, **Food Rations**, **Medical Supplies**, and **Shelter Kits** with custom quantities.
- **Public 6-Stage Request Tracker (`/track`):**
  - Enter any `REQ-XXXX` ID to inspect real-time dispatch progress.
  - 6-stage lifecycle stepper: `Submitted` → `Under Verification` → `Prioritized & Queued` → `Stock Allocated` → `Dispatched` → `Delivered & Confirmed`.
  - **ADR-007 Partial Fulfillment Guarantee:** Clear amber indicator when orders are split due to warehouse stock limits, verifying that unfulfilled quantities remain locked at Priority Rank #1.

---

### 2. Emergency Coordinator Command Center (`coordinator-portal` / Port 3000)
- **Operations Summary Ribbon:** Real-time KPI counters tracking Active Demands, Critical Life Threats, Pending Verifications, Unmet Resource Deficits, and Total Depot Inventory.
- **Tactical GIS Disaster Map:**
  - High-contrast **Humanitarian OpenStreetMap (HOT)** cartography specifically styled for emergency management.
  - GIS vector overlays of the Mithi River flood inundation corridor and evacuation buffer.
  - Interactive depot staging icons, color-coded priority pins, and dynamic route polylines.
  - Viewport auto-framing calculating regional bounding boxes so all active operational sectors are visible on load.
- **4-Tier Lifecycle Dispatch Queue:**
  - **Needs Attention:** All unallocated active demands requiring immediate coordinator action.
  - **To Verify:** Dedicated backlog for unauthenticated citizen submissions with one-click verification or rejection.
  - **Partially Allocated:** Preserves split-batch orders with remaining unmet deficits.
  - **Fully Allocated:** 100% fulfilled demands archived for transparent post-disaster audit.
  - **Rejected:** Audit-logged denials with justification notes and one-click restoration.
- **Score Breakdown Inspector Drawer:**
  - Click any demand card to inspect the exact mathematical weights, AI clinical triage justifications, and component scores.
  - **Authorized Coordinator Override:** Allows command staff to adjust priority tiers with mandatory audit logging.
- **Depot Inventory & Shortage Replenishment Center (`/inventory`):**
  - Regional stock matrix aggregating Drinking Water, Food Rations, Medical Supplies, and Shelter Kits across staging depots (Alpha, Beta, Gamma).
  - Safety buffer warnings (e.g., minimum 150 L water, 100 packs food, 25 medical kits, 15 tents).
  - **Slide-Over Replenishment Drawer:** Rapid supply requisitioning to simulated suppliers with quick-add quantity chips (`+100`, `+250`, `+500`, `+1000`).
  - **Strict Verified Delivery Restock:** Inventory physically increments *only* when coordinators confirm receipt upon shipment delivery.
  - **Actionable Deficit Banners & Navbar Pill:** Automatically alerts coordinators when citizen demand exceeds physical inventory, clearing immediately upon requisition dispatch.
- **Immutable Append-Only Audit Ledger (`/audit`):**
  - Chronological transaction log recording every triage, allocation, score override, replenishment order, and delivery confirmation with actor identification.

---

### 3. DisasterSense IoT Edge Telemetry & Dynamic Safe Route Rerouting
- **ESP32 Edge Microcontroller (`hardware/esp32_disastersense`):**
  - Continuous telemetry ingestion via `POST /api/flood/telemetry` every 3,000ms.
  - **HC-SR04 Ultrasonic Sensor:** Measures overhead road clearance to detect water accumulation in low-lying transit corridors.
  - **Capacitive Soil Moisture Probe:** Measures ground saturation to predict imminent flash flooding before surface ponding starts.
  - **DHT11 Sensor:** Ambient temperature and relative humidity tracking.
- **Closed-Loop Actuator Feedback:**
  - Next.js ingestion API returns a real-time actionable payload to the ESP32 in `<10ms`:
    ```json
    {
      "status": "ok",
      "level": "CRITICAL",
      "is_critical": true,
      "led_color": "RED",
      "active_route": "ELEVATED_BKC_BYPASS",
      "timestamp": "2026-10-25T18:00:00.000Z"
    }
    ```
  - The microcontroller reads the response and toggles physical LEDs: **Green LED** for normal open transit, **Red LED** for road closure.
- **Dynamic Safe Route Rerouting:**
  - When water levels exceed the critical wading limit of Tata 407 ambulances and relief trucks (clearance $\le$ 15 cm in the demo rig):
    - System flags `⛔ LBS UNDERPASS SUBMERGED`.
    - Automatically closes the primary LBS Marg low-lying corridor.
    - Reroutes logistics convoys via the **`✅ BKC ELEVATED BYPASS (+14m ASL)`**.
    - Renders glowing green bypass polylines on the tactical map and triggers filtered coordinator toast notifications.
- **Diagnostic Hub (`/sensors`):** Real-time SVG waveforms, live telemetry gauges, hydrological threshold matrix, and pinout wiring schematics.

---

## 🧮 Algorithmic Specifications

### A. Explainable Multi-Factor Prioritization Engine (55/20/15/10)
Rather than relying on uninterpretable AI black boxes, ResQGrid ranks relief demands using a deterministic, auditable multi-factor formula:

$$\mathbf{Total\ Priority\ Score} = 0.55 \times C + 0.20 \times V + 0.15 \times P + 0.10 \times W$$

Where:
1. **Need Criticality ($C \in [0, 100]$):**
   - Resource Base: `Medical Supplies` = 95, `Drinking Water` = 90, `Food Rations` = 75, `Shelter Kits` = 65.
   - Urgency Multiplier: `Immediate (Threat to Life)` = 1.00, `High` = 0.85, `Moderate` = 0.65, `Low` = 0.45.
   - Evaluated by the AI Triage Engine based on situational hazards.
2. **Vulnerability ($V \in [0, 100]$):**
   - Evaluates demographic vulnerability indicators extracted from distress text:
   - $V = \min(100, \sum(\text{Injured}: +40, \text{Clinic/Hospital}: +35, \text{Children/Infants}: +25, \text{Elderly}: +20))$.
3. **People Affected ($P \in [0, 100]$):**
   - Logarithmic headcount compression to prevent massive crowds with low urgency from drowning out acute medical trauma:
   - $P = \min\left(100, \frac{\log_{10}(\text{headcount} + 1)}{\log_{10}(500)} \times 100\right)$.
4. **Anti-Starvation Waiting Time ($W \in [0, 100]$):**
   - $W = \min(100, \text{Minutes Waiting} \times 0.5)$.
   - Gradually elevates neglected lower-urgency requests over time to prevent resource starvation.

---

### B. Stock-Aware Allocation & Deficit Logic
Let $S_{avail} = S_{total} - S_{allocated}$ represent available inventory for a requested resource. For demand $Q_{req}$:

- **Full Allocation ($S_{avail} \ge Q_{req}$):**
  - $Q_{alloc} = Q_{req}$; Request status $\rightarrow$ `Fully Allocated`.
  - $S_{avail} = S_{avail} - Q_{req}$.
- **Partial Allocation ($0 < S_{avail} < Q_{req}$):**
  - $Q_{alloc} = S_{avail}$; Remaining unmet deficit $Q_{unmet} = Q_{req} - S_{avail}$.
  - Request status $\rightarrow$ `Partially Allocated`.
  - **ADR-007 Retention:** Request remains locked at Priority Rank #1 for $Q_{unmet}$.
- **Stock Depletion ($S_{avail} = 0$):**
  - $Q_{alloc} = 0$; Request status $\rightarrow$ `Shortage / Pending Stock`.
  - Actionable replenishment alert flagged across the coordinator console.

---

### C. DisasterSense Hydrological Calibration Matrix
The system correlates overhead ultrasonic sensor clearance with real-world Mumbai urban flood conditions:

| Clearance (Demo Rig) | Simulated Water Depth | Alert Level | Transport Status | System Action | ESP32 LED |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **> 35 cm** | < 15 cm | `NORMAL` | All vehicles passable | Primary LBS corridor active | 🟢 Green |
| **25 cm – 35 cm** | 15 cm – 25 cm | `ADVISORY` | Low-sedan caution | Early warning advisory flagged | 🟢 Green |
| **16 cm – 24 cm** | 26 cm – 34 cm | `WARNING` | High-clearance only | Staging alert at Chembur depot | 🟢 Green |
| **$\le$ 15 cm** | **$\ge$ 35 cm** | **`CRITICAL`** | **Impassable (Wading limit)** | **⛔ Road Blocked $\rightarrow$ Reroute via BKC Bypass** | **🔴 Red** |

*Note: In the tabletop demo rig, a 50 cm baseline ceiling is used. Clearance $\le$ 15 cm indicates $\ge$ 35 cm of standing water, which matches the empirical water wading limit for Tata 407 relief trucks and municipal ambulances.*

---

## 📁 Repository Directory Structure

```text
resqgrid/
├── .env.example                       # Root environment variable template
├── AGENTS.md                          # Next.js agent rule configuration
├── README.md                          # Master project documentation (this file)
│
├── docs/                              # Project Governance & Architecture Records
│   ├── PRD.md                         # Product Requirements Document
│   └── PROJECT_HISTORY.md             # 17 Architecture Decision Records (ADRs) & build logs
│
├── citizen-portal/                    # Platform 1: Citizen & Volunteer Relief Portal
│   ├── package.json                   # Next.js 16, React 19, Tailwind v4 (Port 3001)
│   ├── prisma/
│   │   └── schema.prisma              # Prisma schema for Neon PostgreSQL
│   ├── scripts/
│   │   ├── seed-mumbai-scenario.ts    # Database seeding script for Mumbai benchmarks
│   │   ├── test-triage.mjs            # AI triage engine validation script
│   │   └── test-realtime-sync.ts      # SSE synchronization stress test
│   └── src/
│       ├── app/
│       │   ├── page.tsx               # Public Relief Intake page
│       │   ├── track/page.tsx         # Live Request Status Tracker
│       │   └── api/
│       │       ├── requests/route.ts  # Intake handler (DB persistence + AI triage)
│       │       └── triage/route.ts    # Dual-Engine AI Triage endpoint
│       ├── components/
│       │   ├── intake/                # ReliefIntakeForm, LocationMapPicker
│       │   └── tracker/               # RequestTrackerView (6-stage stepper)
│       └── lib/
│           ├── db.ts                  # Neon PostgreSQL client with DNS fallback
│           └── engines/               # Triage & Prioritization algorithms
│
├── coordinator-portal/                # Platform 2: Emergency Coordinator Command Center
│   ├── package.json                   # Next.js 16, React 19, Leaflet, Framer Motion (Port 3000)
│   ├── prisma/
│   │   └── schema.prisma              # Shared Prisma database schema
│   ├── scripts/
│   │   ├── sync-neon-db.mjs           # Neon DB live table sync script
│   │   └── clean-non-seeded.mjs       # Database sanitization utility
│   └── src/
│       ├── app/
│       │   ├── page.tsx               # Tactical Command Center Dashboard
│       │   ├── inventory/page.tsx     # Inventory & Replenishment Center
│       │   ├── sensors/page.tsx       # DisasterSense IoT Diagnostic Hub
│       │   ├── audit/page.tsx         # Immutable Activity Ledger
│       │   └── api/
│       │       ├── requests/route.ts  # Queue management (PATCH/GET/SSE broadcast)
│       │       ├── requests/stream/   # Server-Sent Events (SSE) event streamer
│       │       ├── depots/route.ts    # Warehouse stock controller
│       │       ├── replenishment/     # Supplier requisition & receipt verification
│       │       ├── flood/telemetry/   # IoT telemetry ingestion & actuator feedback
│       │       └── scenario/reset/    # One-click Mumbai benchmark reset
│       ├── components/dashboard/      # Map, QueueTable, ScoreInspector, SummaryRibbon
│       └── lib/
│           ├── db.ts                  # Neon PostgreSQL client with connection pooler
│           ├── events.ts              # Node.js EventEmitter singleton for SSE
│           └── engines/               # Stock-aware allocation & prioritization engines
│
└── hardware/                          # DisasterSense IoT Edge Microcontroller
    └── esp32_disastersense/
        └── esp32_disastersense.ino    # ESP32 firmware (Wi-Fi, sensors, actuators, HTTP client)
```

---

## ⚙️ Environment Variables & Configuration

Both portals connect to a single Neon Serverless PostgreSQL database and use Google Gemini for AI triage.

Create a `.env` file in **both** `citizen-portal/` and `coordinator-portal/` (or copy `.env.example`):

```bash
# ==============================================================================
# 1. Google Gemini AI API Key (Triage Engine)
# ==============================================================================
# Get a free key at: https://aistudio.google.com/
GEMINI_API_KEY="AIzaSyYourGeminiApiKeyHere"
GEMINI_MODEL="gemini-2.5-flash"

# ==============================================================================
# 2. Neon Serverless PostgreSQL Database Connection
# ==============================================================================
# Create a free project at: https://console.neon.tech
# Make sure to copy the connection string with "Pooled connection" enabled:
DATABASE_URL="postgresql://neondb_owner:YOUR_PASSWORD@ep-sample-pooler.ap-southeast-1.aws.neon.tech/neondb?sslmode=require"

# Direct connection string (optional, for migrations):
DIRECT_URL="postgresql://neondb_owner:YOUR_PASSWORD@ep-sample.ap-southeast-1.aws.neon.tech/neondb?sslmode=require"
```

---

## 🚀 Quick Start Guide

### Prerequisites
- **Node.js:** v20.x or higher
- **npm:** v10.x or higher
- **Neon Cloud Account:** Free PostgreSQL database instance ([neon.tech](https://neon.tech))
- **Google Gemini API Key:** Free key ([aistudio.google.com](https://aistudio.google.com))

---

### 1. Clone & Install Dependencies

```bash
# Clone the repository
git clone https://github.com/KrishBawangade/resqgrid.git
cd resqgrid

# Install Citizen Portal dependencies
cd citizen-portal
npm install

# Install Coordinator Portal dependencies
cd ../coordinator-portal
npm install
cd ..
```

---

### 2. Configure Environment & Push Database Schema

```bash
# Copy environment files
cp .env.example citizen-portal/.env
cp .env.example coordinator-portal/.env

# Open both .env files and add your GEMINI_API_KEY and DATABASE_URL
```

Push the Prisma schema to create all 5 database tables (`ReliefRequest`, `ReliefDepot`, `DepotStock`, `ReplenishmentOrder`, `AuditLog`):

```bash
cd coordinator-portal
npx prisma db push
```

---

### 3. Seed Initial Mumbai Disaster Benchmark

Initialize the system with authentic Mumbai metropolitan disaster data (Mithi River flood corridor, depots, multi-resource demands, and replenishment orders):

```bash
node scripts/sync-neon-db.mjs
# Alternatively, run: npm run dev in coordinator-portal and click "Reset Demo Scenario"
```

---

### 4. Run Both Applications Concurrently

Open two terminal windows:

#### Terminal 1: Emergency Command Center (Port 3000)
```bash
cd coordinator-portal
npm run dev
```
👉 Access at: **`http://localhost:3000`**

#### Terminal 2: Citizen & Volunteer Relief Portal (Port 3001)
```bash
cd citizen-portal
npm run dev
```
👉 Access at: **`http://localhost:3001`**

---

## 🔌 Hardware Setup: ESP32 DisasterSense Node (Optional)

To connect physical IoT hardware into the command center:

### Component Pinout Wiring Table

| Component | Pin on Sensor | ESP32 Pin / Rail | Description |
| :--- | :--- | :--- | :--- |
| **HC-SR04 Ultrasonic** | `VCC` | `5V / VIN` | Sensor Power |
| **HC-SR04 Ultrasonic** | `GND` | `GND` | Ground |
| **HC-SR04 Ultrasonic** | `TRIG` | `GPIO 5` | Pulse Trigger |
| **HC-SR04 Ultrasonic** | `ECHO` | `GPIO 18` | Echo Return (via 1k/2k voltage divider to 3.3V) |
| **DHT11 Sensor** | `VCC` | `3V3` | Sensor Power |
| **DHT11 Sensor** | `GND` | `GND` | Ground |
| **DHT11 Sensor** | `DATA` | `GPIO 4` | Temperature & Humidity Data |
| **Soil Moisture Probe** | `VCC` | `3V3` | Sensor Power |
| **Soil Moisture Probe** | `GND` | `GND` | Ground |
| **Soil Moisture Probe** | `AOUT` | `GPIO 34` | Analog Soil Saturation |
| **Red Actuator LED** | Anode (`+`) | `GPIO 19` | Road Submerged Indicator (via 330Ω resistor) |
| **Green Actuator LED**| Anode (`+`) | `GPIO 22` | Road Clear Indicator (via 330Ω resistor) |

### Flashing Firmware
1. Open `hardware/esp32_disastersense/esp32_disastersense.ino` in the Arduino IDE.
2. Select **Board:** `ESP32 Dev Module`.
3. Update `WIFI_SSID`, `WIFI_PASSWORD`, and your computer's local IP address:
   ```cpp
   const char* WIFI_SSID     = "Your_WiFi_Name";
   const char* WIFI_PASSWORD = "Your_WiFi_Password";
   const char* SERVER_URL    = "http://192.168.1.100:3000/api/flood/telemetry";
   ```
4. Flash the code to your ESP32. Open the Serial Monitor at `115200 baud` to observe telemetry streaming.
5. In the Coordinator Portal, navigate to **`http://localhost:3000/sensors`** to view real-time incoming waveforms and actuator states.

---

## 🎬 End-to-End Live Demonstration Walkthrough

Follow this 7-step narrative for a complete demonstration of ResQGrid:

| Step | Action | Platform | Key Visual / Technical Feature Demonstrated |
| :---: | :--- | :--- | :--- |
| **1** | **Initial State & Scenario Reset** | Coordinator (`:3000`) | Click **"Reset Scenario"** in the top bar. Automatically resets Neon DB to the Mumbai Mithi River benchmark with 6 sectors, 3 depots, and queued demands. |
| **2** | **Citizen Distress Submission** | Citizen (`:3001`) | Fill out the intake form. Click **"📍 Fetch Current Location"** to simulate GPS inside the Sector 4 flood zone. Enter a freeform distress description (e.g. *"Flash flood breached ground floor; 12 elderly residents stranded without drinking water and insulin"*). Select multiple resources. Submit to acquire a tracking ID (`REQ-XXXX`). |
| **3** | **Zero-Polling SSE Triage** | Coordinator (`:3000`) | Without refreshing the page, the new request appears in the **To Verify** queue tab in `<10ms` via SSE. Inspect the **Score Inspector Drawer** to view Gemini 2.5 Flash's clinical extraction and the 55/20/15/10 mathematical score. Click **"Verify"**. |
| **4** | **Stock-Aware Allocation & Shortage** | Coordinator (`:3000`) | Click **"Allocate Stock"**. The atomic engine checks depot inventory. If stock is partially available, it allocates available units, marks the request as `⚡ Stock Allocated (Partial)`, and automatically preserves the remaining deficit at Priority Rank #1. An amber demand-deficit banner appears across the console. |
| **5** | **Supplier Replenishment** | Inventory (`:3000/inventory`) | Notice the deficit warning. Open the slide-over **Replenishment Drawer** from the depot card. Select the depleted resource and click `+500`. Dispatch order to simulated National Reserve supplier. The order enters `In Transit`, and the deficit banner clears. |
| **6** | **Verified Restock & Handover** | Inventory & Tracker | In the Replenishment Orders table, click **"Confirm Delivery & Restock"**. Stock physically increments in Neon DB and is logged to the Audit Ledger. Re-allocation fulfills the remaining deficit. Switch to Citizen Tracker (`:3001/track`) to watch the 6-stage timeline advance to `✓ Delivered & Confirmed` in real-time. |
| **7** | **IoT Flood Submergence & Safe Route** | IoT Hardware & Map | In the demo rig, simulate rising water by placing a hand/card within 15 cm of the ultrasonic sensor (or submerging the probe). Telemetry triggers `CRITICAL`. In `<10ms`, the ESP32 switches its **Red LED** on. On the tactical map, the LBS underpass is flagged `⛔ SUBMERGED`, and convoys are dynamically rerouted over the glowing green **BKC Elevated Bypass (+14m ASL)**. |

---

## 📜 Architecture Decision Records (ADRs) Summary

The ResQGrid codebase strictly follows 17 formal Architecture Decision Records documented in [`docs/PROJECT_HISTORY.md`](file:///c:/mono_repo_projects/resqgrid/docs/PROJECT_HISTORY.md):

- **ADR-001:** Full-Stack Next.js 16 App Router over standalone Express to eliminate CORS and server drift.
- **ADR-002:** Neon Serverless PostgreSQL with connection pooling and Prisma ORM 7.
- **ADR-003:** Explainable 55/20/15/10 Multi-Factor Prioritization Engine to eliminate unexplainable AI black boxes.
- **ADR-005:** Dual independent directories (`citizen-portal` and `coordinator-portal`) for layout and route isolation.
- **ADR-006:** Humanitarian OpenStreetMap (HOT) disaster cartography with zero API keys and zero watermarks.
- **ADR-007:** Four-tier lifecycle queue (Needs Attention, Partially Allocated, Fully Allocated, Rejected) preserving unmet deficits.
- **ADR-008:** Dual-layer AI natural language triage (Gemini 2.5 Flash + local NLP fallback) eliminating gameable checkboxes.
- **ADR-009:** Embedded Leaflet map picker with simulated flood-zone GPS coordinates.
- **ADR-010:** Hybrid priority score indexing with real-time dynamic elapsed waiting time recalculation.
- **ADR-011:** Real-time Server-Sent Events (SSE) streaming replacing continuous main-thread polling.
- **ADR-012:** Geographic standardization on the Mumbai Metropolitan Disaster Zone (Mithi River, Kurla, BKC).
- **ADR-013:** Reactive depot stock synchronization, slide-over replenishment drawer, and verified receipt restock.
- **ADR-014:** Operational theater auto-framing on Leaflet mount with unified lifecycle fulfillment definitions.
- **ADR-015:** Multi-resource demand benchmarks (`REQ-1048`, `REQ-1033`) and database stage timestamp persistence.
- **ADR-016:** Dedicated verification intake tab, left-aligned layout, and zero-jank pure fade transitions.
- **ADR-017:** DisasterSense IoT telemetry ingestion, bidirectional closed-loop actuator feedback, and dynamic safe route dispatch.

---

## 🛠️ Verification & Test Scripts

ResQGrid includes dedicated testing scripts located in `citizen-portal/scripts/`:

```bash
# 1. Test AI Triage Engine (Gemini API vs. Local NLP Fallback)
node citizen-portal/scripts/test-triage.mjs

# 2. Test End-to-End Submission & Database Persistence Pipeline
npx tsx citizen-portal/scripts/test-submission-pipeline.ts

# 3. Test Real-Time Cross-Portal SSE Synchronization
npx tsx citizen-portal/scripts/test-realtime-sync.ts

# 4. Check Neon Database Connection & Table Row Counts
node citizen-portal/scripts/check-db.mjs
```

---

## 👥 Authors & Acknowledgments

- **ResQGrid Engineering Team** — Developed for emergency disaster response and humanitarian logistics coordination.
- **Cartography:** [Humanitarian OpenStreetMap Team (HOT)](https://www.hotosm.org/) and [OpenStreetMap Contributors](https://www.openstreetmap.org/).
- **AI Infrastructure:** [Google DeepMind / Google AI Studio](https://ai.google.dev/) (Gemini 2.5 Flash).
- **Database Infrastructure:** [Neon Serverless PostgreSQL](https://neon.tech/).

---

<div align="center">
<strong>ResQGrid — Connect Needs. Coordinate Relief. Save Lives.</strong>
</div>
