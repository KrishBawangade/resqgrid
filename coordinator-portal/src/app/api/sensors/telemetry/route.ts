import { NextRequest, NextResponse } from 'next/server';
// Force Turbopack re-eval
import { 
  iotStore, 
  processTelemetryReading, 
  setSimulationScenario 
} from '@/lib/sensors/iotStore';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: CORS_HEADERS,
  });
}

// GET /api/sensors/telemetry - Live sensor readings, history buffer, and disaster alert state
export async function GET() {
  const isHardwareLive = iotStore.lastHardwarePacketAt !== null && 
    (Date.now() - new Date(iotStore.lastHardwarePacketAt).getTime()) < 15000;

  return NextResponse.json({
    latest: iotStore.latestReading,
    history: iotStore.history,
    disasterState: iotStore.disasterState,
    isHardwareLive,
    lastHardwarePacketAt: iotStore.lastHardwarePacketAt,
    activeScenarioName: iotStore.activeScenarioName,
  }, {
    headers: {
      ...CORS_HEADERS,
      'Cache-Control': 'no-store, max-age=0',
    },
  });
}

// POST /api/sensors/telemetry - Receive live readings from ESP32 or scenario switch
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // 1. Scenario override command from UI inspector
    if (body.scenario && ['BASELINE', 'SATURATION_WARNING', 'SUBMERGED_CRITICAL'].includes(body.scenario)) {
      const result = setSimulationScenario(body.scenario as 'BASELINE' | 'SATURATION_WARNING' | 'SUBMERGED_CRITICAL');
      const isCritical = result.disasterState.level === 'CRITICAL';
      const ledColor = isCritical ? 'RED' : 'GREEN';
      return NextResponse.json({
        ok: true,
        scenarioApplied: body.scenario,
        level: result.disasterState.level,
        is_critical: isCritical,
        led_color: ledColor,
        active_route: result.disasterState.activeRoute,
        ...result,
      }, { headers: CORS_HEADERS });
    }

    // 2. Hardware telemetry ingestion (Matches ESP32 payload exactly)
    const result = processTelemetryReading({
      water_surface_distance_cm: body.water_surface_distance_cm,
      temperature_c: body.temperature_c,
      humidity_pct: body.humidity_pct,
      soil_moisture_pct: body.soil_moisture_pct,
      data_source: body.data_source || 'HARDWARE_LIVE',
      is_valid: body.is_valid !== false,
      sensor_id: body.sensor_id || 'ESP32-MITHI-01',
    });

    const isCritical = result.disasterState.level === 'CRITICAL';
    const ledColor = isCritical ? 'RED' : 'GREEN';

    return NextResponse.json({
      ok: true,
      level: result.disasterState.level,
      is_critical: isCritical,
      led_color: ledColor,
      active_route: result.disasterState.activeRoute,
      data_source: result.reading.data_source,
      disasterState: result.disasterState,
      reading: result.reading,
    }, {
      status: 200,
      headers: CORS_HEADERS,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Telemetry processing failed';
    return NextResponse.json({ error: msg }, { status: 400, headers: CORS_HEADERS });
  }
}
