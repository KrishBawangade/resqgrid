'use client';

import React, { useEffect, useRef, useState } from 'react';
import { ReliefRequest, ReliefDepot } from '@/lib/types';
import { Layers, RotateCcw, AlertTriangle, ShieldCheck } from 'lucide-react';

interface InteractiveDisasterMapProps {
  requests: ReliefRequest[];
  depots: ReliefDepot[];
  selectedRequestId: string | null;
  onSelectRequest: (req: ReliefRequest) => void;
}

// 1. Primary Flash Flood Inundation Corridor Polygon (Sector 4 River Basin)
const FLOOD_INUNDATION_ZONE: [number, number][] = [
  [34.0670, -118.2340],
  [34.0620, -118.2215],
  [34.0545, -118.2155],
  [34.0435, -118.2175],
  [34.0340, -118.2260],
  [34.0325, -118.2345],
  [34.0395, -118.2380],
  [34.0470, -118.2315],
  [34.0545, -118.2310],
  [34.0615, -118.2370],
];

// 2. Secondary Evacuation Alert & Debris Perimeter Buffer
const EVACUATION_BUFFER_ZONE: [number, number][] = [
  [34.0735, -118.2430],
  [34.0665, -118.2120],
  [34.0515, -118.2040],
  [34.0375, -118.2080],
  [34.0255, -118.2240],
  [34.0260, -118.2440],
  [34.0415, -118.2480],
  [34.0600, -118.2480],
];

