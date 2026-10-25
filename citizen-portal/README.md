# ResQGrid — Citizen & Volunteer Relief Portal

Public-facing intake and live relief tracking platform for stranded citizens, local volunteer teams, and community wardens.

## 🚀 Quick Start

```bash
# 1. Install dependencies
npm install

# 2. Configure environment (see .env.example)
# Requires DATABASE_URL (Neon PostgreSQL) and GEMINI_API_KEY (Google Gemini)

# 3. Start development server on Port 3001
npm run dev
```

Visit: **`http://localhost:3001`**

## 📌 Capabilities

- **Natural Language Intake:** Freeform crisis description input evaluated by Google Gemini 2.5 Flash (with smart local NLP fallback) to prevent game-theory urgency abuse.
- **Flood Zone Cartography:** Embedded Leaflet map picker rendering the Sector 4 Mithi River Flash Flood Inundation Polygon with one-click simulated flood GPS acquisition.
- **Multi-Resource Demands:** Concurrent requests for Drinking Water, Food Rations, Medical Supplies, and Shelter Kits with itemized tracking.
- **Public 6-Stage Request Tracker (`/track`):** Real-time progress stepper with ADR-007 partial allocation guarantee and zero-polling Server-Sent Events (SSE) updates.

For full project architecture, algorithms, and system documentation, see the [Root README](../README.md).
