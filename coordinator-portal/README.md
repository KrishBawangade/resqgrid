# ResQGrid — Emergency Coordinator Command Center

Tactical command, dispatch triage, inventory logistics, and IoT hydrological early warning console for authorized disaster response personnel.

## 🚀 Quick Start

```bash
# 1. Install dependencies
npm install

# 2. Configure environment (see .env.example)
# Requires DATABASE_URL (Neon PostgreSQL) and GEMINI_API_KEY (Google Gemini)

# 3. Push database schema & seed initial benchmark data
npx prisma db push
node scripts/sync-neon-db.mjs

# 4. Start development server on Port 3000
npm run dev
```

Visit: **`http://localhost:3000`**

## 📌 Capabilities

- **Interactive Tactical Map:** Humanitarian OpenStreetMap (HOT) cartography, Mithi River flood inundation corridor & evacuation buffer, live depot icons, and dynamic fleet routing.
- **4-Tier Lifecycle Dispatch Queue:** Four operational queue views (Needs Attention, To Verify, Partially Allocated, Fully Allocated, Rejected) with left-aligned tabs and smooth transitions.
- **Explainable 55/20/15/10 Prioritization Engine:** Transparent mathematical score breakdown inspector (Need Criticality, Vulnerability, Logarithmic Headcount, Anti-Starvation Waiting Time) with coordinator justification overrides.
- **Stock-Aware Allocation Engine:** Atomic stock reservations preventing double-allocation and retaining unfulfilled deficits at Priority Rank #1.
- **Depot Inventory & Replenishment (`/inventory`):** Dynamic safety buffers, slide-over supplier requisition drawer, verified delivery restock workflow, and auto-clearing demand-deficit banners.
- **DisasterSense IoT Hub (`/sensors`):** Real-time telemetry ingestion from ESP32 edge sensors, bidirectional closed-loop actuator feedback (<10ms), and automated safe route rerouting via the BKC Elevated Bypass (+14m ASL).
- **Append-Only Audit Ledger (`/audit`):** Immutable transaction ledger of all triage, allocation, override, and replenishment activities.

For full system specifications and the end-to-end demonstration narrative, see the [Root README](../README.md).
