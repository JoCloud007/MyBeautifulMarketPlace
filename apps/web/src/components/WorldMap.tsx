import { useState, useCallback } from 'react';
import type { AvailabilityZone } from '@cloudmarket/shared-types';

const regionColors: Record<string, string> = {
  Europe: '#3b82f6',
  'North America': '#10b981',
  'Asia-Pacific': '#f59e0b',
};

/* Mercator-like projection for display */
function project(lat: number, lon: number, w: number, h: number) {
  const x = ((lon + 180) / 360) * w;
  const latRad = (lat * Math.PI) / 180;
  const mercN = Math.log(Math.tan(Math.PI / 4 + latRad / 2));
  const y = (h / 2) - (w * mercN) / (2 * Math.PI);
  return { x, y };
}

/* Simplified continent shapes (SVG path data, roughly Mercator-projected) */
const CONTINENTS = [
  // North America
  { d: 'M60,45 Q80,20 140,25 Q200,15 230,40 Q250,70 220,100 Q190,130 150,120 Q100,110 70,90 Q40,70 60,45Z', fill: '#1e293b' },
  // South America
  { d: 'M170,135 Q200,125 210,150 Q220,190 200,230 Q180,260 160,250 Q150,220 155,180 Q160,150 170,135Z', fill: '#1e293b' },
  // Europe + Africa
  { d: 'M260,40 Q300,25 340,35 Q380,30 400,50 Q420,80 410,120 Q430,160 420,200 Q400,240 370,250 Q340,240 320,210 Q300,180 290,150 Q280,120 270,90 Q260,65 260,40Z', fill: '#1e293b' },
  // Asia
  { d: 'M400,35 Q480,15 560,30 Q620,40 650,70 Q670,110 640,150 Q610,180 560,170 Q510,160 470,140 Q430,120 410,90 Q390,60 400,35Z', fill: '#1e293b' },
  // Australia
  { d: 'M580,200 Q620,190 640,210 Q650,240 630,260 Q600,270 570,260 Q550,240 560,220 Q570,205 580,200Z', fill: '#1e293b' },
];

const MAP_W = 800;
const MAP_H = 420;

interface WorldMapProps {
  zones: AvailabilityZone[];
  selectedZone: AvailabilityZone | null;
  onSelectZone: (zone: AvailabilityZone) => void;
}

export default function WorldMap({ zones, selectedZone, onSelectZone }: WorldMapProps) {
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  const handleZoneClick = useCallback((zone: AvailabilityZone) => {
    onSelectZone(zone);
  }, [onSelectZone]);

  return (
    <div className="relative w-full h-full bg-slate-950 overflow-hidden">
      <svg
        viewBox={`0 0 ${MAP_W} ${MAP_H}`}
        className="w-full h-full"
        preserveAspectRatio="xMidYMid meet"
      >
        {/* Subtle grid */}
        <defs>
          <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
            <path d="M 40 0 L 0 0 0 40" fill="none" stroke="#0f172a" strokeWidth="0.5" />
          </pattern>
        </defs>
        <rect width={MAP_W} height={MAP_H} fill="url(#grid)" />

        {/* Continent silhouettes */}
        {CONTINENTS.map((c, i) => (
          <path key={i} d={c.d} fill={c.fill} stroke="#334155" strokeWidth="0.5" opacity="0.6" />
        ))}

        {/* Connection lines between zones of same region */}
        {(() => {
          const byRegion: Record<string, AvailabilityZone[]> = {};
          zones.forEach((z) => {
            if (!byRegion[z.region]) byRegion[z.region] = [];
            byRegion[z.region].push(z);
          });
          const lines: JSX.Element[] = [];
          Object.values(byRegion).forEach((group) => {
            if (group.length < 2) return;
            const color = regionColors[group[0].region] || '#64748b';
            for (let i = 0; i < group.length; i++) {
              for (let j = i + 1; j < group.length; j++) {
                const a = project(group[i].latitude, group[i].longitude, MAP_W, MAP_H);
                const b = project(group[j].latitude, group[j].longitude, MAP_W, MAP_H);
                lines.push(
                  <line
                    key={`${group[i].id}-${group[j].id}`}
                    x1={a.x} y1={a.y} x2={b.x} y2={b.y}
                    stroke={color} strokeWidth="1" opacity="0.25" strokeDasharray="4 4"
                  />
                );
              }
            }
          });
          return lines;
        })()}

        {/* Zone markers */}
        {zones.map((zone) => {
          const pos = project(zone.latitude, zone.longitude, MAP_W, MAP_H);
          const color = regionColors[zone.region] || '#64748b';
          const isSelected = selectedZone?.id === zone.id;
          const isHovered = hoveredId === zone.id;
          const radius = isSelected ? 8 : isHovered ? 7 : 5;

          return (
            <g
              key={zone.id}
              style={{ cursor: 'pointer' }}
              onClick={() => handleZoneClick(zone)}
              onMouseEnter={() => setHoveredId(zone.id)}
              onMouseLeave={() => setHoveredId((id) => (id === zone.id ? null : id))}
            >
              {/* Pulse ring for active zones */}
              {zone.isActive && (
                <circle
                  cx={pos.x} cy={pos.y}
                  r={radius + 6}
                  fill="none"
                  stroke={color}
                  strokeWidth="1"
                  opacity="0.3"
                >
                  <animate
                    attributeName="r"
                    values={`${radius + 2};${radius + 12};${radius + 2}`}
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

              {/* Outer glow */}
              <circle
                cx={pos.x} cy={pos.y}
                r={radius + 3}
                fill={color}
                opacity={isSelected || isHovered ? 0.2 : 0}
                style={{ transition: 'opacity 0.2s' }}
              />

              {/* Main dot */}
              <circle
                cx={pos.x} cy={pos.y}
                r={radius}
                fill={color}
                stroke="#0f172a"
                strokeWidth="2"
                style={{ transition: 'r 0.2s' }}
              />

              {/* Label (shown on hover or selected) */}
              {(isHovered || isSelected) && (
                <g>
                  <rect
                    x={pos.x + 12} y={pos.y - 22}
                    width={140} height={44}
                    rx={6}
                    fill="#0f172a"
                    stroke={color}
                    strokeWidth="1"
                    opacity="0.95"
                  />
                  <text
                    x={pos.x + 22} y={pos.y - 6}
                    fill="#f8fafc"
                    fontSize="11"
                    fontWeight="600"
                  >
                    {zone.name}
                  </text>
                  <text
                    x={pos.x + 22} y={pos.y + 10}
                    fill="#94a3b8"
                    fontSize="9"
                  >
                    {zone.city}, {zone.country}
                  </text>
                </g>
              )}
            </g>
          );
        })}
      </svg>

      {/* Legend */}
      <div className="absolute bottom-3 left-3 flex gap-3">
        {Object.entries(regionColors).map(([region, color]) => (
          <div key={region} className="flex items-center gap-1.5">
            <span className="inline-block w-2 h-2 rounded-full" style={{ backgroundColor: color }} />
            <span className="text-[10px] text-slate-500">{region}</span>
          </div>
        ))}
      </div>

      {/* Zone count */}
      <div className="absolute bottom-3 right-3 text-[10px] text-slate-600">
        {zones.length} zones · {new Set(zones.map((z) => z.region)).size} regions
      </div>
    </div>
  );
}
