'use client';

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Navigation, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { AccessibilityStatus, SimulatedZoneOption } from '@/lib/types';
import { SIMULATED_ZONES } from '@/lib/data/initialScenario';

// 1. Primary Flash Flood Inundation Corridor Polygon (Mithi River & Kurla Basin) - Matching Coordinator Map
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

// Realistic Flood Impact Hotspots within Kurla / Mithi Corridor for GPS Simulation
const FLOOD_AFFECTED_HOTSPOTS = [
  { name: 'Kurla Kranti Nagar Mithi Overflow (Water 5ft)', lat: 19.0720, lng: 72.8795 },
  { name: 'Bail Bazar Lowland Underpass (Submerged)', lat: 19.0785, lng: 72.8810 },
  { name: 'LBS Marg Kurla Depot Junction (Blocked)', lat: 19.0680, lng: 72.8750 },
  { name: 'Kalina Air India Colony Basin (Isolated)', lat: 19.0740, lng: 72.8660 },
  { name: 'Sion Railway Underpass & Gandhi Market', lat: 19.0410, lng: 72.8620 },
  { name: 'Dharavi 90-Feet Road Canal Breach', lat: 19.0490, lng: 72.8550 },
];

interface LocationMapPickerProps {
  selectedZoneName: string;
  onLocationChange: (loc: {
    zoneName: string;
    lat: number;
    lng: number;
    accessibility: AccessibilityStatus;
  }) => void;
}