export default function InteractiveDisasterMap({
  requests,
  depots,
  selectedRequestId,
  onSelectRequest,
}: InteractiveDisasterMapProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const leafletModuleRef = useRef<any>(null);
  const requestMarkersRef = useRef<{ [id: string]: any }>({});
  const hazardLayersGroupRef = useRef<any>(null);
  const depotRadiiGroupRef = useRef<any>(null);

  const [showHazardZone, setShowHazardZone] = useState(true);
  const [showDepotRadii, setShowDepotRadii] = useState(true);

  // Initialize Map
  useEffect(() => {
    if (typeof window === 'undefined' || !mapContainerRef.current) return;

    let isMounted = true;

    import('leaflet').then((L) => {
      if (!isMounted || !mapContainerRef.current) return;
      leafletModuleRef.current = L;

      // Clean up previous instance if any
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }

      // Initialize map
      const map = L.map(mapContainerRef.current, {
        center: [34.053, -118.235],
        zoom: 13,
        zoomControl: false,
      });

      L.control.zoom({ position: 'bottomright' }).addTo(map);

      // Humanitarian OpenStreetMap (HOT) - Zero API Key, Zero Watermarks
      L.tileLayer('https://{s}.tile.openstreetmap.fr/hot/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap contributors, Humanitarian OpenStreetMap Team',
        maxZoom: 19,
      }).addTo(map);

      mapInstanceRef.current = map;

      // Initialize layer groups
      const hazardGroup = L.layerGroup().addTo(map);
      hazardLayersGroupRef.current = hazardGroup;

      const depotRadiiGroup = L.layerGroup().addTo(map);
      depotRadiiGroupRef.current = depotRadiiGroup;

      // 1. Draw Affected Disaster Hazard Polygons
      // Outer Evacuation Warning Perimeter
      const bufferPolygon = L.polygon(EVACUATION_BUFFER_ZONE, {
        color: '#f59e0b',
        weight: 1.5,
        dashArray: '4, 8',
        fillColor: '#fbbf24',
        fillOpacity: 0.08,
      }).addTo(hazardGroup);

      bufferPolygon.bindTooltip(
        '<div class="font-bold text-amber-700">⚠️ Advisory Evacuation Perimeter</div><div class="text-[10px] text-slate-600">Secondary flash surge monitoring zone</div>',
        { sticky: true }
      );

      // Core Flood Inundation Corridor (High Danger)
      const floodPolygon = L.polygon(FLOOD_INUNDATION_ZONE, {
        color: '#ef4444',
        weight: 2.5,
        dashArray: '6, 6',
        fillColor: '#0284c7',
        fillOpacity: 0.22,
      }).addTo(hazardGroup);

      floodPolygon.bindTooltip(
        '<div class="font-bold text-rose-700">🚨 Sector 4 Flood Inundation Zone</div><div class="text-[10px] text-slate-600">Level 4 Flash Hazard • Overland transport severed (Boat/Air only)</div>',
        { sticky: true }
      );

      // Centered Hazard Area Watermark Badge on Map
      const hazardLabelIcon = L.divIcon({
        className: 'custom-hazard-label',
        html: `
          <div style="
            background: rgba(255, 255, 255, 0.92);
            backdrop-filter: blur(4px);
            border: 1.5px solid #ef4444;
            color: #b91c1c;
            padding: 3px 9px;
            border-radius: 9999px;
            font-size: 10.5px;
            font-weight: 800;
            letter-spacing: 0.02em;
            display: flex;
            align-items: center;
            gap: 5px;
            box-shadow: 0 4px 10px rgba(239, 68, 68, 0.2);
            pointer-events: none;
            white-space: nowrap;
          ">
            <span style="display: inline-block; width: 7px; height: 7px; border-radius: 50%; background: #ef4444; animation: pulse 1.5s infinite;"></span>
            SECTOR 4 FLOOD CORRIDOR
          </div>
        `,
        iconSize: [180, 26],
        iconAnchor: [90, 13],
      });
      L.marker([34.0510, -118.2255], { icon: hazardLabelIcon, interactive: false }).addTo(hazardGroup);

      // 2. Add Depots & Coverage Radii
      depots.forEach((depot) => {
        // Depot Service Radius Ring
        const serviceRadius = depot.id === 'DEPOT-ALPHA' ? 1400 : 1600;
        L.circle([depot.lat, depot.lng], {
          radius: serviceRadius,
          color: '#38bdf8',
          weight: 1.2,
          dashArray: '3, 6',
          fillColor: '#0284c7',
          fillOpacity: 0.04,
        }).addTo(depotRadiiGroup);

        const shortName = depot.id === 'DEPOT-ALPHA' ? 'Alpha Hub' : 'Beta Hub';
        const waterStock = depot.inventory.drinking_water.availableStock;
        const stockBadgeColor = waterStock < 100 ? '#e11d48' : '#059669';

        const depotIcon = L.divIcon({
          className: 'custom-depot-pin',
          html: `
            <div style="display: flex; flex-direction: column; align-items: center; cursor: pointer;">
              <!-- Tactical Pill Header -->
              <div style="
                background: #0f172a;
                color: #ffffff;
                border: 1.5px solid #38bdf8;
                border-radius: 6px;
                padding: 3px 8px;
                font-size: 10px;
                font-weight: 700;
                display: flex;
                align-items: center;
                gap: 5px;
                box-shadow: 0 4px 12px rgba(15, 23, 42, 0.35);
                white-space: nowrap;
              ">
                <span style="font-size: 11px;">🏢</span>
                <span>${shortName}</span>
                <span style="
                  background: ${stockBadgeColor};
                  color: #ffffff;
                  padding: 1px 5px;
                  border-radius: 4px;
                  font-size: 9.5px;
                  font-weight: 800;
                ">${waterStock}L</span>
              </div>
              <!-- Pin Pointer Needle -->
              <div style="
                width: 0;
                height: 0;
                border-left: 5px solid transparent;
                border-right: 5px solid transparent;
                border-top: 6px solid #0f172a;
                margin-top: -1px;
              "></div>
              <!-- Ground Dot -->
              <div style="
                width: 6px;
                height: 6px;
                border-radius: 50%;
                background: #38bdf8;
                box-shadow: 0 0 6px #38bdf8;
                margin-top: -1px;
              "></div>
            </div>
          `,
          iconSize: [110, 36],
          iconAnchor: [55, 34],
        });

        const marker = L.marker([depot.lat, depot.lng], { icon: depotIcon }).addTo(map);
        marker.bindPopup(`
          <div style="font-size: 12px; font-family: sans-serif; min-width: 180px; padding: 2px;">
            <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 4px;">
              <span style="font-weight: 800; color: #0f172a; font-size: 13px;">${depot.name}</span>
            </div>
            <div style="color: #64748b; font-size: 11px; margin-bottom: 8px;">
              Zone: <strong style="color: #0f172a;">${depot.zoneName}</strong>
            </div>
            <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 6px 8px; font-size: 11px; line-height: 1.5;">
              <div>💧 Drinking Water: <strong style="color: ${waterStock < 100 ? '#e11d48' : '#0f172a'};">${waterStock} / ${depot.inventory.drinking_water.totalCapacity} L</strong></div>
              <div>🍞 Food Rations: <strong>${depot.inventory.food_rations.availableStock} Packs</strong></div>
              <div>🩹 Medical Kits: <strong>${depot.inventory.medical_supplies.availableStock} Kits</strong></div>
              <div>⛺ Shelter Kits: <strong>${depot.inventory.shelter_kits.availableStock} Tents</strong></div>
            </div>
          </div>
        `);
      });

      // 3. Add Incident / Relief Request Pins (Active requests only)
      requestMarkersRef.current = {};

      requests
        .filter((r) => r.requestStatus !== 'rejected')
        .forEach((req) => {
          const isCritical = req.priorityScore >= 85;
        const isHigh = req.priorityScore >= 70 && req.priorityScore < 85;
        const color = isCritical ? '#e11d48' : isHigh ? '#d97706' : '#2563eb';
        const isSelected = selectedRequestId === req.id;

        const requestIcon = L.divIcon({
          className: 'custom-request-pin',
          html: `
            <div style="
              position: relative;
              display: flex;
              flex-direction: column;
              align-items: center;
              cursor: pointer;
              transition: transform 0.2s cubic-bezier(0.16, 1, 0.3, 1);
              ${isSelected ? 'transform: scale(1.18); z-index: 1000;' : ''}
            ">
              <!-- Radar Ping for Critical Unfulfilled Needs -->
              ${isCritical && req.unfulfilledQty > 0 ? `
                <div style="
                  position: absolute;
                  top: -4px;
                  width: 38px;
                  height: 38px;
                  border-radius: 50%;
                  background: rgba(225, 29, 72, 0.25);
                  animation: ping 1.8s cubic-bezier(0, 0, 0.2, 1) infinite;
                "></div>
              ` : ''}

              <!-- Main Beacon Badge -->
              <div style="
                width: 30px;
                height: 30px;
                border-radius: 50%;
                background: ${color};
                color: #ffffff;
                border: 2.5px solid #ffffff;
                box-shadow: 0 4px 10px rgba(0, 0, 0, 0.25), 0 0 0 ${isSelected ? '2.5px #2563eb' : '1px rgba(0,0,0,0.1)'};
                display: flex;
                align-items: center;
                justify-content: center;
                font-size: 11px;
                font-weight: 800;
                position: relative;
                z-index: 2;
              ">
                ${req.priorityScore.toFixed(0)}
              </div>

              <!-- Beacon Tip -->
              <div style="
                width: 0;
                height: 0;
                border-left: 5px solid transparent;
                border-right: 5px solid transparent;
                border-top: 6px solid ${color};
                margin-top: -2px;
                z-index: 2;
              "></div>

              <!-- Compact ID Label Pill -->
              <div style="
                background: #ffffff;
                color: #0f172a;
                border: 1px solid ${isSelected ? '#3b82f6' : '#cbd5e1'};
                border-radius: 5px;
                padding: 1px 6px;
                font-size: 9.5px;
                font-weight: 700;
                white-space: nowrap;
                box-shadow: 0 2px 6px rgba(0, 0, 0, 0.08);
                margin-top: 2px;
                display: flex;
                align-items: center;
                gap: 4px;
              ">
                <span style="color: ${color}; font-weight: 800;">${req.id}</span>
                <span style="color: #94a3b8;">•</span>
                <span>${req.requestedQty}${req.resourceType === 'drinking_water' ? 'L' : ''}</span>
              </div>
            </div>
          `,
          iconSize: [60, 48],
          iconAnchor: [30, 36],
        });

        const marker = L.marker([req.location.lat, req.location.lng], { icon: requestIcon }).addTo(map);

        marker.on('click', () => {
          onSelectRequest(req);
        });

        marker.bindPopup(`
          <div style="font-size: 12px; font-family: sans-serif; min-width: 200px; padding: 2px;">
            <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 6px;">
              <span style="font-weight: 800; color: #0f172a; font-size: 13px;">${req.id}</span>
              <span style="
                background: ${isCritical ? '#ffe4e6' : '#fef3c7'};
                color: ${isCritical ? '#be123c' : '#b45309'};
                padding: 1px 6px;
                border-radius: 9999px;
                font-size: 10px;
                font-weight: 800;
              ">Rank #${req.priorityScore.toFixed(0)}</span>
            </div>

            <div style="font-size: 11.5px; color: #334155; margin-bottom: 6px;">
              <strong>${req.resourceType.replace('_', ' ').toUpperCase()}:</strong> ${req.requestedQty} units needed
            </div>

            <div style="font-size: 11px; color: #64748b; margin-bottom: 6px;">
              📍 <strong>${req.location.zoneName}</strong><br/>
              👥 <strong>${req.peopleAffected} people affected</strong>
            </div>

            <div style="margin-top: 8px;">
              <button id="btn-inspect-${req.id}" style="
                width: 100%;
                background: #0f172a;
                color: #ffffff;
                border: none;
                padding: 6px 10px;
                border-radius: 6px;
                font-size: 11px;
                font-weight: 700;
                cursor: pointer;
              ">
                Inspect Priority & Allocate &rarr;
              </button>
            </div>
          </div>
        `);

        marker.on('popupopen', () => {
          const btn = document.getElementById(`btn-inspect-${req.id}`);
          if (btn) {
            btn.onclick = () => onSelectRequest(req);
          }
        });

        requestMarkersRef.current[req.id] = marker;
      });

      // Fit bounds cleanly to show the whole operational theater with margins
      const bounds = L.latLngBounds([
        ...FLOOD_INUNDATION_ZONE,
        ...requests.filter((r) => r.requestStatus !== 'rejected').map((r) => [r.location.lat, r.location.lng] as [number, number]),
        ...depots.map((d) => [d.lat, d.lng] as [number, number]),
      ]);
      map.fitBounds(bounds, { padding: [40, 40], maxZoom: 14 });
    });

    return () => {
      isMounted = false;
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, [requests, depots]);

  // Handle Layer Toggles
  useEffect(() => {
    if (!hazardLayersGroupRef.current || !mapInstanceRef.current) return;
    if (showHazardZone) {
      if (!mapInstanceRef.current.hasLayer(hazardLayersGroupRef.current)) {
        mapInstanceRef.current.addLayer(hazardLayersGroupRef.current);
      }
    } else {
      if (mapInstanceRef.current.hasLayer(hazardLayersGroupRef.current)) {
        mapInstanceRef.current.removeLayer(hazardLayersGroupRef.current);
      }
    }
  }, [showHazardZone]);

  useEffect(() => {
    if (!depotRadiiGroupRef.current || !mapInstanceRef.current) return;
    if (showDepotRadii) {
      if (!mapInstanceRef.current.hasLayer(depotRadiiGroupRef.current)) {
        mapInstanceRef.current.addLayer(depotRadiiGroupRef.current);
      }
    } else {
      if (mapInstanceRef.current.hasLayer(depotRadiiGroupRef.current)) {
        mapInstanceRef.current.removeLayer(depotRadiiGroupRef.current);
      }
    }
  }, [showDepotRadii]);

  // Center on Selected Request
  useEffect(() => {
    if (!selectedRequestId || !mapInstanceRef.current) return;
    const req = requests.find((r) => r.id === selectedRequestId);
    if (!req) return;

    mapInstanceRef.current.flyTo([req.location.lat, req.location.lng], 14, {
      animate: true,
      duration: 0.8,
    });

    const marker = requestMarkersRef.current[selectedRequestId];
    if (marker) {
      marker.openPopup();
    }
  }, [selectedRequestId, requests]);

  // Reset View Handler
  const handleResetView = () => {
    if (!mapInstanceRef.current || !leafletModuleRef.current) return;
    const L = leafletModuleRef.current;
    const bounds = L.latLngBounds([
      ...FLOOD_INUNDATION_ZONE,
      ...requests.filter((r) => r.requestStatus !== 'rejected').map((r) => [r.location.lat, r.location.lng] as [number, number]),
      ...depots.map((d) => [d.lat, d.lng] as [number, number]),
    ]);
    mapInstanceRef.current.fitBounds(bounds, { padding: [40, 40], maxZoom: 14 });
  };

  return (
    <div className="relative w-full h-full min-h-[600px] rounded-2xl overflow-hidden border border-slate-200/90 shadow-xs bg-slate-100">
      {/* Top Left: Operational Sector Badge */}
      <div className="absolute top-3 left-3 z-20 bg-white/95 backdrop-blur border border-slate-200/90 rounded-xl p-2.5 shadow-sm max-w-xs">
        <div className="flex items-center space-x-2 mb-1">
          <span className="w-2.5 h-2.5 rounded-full bg-rose-500 animate-pulse ring-2 ring-rose-200" />
          <span className="font-bold text-slate-800 text-xs">Sector 4 Flood Inundation Zone</span>
        </div>
        <div className="text-[11px] text-slate-600 flex items-center justify-between gap-3">
          <span>Active River Surge Corridor</span>
          <span className="font-mono text-[10px] text-slate-600 bg-slate-100 px-1.5 py-0.5 rounded">HOT OSM</span>
        </div>
      </div>

      {/* Top Right: Tactical Layer Controls */}
      <div className="absolute top-3 right-3 z-20 bg-white/95 backdrop-blur border border-slate-200/90 rounded-xl p-1.5 shadow-sm flex items-center space-x-1.5 text-xs">
        <button
          onClick={() => setShowHazardZone(!showHazardZone)}
          className={`flex items-center space-x-1 px-2.5 py-1 rounded-lg text-xs font-semibold transition-colors ${
            showHazardZone
              ? 'bg-rose-50 text-rose-700 border border-rose-200'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
          title="Toggle Flood Hazard Polygon"
        >
          <AlertTriangle className="w-3.5 h-3.5 text-rose-500" />
          <span>Hazard Area</span>
        </button>

        <button
          onClick={() => setShowDepotRadii(!showDepotRadii)}
          className={`flex items-center space-x-1 px-2.5 py-1 rounded-lg text-xs font-semibold transition-colors ${
            showDepotRadii
              ? 'bg-sky-50 text-sky-700 border border-sky-200'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
          title="Toggle Depot Service Radii"
        >
          <ShieldCheck className="w-3.5 h-3.5 text-sky-500" />
          <span>Depots</span>
        </button>

        <button
          onClick={handleResetView}
          className="p-1.5 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors"
          title="Recenter and Fit Theater Bounds"
        >
          <RotateCcw className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Bottom Left: Unified Legend */}
      <div className="absolute bottom-3 left-3 z-20 bg-white/95 backdrop-blur border border-slate-200/90 rounded-xl px-3 py-2 shadow-sm flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-slate-600">
        <div className="flex items-center space-x-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-rose-600 ring-2 ring-rose-200" />
          <span className="font-medium text-slate-700">Critical (&ge;85)</span>
        </div>
        <div className="flex items-center space-x-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-amber-500" />
          <span className="font-medium text-slate-700">High (70-84)</span>
        </div>
        <div className="flex items-center space-x-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-blue-600" />
          <span className="font-medium text-slate-700">Moderate</span>
        </div>
        <div className="flex items-center space-x-1.5">
          <span className="w-3 h-2 rounded-xs bg-sky-400/40 border border-dashed border-rose-500" />
          <span className="font-medium text-slate-700">Flood Inundation</span>
        </div>
        <div className="flex items-center space-x-1.5">
          <span className="w-2.5 h-2.5 rounded-xs bg-slate-900 border border-sky-400" />
          <span className="font-medium text-slate-700">Depot Hub</span>
        </div>
      </div>

      {/* The Leaflet Container */}
      <div ref={mapContainerRef} className="w-full h-full min-h-[600px]" />
    </div>
  );
}
