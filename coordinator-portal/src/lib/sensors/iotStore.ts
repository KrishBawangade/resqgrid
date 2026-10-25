import { broadcastRealtimeEvent } from '@/lib/events';
import { db } from '@/lib/db';

export interface SensorTelemetryReading {
  water_surface_distance_cm: number | null;
  temperature_c?: number;
  humidity_pct?: number;
  soil_moisture_pct: number;
  data_source: 'HARDWARE_LIVE' | 'SIMULATION';
  is_valid: boolean;
  timestamp: string;
  sensor_id: string;
}

export type DisasterAlertLevel = 'NORMAL' | 'WARNING' | 'CRITICAL';
export type ActiveConvoyRoute = 'PRIMARY_LBS_CORRIDOR' | 'ELEVATED_BKC_BYPASS';
export type HazardTriggerSource = 'NONE' | 'ULTRASONIC_ONLY' | 'SOIL_ONLY' | 'COMBINED_WATER_AND_SOIL';

export interface DisasterState {
  level: DisasterAlertLevel;
  hazardSource: HazardTriggerSource;
  toastMessage: string;
  alertSignature: string;
  soilSaturationPct: number;
  waterClearanceCm: number;
  waterDepthCm: number;
  rateOfRiseCmPerMin: number;
  flashFloodWarning: boolean;
  underpassSubmerged: boolean;
  activeRoute: ActiveConvoyRoute;
  headline: string;
  action: string;
  lastUpdated: string;
  sensorId: string;
}

export interface IoTTelemetryStoreState {
  latestReading: SensorTelemetryReading;
  history: SensorTelemetryReading[];
  disasterState: DisasterState;
  lastHardwarePacketAt: string | null;
  activeScenarioName: 'BASELINE' | 'SATURATION_WARNING' | 'SUBMERGED_CRITICAL' | 'LIVE_HARDWARE';
}

// Tabletop Demo Calibration: Scaled 50cm baseline for benchtop presentation
// Clearance <= 15cm simulates 35cm flood depth (critical exhaust/intake stall limit for rescue trucks)
const BASELINE_CLEARANCE_CM = 50.0;
const SUBMERGENCE_THRESHOLD_CM = 15.0;
const SOIL_WARNING_THRESHOLD_PCT = 90; // Soil saturation >= 90% triggers flash flood warning

const INITIAL_READING: SensorTelemetryReading = {
  water_surface_distance_cm: 46.5,
  temperature_c: 28.5,
  humidity_pct: 68.0,
  soil_moisture_pct: 42,
  data_source: 'SIMULATION',
  is_valid: true,
  timestamp: new Date().toISOString(),
  sensor_id: 'ESP32-MITHI-01',
};

const INITIAL_DISASTER_STATE: DisasterState = {
  level: 'NORMAL',
  hazardSource: 'NONE',
  toastMessage: '🟢 IoT Status: All corridors clear. Standard logistics open.',
  alertSignature: 'NORMAL:NONE',
  soilSaturationPct: 42,
  waterClearanceCm: 46.5,
  waterDepthCm: 3.5,
  rateOfRiseCmPerMin: 0.0,
  flashFloodWarning: false,
  underpassSubmerged: false,
  activeRoute: 'PRIMARY_LBS_CORRIDOR',
  headline: 'All Operational Corridors Clear',
  action: 'Standard LBS Marg logistics transit corridor active. Normal monitoring mode.',
  lastUpdated: new Date().toISOString(),
  sensorId: 'ESP32-MITHI-01',
};

declare global {
  // eslint-disable-next-line no-var
  var __resqgrid_iot_store: IoTTelemetryStoreState | undefined;
}

if (!globalThis.__resqgrid_iot_store) {
  // Pre-seed 15 historical points for immediate rich charting on first render
  const seededHistory: SensorTelemetryReading[] = [];
  const now = Date.now();
  for (let i = 14; i >= 0; i--) {
    seededHistory.push({
      water_surface_distance_cm: 46.0 + Math.sin(i) * 1.2,
      temperature_c: 28.5 + (14 - i) * 0.05,
      humidity_pct: 66.0 + (14 - i) * 0.2,
      soil_moisture_pct: 40 + Math.floor(i * 0.3),
      data_source: 'SIMULATION',
      is_valid: true,
      timestamp: new Date(now - i * 3000).toISOString(),
      sensor_id: 'ESP32-MITHI-01',
    });
  }

  globalThis.__resqgrid_iot_store = {
    latestReading: INITIAL_READING,
    history: seededHistory,
    disasterState: INITIAL_DISASTER_STATE,
    lastHardwarePacketAt: null,
    activeScenarioName: 'BASELINE',
  };
}

export const iotStore: IoTTelemetryStoreState = globalThis.__resqgrid_iot_store;

