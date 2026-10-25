'use client';

import React, { useEffect, useRef, useState } from 'react';
import { ReliefRequest, ReliefDepot } from '@/lib/types';
import { 
  RotateCcw, 
  AlertTriangle, 
  ShieldCheck
} from 'lucide-react';

interface InteractiveDisasterMapProps {
  requests: ReliefRequest[];
  depots: ReliefDepot[];
  selectedRequestId: string | null;
  onSelectRequest: (req: ReliefRequest) => void;
  onResetScenario?: () => void;
}

// 1. Primary Flash Flood Inundation Corridor Polygon (Mithi River & Kurla Basin)
const FLOOD_INUNDATION_ZONE: [number, number][] = [
  [19.0835, 72.8755], // Saki Naka / Mithi upper reach
  [19.0780, 72.8840], // Kurla Kranti Nagar East
  [19.0690, 72.8860], // Kurla Station lowlands
  [19.0610, 72.8790], // Mithi River bend at LBS Marg
  [19.0520, 72.8690], // Dharavi North / Mithi canal
  [19.0440, 72.8540], // Mahim Creek confluence
  [19.0400, 72.8450], // Mahim Causeway mouth
  [19.0480, 72.8510], // Bandra East marsh border
  [19.0580, 72.8630], // BKC North channel bank
  [19.0710, 72.8690], // Kalina CST Road lowlands
  [19.0800, 72.8680], // Santacruz East border
];

// 2. Secondary Evacuation Alert & Debris Perimeter Buffer (Mumbai Central Corridor)
const EVACUATION_BUFFER_ZONE: [number, number][] = [
  [19.0930, 72.8710],
  [19.0830, 72.8930],
  [19.0660, 72.8980],
  [19.0490, 72.8790],
  [19.0340, 72.8560],
  [19.0370, 72.8370],
  [19.0540, 72.8470],
  [19.0760, 72.8540],
];

// 3. IoT Sensor Node Station (Kurla West Mithi River Bridge & LBS Underpass)
const SENSOR_STATION_COORDS: [number, number] = [19.0665, 72.8745];

// 4. Primary Overland Route (LBS Marg lowlands through Underpass)
const LBS_OVERLAND_ROUTE: [number, number][] = [
  [19.0600, 72.8550], // Depot Alpha BKC
  [19.0640, 72.8660], // BKC Junction
  [19.0665, 72.8745], // Mithi River Underpass (IoT Sensor Node #01)
  [19.0715, 72.8785], // Kurla Station West approach
  [19.0740, 72.8820], // Kranti Nagar lowlands
];

// 5. Safe Elevated Convoy Bypass Route (BKC Elevated Flyover & SCLR Viaduct +14m ASL)
const BKC_ELEVATED_BYPASS_ROUTE: [number, number][] = [
  [19.0600, 72.8550], // Depot Alpha BKC
  [19.0630, 72.8590], // BKC Flyover Ramp
  [19.0710, 72.8605], // SCLR Elevated Viaduct (+14m ASL)
  [19.0760, 72.8600], // Kalina CST Flyover
  [19.0780, 72.8720], // SCLR Elevated Crossing above Kurla
  [19.0740, 72.8810], // Kranti Nagar High Ground Ramp
];

// Determine if a relief request has achieved 100% fulfilled allocation status
function isFulfilledRequest(r: ReliefRequest): boolean {
  const totalAlloc = r.requestedResources && r.requestedResources.length > 0
    ? r.requestedResources.reduce((acc, item) => acc + item.allocatedQty, 0)
    : r.allocatedQty;
  const totalUnful = r.requestedResources && r.requestedResources.length > 0
    ? r.requestedResources.reduce((acc, item) => acc + item.unfulfilledQty, 0)
    : r.unfulfilledQty;

  return (
    r.requestStatus === 'fully_allocated' ||
    r.requestStatus === 'dispatched' ||
    r.requestStatus === 'delivered' ||
    (totalUnful === 0 && totalAlloc > 0)
  );
}

