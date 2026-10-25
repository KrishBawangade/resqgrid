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
  Info
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
  const [currentLocalClock, setCurrentLocalClock] = useState<string>('');

  // 1. Live real-time clock ticking every second
  useEffect(() => {
    const update = () => {
      setCurrentLocalClock(
        new Date().toLocaleTimeString([], { 
          hour: '2-digit', 
          minute: '2-digit', 
          second: '2-digit', 
          hour12: true 
        })
      );
    };
    update();
    const clockInterval = setInterval(update, 1000);
    return () => clearInterval(clockInterval);
  }, []);

  // 2. Initial Load & Persistent SSE Real-time Stream
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

  // 3. Relative time counter for heartbeat
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

  const isInitialLoading = telemetry === null;

  // Filter and sort readings: show current (HARDWARE_LIVE) readings only if available; if not, show previous readings
  const rawHistory = telemetry?.history || [];
  const hardwareReadings = rawHistory.filter((r) => r.data_source === 'HARDWARE_LIVE');
  const hasCurrentHardware = hardwareReadings.length > 0;
  const activeHistory = hasCurrentHardware ? hardwareReadings : rawHistory;

  // Sorted newest first for the packets log table (current readings at the top)
  const sortedTableReadings = [...activeHistory].sort(
    (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  );

  // Sorted chronologically for waveform chart (oldest to newest, left to right)
  const sortedChartReadings = [...activeHistory].sort(
    (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
  );

  const activeLatest = hasCurrentHardware
    ? sortedTableReadings[0]
    : telemetry?.latest;

  const disasterState = telemetry?.disasterState;
  const isHardwareLive = telemetry?.isHardwareLive || false;

  const isCritical = disasterState?.level === 'CRITICAL';
  const isWarning = disasterState?.level === 'WARNING';

  const clearanceVal = activeLatest?.water_surface_distance_cm !== null && activeLatest?.water_surface_distance_cm !== undefined
    ? Number(activeLatest.water_surface_distance_cm)
    : 45.0;

  const soilVal = activeLatest?.soil_moisture_pct ?? 0;
  const tempVal = activeLatest?.temperature_c ?? 28.5;
  const humVal = activeLatest?.humidity_pct ?? 70.0;
  const waterDepthVal = disasterState?.waterDepthCm ?? Math.max(0, Math.round((50.0 - clearanceVal) * 10) / 10);
  const rateOfRise = disasterState?.rateOfRiseCmPerMin ?? 0;
  const activeRoute = disasterState?.activeRoute ?? 'PRIMARY_LBS_CORRIDOR';

  // Derived alerts based on real telemetry numbers
  const isSubmerged = clearanceVal <= 15.0;
  const isWaterRising = clearanceVal <= 25.0 && clearanceVal > 15.0;
  const isSoilCritical = soilVal >= 90;
  const isSoilElevated = soilVal >= 75 && soilVal < 90;

  // Helper to format packet timestamp into current local time, UTC, and relative time
  const formatReadingTime = (timestamp?: string) => {
    if (!timestamp) return { local: '--:--:--', utc: '--:--:--', relative: '' };
    const d = new Date(timestamp);
    if (isNaN(d.getTime())) return { local: timestamp, utc: timestamp, relative: '' };

    const local = d.toLocaleTimeString([], { 
      hour: '2-digit', 
      minute: '2-digit', 
      second: '2-digit',
      hour12: true 
    });
    const utc = timestamp.length >= 19 ? timestamp.substring(11, 19) : d.toISOString().substring(11, 19);

    const diffSec = Math.max(0, Math.floor((Date.now() - d.getTime()) / 1000));
    let relative = 'Just now';
    if (diffSec >= 60) {
      const diffMin = Math.floor(diffSec / 60);
      relative = `${diffMin}m ago`;
    } else if (diffSec > 2) {
      relative = `${diffSec}s ago`;
    }

    return { local, utc, relative };
  };

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
                isInitialLoading
                  ? 'bg-slate-100 text-slate-600 border-slate-300 animate-pulse'
                  : isHardwareLive 
                  ? 'bg-emerald-50 text-emerald-700 border-emerald-300 ring-2 ring-emerald-100' 
                  : 'bg-amber-50 text-amber-700 border-amber-300'
              }`}>
                <span className={`w-2 h-2 rounded-full ${isInitialLoading ? 'bg-slate-400' : isHardwareLive ? 'bg-emerald-500 animate-ping' : 'bg-amber-500'}`} />
                <span>
                  {isInitialLoading 
                    ? '○ Connecting Telemetry Stream...' 
                    : isHardwareLive 
                    ? '● Live Hardware Streaming' 
                    : '○ Standby / Listening'}
                </span>
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
            </div>
          </div>

          <div className="flex flex-col sm:items-end gap-1.5 text-xs font-mono">
            <div className="flex flex-wrap items-center gap-2 bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1 text-[11px] text-slate-700">
              <span className="flex items-center space-x-1 font-bold text-slate-900">
                <Clock className="w-3.5 h-3.5 text-blue-600" />
                <span>Clock: <strong>{currentLocalClock || 'Connecting...'}</strong></span>
              </span>
              <span className="text-slate-300">|</span>
              <span>Heartbeat: <strong>{isInitialLoading ? 'Connecting...' : timeSinceLastPacket}</strong></span>
            </div>
            <div className="text-[10px] text-slate-500">
              Sensor ID: <strong>{activeLatest?.sensor_id || 'ESP32-MITHI-01'}</strong> • Transmission Interval: <strong>3000ms</strong>
            </div>
          </div>
        </div>
      </div>

      {/* 2. Primary Real-Time Disaster Alert Banner */}
      {isInitialLoading ? (
        <div className="p-5 rounded-2xl border border-slate-200 bg-white shadow-2xs h-24 flex items-center justify-between animate-pulse">
          <div className="flex items-center space-x-3.5">
            <div className="w-10 h-10 rounded-xl bg-slate-100" />
            <div className="space-y-2">
              <div className="h-5 w-64 bg-slate-200 rounded" />
              <div className="h-3.5 w-96 max-w-full bg-slate-100 rounded" />
            </div>
          </div>
          <div className="h-8 w-36 bg-slate-100 rounded-lg" />
        </div>
      ) : (
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
      )}

      {/* 3. Four Core Real-Time Hardware Metric Gauges */}
      {isInitialLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { label: 'HC-SR04 Clearance', icon: Activity },
            { label: 'Soil Saturation', icon: Droplets },
            { label: 'Meteorology', icon: Thermometer },
            { label: 'Convoy Routing', icon: Layers },
          ].map((item, idx) => (
            <div
              key={idx}
              className="bg-white rounded-2xl border border-slate-200/90 p-4 shadow-2xs h-48 flex flex-col justify-between animate-pulse"
            >
              <div>
                <div className="flex items-center justify-between">
                  <div className="h-3.5 w-24 bg-slate-200 rounded" />
                  <div className="h-3 w-12 bg-slate-100 rounded" />
                </div>
                <div className="mt-3 space-y-2">
                  <div className="h-8 w-20 bg-slate-200 rounded-lg" />
                  <div className="h-3 w-36 bg-slate-100 rounded" />
                </div>
              </div>
              <div className="pt-3 border-t border-slate-100">
                <div className="h-2.5 w-full bg-slate-100 rounded-full" />
              </div>
            </div>
          ))}
        </div>
      ) : (
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
                <span>Cutoff &le;15cm represents 35cm flood depth (vehicle wading limit).</span>
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
                    isSoilCritical ? 'bg-rose-500' : isSoilElevated ? 'bg-amber-500' : 'bg-emerald-500'
                  }`}
                  style={{ width: `${Math.max(5, Math.min(100, soilVal))}%` }}
                />
              </div>
            </div>
          </div>

          {/* Gauge 3: Ambient Weather (DHT11) */}
          <div className="bg-white rounded-2xl border border-slate-200/90 p-4 shadow-2xs flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between text-xs text-slate-500 mb-2">
                <span className="font-semibold flex items-center space-x-1.5">
                  <Thermometer className="w-3.5 h-3.5 text-indigo-600" />
                  <span>Station Meteorology</span>
                </span>
                <span className="font-mono text-[10px] bg-slate-100 px-1.5 py-0.2 rounded text-slate-600 font-bold">DHT11</span>
              </div>

              <div className="flex items-baseline space-x-2">
                <span className="text-3xl font-black font-mono tracking-tight text-slate-900">
                  {tempVal.toFixed(1)}
                </span>
                <span className="text-xs font-semibold text-slate-500">°C Temperature</span>
              </div>

              <div className="text-xs text-slate-600 mt-1">
                Relative Humidity: <strong className="text-slate-800">{humVal.toFixed(1)}%</strong>
              </div>
            </div>

            <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-[10.5px]">
              <span className="text-slate-500 font-mono">Microcontroller GPIO 4</span>
              <span className="text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded font-mono font-semibold flex items-center space-x-1 border border-emerald-200">
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
      )}

      {/* 4. Live Telemetry Trend Waveform */}
      <div className="bg-white rounded-2xl border border-slate-200/90 p-5 shadow-2xs">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
          <div>
            <h2 className="text-sm font-extrabold text-slate-900 tracking-tight flex items-center space-x-2">
              <Radio className="w-4 h-4 text-blue-600" />
              <span>Real-Time Inundation Depth & Soil Saturation Waveform</span>
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Live streaming waveform from ESP32 telemetry buffer ({sortedChartReadings.length} {hasCurrentHardware ? 'live hardware' : 'buffered'} samples)
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
          {sortedChartReadings.length > 0 ? (
            <svg className="w-full h-full overflow-visible" viewBox="0 0 600 160" preserveAspectRatio="none">
              {/* Background Grid Lines */}
              <line x1="0" y1="25" x2="600" y2="25" stroke="#1e293b" strokeWidth="1" strokeDasharray="3 3" />
              <line x1="0" y1="95" x2="600" y2="95" stroke="#1e293b" strokeWidth="1" strokeDasharray="3 3" />
              <line x1="0" y1="135" x2="600" y2="135" stroke="#1e293b" strokeWidth="1" />

              {/* 90% Soil Saturation Limit (y = 135 - (90/100)*110 = 36) - dashed line starts after the badge */}
              <line x1="182" y1="36" x2="600" y2="36" stroke="#f59e0b" strokeWidth="1.2" strokeDasharray="4 4" opacity="0.8" />

              {/* 35cm Submergence Threshold Line (y = 135 - (35/50)*110 = 58) - dashed red line stops cleanly before the badge */}
              <line x1="0" y1="58" x2="470" y2="58" stroke="#ef4444" strokeWidth="1.5" strokeDasharray="4 4" />

              {/* Inundation Depth Polyline (Sky Blue: 0cm at bottom, 50cm at top) */}
              <polyline
                fill="none"
                stroke="#38bdf8"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                points={
                  sortedChartReadings.length === 1
                    ? (() => {
                        const c = sortedChartReadings[0].water_surface_distance_cm !== null ? Number(sortedChartReadings[0].water_surface_distance_cm) : 50.0;
                        const depth = Math.max(0, Math.min(50.0, 50.0 - c));
                        const y = 135 - (depth / 50.0) * 110;
                        return `0,${y} 600,${y}`;
                      })()
                    : sortedChartReadings.map((pt, idx) => {
                        const x = (idx / (sortedChartReadings.length - 1)) * 600;
                        const c = pt.water_surface_distance_cm !== null ? Number(pt.water_surface_distance_cm) : 50.0;
                        const depth = Math.max(0, Math.min(50.0, 50.0 - c));
                        const y = 135 - (depth / 50.0) * 110;
                        return `${x},${y}`;
                      }).join(' ')
                }
              />

              {/* Soil Saturation Polyline (Amber: 0% at bottom, 100% at top) */}
              <polyline
                fill="none"
                stroke="#fbbf24"
                strokeWidth="2"
                strokeDasharray="3 3"
                strokeLinecap="round"
                strokeLinejoin="round"
                points={
                  sortedChartReadings.length === 1
                    ? (() => {
                        const s = Math.max(0, Math.min(100, sortedChartReadings[0].soil_moisture_pct));
                        const y = 135 - (s / 100.0) * 110;
                        return `0,${y} 600,${y}`;
                      })()
                    : sortedChartReadings.map((pt, idx) => {
                        const x = (idx / (sortedChartReadings.length - 1)) * 600;
                        const s = Math.max(0, Math.min(100, pt.soil_moisture_pct));
                        const y = 135 - (s / 100.0) * 110;
                        return `${x},${y}`;
                      }).join(' ')
                }
              />

              {/* 90% Soil Saturation Badge (Overlay: Left Aligned) */}
              <rect x="8" y="27" width="166" height="18" rx="4" fill="#1e1805" stroke="#78350f" strokeWidth="1" />
              <text x="91" y="39.5" fill="#f59e0b" fontSize="8.5" fontWeight="bold" textAnchor="middle">90% SOIL SATURATION LIMIT</text>

              {/* 35cm Submergence Threshold Badge (Overlay: Right Aligned with gap-only line connector) */}
              <rect x="478" y="49" width="114" height="18" rx="4" fill="#2d060e" stroke="#991b1b" strokeWidth="1" />
              <text x="535" y="61.5" fill="#f43f5e" fontSize="8.5" fontWeight="bold" textAnchor="middle">35cm SUBMERGED</text>

              {/* Baseline indicator (Dry ground: 0cm depth / 0% soil) */}
              <text x="8" y="148" fill="#64748b" fontSize="8" fontFamily="monospace">0cm / 0% (Dry Baseline)</text>
              <text x="590" y="148" fill="#64748b" fontSize="8" fontFamily="monospace" textAnchor="end">Normal Flow</text>
            </svg>
          ) : (
            <div className="w-full h-full flex items-center justify-center text-slate-500 text-xs font-mono">
              Waiting for streaming telemetry packets from ESP32...
            </div>
          )}

          <div className="flex justify-between text-[9px] font-mono text-slate-500 pt-1 border-t border-slate-800">
            <span>
              {sortedChartReadings.length > 0 && sortedChartReadings[0].timestamp
                ? `T - ${sortedChartReadings.length * 3}s (${formatReadingTime(sortedChartReadings[0].timestamp).local})`
                : `T - ${sortedChartReadings.length * 3}s`}
            </span>
            <span>ESP32-MITHI-01 Real-Time Signal Stream</span>
            <span>
              Live: {currentLocalClock || 'T - 0s'}
            </span>
          </div>
        </div>
      </div>

      {/* 5. Recent Ingestion Packets Log */}
      <div className="bg-white rounded-2xl border border-slate-200/90 p-5 shadow-2xs">
        <div className="flex items-center justify-between mb-3 pb-2.5 border-b border-slate-100">
          <div>
            <h3 className="text-sm font-extrabold text-slate-900 tracking-tight flex items-center space-x-1.5">
              <Radio className="w-4 h-4 text-blue-600" />
              <span>Real-Time Ingestion Packets Log</span>
            </h3>
            <p className="text-[11px] text-slate-500 mt-0.5">
              {hasCurrentHardware
                ? 'Displaying current physical packets processed directly from ESP32-MITHI-01'
                : 'Displaying previous calibrated telemetry packets (awaiting live ESP32 stream)'}
            </p>
          </div>
          <div className="flex items-center space-x-2">
            <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded-full border ${
              hasCurrentHardware
                ? 'bg-emerald-50 text-emerald-700 border-emerald-300 ring-2 ring-emerald-100'
                : 'bg-blue-50 text-blue-700 border-blue-200'
            }`}>
              {hasCurrentHardware ? '● Current Readings' : '○ Previous Readings'}
            </span>
            <span className="text-[10px] font-mono font-bold bg-slate-100 text-slate-700 px-2 py-0.5 rounded-full border border-slate-200">
              {sortedTableReadings.length} Packets
            </span>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs font-mono">
            <thead>
              <tr className="border-b border-slate-200 text-slate-400 text-[10px] uppercase tracking-wider">
                <th className="pb-2 font-semibold">Time (Current Local & UTC)</th>
                <th className="pb-2 font-semibold">Clearance</th>
                <th className="pb-2 font-semibold">Inundation Depth</th>
                <th className="pb-2 font-semibold">Soil Saturation</th>
                <th className="pb-2 font-semibold">Meteorology</th>
                <th className="pb-2 font-semibold text-right">Derived System Alert</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {isInitialLoading ? (
                [1, 2, 3, 4, 5].map((i) => (
                  <tr key={i} className="animate-pulse">
                    <td className="py-2.5"><div className="h-3 w-28 bg-slate-200 rounded" /></td>
                    <td className="py-2.5"><div className="h-3 w-12 bg-slate-200 rounded" /></td>
                    <td className="py-2.5"><div className="h-3 w-12 bg-slate-200 rounded" /></td>
                    <td className="py-2.5"><div className="h-3 w-10 bg-slate-200 rounded" /></td>
                    <td className="py-2.5"><div className="h-3 w-20 bg-slate-200 rounded" /></td>
                    <td className="py-2.5 text-right"><div className="h-5 w-24 bg-slate-200 rounded-full ml-auto" /></td>
                  </tr>
                ))
              ) : sortedTableReadings.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-6 text-center text-xs text-slate-400 font-mono">
                    Zero telemetry packets in buffer. Waiting for sensor transmissions...
                  </td>
                </tr>
              ) : (
                sortedTableReadings.slice(0, 15).map((pt, idx) => {
                  const c = pt.water_surface_distance_cm !== null ? Number(pt.water_surface_distance_cm).toFixed(1) : '--';
                  const depth = pt.water_surface_distance_cm !== null ? Math.max(0, Math.round((50.0 - Number(pt.water_surface_distance_cm)) * 10) / 10).toFixed(1) : '0.0';
                  const s = pt.soil_moisture_pct;
                  const isSub = pt.water_surface_distance_cm !== null && Number(pt.water_surface_distance_cm) <= 15.0;
                  const isWarn = pt.soil_moisture_pct >= 90 || (pt.water_surface_distance_cm !== null && Number(pt.water_surface_distance_cm) <= 25.0);
                  const isLive = pt.data_source === 'HARDWARE_LIVE';
                  const timeData = formatReadingTime(pt.timestamp);

                  return (
                    <tr key={idx} className="hover:bg-slate-50 transition-colors">
                      <td className="py-2.5 text-[10.5px]">
                        <div className="flex items-center space-x-2">
                          <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${isLive ? 'bg-emerald-500 animate-pulse' : 'bg-slate-400'}`} />
                          <div>
                            <div className="flex items-center space-x-1.5">
                              <span className="font-extrabold font-mono text-slate-900 text-[11px]">
                                {timeData.local}
                              </span>
                              {timeData.relative && (
                                <span className="text-[9.5px] font-mono text-blue-700 bg-blue-50 px-1 py-0.2 rounded font-semibold border border-blue-200">
                                  {timeData.relative}
                                </span>
                              )}
                            </div>
                            <span className="text-[9.5px] font-mono text-slate-400 block mt-0.5">
                              {timeData.utc} UTC
                            </span>
                          </div>
                        </div>
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
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
