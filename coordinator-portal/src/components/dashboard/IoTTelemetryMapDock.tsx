'use client';

import React, { useState } from 'react';
import { 
  Activity, 
  AlertTriangle, 
  ShieldAlert, 
  Radio, 
  ChevronDown, 
  ChevronUp, 
  ExternalLink,
  Wifi,
  Cpu,
  Layers,
  Sparkles
} from 'lucide-react';
import Link from 'next/link';
import { DisasterState, SensorTelemetryReading } from '@/lib/sensors/iotStore';

interface IoTTelemetryMapDockProps {
  telemetry: {
    latest: SensorTelemetryReading;
    disasterState: DisasterState;
    isHardwareLive: boolean;
    activeScenarioName: string;
  };
  onApplyScenario: (scenario: 'BASELINE' | 'SATURATION_WARNING' | 'SUBMERGED_CRITICAL') => void;
}

export default function IoTTelemetryMapDock({
  telemetry,
  onApplyScenario,
}: IoTTelemetryMapDockProps) {
  const [isExpanded, setIsExpanded] = useState(true);
  const [isSwitching, setIsSwitching] = useState(false);

  const { latest, disasterState, isHardwareLive, activeScenarioName } = telemetry;
  const isCritical = disasterState.level === 'CRITICAL';
  const isWarning = disasterState.level === 'WARNING';

  const handleScenarioClick = async (scenario: 'BASELINE' | 'SATURATION_WARNING' | 'SUBMERGED_CRITICAL') => {
    setIsSwitching(true);
    try {
      await onApplyScenario(scenario);
    } finally {
      setTimeout(() => setIsSwitching(false), 300);
    }
  };

  const clearanceCm = latest.water_surface_distance_cm !== null 
    ? latest.water_surface_distance_cm.toFixed(1) 
    : '46.5';
  
  const soilMoisture = latest.soil_moisture_pct;

  return (
    <div className="absolute top-3 left-1/2 -translate-x-1/2 z-30 w-[92%] sm:w-[680px] max-w-[calc(100%-24px)] pointer-events-auto">
      <div className={`backdrop-blur-md rounded-2xl border transition-all duration-300 shadow-lg ${
        isCritical
          ? 'bg-rose-950/90 border-rose-500/80 text-rose-100 shadow-rose-950/40'
          : isWarning
          ? 'bg-amber-950/90 border-amber-500/80 text-amber-100 shadow-amber-950/40'
          : 'bg-slate-900/90 border-slate-700/80 text-slate-100 shadow-slate-950/30'
      }`}>
        {/* Main Ribbon Bar */}
        <div className="px-3 py-2 flex items-center justify-between gap-2 text-xs">
          {/* Hardware & Sensor Node Label */}
          <div className="flex items-center space-x-2 shrink-0">
            <span className="relative flex h-2.5 w-2.5">
              <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${
                isCritical ? 'bg-rose-400' : isWarning ? 'bg-amber-400' : 'bg-emerald-400'
              }`} />
              <span className={`relative inline-flex rounded-full h-2.5 w-2.5 ${
                isCritical ? 'bg-rose-500' : isWarning ? 'bg-amber-500' : 'bg-emerald-500'
              }`} />
            </span>
            <div className="flex items-center space-x-1.5 font-bold tracking-tight">
              <span className="font-mono text-[11px] text-white">IOT NODE #01</span>
              <span className={`text-[9.5px] px-1.5 py-0.2 rounded font-mono uppercase tracking-wider font-extrabold ${
                isHardwareLive 
                  ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40' 
                  : 'bg-sky-500/20 text-sky-300 border border-sky-500/40'
              }`}>
                {isHardwareLive ? 'ESP32 LIVE' : 'SIMULATED'}
              </span>
            </div>
          </div>

          {/* Quick Metrics in Collapsed or Ribbon View */}
          <div className="flex items-center space-x-3 text-[11px] font-mono shrink-0">
            <div className="flex items-center space-x-1">
              <span className="text-slate-400">Clearance:</span>
              <span className={`font-bold ${
                isCritical ? 'text-rose-300 font-extrabold' : 'text-white'
              }`}>
                {clearanceCm}cm
              </span>
            </div>
            <div className="hidden sm:flex items-center space-x-1">
              <span className="text-slate-400">Soil:</span>
              <span className={`font-bold ${
                soilMoisture >= 90 ? 'text-amber-300' : 'text-white'
              }`}>
                {soilMoisture}%
              </span>
            </div>
          </div>

          {/* Route Status Tag */}
          <div className="hidden md:flex items-center space-x-1 truncate max-w-[210px]">
            {isCritical ? (
              <span className="inline-flex items-center space-x-1 text-[10px] font-bold text-rose-300 bg-rose-500/20 px-2 py-0.5 rounded-full border border-rose-500/40 truncate">
                <ShieldAlert className="w-3 h-3 text-rose-400 shrink-0" />
                <span className="truncate">Reroute: BKC Bypass</span>
              </span>
            ) : isWarning ? (
              <span className="inline-flex items-center space-x-1 text-[10px] font-bold text-amber-300 bg-amber-500/20 px-2 py-0.5 rounded-full border border-amber-500/40 truncate">
                <AlertTriangle className="w-3 h-3 text-amber-400 shrink-0" />
                <span className="truncate">Runoff Risk &gt;90%</span>
              </span>
            ) : (
              <span className="inline-flex items-center space-x-1 text-[10px] font-bold text-emerald-300 bg-emerald-500/20 px-2 py-0.5 rounded-full border border-emerald-500/40 truncate">
                <span>✓ LBS Route Clear</span>
              </span>
            )}
          </div>

          {/* Actions & Expand Toggle */}
          <div className="flex items-center space-x-1 shrink-0">
            <Link
              href="/sensors"
              className="text-[11px] font-bold px-2 py-0.5 rounded-lg bg-white/10 hover:bg-white/20 text-white flex items-center space-x-1 transition-colors"
              title="Open Dedicated Early Warning Telemetry Console"
            >
              <span>Hub</span>
              <ExternalLink className="w-3 h-3" />
            </Link>

            <button
              onClick={() => setIsExpanded(!isExpanded)}
              className="p-1 rounded-lg text-slate-300 hover:text-white hover:bg-white/10 transition-colors"
              title={isExpanded ? 'Collapse Dock' : 'Expand Tactical Controls'}
            >
              {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            </button>
          </div>
        </div>

        {/* Expanded Tactical Drawer */}
        {isExpanded && (
          <div className="px-3 pb-3 pt-1 border-t border-white/10 text-xs">
            {/* Headline Banner */}
            <div className="mb-2.5 flex items-start justify-between gap-2">
              <div>
                <div className="text-[11.5px] font-bold flex items-center gap-1.5">
                  <span>{disasterState.headline}</span>
                </div>
                <div className="text-[10.5px] text-slate-300/90 leading-tight mt-0.5">
                  {disasterState.action}
                </div>
              </div>
            </div>

            {/* Live Metrics Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-3">
              {/* Metric 1: Ultrasonic Distance */}
              <div className="bg-black/30 rounded-xl p-2 border border-white/10">
                <div className="text-[10px] text-slate-400 flex items-center justify-between">
                  <span>Underpass Clearance</span>
                  <span className="text-[9px] font-mono">HC-SR04</span>
                </div>
                <div className="text-base font-extrabold font-mono mt-0.5 text-white flex items-baseline gap-1">
                  <span>{clearanceCm}</span>
                  <span className="text-[10px] text-slate-400 font-normal">cm</span>
                </div>
                <div className="text-[9px] text-slate-300 mt-0.5">
                  {isCritical ? '⛔ Submerged (<15cm)' : 'Passable clearance'}
                </div>
              </div>

              {/* Metric 2: Water Depth Inundation */}
              <div className="bg-black/30 rounded-xl p-2 border border-white/10">
                <div className="text-[10px] text-slate-400 flex items-center justify-between">
                  <span>Tarmac Inundation</span>
                  <span className="text-[9px] font-mono">Flood Rise</span>
                </div>
                <div className="text-base font-extrabold font-mono mt-0.5 text-white flex items-baseline gap-1">
                  <span>{disasterState.waterDepthCm.toFixed(1)}</span>
                  <span className="text-[10px] text-slate-400 font-normal">cm</span>
                </div>
                <div className="text-[9px] text-slate-300 mt-0.5">
                  Rate: +{disasterState.rateOfRiseCmPerMin} cm/min
                </div>
              </div>

              {/* Metric 3: Soil Moisture Saturation */}
              <div className="bg-black/30 rounded-xl p-2 border border-white/10">
                <div className="text-[10px] text-slate-400 flex items-center justify-between">
                  <span>Riverbank Saturation</span>
                  <span className="text-[9px] font-mono">Soil ADC</span>
                </div>
                <div className="text-base font-extrabold font-mono mt-0.5 text-white flex items-baseline gap-1">
                  <span>{soilMoisture}</span>
                  <span className="text-[10px] text-slate-400 font-normal">%</span>
                </div>
                <div className="text-[9px] text-slate-300 mt-0.5">
                  {soilMoisture >= 90 ? '⚠️ Hyper-saturated' : 'Field capacity safe'}
                </div>
              </div>

              {/* Metric 4: Ambient Weather */}
              <div className="bg-black/30 rounded-xl p-2 border border-white/10">
                <div className="text-[10px] text-slate-400 flex items-center justify-between">
                  <span>Ambient Weather</span>
                  <span className="text-[9px] font-mono">DHT11</span>
                </div>
                <div className="text-base font-extrabold font-mono mt-0.5 text-white flex items-baseline gap-1">
                  <span>{latest.temperature_c ?? 28}°C</span>
                  <span className="text-[10px] text-slate-400 font-normal">/ {latest.humidity_pct ?? 75}%</span>
                </div>
                <div className="text-[9px] text-slate-300 mt-0.5">
                  {latest.humidity_pct && latest.humidity_pct > 88 ? '⛈️ Torrential Rain' : 'Overcast'}
                </div>
              </div>
            </div>

            {/* Dynamic Safe Route Recommendation Bar */}
            <div className={`p-2 rounded-xl border flex items-center justify-between gap-2 mb-2.5 ${
              isCritical
                ? 'bg-rose-500/20 border-rose-500/50 text-rose-100'
                : 'bg-emerald-500/20 border-emerald-500/50 text-emerald-100'
            }`}>
              <div className="flex items-center space-x-2">
                <Layers className={`w-4 h-4 ${isCritical ? 'text-rose-400' : 'text-emerald-400'}`} />
                <div className="text-[11px]">
                  <span className="font-bold">Active Fleet Routing: </span>
                  <span className="font-mono underline">
                    {isCritical ? 'BKC Elevated Bypass (+14m ASL)' : 'LBS Marg Primary Arterial'}
                  </span>
                </div>
              </div>
              <span className="text-[10px] font-extrabold px-2 py-0.5 rounded bg-black/40">
                {isCritical ? 'SAFE REROUTE ACTIVE' : 'OPEN'}
              </span>
            </div>

            {/* Quick Demo Simulator Bar for Hackathon Presentation */}
            <div className="pt-2 border-t border-white/10 flex flex-wrap items-center justify-between gap-1.5 text-[11px]">
              <span className="text-slate-400 font-bold flex items-center gap-1">
                <Sparkles className="w-3 h-3 text-amber-400" />
                <span>Demo Simulator:</span>
              </span>
              <div className="flex items-center space-x-1.5">
                <button
                  disabled={isSwitching}
                  onClick={() => handleScenarioClick('BASELINE')}
                  className={`px-2 py-1 rounded-md text-[10.5px] font-bold transition-all ${
                    activeScenarioName === 'BASELINE'
                      ? 'bg-emerald-500 text-slate-950 shadow-sm'
                      : 'bg-white/10 hover:bg-white/20 text-slate-200'
                  }`}
                >
                  🟢 Normal Flow
                </button>
                <button
                  disabled={isSwitching}
                  onClick={() => handleScenarioClick('SATURATION_WARNING')}
                  className={`px-2 py-1 rounded-md text-[10.5px] font-bold transition-all ${
                    activeScenarioName === 'SATURATION_WARNING'
                      ? 'bg-amber-500 text-slate-950 shadow-sm'
                      : 'bg-white/10 hover:bg-white/20 text-slate-200'
                  }`}
                >
                  🟡 Saturation Risk (&gt;90%)
                </button>
                <button
                  disabled={isSwitching}
                  onClick={() => handleScenarioClick('SUBMERGED_CRITICAL')}
                  className={`px-2 py-1 rounded-md text-[10.5px] font-bold transition-all ${
                    activeScenarioName === 'SUBMERGED_CRITICAL'
                      ? 'bg-rose-500 text-white shadow-sm'
                      : 'bg-white/10 hover:bg-white/20 text-slate-200'
                  }`}
                >
                  🔴 Submerged Underpass (&lt;15cm)
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