// Calculate rate of rise over the last minute (cm/min)
function computeRateOfRise(history: SensorTelemetryReading[], currentClearance: number | null): number {
  if (currentClearance === null || history.length < 2) return 0;
  
  const oneMinAgoTime = Date.now() - 60000;
  const pastReading = [...history].reverse().find((h) => 
    new Date(h.timestamp).getTime() <= oneMinAgoTime && h.water_surface_distance_cm !== null
  ) || history[0];

  if (!pastReading || pastReading.water_surface_distance_cm === null) return 0;

  const clearanceDrop = pastReading.water_surface_distance_cm - currentClearance;
  const timeDeltaMin = Math.max(0.1, (Date.now() - new Date(pastReading.timestamp).getTime()) / 60000);
  
  const rate = Math.round((clearanceDrop / timeDeltaMin) * 10) / 10;
  return Math.max(0, rate); // only positive rise
}

export function processTelemetryReading(raw: {
  water_surface_distance_cm?: number | null;
  temperature_c?: number | null;
  humidity_pct?: number | null;
  soil_moisture_pct?: number | null;
  data_source?: string;
  is_valid?: boolean;
  sensor_id?: string;
}): { reading: SensorTelemetryReading; disasterState: DisasterState } {
  const clearance = typeof raw.water_surface_distance_cm === 'number' && !isNaN(raw.water_surface_distance_cm)
    ? Math.max(2.0, Math.min(400.0, raw.water_surface_distance_cm))
    : null;

  const soilMoisture = typeof raw.soil_moisture_pct === 'number' && !isNaN(raw.soil_moisture_pct)
    ? Math.max(0, Math.min(100, Math.round(raw.soil_moisture_pct)))
    : iotStore.latestReading.soil_moisture_pct;

  const temp = typeof raw.temperature_c === 'number' && !isNaN(raw.temperature_c)
    ? Math.round(raw.temperature_c * 10) / 10
    : iotStore.latestReading.temperature_c ?? 28.0;

  const humidity = typeof raw.humidity_pct === 'number' && !isNaN(raw.humidity_pct)
    ? Math.round(raw.humidity_pct * 10) / 10
    : iotStore.latestReading.humidity_pct ?? 70.0;

  const dataSource: 'HARDWARE_LIVE' | 'SIMULATION' = raw.data_source === 'HARDWARE_LIVE' 
    ? 'HARDWARE_LIVE' 
    : 'SIMULATION';

  const sensorId = raw.sensor_id || 'ESP32-MITHI-01';
  const timestamp = new Date().toISOString();

  const reading: SensorTelemetryReading = {
    water_surface_distance_cm: clearance,
    temperature_c: temp,
    humidity_pct: humidity,
    soil_moisture_pct: soilMoisture,
    data_source: dataSource,
    is_valid: raw.is_valid !== false,
    timestamp,
    sensor_id: sensorId,
  };

  if (dataSource === 'HARDWARE_LIVE') {
    iotStore.lastHardwarePacketAt = timestamp;
    iotStore.activeScenarioName = 'LIVE_HARDWARE';
  }

  // Update history buffer (keep up to 100 readings)
  iotStore.history.push(reading);
  if (iotStore.history.length > 100) {
    iotStore.history.shift();
  }
  iotStore.latestReading = reading;

  // Evaluate Individual Physical Sensor Channels
  const effectiveClearance = clearance !== null ? clearance : iotStore.latestReading.water_surface_distance_cm ?? 45.0;
  const waterDepthCm = Math.max(0, Math.round((BASELINE_CLEARANCE_CM - effectiveClearance) * 10) / 10);
  const rateOfRise = computeRateOfRise(iotStore.history, effectiveClearance);
  
  // A. Ultrasonic Water Clearance Triggers
  const underpassSubmerged = effectiveClearance <= SUBMERGENCE_THRESHOLD_CM; // <= 15cm (Critical)
  const isWaterApproaching = !underpassSubmerged && effectiveClearance <= 25.0; // <= 25cm (Warning)
  const isSurgeSpike = !underpassSubmerged && rateOfRise >= 3.0; // >= 3 cm/min (Warning)
  const hasWaterHazard = underpassSubmerged || isWaterApproaching || isSurgeSpike;

  // B. Soil Moisture Triggers
  const isSoilRunoff = soilMoisture >= SOIL_WARNING_THRESHOLD_PCT; // >= 90% (Warning)
  const isSoilElevated = !isSoilRunoff && soilMoisture >= 85; // >= 85% (Warning)
  const hasSoilHazard = isSoilRunoff || isSoilElevated;

  let level: DisasterAlertLevel = 'NORMAL';
  let hazardSource: HazardTriggerSource = 'NONE';
  let activeRoute: ActiveConvoyRoute = 'PRIMARY_LBS_CORRIDOR';
  let headline = 'All Operational Corridors Clear';
  let action = 'Standard LBS Marg transit corridor active. Normal monitoring mode.';
  let toastMessage = `🟢 IoT Status: Roadway clear (${effectiveClearance.toFixed(1)}cm clearance, ${soilMoisture}% soil). Standard logistics open.`;

  // Multi-Sensor Fusion Decision Matrix
  if (hasWaterHazard && hasSoilHazard) {
    // Both sensors trigger: Combined multi-hazard alert
    hazardSource = 'COMBINED_WATER_AND_SOIL';
    if (underpassSubmerged) {
      level = 'CRITICAL';
      activeRoute = 'ELEVATED_BKC_BYPASS';
      headline = '⛔ COMBINED ALERT: UNDERPASS SUBMERGED + RIVERBANK SATURATED';
      action = `Ultrasonic detected ${waterDepthCm}cm inundation (${effectiveClearance.toFixed(1)}cm clearance) AND Soil Sensor detected ${soilMoisture}% saturation. Overland route closed. Convoys redirected via BKC Elevated Bypass (+14m ASL).`;
      toastMessage = `⛔ Combined Hazard: Underpass submerged (${effectiveClearance.toFixed(1)}cm) + Riverbank ${soilMoisture}% saturated! Diverting via BKC Flyover.`;
    } else {
      level = 'WARNING';
      activeRoute = 'PRIMARY_LBS_CORRIDOR';
      headline = '⚠️ COMBINED EARLY WARNING: WATER APPROACHING ROAD + HIGH SOIL SATURATION';
      action = `Water clearance dropped to ${effectiveClearance.toFixed(1)}cm (${waterDepthCm}cm inundation) with soil saturation at ${soilMoisture}%. Surface runoff imminent across lowlands.`;
      toastMessage = `⚠️ Combined Warning: Water clearance ${effectiveClearance.toFixed(1)}cm + Soil saturation ${soilMoisture}%. Pre-staging high-ground depots.`;
    }
  } else if (hasWaterHazard) {
    // Only Ultrasonic channel triggers
    hazardSource = 'ULTRASONIC_ONLY';
    if (underpassSubmerged) {
      level = 'CRITICAL';
      activeRoute = 'ELEVATED_BKC_BYPASS';
      headline = '⛔ LBS UNDERPASS SUBMERGED — DYNAMIC REROUTE ACTIVE';
      action = `Ultrasonic Sensor #01 detected ${waterDepthCm}cm inundation (clearance ${effectiveClearance.toFixed(1)}cm). Overland route blocked. Convoys redirected via BKC Elevated Bypass (+14m ASL).`;
      toastMessage = `⛔ Ultrasonic Alert: Underpass submerged (${effectiveClearance.toFixed(1)}cm clearance, ${waterDepthCm}cm water)! Convoys rerouted via BKC Elevated Bypass.`;
    } else if (isSurgeSpike) {
      level = 'WARNING';
      activeRoute = 'PRIMARY_LBS_CORRIDOR';
      headline = `⚡ RAPID WATER SURGE DETECTED (+${rateOfRise.toFixed(1)} cm/min)`;
      action = `Water surface rising rapidly at +${rateOfRise.toFixed(1)} cm/min towards underpass tarmac. Active flood surge monitoring.`;
      toastMessage = `⚡ Ultrasonic Warning: Rapid water surge (+${rateOfRise.toFixed(1)} cm/min)! Water clearance at ${effectiveClearance.toFixed(1)}cm.`;
    } else {
      level = 'WARNING';
      activeRoute = 'PRIMARY_LBS_CORRIDOR';
      headline = '⚠️ RAPID INUNDATION SURGE — ROAD LEVEL RISK';
      action = `Water clearance dropped to ${effectiveClearance.toFixed(1)}cm (${waterDepthCm}cm inundation). Water approaching underpass tarmac. Preparing emergency diversion.`;
      toastMessage = `⚠️ Ultrasonic Warning: Water clearance dropped to ${effectiveClearance.toFixed(1)}cm (${waterDepthCm}cm flood depth). Preparing diversion.`;
    }
  } else if (hasSoilHazard) {
    // Only Soil Moisture channel triggers
    hazardSource = 'SOIL_ONLY';
    level = 'WARNING';
    activeRoute = 'PRIMARY_LBS_CORRIDOR';
    if (isSoilRunoff) {
      headline = '🟡 FLASH RUNOFF PREDICTED — PRE-STAGE HIGH GROUND DEPOTS';
      action = `Riverbank saturation reached ${soilMoisture}%. Ground absorption capacity exhausted. Pre-stage emergency stock at Sector 9 Chembur and alert boat units.`;
      toastMessage = `🟡 Soil Sensor Warning: Riverbank saturation reached ${soilMoisture}%! Ground capacity exhausted; flash runoff predicted.`;
    } else {
      headline = `🟡 ELEVATED SOIL MOISTURE (${soilMoisture}%) — RUNOFF MONITORING`;
      action = `Riverbank ground capacity absorbing moisture at ${soilMoisture}%. Monitoring upstream surge rate.`;
      toastMessage = `🟡 Soil Sensor Advisory: Elevated soil moisture (${soilMoisture}%). Monitoring riverbank saturation.`;
    }
  } else {
    // Both channels normal
    hazardSource = 'NONE';
    level = 'NORMAL';
    activeRoute = 'PRIMARY_LBS_CORRIDOR';
    headline = 'All Operational Corridors Clear';
    action = `Standard LBS Marg transit corridor active. Clearance: ${effectiveClearance.toFixed(1)}cm (Inundation: ${waterDepthCm}cm), Soil: ${soilMoisture}%. Normal monitoring mode.`;
    toastMessage = `🟢 IoT Status: Roadway clear (${effectiveClearance.toFixed(1)}cm clearance, ${soilMoisture}% soil). Standard logistics open.`;
  }

  const previousRoute = iotStore.disasterState.activeRoute;
  const isRouteChanged = previousRoute !== activeRoute;
  const currentSignature = `${level}:${hazardSource}`;

  const nextDisasterState: DisasterState = {
    level,
    hazardSource,
    toastMessage,
    alertSignature: currentSignature,
    soilSaturationPct: soilMoisture,
    waterClearanceCm: effectiveClearance,
    waterDepthCm,
    rateOfRiseCmPerMin: rateOfRise,
    flashFloodWarning: isSoilRunoff,
    underpassSubmerged,
    activeRoute,
    headline,
    action,
    lastUpdated: timestamp,
    sensorId,
  };

  iotStore.disasterState = nextDisasterState;

  // Broadcast realtime telemetry update on every packet (for charts & gauges)
  broadcastRealtimeEvent('SENSOR_TELEMETRY', {
    reading,
    disasterState: nextDisasterState,
  });

  // Only broadcast DISASTER_STATE_CHANGED when the route is rerouted or cleared
  if (isRouteChanged) {
    broadcastRealtimeEvent('DISASTER_STATE_CHANGED', {
      fromRoute: previousRoute,
      toRoute: activeRoute,
      routeAction: activeRoute === 'ELEVATED_BKC_BYPASS' ? 'REROUTED' : 'CLEARED',
      disasterState: nextDisasterState,
    });

    // Asynchronously log route transition into Neon AuditLog
    try {
      db.auditLog.create({
        data: {
          action: activeRoute === 'ELEVATED_BKC_BYPASS' ? 'UNDERPASS_SUBMERGED_REROUTE' : 'ROUTE_CLEARED_PRIMARY_RESTORED',
          actor: `DisasterSense IoT Node (${sensorId})`,
          details: activeRoute === 'ELEVATED_BKC_BYPASS'
            ? `⛔ Dynamic Reroute: LBS Underpass submerged (clearance=${effectiveClearance.toFixed(1)}cm, depth=${waterDepthCm}cm). Diverting via BKC Elevated Bypass (+14m ASL).`
            : `🟢 Route Cleared: Roadway clearance restored (${effectiveClearance.toFixed(1)}cm). Primary LBS corridor open.`,
        }
      }).catch((err) => console.warn('Could not persist IoT audit log:', err));
    } catch {
      // Non-blocking
    }
  }

  return { reading, disasterState: nextDisasterState };
}

// Preset demonstration scenarios for live hackathon judging
export function setSimulationScenario(preset: 'BASELINE' | 'SATURATION_WARNING' | 'SUBMERGED_CRITICAL') {
  iotStore.activeScenarioName = preset;

  switch (preset) {
    case 'BASELINE':
      return processTelemetryReading({
        water_surface_distance_cm: 46.5,
        soil_moisture_pct: 38,
        humidity_pct: 62.0,
        temperature_c: 29.2,
        data_source: 'SIMULATION',
        sensor_id: 'ESP32-MITHI-01',
      });

    case 'SATURATION_WARNING':
      return processTelemetryReading({
        water_surface_distance_cm: 27.5,
        soil_moisture_pct: 94,
        humidity_pct: 92.5,
        temperature_c: 27.1,
        data_source: 'SIMULATION',
        sensor_id: 'ESP32-MITHI-01',
      });

    case 'SUBMERGED_CRITICAL':
      return processTelemetryReading({
        water_surface_distance_cm: 11.4,
        soil_moisture_pct: 99,
        humidity_pct: 97.0,
        temperature_c: 25.8,
        data_source: 'SIMULATION',
        sensor_id: 'ESP32-MITHI-01',
      });
  }
}