export default function LocationMapPicker({
  selectedZoneName,
  onLocationChange,
}: LocationMapPickerProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const leafletRef = useRef<any>(null);
  const userMarkerRef = useRef<any>(null);

  const [currentCoords, setCurrentCoords] = useState<{ lat: number; lng: number }>({
    lat: 34.0489,
    lng: -118.2250,
  });
  const [isLocating, setIsLocating] = useState(false);
  const [locationSource, setLocationSource] = useState<'map_click' | 'gps_simulated' | 'preset'>('preset');
  const [gpsHotspotLabel, setGpsHotspotLabel] = useState<string | null>(null);

  // Find nearest sector from coordinates
  const findNearestZone = (lat: number, lng: number): SimulatedZoneOption => {
    let nearest = SIMULATED_ZONES[0];
    let minDist = Infinity;

    for (const zone of SIMULATED_ZONES) {
      const d = Math.hypot(zone.lat - lat, zone.lng - lng);
      if (d < minDist) {
        minDist = d;
        nearest = zone;
      }
    }
    return nearest;
  };

  // Helper to update marker position
  const setMarkerPosition = useCallback(
    (lat: number, lng: number, L: any, map: any) => {
      const pinHtml = `
        <div class="relative flex items-center justify-center">
          <div class="absolute -top-7 h-10 w-10 rounded-full bg-rose-500/30 animate-ping"></div>
          <div class="absolute -top-7 h-8 w-8 rounded-full bg-rose-600 border-2 border-white shadow-xl flex items-center justify-center text-white">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"/>
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"/>
            </svg>
          </div>
        </div>
      `;

      const customIcon = L.divIcon({
        className: 'custom-location-pin',
        html: pinHtml,
        iconSize: [32, 32],
        iconAnchor: [16, 28],
      });

      if (userMarkerRef.current) {
        userMarkerRef.current.setLatLng([lat, lng]);
      } else {
        userMarkerRef.current = L.marker([lat, lng], {
          icon: customIcon,
          draggable: true,
        }).addTo(map);

        userMarkerRef.current.on('dragend', (e: any) => {
          const pos = e.target.getLatLng();
          handleLocationUpdate(pos.lat, pos.lng, 'map_click');
        });
      }
    },
    []
  );

  const handleLocationUpdate = (
    lat: number,
    lng: number,
    source: 'map_click' | 'gps_simulated' | 'preset',
    label?: string
  ) => {
    const roundedLat = Math.round(lat * 10000) / 10000;
    const roundedLng = Math.round(lng * 10000) / 10000;
    setCurrentCoords({ lat: roundedLat, lng: roundedLng });
    setLocationSource(source);
    if (label) setGpsHotspotLabel(label);

    const nearestZone = findNearestZone(roundedLat, roundedLng);
    onLocationChange({
      zoneName: nearestZone.zoneName,
      lat: roundedLat,
      lng: roundedLng,
      accessibility: nearestZone.accessibility,
    });
  };

  // Initialize Map
  useEffect(() => {
    if (typeof window === 'undefined' || !mapContainerRef.current) return;

    let isMounted = true;

    import('leaflet').then((L) => {
      if (!isMounted || !mapContainerRef.current) return;
      leafletRef.current = L;

      // Clean up previous map if exists
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }

      // Initial center
      const initialZone = SIMULATED_ZONES.find((z) => z.zoneName === selectedZoneName) || SIMULATED_ZONES[0];
      const map = L.map(mapContainerRef.current, {
        center: [initialZone.lat, initialZone.lng],
        zoom: 13,
        zoomControl: false,
      });

      L.control.zoom({ position: 'bottomright' }).addTo(map);

      // Humanitarian OpenStreetMap (HOT) - 100% open, zero keys, crisp light disaster styling
      L.tileLayer('https://{s}.tile.openstreetmap.fr/hot/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap contributors, Humanitarian OpenStreetMap Team',
        maxZoom: 19,
      }).addTo(map);

      // 1. Secondary Advisory Evacuation Perimeter Buffer (Amber)
      L.polygon(EVACUATION_BUFFER_ZONE, {
        color: '#f59e0b',
        weight: 1.5,
        dashArray: '4, 8',
        fillColor: '#fbbf24',
        fillOpacity: 0.08,
      }).addTo(map);

      // 2. Primary Flash Flood Inundation Polygon (Sector 4 River Basin - Red border, blue fill)
      L.polygon(FLOOD_INUNDATION_ZONE, {
        color: '#ef4444',
        weight: 2.5,
        dashArray: '6, 6',
        fillColor: '#0284c7',
        fillOpacity: 0.24,
      })
        .addTo(map)
        .bindPopup(
          `<div class="p-1 text-xs">
            <strong class="text-rose-700 block">🚨 Sector 4 Flood Inundation Zone</strong>
            <span>Active flash flood water depth 3-5 ft. Severe road washouts, boat/air only.</span>
          </div>`
        );

      // 3. Centered Hazard Area Watermark Badge on Map
      const hazardLabelIcon = L.divIcon({
        className: 'custom-hazard-label',
        html: `
          <div style="
            background: rgba(255, 255, 255, 0.94);
            backdrop-filter: blur(4px);
            border: 1.5px solid #ef4444;
            color: #b91c1c;
            padding: 3px 9px;
            border-radius: 9999px;
            font-size: 10px;
            font-weight: 800;
            letter-spacing: 0.02em;
            display: flex;
            align-items: center;
            gap: 5px;
            box-shadow: 0 4px 10px rgba(239, 68, 68, 0.2);
            pointer-events: none;
            white-space: nowrap;
          ">
            <span style="display: inline-block; width: 6px; height: 6px; border-radius: 50%; background: #ef4444; animation: pulse 1.5s infinite;"></span>
            SECTOR 4 FLOOD CORRIDOR
          </div>
        `,
        iconSize: [170, 24],
        iconAnchor: [85, 12],
      });
      L.marker([34.0510, -118.2255], { icon: hazardLabelIcon, interactive: false }).addTo(map);

      // 4. Add Sector Reference Markers
      SIMULATED_ZONES.forEach((zone) => {
        const sectorDotHtml = `
          <div class="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-white/95 border border-slate-300 shadow-xs text-[10px] font-bold text-slate-700 whitespace-nowrap pointer-events-auto cursor-pointer hover:bg-slate-100 hover:scale-105 transition-all">
            <span class="h-2 w-2 rounded-full ${
              zone.accessibility === 'flooded_boat_only'
                ? 'bg-rose-500'
                : zone.accessibility === 'debris_delay'
                ? 'bg-amber-500'
                : 'bg-emerald-500'
            }"></span>
            <span>${zone.zoneName.split('-')[0].trim()}</span>
          </div>
        `;

        const sectorIcon = L.divIcon({
          className: 'custom-hazard-label',
          html: sectorDotHtml,
          iconSize: [80, 20],
          iconAnchor: [40, 10],
        });

        const marker = L.marker([zone.lat, zone.lng], { icon: sectorIcon }).addTo(map);
        marker.on('click', () => {
          map.flyTo([zone.lat, zone.lng], 14, { duration: 0.8 });
          setMarkerPosition(zone.lat, zone.lng, L, map);
          handleLocationUpdate(zone.lat, zone.lng, 'preset');
        });
      });

      // 5. User Pin setup
      setMarkerPosition(initialZone.lat, initialZone.lng, L, map);

      // 6. Click on map to drop pin
      map.on('click', (e: any) => {
        const { lat, lng } = e.latlng;
        setMarkerPosition(lat, lng, L, map);
        handleLocationUpdate(lat, lng, 'map_click');
      });

      mapInstanceRef.current = map;

      // Force size recalculation to guarantee full container tile coverage
      const triggerInvalidate = () => {
        if (mapInstanceRef.current) {
          mapInstanceRef.current.invalidateSize({ debounceMoveEngine: true });
        }
      };

      // Staggered invalidations for layout settling
      requestAnimationFrame(triggerInvalidate);
      const timer1 = setTimeout(triggerInvalidate, 100);
      const timer2 = setTimeout(triggerInvalidate, 300);
      const timer3 = setTimeout(triggerInvalidate, 600);

      // ResizeObserver to automatically resize map when container dimensions change
      let resizeObserver: ResizeObserver | null = null;
      if (typeof ResizeObserver !== 'undefined' && mapContainerRef.current) {
        resizeObserver = new ResizeObserver(() => {
          triggerInvalidate();
        });
        resizeObserver.observe(mapContainerRef.current);
      }

      const handleWindowResize = () => triggerInvalidate();
      window.addEventListener('resize', handleWindowResize);

      return () => {
        clearTimeout(timer1);
        clearTimeout(timer2);
        clearTimeout(timer3);
        if (resizeObserver) resizeObserver.disconnect();
        window.removeEventListener('resize', handleWindowResize);
      };
    });

    return () => {
      isMounted = false;
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, []);

  // When selectedZoneName changes from outside, fly map to zone
  useEffect(() => {
    if (!mapInstanceRef.current || !leafletRef.current) return;
    const zone = SIMULATED_ZONES.find((z) => z.zoneName === selectedZoneName);
    if (zone && (zone.lat !== currentCoords.lat || zone.lng !== currentCoords.lng)) {
      mapInstanceRef.current.invalidateSize();
      mapInstanceRef.current.flyTo([zone.lat, zone.lng], 14, { duration: 0.8 });
      setMarkerPosition(zone.lat, zone.lng, leafletRef.current, mapInstanceRef.current);
      setCurrentCoords({ lat: zone.lat, lng: zone.lng });
    }
  }, [selectedZoneName, setMarkerPosition]);

  // "Fetch Current Location" Action: Picks a random location in the flood-affected area
  const handleFetchCurrentLocation = () => {
    setIsLocating(true);

    if (mapInstanceRef.current) {
      mapInstanceRef.current.invalidateSize();
    }

    setTimeout(() => {
      // Pick a random flood impact hotspot within Sector 4 flood inundation corridor
      const randomIndex = Math.floor(Math.random() * FLOOD_AFFECTED_HOTSPOTS.length);
      const hotspot = FLOOD_AFFECTED_HOTSPOTS[randomIndex];

      // Add realistic microscopic GPS jitter (±0.0015 deg ~150 meters)
      const jitterLat = (Math.random() - 0.5) * 0.003;
      const jitterLng = (Math.random() - 0.5) * 0.003;

      const gpsLat = Math.round((hotspot.lat + jitterLat) * 10000) / 10000;
      const gpsLng = Math.round((hotspot.lng + jitterLng) * 10000) / 10000;

      if (mapInstanceRef.current && leafletRef.current) {
        mapInstanceRef.current.invalidateSize();
        mapInstanceRef.current.flyTo([gpsLat, gpsLng], 15, { duration: 1.2 });
        setMarkerPosition(gpsLat, gpsLng, leafletRef.current, mapInstanceRef.current);
      }

      handleLocationUpdate(gpsLat, gpsLng, 'gps_simulated', hotspot.name);
      setIsLocating(false);
    }, 600);
  };

  const currentZoneMeta = SIMULATED_ZONES.find((z) => z.zoneName === selectedZoneName) || SIMULATED_ZONES[0];

  return (
    <div className="space-y-3.5">
      {/* Top Map Action Bar */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-slate-700">
            Click map or drag pin to select your location:
          </span>
          <span className="text-[11px] text-slate-400 hidden sm:inline">• HOT Disaster Cartography</span>
        </div>

        {/* GPS Fetch Button - User requested: fetches random location in the flood-affected area */}
        <button
          type="button"
          onClick={handleFetchCurrentLocation}
          disabled={isLocating}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-blue-600 text-white hover:bg-blue-700 active:scale-95 disabled:opacity-50 transition-all shadow-xs cursor-pointer"
          title="Simulate device GPS fix in the active disaster flood perimeter"
        >
          <Navigation className={`w-3.5 h-3.5 ${isLocating ? 'animate-spin' : ''}`} />
          <span>{isLocating ? 'Acquiring GPS Fix...' : '📍 Fetch Current Location'}</span>
        </button>
      </div>

      {/* Interactive Leaflet Map Container */}
      <div className="relative rounded-xl overflow-hidden border border-slate-300 shadow-2xs">
        <div ref={mapContainerRef} className="h-64 sm:h-72 w-full z-10" />

        {/* Map Legend Overlay */}
        <div className="absolute top-2.5 left-2.5 z-20 bg-white/95 backdrop-blur-xs px-2.5 py-1.5 rounded-lg border border-slate-200/90 shadow-2xs text-[11px] space-y-1">
          <div className="flex items-center gap-1.5 text-slate-700 font-semibold">
            <span className="h-2.5 w-2.5 rounded-full bg-rose-600 animate-pulse" />
            <span>Selected Citizen Location</span>
          </div>
          <div className="flex items-center gap-1.5 text-rose-700 font-medium">
            <span className="h-2 w-3.5 rounded-xs bg-sky-400/30 border border-rose-500" />
            <span>Sector 4 Flood Inundation Zone</span>
          </div>
          <div className="flex items-center gap-1.5 text-amber-700 font-medium">
            <span className="h-2 w-3.5 rounded-xs bg-amber-400/20 border border-amber-500" />
            <span>Advisory Evacuation Perimeter</span>
          </div>
        </div>

        {/* GPS Fix Toast Indicator */}
        {locationSource === 'gps_simulated' && (
          <div className="absolute bottom-2.5 left-2.5 z-20 bg-emerald-600 text-white px-3 py-1.5 rounded-lg text-xs font-bold shadow-md flex items-center gap-2 animate-in fade-in duration-200">
            <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
            <div>
              <div className="leading-tight">GPS Fixed: Active Flood Impact Corridor</div>
              {gpsHotspotLabel && (
                <div className="text-[10px] text-emerald-100 font-normal">{gpsHotspotLabel}</div>
              )}
            </div>
          </div>
        )}
      </div>


      {/* Location Confirmation Details Bar */}
      <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
        <div>
          <span className="text-slate-500 block text-[10px] uppercase font-bold tracking-wider">
            Detected Disaster Sector
          </span>
          <span className="font-bold text-slate-900 text-sm">{currentZoneMeta.zoneName}</span>
          <span className="text-slate-500 block text-[11px] font-mono mt-0.5">
            Coordinates: {currentCoords.lat.toFixed(4)}° N, {Math.abs(currentCoords.lng).toFixed(4)}° W
          </span>
        </div>

        <div className="shrink-0">
          <span
            className={`inline-flex items-center gap-1 font-bold px-2.5 py-1 rounded-full text-[11px] uppercase tracking-wider ${
              currentZoneMeta.accessibility === 'flooded_boat_only'
                ? 'bg-rose-100 text-rose-800 border border-rose-200'
                : currentZoneMeta.accessibility === 'debris_delay'
                ? 'bg-amber-100 text-amber-800 border border-amber-200'
                : 'bg-emerald-100 text-emerald-800 border border-emerald-200'
            }`}
          >
            {currentZoneMeta.accessibility === 'flooded_boat_only' && (
              <AlertTriangle className="w-3 h-3 text-rose-600" />
            )}
            <span>{currentZoneMeta.accessibility.replace(/_/g, ' ')}</span>
          </span>
        </div>
      </div>
    </div>
  );
}
