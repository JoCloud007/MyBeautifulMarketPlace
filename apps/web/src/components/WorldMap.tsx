import { useState, useCallback, useRef } from 'react';
import {
  ComposableMap,
  Geographies,
  Geography,
  Marker,
  ZoomableGroup,
} from 'react-simple-maps';
import type { AvailabilityZone } from '@cloudmarket/shared-types';

const GEO_URL = 'https://cdn.jsdelivr.net/npm/world-atlas@2/countries-50m.json';
const MAP_W = 800;
const MAP_H = 420;

const regionColors: Record<string, string> = {
  Europe: '#3b82f6',
  'North America': '#10b981',
  'Asia-Pacific': '#f59e0b',
};

const regionFill: Record<string, string> = {
  Europe: 'rgba(59, 130, 246, 0.12)',
  'North America': 'rgba(16, 185, 129, 0.12)',
  'Asia-Pacific': 'rgba(245, 158, 11, 0.12)',
};

interface WorldMapProps {
  zones: AvailabilityZone[];
  selectedZone: AvailabilityZone | null;
  onSelectZone: (zone: AvailabilityZone) => void;
}

interface TooltipState {
  zone: AvailabilityZone;
  x: number;
  y: number;
}

export default function WorldMap({ zones, selectedZone, onSelectZone }: WorldMapProps) {
  const [tooltip, setTooltip] = useState<TooltipState | null>(null);
  const [position, setPosition] = useState({ coordinates: [0, 20] as [number, number], zoom: 1 });
  const containerRef = useRef<HTMLDivElement>(null);

  const handleMoveEnd = useCallback((pos: { coordinates: [number, number]; zoom: number }) => {
    setPosition(pos);
  }, []);

  const handleMouseEnter = useCallback((zone: AvailabilityZone, e: React.MouseEvent) => {
    const container = containerRef.current;
    if (!container) return;
    const rect = container.getBoundingClientRect();
    setTooltip({
      zone,
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    });
  }, []);

  const handleMouseLeave = useCallback((zoneId: string) => {
    setTooltip((t) => (t?.zone.id === zoneId ? null : t));
  }, []);

  // Tooltip edge-guard
  const tooltipLeft = (() => {
    if (!tooltip || !containerRef.current) return 0;
    const w = containerRef.current.clientWidth;
    const flipX = tooltip.x + 160 > w;
    return flipX ? tooltip.x - 160 : tooltip.x + 12;
  })();

  const tooltipTop = (() => {
    if (!tooltip) return 0;
    const flipY = tooltip.y - 52 < 0;
    return flipY ? tooltip.y + 12 : tooltip.y - 52;
  })();

  return (
    <div ref={containerRef} className="relative w-full h-full bg-slate-950 overflow-hidden">
      <ComposableMap
        projection="geoMercator"
        projectionConfig={{ scale: 140, center: [0, 20] }}
        style={{ width: '100%', height: '100%' }}
      >
        <ZoomableGroup
          zoom={position.zoom}
          center={position.coordinates}
          onMoveEnd={handleMoveEnd}
          minZoom={1}
          maxZoom={8}
        >
          {/* Ocean background */}
          <rect x={0} y={0} width={MAP_W} height={MAP_H} fill="#020617" />

          <Geographies geography={GEO_URL}>
            {({ geographies }) =>
              geographies.map((geo) => {
                const name = (geo.properties?.name || '') as string;
                const hostingZone = zones.find(
                  (z) => z.country.toLowerCase() === name.toLowerCase()
                );
                const fill = hostingZone
                  ? regionFill[hostingZone.region] || 'rgba(100, 116, 139, 0.30)'
                  : '#475569';
                const stroke = hostingZone
                  ? (regionColors[hostingZone.region] || '#94a3b8')
                  : '#64748b';

                return (
                  <Geography
                    key={geo.rsmKey}
                    geography={geo}
                    fill={fill}
                    stroke={stroke}
                    strokeWidth={hostingZone ? 0.6 : 0.4}
                    style={{
                      default: { outline: 'none' },
                      hover: { outline: 'none', fill: hostingZone ? (regionFill[hostingZone.region] || 'rgba(100, 116, 139, 0.30)') : '#475569' },
                      pressed: { outline: 'none' },
                    }}
                  />
                );
              })
            }
          </Geographies>

          {zones.map((zone) => {
            const color = regionColors[zone.region] || '#64748b';
            const isSelected = selectedZone?.id === zone.id;
            const isHovered = tooltip?.zone.id === zone.id;
            const r = isSelected ? 6 : isHovered ? 5 : 4;

            return (
              <Marker key={zone.id} coordinates={[zone.longitude, zone.latitude]}>
                <g
                  style={{ cursor: 'pointer' }}
                  onClick={() => onSelectZone(zone)}
                  onMouseEnter={(e) => handleMouseEnter(zone, e)}
                  onMouseLeave={() => handleMouseLeave(zone.id)}
                >
                  {/* Pulse ring for active zones */}
                  {zone.isActive && (
                    <circle r={r + 8} fill="none" stroke={color} strokeWidth="1" opacity="0.3">
                      <animate
                        attributeName="r"
                        values={`${r + 2};${r + 14};${r + 2}`}
                        dur="3s"
                        repeatCount="indefinite"
                      />
                      <animate
                        attributeName="opacity"
                        values="0.5;0;0.5"
                        dur="3s"
                        repeatCount="indefinite"
                      />
                    </circle>
                  )}

                  {/* Glow */}
                  {(isSelected || isHovered) && (
                    <circle r={r + 3} fill={color} opacity="0.2" />
                  )}

                  {/* Main dot */}
                  <circle r={r} fill={color} stroke="#0f172a" strokeWidth="2" />
                </g>
              </Marker>
            );
          })}
        </ZoomableGroup>
      </ComposableMap>

      {/* HTML Tooltip */}
      {tooltip && (
        <div
          className="absolute pointer-events-none z-10"
          style={{ left: tooltipLeft, top: tooltipTop }}
        >
          <div
            className="rounded-lg border px-3 py-2 shadow-lg whitespace-nowrap"
            style={{
              backgroundColor: '#0f172a',
              borderColor: regionColors[tooltip.zone.region] || '#334155',
            }}
          >
            <p className="text-xs font-semibold text-white">{tooltip.zone.name}</p>
            <p className="text-[10px] text-slate-400">
              {tooltip.zone.city}, {tooltip.zone.country}
            </p>
          </div>
        </div>
      )}

      {/* Legend */}
      <div className="absolute bottom-3 left-3 flex gap-3 bg-slate-950/80 px-2 py-1.5 rounded-md border border-slate-800">
        {Object.entries(regionColors).map(([region, color]) => (
          <div key={region} className="flex items-center gap-1.5">
            <span className="inline-block w-2 h-2 rounded-full" style={{ backgroundColor: color }} />
            <span className="text-[10px] text-slate-500">{region}</span>
          </div>
        ))}
      </div>

      {/* Zone count + zoom hint */}
      <div className="absolute bottom-3 right-3 text-[10px] text-slate-600 bg-slate-950/80 px-2 py-1.5 rounded-md border border-slate-800">
        {zones.length} zones · {new Set(zones.map((z) => z.region)).size} regions · scroll to zoom
      </div>
    </div>
  );
}