export default function InteractiveDisasterMap({
  requests,
  depots,
  selectedRequestId,
  onSelectRequest,
  onResetScenario,
}: InteractiveDisasterMapProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const leafletModuleRef = useRef<any>(null);
  const requestMarkersRef = useRef<{ [id: string]: any }>({});
  const requestsGroupRef = useRef<any>(null);
  const hazardLayersGroupRef = useRef<any>(null);
  const depotRadiiGroupRef = useRef<any>(null);
  const depotsGroupRef = useRef<any>(null);
  const iotLayersGroupRef = useRef<any>(null);

  const [mapReady, setMapReady] = useState(false);
  const [showHazardZone, setShowHazardZone] = useState(true);
  const [showDepotRadii, setShowDepotRadii] = useState(true);
  const [showFulfilled, setShowFulfilled] = useState(true);
  const [telemetry, setTelemetry] = useState<any>(null);

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
        center: [19.062, 72.868],
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

      const depotsGroup = L.layerGroup().addTo(map);
      depotsGroupRef.current = depotsGroup;

      const requestsGroup = L.layerGroup().addTo(map);
      requestsGroupRef.current = requestsGroup;

      const iotGroup = L.layerGroup().addTo(map);
      iotLayersGroupRef.current = iotGroup;

      // 1. Draw Affected Disaster Hazard Polygons
      // Outer Evacuation Warning Perimeter (Click to inspect, zero hover popup)
      const bufferPolygon = L.polygon(EVACUATION_BUFFER_ZONE, {
        color: '#f59e0b',
        weight: 1.5,
        dashArray: '4, 8',
        fillColor: '#fbbf24',
        fillOpacity: 0.08,
      }).addTo(hazardGroup);

      bufferPolygon.bindPopup(`
        <div style="font-size: 12px; font-family: sans-serif; min-width: 210px; padding: 2px;">
          <div style="display: flex; align-items: center; gap: 6px; margin-bottom: 4px;">
            <span style="font-size: 14px;">⚠️</span>
            <span style="font-weight: 800; color: #b45309; font-size: 13px;">Advisory Evacuation Perimeter</span>
          </div>
          <div style="color: #64748b; font-size: 11px; margin-bottom: 6px;">
            Mumbai Central Disaster Buffer
          </div>
          <div style="background: #fffbeb; border: 1px solid #fef3c7; border-radius: 6px; padding: 6px 8px; font-size: 11px; color: #92400e; line-height: 1.4;">
            Secondary flash surge monitoring area. High ground staging active.
          </div>
        </div>
      `);

      // Core Flood Inundation Corridor (Click to inspect, zero hover popup)
      const floodPolygon = L.polygon(FLOOD_INUNDATION_ZONE, {
        color: '#ef4444',
        weight: 2.5,
        dashArray: '6, 6',
        fillColor: '#0284c7',
        fillOpacity: 0.22,
      }).addTo(hazardGroup);

      floodPolygon.bindPopup(`
        <div style="font-size: 12px; font-family: sans-serif; min-width: 220px; padding: 2px;">
          <div style="display: flex; align-items: center; gap: 6px; margin-bottom: 4px;">
            <span style="font-size: 14px;">🚨</span>
            <span style="font-weight: 800; color: #b91c1c; font-size: 13px;">Sector 4 Flood Inundation Zone</span>
          </div>
          <div style="color: #64748b; font-size: 11px; margin-bottom: 6px;">
            Kurla West & Mithi River Basin
          </div>
          <div style="background: #fef2f2; border: 1px solid #fee2e2; border-radius: 6px; padding: 6px 8px; font-size: 11px; color: #991b1b; line-height: 1.4;">
            <strong>Critical Hazard:</strong> Overland road transit severed.<br/>
            Amphibious boat or elevated viaduct bypass routing active.
          </div>
        </div>
      `);

      // Centered Hazard Area Static Watermark Pill (Zero Clicks, Zero Hover, Pointer-Events None)
      const hazardLabelIcon = L.divIcon({
        className: 'custom-hazard-label',
        html: `
          <div style="
            background: rgba(255, 255, 255, 0.94);
            backdrop-filter: blur(4px);
            border: 1.5px solid #ef4444;
            color: #b91c1c;
            padding: 3px 12px;
            border-radius: 9999px;
            font-size: 10px;
            font-weight: 800;
            letter-spacing: 0.03em;
            display: inline-flex;
            align-items: center;
            justify-content: center;
            gap: 6px;
            box-shadow: 0 4px 12px rgba(239, 68, 68, 0.2);
            pointer-events: none;
            white-space: nowrap;
            box-sizing: border-box;
          ">
            <span style="display: inline-block; width: 7px; height: 7px; border-radius: 50%; background: #ef4444;"></span>
            SECTOR 4 FLOOD CORRIDOR
          </div>
        `,
        iconSize: [210, 26],
        iconAnchor: [105, 13],
      });
      L.marker([19.0780, 72.8830], { icon: hazardLabelIcon, interactive: false }).addTo(hazardGroup);

      // Advisory Evacuation Perimeter Subtle Ground Badge (Expanded width & comfortable padding)
      const bufferLabelIcon = L.divIcon({
        className: 'custom-buffer-label',
        html: `
          <div style="
            background: rgba(255, 255, 255, 0.94);
            backdrop-filter: blur(4px);
            border: 1.5px solid #f59e0b;
            color: #b45309;
            padding: 3px 12px;
            border-radius: 9999px;
            font-size: 10px;
            font-weight: 800;
            letter-spacing: 0.03em;
            display: inline-flex;
            align-items: center;
            justify-content: center;
            gap: 6px;
            box-shadow: 0 4px 10px rgba(245, 158, 11, 0.2);
            pointer-events: none;
            white-space: nowrap;
            box-sizing: border-box;
          ">
            <span style="display: inline-block; width: 6px; height: 6px; border-radius: 50%; background: #f59e0b;"></span>
            ADVISORY EVACUATION PERIMETER
          </div>
        `,
        iconSize: [240, 26],
        iconAnchor: [120, 13],
      });
      L.marker([19.0915, 72.8750], { icon: bufferLabelIcon, interactive: false }).addTo(hazardGroup);

      // Fit bounds initially to Mumbai disaster operational theater (including initial requests and depots)
      const visibleInitialDemands = requests.filter(
        (r) => r.requestStatus !== 'rejected' && (!isFulfilledRequest(r) || showFulfilled)
      );
      const pointsToBound: [number, number][] = [
        ...FLOOD_INUNDATION_ZONE,
        ...depots.map((d) => [d.lat, d.lng] as [number, number]),
        ...(visibleInitialDemands.length > 0 ? visibleInitialDemands : requests).map(
          (r) => [r.location.lat, r.location.lng] as [number, number]
        ),
      ];
      const bounds = L.latLngBounds(pointsToBound);
      map.fitBounds(bounds, { padding: [40, 40], maxZoom: 13.5 });

      setMapReady(true);
    });

    return () => {
      isMounted = false;
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
      setMapReady(false);
    };
  }, []);

  // 1. Dynamically Update Depot Markers & Stock Levels on Real-Time State Changes
  useEffect(() => {
    const L = leafletModuleRef.current;
    const map = mapInstanceRef.current;
    const depotsGroup = depotsGroupRef.current;
    const depotRadiiGroup = depotRadiiGroupRef.current;
    if (!L || !map || !depotsGroup || !depotRadiiGroup) return;

    depotsGroup.clearLayers();
    depotRadiiGroup.clearLayers();

    depots.forEach((depot) => {
      if (showDepotRadii) {
        const serviceRadius = depot.id === 'DEPOT-ALPHA' ? 1400 : 1600;
        L.circle([depot.lat, depot.lng], {
          radius: serviceRadius,
          color: '#38bdf8',
          weight: 1.2,
          dashArray: '3, 6',
          fillColor: '#0284c7',
          fillOpacity: 0.04,
        }).addTo(depotRadiiGroup);
      }

      const shortName =
        depot.id === 'DEPOT-ALPHA' ? 'Alpha Hub' : depot.id === 'DEPOT-BETA' ? 'Beta Hub' : 'Gamma Hub';
      const waterStock = depot.inventory?.drinking_water?.availableStock ?? 0;
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

      const marker = L.marker([depot.lat, depot.lng], { icon: depotIcon }).addTo(depotsGroup);
      marker.bindPopup(`
        <div style="font-size: 12px; font-family: sans-serif; min-width: 180px; padding: 2px;">
          <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 4px;">
            <span style="font-weight: 800; color: #0f172a; font-size: 13px;">${depot.name}</span>
          </div>
          <div style="color: #64748b; font-size: 11px; margin-bottom: 8px;">
            Zone: <strong style="color: #0f172a;">${depot.zoneName}</strong>
          </div>
          <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 6px 8px; font-size: 11px; line-height: 1.5;">
            <div>💧 Drinking Water: <strong style="color: ${
              waterStock < 100 ? '#e11d48' : '#0f172a'
            };">${waterStock} / ${depot.inventory?.drinking_water?.totalCapacity || 1000} L</strong></div>
            <div>🍞 Food Rations: <strong>${
              depot.inventory?.food_rations?.availableStock || 0
            } Packs</strong></div>
            <div>🩹 Medical Kits: <strong>${
              depot.inventory?.medical_supplies?.availableStock || 0
            } Kits</strong></div>
            <div>⛺ Shelter Kits: <strong>${
              depot.inventory?.shelter_kits?.availableStock || 0
            } Tents</strong></div>
          </div>
        </div>
      `);
    });
  }, [depots, showDepotRadii, mapReady]);

  // 2. Dynamically Update Request Markers on Real-Time State Changes (Without Recreating Map)
  useEffect(() => {
    const L = leafletModuleRef.current;
    const map = mapInstanceRef.current;
    const requestsGroup = requestsGroupRef.current;
    if (!L || !map || !requestsGroup) return;

    // Clear existing pins
    requestsGroup.clearLayers();
    requestMarkersRef.current = {};

    // 2. Classify demands into unfulfilled triage vs fulfilled (allocated, dispatched, delivered)
    const unfulfilledDemands = requests.filter(
      (r) => r.requestStatus !== 'rejected' && !isFulfilledRequest(r)
    );
    const fulfilledDemands = requests.filter(
      (r) => r.requestStatus !== 'rejected' && isFulfilledRequest(r)
    );

    // Render unfulfilled acute intake demands (triage beacons)
    unfulfilledDemands.forEach((req) => {
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
              <span>${
                req.requestedResources && req.requestedResources.length > 1
                  ? `${req.requestedResources.length} Items`
                  : `${req.requestedQty}${req.resourceType === 'drinking_water' ? 'L' : ''}`
              }</span>
            </div>
          </div>
        `,
        iconSize: [60, 48],
        iconAnchor: [30, 36],
      });

      const marker = L.marker([req.location.lat, req.location.lng], { icon: requestIcon }).addTo(requestsGroup);

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

          ${req.requestedResources && req.requestedResources.length > 1
            ? `<div style="font-size: 11px; color: #334155; margin-bottom: 6px;">
                <div style="font-weight: 800; color: #1e40af; margin-bottom: 3px;">📦 Multi-Resource Demand (${req.requestedResources.length} Categories):</div>
                <div style="line-height: 1.4; padding: 4px 6px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px;">
                  ${req.requestedResources.map((it) => `• <strong>${it.resourceType === 'drinking_water' ? 'Water' : it.resourceType === 'medical_supplies' ? 'Medical' : it.resourceType === 'food_rations' ? 'Food' : 'Shelter'}:</strong> ${it.requestedQty}${it.resourceType === 'drinking_water' ? 'L' : ' units'}`).join('<br/>')}
                </div>
              </div>`
            : `<div style="font-size: 11.5px; color: #334155; margin-bottom: 6px;">
                <strong>${req.resourceType.replace('_', ' ').toUpperCase()}:</strong> ${req.requestedQty} units needed
              </div>`
          }

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

    // 3. Render Fulfilled Demands (Allocated, Dispatched, Delivered) when showFulfilled is checked
    if (showFulfilled) {
      fulfilledDemands.forEach((req) => {
        const isSelected = selectedRequestId === req.id;
        const isDelivered = req.requestStatus === 'delivered';
        const isDispatched = req.requestStatus === 'dispatched';
        const isAllocated = req.requestStatus === 'fully_allocated' || req.requestStatus === 'partially_allocated';

        const color = isDelivered ? '#059669' : isDispatched ? '#0284c7' : '#0d9488';
        const badgeIcon = isDelivered ? '✓' : isDispatched ? '🚚' : '📦';
        const statusLabel = isDelivered 
          ? 'Delivered' 
          : isDispatched 
          ? 'In Transit' 
          : req.requestStatus === 'fully_allocated' 
          ? 'Allocated' 
          : 'Partial';
        const statusPillBg = isDelivered ? '#ecfdf5' : isDispatched ? '#f0f9ff' : '#f0fdfa';
        const statusPillBorder = isDelivered ? '#a7f3d0' : isDispatched ? '#bae6fd' : '#99f6e4';
        const statusPillText = isDelivered ? '#065f46' : isDispatched ? '#0369a1' : '#115e59';

        const fulfilledIcon = L.divIcon({
          className: 'custom-fulfilled-pin',
          html: `
            <div style="
              position: relative;
              display: flex;
              flex-direction: column;
              align-items: center;
              cursor: pointer;
              transition: transform 0.2s cubic-bezier(0.16, 1, 0.3, 1);
              ${isSelected ? 'transform: scale(1.18); z-index: 1000;' : 'opacity: 0.94;'}
            ">
              <!-- Fulfilled Badge -->
              <div style="
                width: 28px;
                height: 28px;
                border-radius: 50%;
                background: ${color};
                color: #ffffff;
                border: 2px solid #ffffff;
                box-shadow: 0 4px 10px ${color}55;
                display: flex;
                align-items: center;
                justify-content: center;
                font-size: ${isDelivered ? '13px' : '11px'};
                font-weight: 900;
                position: relative;
                z-index: 2;
              ">
                ${badgeIcon}
              </div>

              <!-- Pin Tip -->
              <div style="
                width: 0;
                height: 0;
                border-left: 4px solid transparent;
                border-right: 4px solid transparent;
                border-top: 5px solid ${color};
                margin-top: -1px;
                z-index: 2;
              "></div>

              <!-- Status Pill Label -->
              <div style="
                background: ${statusPillBg};
                color: ${statusPillText};
                border: 1px solid ${statusPillBorder};
                border-radius: 5px;
                padding: 1px 6px;
                font-size: 9px;
                font-weight: 700;
                white-space: nowrap;
                box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);
                margin-top: 2px;
                display: flex;
                align-items: center;
                gap: 3px;
              ">
                <span style="color: ${color}; font-weight: 800;">${req.id}</span>
                <span style="opacity: 0.5;">•</span>
                <span>${statusLabel}</span>
              </div>
            </div>
          `,
          iconSize: [60, 44],
          iconAnchor: [30, 34],
        });

        const marker = L.marker([req.location.lat, req.location.lng], { icon: fulfilledIcon }).addTo(requestsGroup);

        marker.on('click', () => {
          onSelectRequest(req);
        });

        const statusTag = isDelivered 
          ? '✓ 100% Delivered' 
          : isDispatched 
          ? '🚚 Dispatched (En Route)' 
          : '📦 Warehouse Staged';

        const statusDetailNote = isDelivered
          ? '✓ Citizen handover confirmed & reserved warehouse stock released.'
          : isDispatched
          ? '🚚 Vehicle fleet en route to recipient zone from depot hub.'
          : '📦 Depot stock reserved and packed for immediate convoy dispatch.';

        marker.bindPopup(`
          <div style="font-size: 12px; font-family: sans-serif; min-width: 220px; padding: 2px;">
            <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 6px;">
              <span style="font-weight: 800; color: #0f172a; font-size: 13px;">${req.id}</span>
              <span style="
                background: ${statusPillBg};
                color: ${statusPillText};
                padding: 1px 7px;
                border-radius: 9999px;
                font-size: 10px;
                font-weight: 800;
                border: 1px solid ${statusPillBorder};
              ">${statusTag}</span>
            </div>

            <div style="font-size: 11.5px; color: #334155; margin-bottom: 4px;">
              ${req.requestedResources && req.requestedResources.length > 1
                ? `<strong>Fulfillment:</strong> ${req.requestedResources.length} Categories (${req.allocatedQty || req.requestedQty} / ${req.requestedQty} units)`
                : `<strong>Fulfillment:</strong> ${req.allocatedQty || req.requestedQty} / ${req.requestedQty} units of ${req.resourceType.replace('_', ' ')}`
              }
            </div>

            <div style="font-size: 11px; color: #64748b; margin-bottom: 6px; line-height: 1.4;">
              👤 <strong>${req.requesterName}</strong><br/>
              📍 <strong>${req.location.zoneName}</strong><br/>
              🏢 Source Depot: <strong>${req.allocatedDepotId || 'Staging Base'}</strong>
            </div>

            <div style="padding: 5px 8px; background: ${statusPillBg}; border: 1px solid ${statusPillBorder}; border-radius: 6px; font-size: 10.5px; color: ${statusPillText}; font-weight: 600; margin-bottom: 8px;">
              ${statusDetailNote}
            </div>

            <div>
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
                Inspect in Operations Console &rarr;
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
    }
  }, [requests, selectedRequestId, showFulfilled, onSelectRequest, mapReady]);

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

  // 4. Initial Telemetry Fetch & Persistent SSE Stream
  useEffect(() => {
    let isMounted = true;
    fetch('/api/sensors/telemetry', { cache: 'no-store' })
      .then((res) => res.json())
      .then((data) => {
        if (isMounted) setTelemetry(data);
      })
      .catch(() => {});

    let es: EventSource | null = null;
    try {
      es = new EventSource('/api/requests/stream');
      es.onmessage = (event) => {
        if (!event.data) return;
        try {
          const payload = JSON.parse(event.data);
          if (payload.type === 'SENSOR_TELEMETRY' && payload.data) {
            if (isMounted) {
              setTelemetry((prev: any) => ({
                ...prev,
                latest: payload.data.reading,
                disasterState: payload.data.disasterState,
              }));
            }
          } else if (payload.type === 'DISASTER_STATE_CHANGED' && payload.data) {
            if (isMounted) {
              setTelemetry((prev: any) => ({
                ...prev,
                disasterState: payload.data.disasterState,
              }));
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

  // 5. Dynamically Render IoT Station Pin & Dynamic Transit Corridors
  useEffect(() => {
    const L = leafletModuleRef.current;
    const map = mapInstanceRef.current;
    const iotGroup = iotLayersGroupRef.current;
    if (!L || !map || !iotGroup) return;

    iotGroup.clearLayers();

    const state = telemetry?.disasterState;
    const latest = telemetry?.latest;
    const isSubmerged = state?.underpassSubmerged || false;
    const isWarning = state?.flashFloodWarning || ((latest?.soil_moisture_pct ?? 0) >= 90);
    const clearance = latest?.water_surface_distance_cm !== null && latest?.water_surface_distance_cm !== undefined
      ? Number(latest.water_surface_distance_cm).toFixed(1)
      : '46.5';
    const soil = latest?.soil_moisture_pct ?? 42;
    const waterDepth = state?.waterDepthCm !== undefined ? Number(state.waterDepthCm).toFixed(1) : '0.0';

    // 1. Draw Active / Submerged Transit Routes
    if (isSubmerged) {
      // A. Draw Blocked Roadway in Dashed Crimson
      const blockedPolyline = L.polyline(LBS_OVERLAND_ROUTE, {
        color: '#ef4444',
        weight: 4.5,
        dashArray: '8, 8',
        opacity: 0.95,
      }).addTo(iotGroup);

      blockedPolyline.bindPopup(
        `<div style="font-size: 12px; font-family: sans-serif; min-width: 200px; padding: 2px;">
          <div class="font-extrabold text-rose-700">⛔ SUBMERGED: LBS Marg Underpass</div>
          <div class="text-[11px] text-slate-600 mt-1">Water Depth: <strong>${waterDepth} cm</strong> (Sensor #01)</div>
          <div class="text-[10px] text-slate-500 mt-1">Overland vehicular access is blocked. Convoys redirected via BKC Elevated Bypass.</div>
        </div>`
      );

      // Blocked Warning Badge along LBS approach (placed at [19.0645, 72.8690] clear of all pins)
      const blockedBadgeIcon = L.divIcon({
        className: 'custom-route-label',
        html: `
          <div style="
            background: #b91c1c;
            color: #ffffff;
            border: 1.5px solid #ffffff;
            padding: 3px 10px;
            border-radius: 9999px;
            font-size: 10px;
            font-weight: 800;
            letter-spacing: 0.03em;
            display: flex;
            align-items: center;
            gap: 5px;
            box-shadow: 0 4px 12px rgba(185, 28, 28, 0.5);
            white-space: nowrap;
            pointer-events: none;
            box-sizing: border-box;
          ">
            <span>⛔</span>
            <span>LBS UNDERPASS SUBMERGED</span>
          </div>
        `,
        iconSize: [195, 24],
        iconAnchor: [97, 12],
      });
      L.marker([19.0645, 72.8690], { icon: blockedBadgeIcon, interactive: false }).addTo(iotGroup);

      // B. Draw Active Safe Elevated Bypass (Emerald Highway)
      // Casing underlay for elevated aesthetic
      L.polyline(BKC_ELEVATED_BYPASS_ROUTE, {
        color: '#064e3b',
        weight: 8,
        opacity: 0.85,
      }).addTo(iotGroup);

      // Glowing emerald inner line
      const elevatedPolyline = L.polyline(BKC_ELEVATED_BYPASS_ROUTE, {
        color: '#10b981',
        weight: 4.5,
        opacity: 1.0,
      }).addTo(iotGroup);

      elevatedPolyline.bindPopup(
        `<div style="font-size: 12px; font-family: sans-serif; min-width: 220px; padding: 2px;">
          <div class="font-extrabold text-emerald-700">✅ ACTIVE CONVOY DISPATCH: BKC Elevated Bypass</div>
          <div class="text-[11px] text-slate-600 mt-1">Viaduct Elevation: <strong>+14m ASL (100% Flood-Free)</strong></div>
          <div class="text-[10px] text-slate-500 mt-1">Primary safe arterial for heavy emergency relief trucks and ambulances.</div>
        </div>`
      );

      // Safe Route Badge at Flyover midpoint
      const safeBadgeIcon = L.divIcon({
        className: 'custom-route-label',
        html: `
          <div style="
            background: #047857;
            color: #ffffff;
            border: 1.5px solid #ffffff;
            padding: 3px 10px;
            border-radius: 9999px;
            font-size: 10px;
            font-weight: 800;
            letter-spacing: 0.02em;
            display: flex;
            align-items: center;
            gap: 5px;
            box-shadow: 0 4px 10px rgba(4, 120, 87, 0.4);
            white-space: nowrap;
            pointer-events: none;
            box-sizing: border-box;
          ">
            <span>✅</span>
            <span>BKC ELEVATED BYPASS (ACTIVE)</span>
          </div>
        `,
        iconSize: [210, 24],
        iconAnchor: [105, 12],
      });
      L.marker([19.0735, 72.8602], { icon: safeBadgeIcon, interactive: false }).addTo(iotGroup);
    } else {
      // Standard normal routing: draw subtle primary route
      const normalRoute = L.polyline(LBS_OVERLAND_ROUTE, {
        color: '#2563eb',
        weight: 3.5,
        opacity: 0.75,
      }).addTo(iotGroup);

      normalRoute.bindPopup(
        `<div style="font-size: 12px; font-family: sans-serif; min-width: 200px; padding: 2px;">
          <div class="font-bold text-blue-700">🚚 Primary Logistics Transit Corridor</div>
          <div class="text-[11px] text-slate-600 mt-1">LBS Marg Underpass Passable (Clearance: <strong>${clearance} cm</strong>)</div>
          <div class="text-[10px] text-slate-500 mt-1">Standard surface road open for all relief vehicles.</div>
        </div>`
      );
    }

    // 2. Draw IoT Sensor Station Pin
    const pinBg = isSubmerged ? '#e11d48' : isWarning ? '#d97706' : '#059669';
    const pinBorder = isSubmerged ? '#ffe4e6' : isWarning ? '#fef3c7' : '#d1fae5';
    const badgeLabel = isSubmerged ? 'SUBMERGED' : isWarning ? 'SATURATED' : 'PASSABLE';

    const iotIcon = L.divIcon({
      className: 'custom-iot-pin',
      html: `
        <div style="
          position: relative;
          display: flex;
          flex-direction: column;
          align-items: center;
          cursor: pointer;
          filter: drop-shadow(0 6px 12px rgba(0,0,0,0.3));
        ">
          <!-- Radar Ring Animation -->
          <div style="
            position: absolute;
            top: 0;
            left: 50%;
            transform: translate(-50%, -50%);
            width: 38px;
            height: 38px;
            border-radius: 50%;
            background: ${pinBg}33;
            border: 1.5px solid ${pinBg};
            animation: ping 2s cubic-bezier(0, 0, 0.2, 1) infinite;
          "></div>

          <!-- Central Sensor Beacon -->
          <div style="
            width: 32px;
            height: 32px;
            border-radius: 50%;
            background: #0f172a;
            border: 2.5px solid ${pinBg};
            color: #ffffff;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 14px;
            position: relative;
            z-index: 2;
          ">
            📡
          </div>

          <!-- Sensor Pin Pointer Needle -->
          <div style="
            width: 0;
            height: 0;
            border-left: 5px solid transparent;
            border-right: 5px solid transparent;
            border-top: 6px solid #0f172a;
            margin-top: -1px;
            z-index: 2;
          "></div>

          <!-- Real-time Live Badge -->
          <div style="
            background: #0f172a;
            color: #ffffff;
            border: 1px solid ${pinBg};
            border-radius: 6px;
            padding: 2px 6px;
            font-size: 9.5px;
            font-weight: 800;
            white-space: nowrap;
            margin-top: 2px;
            display: flex;
            align-items: center;
            gap: 4px;
            box-shadow: 0 2px 6px rgba(0,0,0,0.2);
          ">
            <span style="color: ${pinBg}; font-weight: 900;">NODE #01</span>
            <span style="color: #64748b;">•</span>
            <span>${clearance}cm</span>
          </div>
        </div>
      `,
      iconSize: [80, 52],
      iconAnchor: [40, 36],
    });

    const iotMarker = L.marker(SENSOR_STATION_COORDS, { 
      icon: iotIcon,
      zIndexOffset: 2500,
    }).addTo(iotGroup);

    iotMarker.bindPopup(`
      <div style="font-size: 12px; font-family: sans-serif; min-width: 230px; padding: 2px;">
        <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 6px;">
          <span style="font-weight: 800; color: #0f172a; font-size: 13px;">📡 DisasterSense IoT Node #01</span>
          <span style="
            background: ${pinBorder};
            color: ${pinBg};
            padding: 1px 6px;
            border-radius: 9999px;
            font-size: 10px;
            font-weight: 800;
          ">${badgeLabel}</span>
        </div>

        <div style="color: #64748b; font-size: 11px; margin-bottom: 8px;">
          Location: <strong>Kurla West / LBS Marg Underpass (Mithi Basin)</strong><br/>
          Hardware: <strong>ESP32 Microcontroller + HC-SR04 + Soil ADC</strong>
        </div>

        <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 6px 8px; font-size: 11px; line-height: 1.6; margin-bottom: 8px;">
          <div>📏 <strong>Water Clearance:</strong> <span style="font-weight: 800; color: ${isSubmerged ? '#e11d48' : '#0f172a'};">${clearance} cm</span> (Road Inundation: ${waterDepth} cm)</div>
          <div>🌱 <strong>Soil Saturation:</strong> <span style="font-weight: 800; color: ${soil >= 90 ? '#d97706' : '#0f172a'};">${soil}%</span></div>
          <div>🌡️ <strong>Ambient Weather:</strong> ${latest?.temperature_c ?? 28}°C / ${latest?.humidity_pct ?? 75}% Hum</div>
          <div>🛣️ <strong>Current Route:</strong> <strong style="color: ${isSubmerged ? '#e11d48' : '#059669'};">${isSubmerged ? 'BKC Elevated Bypass' : 'LBS Marg Primary'}</strong></div>
          <div style="margin-top: 4px; padding-top: 4px; border-top: 1px dashed #cbd5e1; font-size: 10px; color: #64748b;">
            🎯 <strong>Demo Calibration:</strong> 50cm baseline (&le;15cm cutoff = 35cm truck stall limit)
          </div>
        </div>

        <a href="/sensors" style="
          display: block;
          text-align: center;
          background: #0f172a;
          color: #ffffff;
          text-decoration: none;
          padding: 6px 10px;
          border-radius: 6px;
          font-size: 11px;
          font-weight: 700;
        ">
          Open Dedicated IoT Telemetry Hub &rarr;
        </a>
      </div>
    `);
  }, [telemetry, mapReady]);


  // Reset View Handler
  const handleResetView = () => {
    if (!mapInstanceRef.current || !leafletModuleRef.current) return;
    const L = leafletModuleRef.current;

    const visibleDemands = requests.filter((r) => {
      if (r.requestStatus === 'rejected') return false;
      if (isFulfilledRequest(r)) return showFulfilled;
      return true;
    });

    const targetDemands = visibleDemands.length > 0 ? visibleDemands : requests;
    const bounds = L.latLngBounds([
      ...FLOOD_INUNDATION_ZONE,
      SENSOR_STATION_COORDS,
      ...targetDemands.map((r) => [r.location.lat, r.location.lng] as [number, number]),
      ...depots.map((d) => [d.lat, d.lng] as [number, number]),
    ]);
    mapInstanceRef.current.fitBounds(bounds, { padding: [40, 40], maxZoom: 13.5 });
  };

  const unfulfilledDemands = requests.filter(
    (r) => r.requestStatus !== 'rejected' && !isFulfilledRequest(r)
  );

  const fulfilledDemands = requests.filter(
    (r) => r.requestStatus !== 'rejected' && isFulfilledRequest(r)
  );

  return (
    <div className="relative w-full h-full min-h-[600px] rounded-2xl overflow-hidden border border-slate-200/90 shadow-xs bg-slate-100">


      {/* Top Left: Operational Sector Badge */}
      <div className="absolute top-3 left-3 z-20 bg-white/95 backdrop-blur border border-slate-200/90 rounded-xl p-2.5 shadow-sm max-w-xs">
        <div className="flex items-center space-x-2 mb-1">
          <span className={`w-2.5 h-2.5 rounded-full ${
            unfulfilledDemands.length > 0 
              ? 'bg-rose-500 animate-pulse ring-2 ring-rose-200' 
              : 'bg-emerald-500 ring-2 ring-emerald-200'
          }`} />
          <span className="font-bold text-slate-800 text-xs">Sector 4 Flood Inundation Zone</span>
        </div>
        <div className="text-[11px] text-slate-600 flex items-center justify-between gap-3">
          <span>
            {unfulfilledDemands.length > 0 
              ? `${unfulfilledDemands.length} Pending Intake Demands` 
              : `Sector Stabilized ✓ (${fulfilledDemands.length} Fulfilled)`}
          </span>
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

        {/* Fulfilled Checkbox (Allocated, Dispatched, Delivered) - Default Checked */}
        <label
          className={`flex items-center space-x-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold transition-colors cursor-pointer select-none ${
            showFulfilled
              ? 'bg-emerald-50 text-emerald-800 border border-emerald-200 shadow-2xs'
              : 'text-slate-600 hover:bg-slate-100 border border-transparent'
          }`}
          title="Toggle Fulfilled Requests (Allocated, Dispatched, Delivered) on Map"
        >
          <input
            type="checkbox"
            checked={showFulfilled}
            onChange={(e) => setShowFulfilled(e.target.checked)}
            className="w-3.5 h-3.5 rounded text-emerald-600 focus:ring-emerald-500 focus:ring-1 border-slate-300 accent-emerald-600 cursor-pointer"
          />
          <span className="flex items-center space-x-1">
            <span>Fulfilled</span>
            <span className="font-mono text-[10px] bg-emerald-100/80 text-emerald-700 px-1.5 py-0.2 rounded-full font-bold">
              {fulfilledDemands.length}
            </span>
          </span>
        </label>

        <button
          onClick={handleResetView}
          className="p-1.5 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors"
          title="Recenter and Fit Theater Bounds"
        >
          <RotateCcw className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Bottom Left: Unified Tactical Legend */}
      <div className="absolute bottom-3 left-3 z-20 bg-white/95 backdrop-blur border border-slate-200/90 rounded-xl px-3 py-2 shadow-sm flex flex-wrap items-center gap-x-3.5 gap-y-1.5 text-[11px] text-slate-600">
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
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-600 ring-2 ring-emerald-200" />
          <span className="font-medium text-emerald-800">Fulfilled ({fulfilledDemands.length})</span>
        </div>
        <div className="flex items-center space-x-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-indigo-600 ring-2 ring-indigo-200" />
          <span className="font-medium text-slate-700">📡 IoT Node #01</span>
        </div>
        <div className="flex items-center space-x-1.5">
          <span className="w-3 h-2 rounded-xs bg-sky-400/40 border border-dashed border-rose-500" />
          <span className="font-medium text-slate-700">Flood Polygon</span>
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
