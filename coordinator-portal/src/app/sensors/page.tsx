'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { 
  Activity, 
  AlertTriangle, 
  ShieldAlert, 
  Radio, 
  ArrowLeft, 
  Layers, 
  Droplets, 
  Thermometer, 
  ShieldCheck,
  ChevronRight,
  Zap,
  CheckCircle2,
  Clock,
  Compass,
  Scale,
  Info,
  Sliders
} from 'lucide-react';
import { DisasterState, SensorTelemetryReading } from '@/lib/sensors/iotStore';

export default function IoTSensorsHubPage() {
  const [telemetry, setTelemetry] = useState<{
    latest: SensorTelemetryReading;
    history: SensorTelemetryReading[];
    disasterState: DisasterState;
    isHardwareLive: boolean;
    lastHardwarePacketAt: string | null;
  } | null>(null);

  const [timeSinceLastPacket, setTimeSinceLastPacket] = useState<string>('Listening...');

  // 1. Initial Load & Persistent SSE Real-time Stream
  useEffect(() => {
    let isMounted = true;

    const fetchTelemetry = async () => {
      try {
        const res = await fetch('/api/sensors/telemetry', { cache: 'no-store' });
        if (res.ok) {
          const data = await res.json();
          if (isMounted) setTelemetry(data);
        }
      } catch (err) {
        console.warn('Failed to load initial telemetry:', err);
      }
    };

    fetchTelemetry();

    let es: EventSource | null = null;
    try {
      es = new EventSource('/api/requests/stream');
      es.onmessage = (event) => {
        if (!event.data) return;
        try {
          const payload = JSON.parse(event.data);
          if (payload.type === 'SENSOR_TELEMETRY' && payload.data) {
            if (isMounted) {
              setTelemetry((prev) => {
                if (!prev) return prev;
                const newHistory = [...prev.history, payload.data.reading];
                if (newHistory.length > 50) newHistory.shift();
                return {
                  ...prev,
                  latest: payload.data.reading,
                  history: newHistory,
                  disasterState: payload.data.disasterState,
                  isHardwareLive: payload.data.reading.data_source === 'HARDWARE_LIVE',
                  lastHardwarePacketAt: payload.data.reading.data_source === 'HARDWARE_LIVE' 
                    ? payload.data.reading.timestamp 
                    : prev.lastHardwarePacketAt,
                };
              });
            }
          } else if (payload.type === 'DISASTER_STATE_CHANGED' && payload.data) {
            if (isMounted) {
              setTelemetry((prev) => prev ? { ...prev, disasterState: payload.data.disasterState } : prev);
            }
          }
        } catch {}
      };
    } catch {}

    return () => {
      isMounted = false;
      if (es) es.close();
    };
  }, []);

  // 2. Relative time counter for heartbeat
  useEffect(() => {
    const timer = setInterval(() => {
      if (!telemetry?.lastHardwarePacketAt) {
        setTimeSinceLastPacket('Waiting for first packet');
        return;
      }
      const diffSec = Math.max(0, Math.floor((Date.now() - new Date(telemetry.lastHardwarePacketAt).getTime()) / 1000));
      if (diffSec < 4) {
        setTimeSinceLastPacket('Just now (< 3s)');
      } else if (diffSec < 60) {
        setTimeSinceLastPacket(`${diffSec}s ago`);
      } else {
        const diffMin = Math.floor(diffSec / 60);
        setTimeSinceLastPacket(`${diffMin}m ago`);
      }
    }, 1000);

    return () => clearInterval(timer);
  }, [telemetry?.lastHardwarePacketAt]);

  const latest = telemetry?.latest;
  const disasterState = telemetry?.disasterState;
  const history = telemetry?.history || [];
  const isHardwareLive = telemetry?.isHardwareLive || false;

  const isCritical = disasterState?.level === 'CRITICAL';
  const isWarning = disasterState?.level === 'WARNING';

  const clearanceVal = latest?.water_surface_distance_cm !== null && latest?.water_surface_distance_cm !== undefined
    ? Number(latest.water_surface_distance_cm)
    : 45.0;

  const soilVal = latest?.soil_moisture_pct ?? 0;
  const tempVal = latest?.temperature_c ?? 28.5;
  const humVal = latest?.humidity_pct ?? 70.0;
  const waterDepthVal = disasterState?.waterDepthCm ?? Math.max(0, Math.round((50.0 - clearanceVal) * 10) / 10);
  const rateOfRise = disasterState?.rateOfRiseCmPerMin ?? 0;
  const activeRoute = disasterState?.activeRoute ?? 'PRIMARY_LBS_CORRIDOR';

  // Derived alerts based on real telemetry numbers
  const isSubmerged = clearanceVal <= 15.0;
  const isWaterRising = clearanceVal <= 25.0 && clearanceVal > 15.0;
  const isSoilCritical = soilVal >= 90;
  const isSoilElevated = soilVal >= 75 && soilVal < 90;

  return (
    <div className="space-y-5 pb-12">
      {/* 1. Header with Live Hardware Status */}
      <div className="bg-white rounded-2xl border border-slate-200/90 p-5 shadow-2xs">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="flex items-center space-x-2 mb-1.5">
              <Link 
                href="/" 
                className="inline-flex items-center space-x-1 text-xs font-semibold text-slate-500 hover:text-blue-600 transition-colors"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Command Operations Map</span>
              </Link>
              <span className="text-slate-300">/</span>
              <span className="text-xs font-bold text-slate-800">Live Hardware Telemetry & Alert Center</span>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 tracking-tight">
                DisasterSense IoT Station #01
              </h1>
              <span className={`text-xs px-2.5 py-0.5 rounded-full font-bold font-mono tracking-wider uppercase border flex items-center space-x-1.5 ${
                isHardwareLive 
                  ? 'bg-emerald-50 text-emerald-700 border-emerald-300 ring-2 ring-emerald-100' 
                  : 'bg-amber-50 text-amber-700 border-amber-300'
              }`}>
                <span className={`w-2 h-2 rounded-full ${isHardwareLive ? 'bg-emerald-500 animate-ping' : 'bg-amber-500'}`} />
                <span>{isHardwareLive ? '● Live Hardware Streaming' : '○ Standby / Listening'}</span>
              </span>
            </div>

            <p className="text-xs text-slate-600 mt-1 max-w-2xl leading-relaxed">
              Sector 4: Kurla West / Mithi River Basin • Direct telemetry ingestion from ESP32 microcontroller with HC-SR04 ultrasonic, capacitive soil moisture, and DHT11 sensors.
            </p>

            <div className="mt-2.5 flex flex-wrap items-center gap-2">
              <span className="text-[10.5px] font-mono font-bold bg-blue-50 text-blue-800 px-2.5 py-1 rounded-lg border border-blue-200 flex items-center space-x-1.5 shadow-2xs">
                <span>🎯</span>
                <span>Tabletop Demo Calibration: 50.0cm Baseline</span>
              </span>
              <span className="text-[10.5px] font-mono font-bold bg-rose-50 text-rose-800 px-2.5 py-1 rounded-lg border border-rose-200 flex items-center space-x-1.5">
                <span>⛔</span>
                <span>Submergence Cutoff: &le;15.0cm (Simulates 35.0cm Truck Stall Depth)</span>
              </span>
              <span className="text-[10.5px] text-slate-500 font-mono hidden sm:inline">
                Scaled short threshold for live presentation testing
              </span>
            </div>
          </div>

          <div className="flex flex-col sm:items-end gap-1.5 text-xs font-mono">
            <div className="flex items-center space-x-2 bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1 text-[11px] text-slate-700">
              <Clock className="w-3.5 h-3.5 text-blue-600" />
              <span>Packet Heartbeat: <strong>{timeSinceLastPacket}</strong></span>
            </div>
            <div className="text-[10px] text-slate-500">
              Sensor ID: <strong>{latest?.sensor_id || 'ESP32-MITHI-01'}</strong> • Transmission Interval: <strong>3000ms</strong>
            </div>
          </div>
        </div>
      </div>

      {/* 2. Primary Real-Time Disaster Alert Banner */}
      <div className={`p-5 rounded-2xl border transition-all ${
        isCritical
          ? 'bg-rose-50 border-rose-300 text-rose-950 shadow-sm shadow-rose-100'
          : isWarning
          ? 'bg-amber-50 border-amber-300 text-amber-950 shadow-sm shadow-amber-100'
          : 'bg-emerald-50 border-emerald-300 text-emerald-950 shadow-sm shadow-emerald-100'
      }`}>
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-start space-x-3.5 max-w-3xl">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 mt-0.5 ${
              isCritical ? 'bg-rose-600 text-white' : isWarning ? 'bg-amber-600 text-white' : 'bg-emerald-600 text-white'
            }`}>
              {isCritical ? <ShieldAlert className="w-6 h-6" /> : isWarning ? <AlertTriangle className="w-6 h-6" /> : <ShieldCheck className="w-6 h-6" />}
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2 mb-1">
                <span className="font-black text-base tracking-tight">
                  {disasterState?.headline || 'Operational Corridors Clear'}
                </span>
                <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded-full ${
                  isCritical ? 'bg-rose-200 text-rose-900' : isWarning ? 'bg-amber-200 text-amber-900' : 'bg-emerald-200 text-emerald-900'
                }`}>
                  LEVEL: {disasterState?.level || 'NORMAL'}
                </span>
                {disasterState?.hazardSource && disasterState.hazardSource !== 'NONE' && (
                  <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-slate-900 text-white shadow-2xs">
                    {disasterState.hazardSource === 'COMBINED_WATER_AND_SOIL' 
                      ? '⚡ COMBINED: ULTRASONIC + SOIL' 
                      : disasterState.hazardSource === 'ULTRASONIC_ONLY'
                      ? '📡 SOURCE: ULTRASONIC SENSOR'
                      : '🌱 SOURCE: SOIL MOISTURE'}
                  </span>
                )}
              </div>
              <p className="text-xs opacity-90 leading-relaxed">
                {disasterState?.action || 'Monitoring Mithi Basin water level and soil moisture in real time.'}
              </p>
            </div>
          </div>

          <div className="flex flex-col sm:items-end gap-2 shrink-0">
            <div className={`px-3 py-1 rounded-lg text-xs font-bold font-mono border ${
              activeRoute === 'ELEVATED_BKC_BYPASS'
                ? 'bg-emerald-950 text-emerald-300 border-emerald-700'
                : 'bg-blue-950 text-blue-300 border-blue-700'
            }`}>
              Route: {activeRoute === 'ELEVATED_BKC_BYPASS' ? '✅ BKC Elevated Bypass (+14m ASL)' : '🚚 LBS Marg Primary Arterial'}
            </div>
            <Link
              href="/"
              className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-lg font-bold text-xs bg-white border border-slate-300 hover:bg-slate-50 transition-colors shadow-2xs"
            >
              <span>View Route on Map</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>
      </div>

      {/* 3. Four Core Real-Time Hardware Metric Gauges */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Gauge 1: Ultrasonic Distance & Water Depth */}
        <div className="bg-white rounded-2xl border border-slate-200/90 p-4 shadow-2xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between text-xs text-slate-500 mb-2">
              <span className="font-semibold flex items-center space-x-1.5">
                <Activity className="w-3.5 h-3.5 text-blue-600" />
                <span>Roadway Clearance</span>
              </span>
              <span className="font-mono text-[10px] bg-slate-100 px-1.5 py-0.2 rounded text-slate-600 font-bold">HC-SR04</span>
            </div>

            <div className="flex items-baseline space-x-2">
              <span className={`text-3xl font-black font-mono tracking-tight ${
                isSubmerged ? 'text-rose-600' : isWaterRising ? 'text-amber-600' : 'text-slate-900'
              }`}>
                {clearanceVal.toFixed(1)}
              </span>
              <span className="text-xs font-semibold text-slate-500">cm distance</span>
            </div>

            <div className="text-xs text-slate-600 mt-1">
              Simulated Water Depth: <strong className={isSubmerged ? 'text-rose-700 font-extrabold' : 'text-slate-800'}>
                {waterDepthVal.toFixed(1)} cm
              </strong>
              <span className="text-[10px] text-slate-400 block font-mono mt-0.5">
                (50cm Baseline - {clearanceVal.toFixed(1)}cm)
              </span>
            </div>

            <div className="mt-2 text-[10px] bg-slate-50 border border-slate-200 rounded p-1.5 text-slate-600 font-mono leading-tight">
              <span>Demo Rig: Cutoff &le;15cm represents 35cm flood depth (vehicle wading limit).</span>
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-slate-100">
            <div className="flex justify-between text-[10px] font-mono text-slate-500 mb-1">
              <span>Dry: 50cm</span>
              <span className={isSubmerged ? 'text-rose-600 font-bold' : isWaterRising ? 'text-amber-600 font-bold' : 'text-emerald-600 font-bold'}>
                {isSubmerged ? '⛔ SUBMERGED (&le;15cm)' : isWaterRising ? '⚠️ WATER RISING' : '✓ PASSABLE'}
              </span>
            </div>
            <div className="w-full h-2.5 rounded-full bg-slate-100 border border-slate-200 overflow-hidden relative">
              <div 
                className={`h-full transition-all duration-300 rounded-full ${
                  isSubmerged ? 'bg-rose-500' : isWaterRising ? 'bg-amber-500' : 'bg-blue-500'
                }`}
                style={{ width: `${Math.max(5, Math.min(100, (1 - (clearanceVal / 50)) * 100))}%` }}
              />
            </div>
          </div>
        </div>

        {/* Gauge 2: Riverbank Soil Saturation */}
        <div className="bg-white rounded-2xl border border-slate-200/90 p-4 shadow-2xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between text-xs text-slate-500 mb-2">
              <span className="font-semibold flex items-center space-x-1.5">
                <Droplets className="w-3.5 h-3.5 text-amber-600" />
                <span>Riverbank Soil Moisture</span>
              </span>
              <span className="font-mono text-[10px] bg-slate-100 px-1.5 py-0.2 rounded text-slate-600 font-bold">ADC GPIO 34</span>
            </div>

            <div className="flex items-baseline space-x-2">
              <span className={`text-3xl font-black font-mono tracking-tight ${
                isSoilCritical ? 'text-amber-600' : isSoilElevated ? 'text-amber-500' : 'text-slate-900'
              }`}>
                {soilVal}
              </span>
              <span className="text-xs font-semibold text-slate-500">% saturation</span>
            </div>

            <div className="text-xs text-slate-600 mt-1">
              Ground Infiltration: <strong className={isSoilCritical ? 'text-rose-700 font-extrabold' : isSoilElevated ? 'text-amber-700' : 'text-emerald-700'}>
                {isSoilCritical ? '⚠️ 0% Capacity (Flash Runoff)' : isSoilElevated ? 'High Saturation' : 'Field Capacity Safe'}
              </strong>
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-slate-100">
            <div className="flex justify-between text-[10px] font-mono text-slate-500 mb-1">
              <span>Limit: 90%</span>
              <span className={isSoilCritical ? 'text-rose-600 font-bold' : 'text-slate-600'}>
                {isSoilCritical ? 'RUNOFF RISK' : 'ABSORBING'}
              </span>
            </div>
            <div className="w-full h-2.5 rounded-full bg-slate-100 border border-slate-200 overflow-hidden relative">
              <div 
                className={`h-full transition-all duration-300 rounded-full ${
                  isSoilCritical ? 'bg-amber-500' : 'bg-emerald-500'
                }`}
                style={{ width: `${Math.max(5, Math.min(100, soilVal))}%` }}
              />
            </div>
          </div>
        </div>

        {/* Gauge 3: Meteorological Sensor (DHT11) */}
        <div className="bg-white rounded-2xl border border-slate-200/90 p-4 shadow-2xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between text-xs text-slate-500 mb-2">
              <span className="font-semibold flex items-center space-x-1.5">
                <Thermometer className="w-3.5 h-3.5 text-rose-500" />
                <span>Ambient Meteorology</span>
              </span>
              <span className="font-mono text-[10px] bg-slate-100 px-1.5 py-0.2 rounded text-slate-600 font-bold">DHT11 GPIO 4</span>
            </div>

            <div className="flex items-baseline space-x-3">
              <div>
                <span className="text-2xl font-black font-mono tracking-tight text-slate-900">
                  {tempVal.toFixed(1)}°
                </span>
                <span className="text-[10px] text-slate-500 font-semibold ml-0.5">C</span>
              </div>
              <span className="text-slate-300">/</span>
              <div>
                <span className="text-2xl font-black font-mono tracking-tight text-slate-900">
                  {humVal.toFixed(1)}%
                </span>
                <span className="text-[10px] text-slate-500 font-semibold ml-0.5">Humidity</span>
              </div>
            </div>

            <div className="text-xs text-slate-600 mt-1">
              Atmospheric State: <strong className="text-slate-800">
                {humVal >= 85 ? 'High Storm Risk / Cloudburst' : 'Monsoonal Overcast'}
              </strong>
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500 font-semibold">
            <span>Sensor Signal:</span>
            <span className="text-emerald-700 font-bold flex items-center space-x-1">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
              <span>Bit-Bang Validated</span>
            </span>
          </div>
        </div>

        {/* Gauge 4: Dynamic Safe Routing Dispatch */}
        <div className={`rounded-2xl border p-4 shadow-2xs flex flex-col justify-between ${
          isCritical ? 'bg-rose-900 text-white border-rose-800' : 'bg-slate-900 text-white border-slate-800'
        }`}>
          <div>
            <div className="flex items-center justify-between text-xs text-slate-300 mb-2">
              <span className="font-semibold flex items-center space-x-1.5">
                <Layers className={`w-3.5 h-3.5 ${isCritical ? 'text-rose-300' : 'text-emerald-400'}`} />
                <span>Convoy Dispatch Routing</span>
              </span>
              <span className={`font-mono text-[9.5px] px-1.5 py-0.2 rounded font-extrabold uppercase ${
                isCritical ? 'bg-rose-500 text-white' : 'bg-emerald-500 text-slate-950'
              }`}>
                {isCritical ? 'REROUTE ACTIVE' : 'CORRIDOR OPEN'}
              </span>
            </div>

            <div className="font-extrabold text-sm tracking-tight leading-snug mt-1">
              {isCritical ? 'BKC Elevated Bypass (+14m ASL)' : 'LBS Marg Primary Overland'}
            </div>

            <div className="text-[11px] text-slate-300 mt-1 leading-relaxed">
              {isCritical 
                ? 'Underpass submerged. Surface vehicular access blocked. Trucks routed via flyover.'
                : 'Overland transit corridor passable. Standard supply convoys moving normally.'}
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-white/10 flex items-center justify-between text-[10.5px] font-mono">
            <span className="text-slate-400">Surge Velocity:</span>
            <span className="font-bold text-white">
              {rateOfRise > 0 ? `+${rateOfRise.toFixed(1)} cm/min` : '0.0 cm/min (Stable)'}
            </span>
          </div>
        </div>
      </div>

      {/* 4. Hydrological Alert Rule Engine & Tabletop Demo Calibration Specs */}
      <div className="bg-white rounded-2xl border border-slate-200/90 p-5 shadow-2xs space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-3">
          <div>
            <h2 className="text-sm font-extrabold text-slate-900 tracking-tight flex items-center space-x-2">
              <Scale className="w-4 h-4 text-blue-600" />
              <span>Hydrological Alert Rule Engine & Tabletop Demo Calibration</span>
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Deterministic multi-sensor evaluation logic and hands-on presentation scaling specifications
            </p>
          </div>
          <span className="text-[10px] font-mono font-bold bg-amber-50 text-amber-800 border border-amber-200 px-2.5 py-0.5 rounded-full flex items-center space-x-1">
            <span>🎯</span>
            <span>Presentation Setup: Scaled 15cm Cutoff</span>
          </span>
        </div>

        {/* Tabletop Demo Rig vs Real-World Deployment Callout */}
        <div className="bg-gradient-to-r from-blue-50/80 via-slate-50 to-indigo-50/50 border border-blue-200/80 rounded-xl p-4 text-xs text-blue-950">
          <div className="flex items-start space-x-3">
            <Info className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
            <div className="space-y-2">
              <div className="font-extrabold text-sm text-slate-900">
                Why is the submergence threshold set to 15 cm in this demonstration?
              </div>
              <p className="text-slate-600 leading-relaxed text-[11.5px]">
                In live evaluator demonstrations and hackathon judging, the ESP32 IoT node operates on an indoor desk or demonstration podium. Requiring a 4.5-meter tall gantry or filling a 2-meter deep container with water is logistically impossible. To enable instant, hands-on physical verification (e.g., placing a hand, cup, or test surface near the sensor), the engine runs on a <strong>Tabletop Scaled Calibration Model</strong>.
              </p>
              
              {/* Comparative Table: Demo Rig vs Real Underpass */}
              <div className="overflow-x-auto mt-2">
                <table className="w-full text-left text-[11px] font-mono bg-white rounded-lg border border-slate-200 overflow-hidden">
                  <thead>
                    <tr className="bg-slate-100/80 text-slate-700 border-b border-slate-200 text-[10px] uppercase font-bold">
                      <th className="py-2 px-3">System Parameter</th>
                      <th className="py-2 px-3 text-blue-700">Tabletop Demo Rig (Active Now)</th>
                      <th className="py-2 px-3 text-slate-700">Real-World Underpass Deployment</th>
                      <th className="py-2 px-3 text-slate-600">Physical & Operational Rationale</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-slate-600">
                    <tr>
                      <td className="py-2 px-3 font-bold text-slate-800">Dry Sensor Height</td>
                      <td className="py-2 px-3 text-blue-700 font-semibold">50.0 cm (to desk surface)</td>
                      <td className="py-2 px-3">2.5 m - 4.5 m (underpass girder)</td>
                      <td className="py-2 px-3">HC-SR04 ultrasonic range: 2 cm to 400 cm (industrial: JSN-SR04T)</td>
                    </tr>
                    <tr>
                      <td className="py-2 px-3 font-bold text-slate-800">Critical Submergence Cutoff</td>
                      <td className="py-2 px-3 text-rose-600 font-bold">&le; 15.0 cm clearance</td>
                      <td className="py-2 px-3 text-rose-600 font-bold">&ge; 35.0 cm water depth on road</td>
                      <td className="py-2 px-3">50cm baseline - 15cm clearance = exactly 35cm simulated flood depth</td>
                    </tr>
                    <tr>
                      <td className="py-2 px-3 font-bold text-slate-800">Vehicle Stall Limit</td>
                      <td className="py-2 px-3">Simulated 35 cm water column</td>
                      <td className="py-2 px-3">35 cm - 50 cm inundation</td>
                      <td className="py-2 px-3">Tata 407 trucks and ambulances suffer exhaust backpressure stall at 35cm</td>
                    </tr>
                    <tr>
                      <td className="py-2 px-3 font-bold text-slate-800">How to Test in Demo</td>
                      <td className="py-2 px-3 text-emerald-700 font-bold">Bring hand &le;15cm to sensor</td>
                      <td className="py-2 px-3">Water rises up from river overflow</td>
                      <td className="py-2 px-3">Instantly triggers Red LED on ESP32, Alert Banner, and Map Reroute</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>

        {/* Deterministic Alert Engine Rules (NO LATEX) */}
        <div>
          <div className="text-xs font-bold text-slate-800 uppercase tracking-wider mb-2.5 flex items-center space-x-1.5">
            <Zap className="w-3.5 h-3.5 text-amber-500" />
            <span>Deterministic Rules Generating System Alerts & Dynamic Routing</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {/* Rule 1: Critical Submergence */}
            <div className="p-3.5 rounded-xl border border-rose-200 bg-rose-50/40 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-[10px] font-mono font-extrabold uppercase px-1.5 py-0.5 rounded bg-rose-200 text-rose-900">
                    Rule 1 • CRITICAL
                  </span>
                  <span className="text-[11px] font-bold font-mono text-rose-700">Clearance &le; 15.0 cm</span>
                </div>
                <div className="text-xs font-bold text-slate-900 mt-1">LBS Underpass Submerged</div>
                <p className="text-[11px] text-slate-600 mt-1 leading-relaxed">
                  Water column reaches 35.0 cm (50cm baseline - 15cm cutoff). Surface roadway impassable for relief trucks.
                </p>
              </div>
              <div className="mt-3 pt-2 border-t border-rose-200/80 text-[10.5px] font-mono text-rose-900 font-bold flex items-center space-x-1">
                <span>⚡ Action:</span>
                <span>Dynamic Reroute to BKC Elevated Flyover (+14m ASL)</span>
              </div>
            </div>

            {/* Rule 2: Rapid Inundation Surge Approach */}
            <div className="p-3.5 rounded-xl border border-amber-200 bg-amber-50/40 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-[10px] font-mono font-extrabold uppercase px-1.5 py-0.5 rounded bg-amber-200 text-amber-900">
                    Rule 2 • WARNING
                  </span>
                  <span className="text-[11px] font-bold font-mono text-amber-700">Clearance &le; 25.0 cm</span>
                </div>
                <div className="text-xs font-bold text-slate-900 mt-1">Rapid Inundation Surge</div>
                <p className="text-[11px] text-slate-600 mt-1 leading-relaxed">
                  Water clearance dropped to 25.0 cm (25cm inundation). River overflow approaching road surface.
                </p>
              </div>
              <div className="mt-3 pt-2 border-t border-amber-200/80 text-[10.5px] font-mono text-amber-900 font-bold flex items-center space-x-1">
                <span>⚠️ Action:</span>
                <span>Warm standby for flyover diversion; advisory to drivers</span>
              </div>
            </div>

            {/* Rule 3: Riverbank Soil Saturation Runoff */}
            <div className="p-3.5 rounded-xl border border-amber-200 bg-amber-50/40 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-[10px] font-mono font-extrabold uppercase px-1.5 py-0.5 rounded bg-amber-200 text-amber-900">
                    Rule 3 • WARNING
                  </span>
                  <span className="text-[11px] font-bold font-mono text-amber-700">Soil Saturation &ge; 90%</span>
                </div>
                <div className="text-xs font-bold text-slate-900 mt-1">Flash Runoff Prediction</div>
                <p className="text-[11px] text-slate-600 mt-1 leading-relaxed">
                  Ground infiltration capacity exhausted. 100% of additional precipitation converts directly to surface flood runoff.
                </p>
              </div>
              <div className="mt-3 pt-2 border-t border-amber-200/80 text-[10.5px] font-mono text-amber-900 font-bold flex items-center space-x-1">
                <span>⚠️ Action:</span>
                <span>Pre-stage emergency stock at Sector 9 Chembur high ground</span>
              </div>
            </div>

            {/* Rule 4: Elevated Soil Moisture */}
            <div className="p-3.5 rounded-xl border border-slate-200 bg-slate-50/60 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-[10px] font-mono font-extrabold uppercase px-1.5 py-0.5 rounded bg-slate-200 text-slate-800">
                    Rule 4 • WARNING
                  </span>
                  <span className="text-[11px] font-bold font-mono text-slate-700">Soil Saturation &ge; 75%</span>
                </div>
                <div className="text-xs font-bold text-slate-900 mt-1">Ground Saturation Advisory</div>
                <p className="text-[11px] text-slate-600 mt-1 leading-relaxed">
                  Riverbank soil approaching field saturation limit. Percolation slows down; upstream drainage monitored.
                </p>
              </div>
              <div className="mt-3 pt-2 border-t border-slate-200 text-[10.5px] font-mono text-slate-700 font-semibold flex items-center space-x-1">
                <span>ℹ️ Action:</span>
                <span>Increase telemetry polling and monitor upstream dam flow</span>
              </div>
            </div>

            {/* Rule 5: Surge Velocity Spike */}
            <div className="p-3.5 rounded-xl border border-slate-200 bg-slate-50/60 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-[10px] font-mono font-extrabold uppercase px-1.5 py-0.5 rounded bg-slate-200 text-slate-800">
                    Rule 5 • WARNING
                  </span>
                  <span className="text-[11px] font-bold font-mono text-slate-700">Rate of Rise &ge; 3.0 cm/min</span>
                </div>
                <div className="text-xs font-bold text-slate-900 mt-1">Flash Surge Velocity</div>
                <p className="text-[11px] text-slate-600 mt-1 leading-relaxed">
                  Water level rising faster than 3 cm per minute, indicating upstream cloudburst or sluice gate opening.
                </p>
              </div>
              <div className="mt-3 pt-2 border-t border-slate-200 text-[10.5px] font-mono text-slate-700 font-semibold flex items-center space-x-1">
                <span>ℹ️ Action:</span>
                <span>Sound acoustic alarm at Mithi barrage; notify NDRF boat teams</span>
              </div>
            </div>

            {/* Rule 6: Normal Transit Corridor */}
            <div className="p-3.5 rounded-xl border border-emerald-200 bg-emerald-50/40 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-[10px] font-mono font-extrabold uppercase px-1.5 py-0.5 rounded bg-emerald-200 text-emerald-900">
                    Rule 6 • NORMAL
                  </span>
                  <span className="text-[11px] font-bold font-mono text-emerald-700">Clearance &gt; 25cm &amp; Soil &lt; 75%</span>
                </div>
                <div className="text-xs font-bold text-slate-900 mt-1">Operational Corridors Clear</div>
                <p className="text-[11px] text-slate-600 mt-1 leading-relaxed">
                  Roadway dry and passable. Normal drainage capacity available across the entire Mithi Basin corridor.
                </p>
              </div>
              <div className="mt-3 pt-2 border-t border-emerald-200/80 text-[10.5px] font-mono text-emerald-900 font-bold flex items-center space-x-1">
                <span>✓ Action:</span>
                <span>Primary LBS Marg arterial open for all supply convoys</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 5. Live Telemetry Trend Waveform (Historical buffer of real packets) */}
      <div className="bg-white rounded-2xl border border-slate-200/90 p-5 shadow-2xs">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
          <div>
            <h2 className="text-sm font-extrabold text-slate-900 tracking-tight flex items-center space-x-2">
              <Radio className="w-4 h-4 text-blue-600" />
              <span>Real-Time Inundation Depth & Soil Saturation Waveform</span>
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Live streaming waveform from ESP32 telemetry buffer ({history.length} samples buffered)
            </p>
          </div>

          <div className="flex items-center space-x-4 text-xs font-semibold">
            <div className="flex items-center space-x-1.5">
              <span className="w-3 h-1 bg-sky-400 rounded-full" />
              <span className="text-slate-700">Inundation Depth (cm)</span>
            </div>
            <div className="flex items-center space-x-1.5">
              <span className="w-3 h-1 bg-amber-400 rounded-full" />
              <span className="text-slate-700">Soil Saturation (%)</span>
            </div>
            <div className="flex items-center space-x-1.5">
              <span className="w-3 h-0.5 border-t border-dashed border-rose-500" />
              <span className="text-rose-600 font-bold">Submerged Line (35cm Depth)</span>
            </div>
          </div>
        </div>

        {/* SVG Streaming Chart */}
        <div className="w-full h-52 bg-slate-950 rounded-xl p-3 relative overflow-hidden flex flex-col justify-between">
          {history.length > 1 ? (
            <svg className="w-full h-full overflow-visible" viewBox="0 0 600 160" preserveAspectRatio="none">
              {/* Background Grid Lines */}
              <line x1="0" y1="25" x2="600" y2="25" stroke="#1e293b" strokeWidth="1" strokeDasharray="3 3" />
              <line x1="0" y1="58" x2="600" y2="58" stroke="#1e293b" strokeWidth="1" strokeDasharray="3 3" />
              <line x1="0" y1="95" x2="600" y2="95" stroke="#1e293b" strokeWidth="1" strokeDasharray="3 3" />
              <line x1="0" y1="135" x2="600" y2="135" stroke="#1e293b" strokeWidth="1" />

              {/* 90% Soil Saturation Limit (y = 135 - (90/100)*110 = 36) */}
              <line x1="0" y1="36" x2="600" y2="36" stroke="#f59e0b" strokeWidth="1.2" strokeDasharray="4 4" opacity="0.8" />
              <rect x="8" y="27" width="165" height="18" rx="4" fill="#1e1805" stroke="#78350f" strokeWidth="1" />
              <text x="90" y="39" fill="#f59e0b" fontSize="8.5" fontWeight="bold" textAnchor="middle">90% SOIL SATURATION LIMIT</text>

              {/* 35cm Submergence Threshold Line (y = 135 - (35/50)*110 = 58) */}
              <line x1="0" y1="58" x2="600" y2="58" stroke="#ef4444" strokeWidth="1.5" strokeDasharray="4 4" />
              <rect x="420" y="49" width="170" height="18" rx="4" fill="#2d060e" stroke="#991b1b" strokeWidth="1" />
              <text x="505" y="61" fill="#f43f5e" fontSize="8.5" fontWeight="bold" textAnchor="middle">35cm SUBMERGED (&le;15cm CUTOFF • DEMO)</text>

              {/* Baseline indicator (Dry ground: 0cm depth / 0% soil) */}
              <text x="8" y="148" fill="#64748b" fontSize="8" fontFamily="monospace">0cm / 0% (Dry Baseline)</text>
              <text x="590" y="148" fill="#64748b" fontSize="8" fontFamily="monospace" textAnchor="end">Normal Flow</text>

              {/* Inundation Depth Polyline (Sky Blue: 0cm at bottom, 50cm at top) */}
              <polyline
                fill="none"
                stroke="#38bdf8"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                points={history.map((pt, idx) => {
                  const x = (idx / (history.length - 1)) * 600;
                  const c = pt.water_surface_distance_cm !== null ? Number(pt.water_surface_distance_cm) : 50.0;
                  const depth = Math.max(0, Math.min(50.0, 50.0 - c));
                  const y = 135 - (depth / 50.0) * 110;
                  return `${x},${y}`;
                }).join(' ')}
              />

              {/* Soil Saturation Polyline (Amber: 0% at bottom, 100% at top) */}
              <polyline
                fill="none"
                stroke="#fbbf24"
                strokeWidth="2"
                strokeDasharray="3 3"
                strokeLinecap="round"
                strokeLinejoin="round"
                points={history.map((pt, idx) => {
                  const x = (idx / (history.length - 1)) * 600;
                  const s = Math.max(0, Math.min(100, pt.soil_moisture_pct));
                  const y = 135 - (s / 100.0) * 110;
                  return `${x},${y}`;
                }).join(' ')}
              />
            </svg>
          ) : (
            <div className="w-full h-full flex items-center justify-center text-slate-500 text-xs font-mono">
              Waiting for streaming telemetry packets from ESP32...
            </div>
          )}

          <div className="flex justify-between text-[9px] font-mono text-slate-500 pt-1 border-t border-slate-800">
            <span>T - {history.length * 3}s</span>
            <span>ESP32-MITHI-01 Real-Time Signal Stream</span>
            <span>Live (T - 0s)</span>
          </div>
        </div>
      </div>

      {/* 5. Pure Recent Ingestion Packets Log (Full Width) */}
      <div className="bg-white rounded-2xl border border-slate-200/90 p-5 shadow-2xs">
        <div className="flex items-center justify-between mb-3 pb-2.5 border-b border-slate-100">
          <div>
            <h3 className="text-sm font-extrabold text-slate-900 tracking-tight flex items-center space-x-1.5">
              <Radio className="w-4 h-4 text-blue-600" />
              <span>Real-Time Ingestion Packets Log</span>
            </h3>
            <p className="text-[11px] text-slate-500 mt-0.5">
              Live chronological stream of physical packets processed directly from ESP32-MITHI-01
            </p>
          </div>
          <span className="text-[10px] font-mono font-bold bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full border border-blue-200">
            {history.length} Packets Buffered
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs font-mono">
            <thead>
              <tr className="border-b border-slate-200 text-slate-400 text-[10px] uppercase tracking-wider">
                <th className="pb-2 font-semibold">Time</th>
                <th className="pb-2 font-semibold">Clearance</th>
                <th className="pb-2 font-semibold">Inundation Depth</th>
                <th className="pb-2 font-semibold">Soil Saturation</th>
                <th className="pb-2 font-semibold">Meteorology</th>
                <th className="pb-2 font-semibold text-right">Derived System Alert</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {[...history].reverse().slice(0, 10).map((pt, idx) => {
                const c = pt.water_surface_distance_cm !== null ? Number(pt.water_surface_distance_cm).toFixed(1) : '--';
                const depth = pt.water_surface_distance_cm !== null ? Math.max(0, Math.round((50.0 - Number(pt.water_surface_distance_cm)) * 10) / 10).toFixed(1) : '0.0';
                const s = pt.soil_moisture_pct;
                const isSub = pt.water_surface_distance_cm !== null && Number(pt.water_surface_distance_cm) <= 15.0;
                const isWarn = pt.soil_moisture_pct >= 90 || (pt.water_surface_distance_cm !== null && Number(pt.water_surface_distance_cm) <= 25.0);

                return (
                  <tr key={idx} className="hover:bg-slate-50 transition-colors">
                    <td className="py-2.5 text-[10.5px] text-slate-500">
                      {pt.timestamp ? pt.timestamp.substring(11, 19) + ' UTC' : '--:--:--'}
                    </td>
                    <td className={`py-2.5 font-bold ${isSub ? 'text-rose-600' : 'text-slate-800'}`}>
                      {c} cm
                    </td>
                    <td className="py-2.5 text-slate-600">
                      {depth} cm
                    </td>
                    <td className={`py-2.5 font-bold ${s >= 90 ? 'text-amber-600' : 'text-slate-700'}`}>
                      {s}%
                    </td>
                    <td className="py-2.5 text-slate-500 text-[10.5px]">
                      {pt.temperature_c ?? 28}°C / {pt.humidity_pct ?? 70}%
                    </td>
                    <td className="py-2.5 text-right">
                      <span className={`text-[9.5px] font-bold px-2 py-0.5 rounded-full ${
                        isSub 
                          ? 'bg-rose-100 text-rose-700 border border-rose-200' 
                          : isWarn 
                          ? 'bg-amber-100 text-amber-800 border border-amber-200' 
                          : 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                      }`}>
                        {isSub ? '⛔ CRITICAL: SUBMERGED' : isWarn ? '⚠️ WARNING: RISK' : '✓ NORMAL: PASSABLE'}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
