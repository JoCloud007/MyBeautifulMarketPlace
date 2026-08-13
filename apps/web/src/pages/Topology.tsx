import { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTopology } from '@/hooks/useApi';
import { useScrollReveal } from '@/hooks/useScrollReveal';
import QueryError from '@/components/QueryError';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

import { Skeleton } from '@/components/ui/skeleton';
import {
  GitBranch,
  Layers,
  Package,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Move,
  Info,
  Eye,
  EyeOff,
  MousePointerClick,
} from 'lucide-react';
import type { TopologyNode, TopologyEdge } from '@cloudmarket/shared-types';

/* ─── Types ─── */
interface SimNode extends TopologyNode {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
}

/* ─── Constants ─── */
const WIDTH = 900;
const HEIGHT = 600;
const APP_RADIUS = 22;
const PRODUCT_RADIUS = 16;
const REPULSION = 800;
const SPRING_LENGTH = 140;
const SPRING_STRENGTH = 0.03;
const DAMPING = 0.85;
const CENTER_GRAVITY = 0.008;

const continuityColors: Record<string, string> = {
  green: '#22c55e',
  yellow: '#eab308',
  orange: '#f97316',
  red: '#ef4444',
};

const categoryColors: Record<string, string> = {
  Compute: '#3b82f6',
  Data: '#8b5cf6',
  Hypervisor: '#06b6d4',
  Citrix: '#ec4899',
  Storage: '#10b981',
  Network: '#f59e0b',
};

const edgeStyles: Record<string, { stroke: string; dash?: string; width: number }> = {
  INSTANCE: { stroke: '#64748b', width: 1.5 },
  DEPENDENCY: { stroke: '#94a3b8', dash: '4,3', width: 1 },
  RELATED: { stroke: '#475569', dash: '2,4', width: 0.75 },
};

/* ─── Helpers ─── */
function AnimatedSection({ children, className, delay = 0 }: { children: React.ReactNode; className?: string; delay?: number }) {
  const { ref, isVisible } = useScrollReveal<HTMLDivElement>();
  return (
    <div
      ref={ref}
      className={`transition-all duration-500 ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-5'} ${className || ''}`}
      style={{ transitionDelay: `${delay}ms` }}
    >
      {children}
    </div>
  );
}

/* Simple force-directed layout simulation */
function runSimulation(nodes: SimNode[], edges: TopologyEdge[], iterations = 300): SimNode[] {
  const simNodes = nodes.map((n) => ({ ...n }));

  for (let iter = 0; iter < iterations; iter++) {
    // Repulsion (Coulomb)
    for (let i = 0; i < simNodes.length; i++) {
      for (let j = i + 1; j < simNodes.length; j++) {
        const a = simNodes[i];
        const b = simNodes[j];
        let dx = b.x - a.x;
        let dy = b.y - a.y;
        let dist = Math.sqrt(dx * dx + dy * dy) || 1;
        const force = REPULSION / (dist * dist);
        const fx = (dx / dist) * force;
        const fy = (dy / dist) * force;
        a.vx -= fx;
        a.vy -= fy;
        b.vx += fx;
        b.vy += fy;
      }
    }

    // Spring attraction (Hooke)
    for (const edge of edges) {
      const a = simNodes.find((n) => n.id === edge.source);
      const b = simNodes.find((n) => n.id === edge.target);
      if (!a || !b) continue;
      let dx = b.x - a.x;
      let dy = b.y - a.y;
      let dist = Math.sqrt(dx * dx + dy * dy) || 1;
      const force = (dist - SPRING_LENGTH) * SPRING_STRENGTH;
      const fx = (dx / dist) * force;
      const fy = (dy / dist) * force;
      a.vx += fx;
      a.vy += fy;
      b.vx -= fx;
      b.vy -= fy;
    }

    // Center gravity
    for (const n of simNodes) {
      n.vx += (WIDTH / 2 - n.x) * CENTER_GRAVITY;
      n.vy += (HEIGHT / 2 - n.y) * CENTER_GRAVITY;
      n.vx *= DAMPING;
      n.vy *= DAMPING;
      n.x += n.vx;
      n.y += n.vy;
    }
  }

  return simNodes;
}

/* ─── Component ─── */
export default function TopologyPage() {
  const { data: topology, isLoading, isError, refetch } = useTopology();
  const navigate = useNavigate();
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const [showApps, setShowApps] = useState(true);
  const [showProducts, setShowProducts] = useState(true);
  const [showInstanceEdges, setShowInstanceEdges] = useState(true);
  const [showDependencyEdges, setShowDependencyEdges] = useState(true);
  const [showRelatedEdges, setShowRelatedEdges] = useState(false);
  const [hoveredNode, setHoveredNode] = useState<SimNode | null>(null);
  const [tooltipPos, setTooltipPos] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [transform, setTransform] = useState({ x: 0, y: 0, scale: 1 });
  const [isDragging, setIsDragging] = useState(false);
  const dragStart = useRef({ x: 0, y: 0 });

  // Build simulation nodes and run layout
  const simNodes = useMemo(() => {
    if (!topology) return [];
    const nodes: SimNode[] = topology.nodes.map((n) => ({
      ...n,
      x: WIDTH / 2 + (Math.random() - 0.5) * 200,
      y: HEIGHT / 2 + (Math.random() - 0.5) * 200,
      vx: 0,
      vy: 0,
      radius: n.type === 'APPLICATION' ? APP_RADIUS : PRODUCT_RADIUS,
    }));
    return runSimulation(nodes, topology.edges, 300);
  }, [topology]);

  const filteredEdges = useMemo(() => {
    if (!topology) return [];
    return topology.edges.filter((e) => {
      if (e.type === 'INSTANCE' && !showInstanceEdges) return false;
      if (e.type === 'DEPENDENCY' && !showDependencyEdges) return false;
      if (e.type === 'RELATED' && !showRelatedEdges) return false;
      return true;
    });
  }, [topology, showInstanceEdges, showDependencyEdges, showRelatedEdges]);

  const visibleNodes = useMemo(() => {
    return simNodes.filter((n) => {
      if (n.type === 'APPLICATION' && !showApps) return false;
      if (n.type === 'PRODUCT' && !showProducts) return false;
      return true;
    });
  }, [simNodes, showApps, showProducts]);

  const visibleNodeIds = useMemo(() => new Set(visibleNodes.map((n) => n.id)), [visibleNodes]);

  const visibleEdges = useMemo(() => {
    return filteredEdges.filter((e) => visibleNodeIds.has(e.source) && visibleNodeIds.has(e.target));
  }, [filteredEdges, visibleNodeIds]);

  // Stats
  const stats = useMemo(() => {
    if (!topology) return null;
    const appCount = topology.nodes.filter((n) => n.type === 'APPLICATION').length;
    const productCount = topology.nodes.filter((n) => n.type === 'PRODUCT').length;
    const instanceEdges = topology.edges.filter((e) => e.type === 'INSTANCE').length;
    const dependencyEdges = topology.edges.filter((e) => e.type === 'DEPENDENCY').length;
    const relatedEdges = topology.edges.filter((e) => e.type === 'RELATED').length;
    return { appCount, productCount, instanceEdges, dependencyEdges, relatedEdges };
  }, [topology]);

  // Mouse handlers for pan/zoom
  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? 0.9 : 1.1;
    setTransform((t) => {
      const newScale = Math.min(Math.max(t.scale * delta, 0.3), 4);
      return { ...t, scale: newScale };
    });
  }, []);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    setIsDragging(true);
    dragStart.current = { x: e.clientX - transform.x, y: e.clientY - transform.y };
  }, [transform]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (isDragging) {
      setTransform((t) => ({
        ...t,
        x: e.clientX - dragStart.current.x,
        y: e.clientY - dragStart.current.y,
      }));
    }
  }, [isDragging]);

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  const handleNodeMouseEnter = useCallback((node: SimNode, e: React.MouseEvent) => {
    setHoveredNode(node);
    const rect = containerRef.current?.getBoundingClientRect();
    if (rect) {
      setTooltipPos({ x: e.clientX - rect.left + 12, y: e.clientY - rect.top - 8 });
    }
  }, []);

  const handleNodeMouseMove = useCallback((e: React.MouseEvent) => {
    const rect = containerRef.current?.getBoundingClientRect();
    if (rect) {
      setTooltipPos({ x: e.clientX - rect.left + 12, y: e.clientY - rect.top - 8 });
    }
  }, []);

  const handleNodeClick = useCallback((node: SimNode) => {
    if (node.type === 'APPLICATION') {
      navigate(`/applications/${node.id}`);
    } else {
      // Products don't have a dedicated detail page with slug; navigate to marketplace
      // We could enhance this later
      navigate('/marketplace');
    }
  }, [navigate]);

  const resetView = useCallback(() => {
    setTransform({ x: 0, y: 0, scale: 1 });
  }, []);

  const zoomIn = useCallback(() => {
    setTransform((t) => ({ ...t, scale: Math.min(t.scale * 1.2, 4) }));
  }, []);

  const zoomOut = useCallback(() => {
    setTransform((t) => ({ ...t, scale: Math.max(t.scale / 1.2, 0.3) }));
  }, []);

  useEffect(() => {
    const handleGlobalMouseUp = () => setIsDragging(false);
    window.addEventListener('mouseup', handleGlobalMouseUp);
    return () => window.removeEventListener('mouseup', handleGlobalMouseUp);
  }, []);

  if (isError) {
    return <QueryError message="Unable to load topology data." onRetry={refetch} />;
  }

  return (
    <div className="space-y-6 sm:space-y-8">
      {/* Header */}
      <AnimatedSection>
        <div className="flex flex-col gap-2">
          <h1 className="text-3xl font-bold text-white">Dependency Topology</h1>
          <p className="text-slate-400">
            Interactive graph of application-to-application and application-to-product dependencies.
          </p>
        </div>
      </AnimatedSection>

      {/* Stats */}
      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-24 rounded-lg bg-slate-800 animate-pulse-soft" />
          ))}
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          <AnimatedSection delay={0}>
            <Card className="bg-slate-900 border-slate-800">
              <CardContent className="flex items-center gap-4 py-5">
                <Layers className="h-8 w-8 text-blue-400" />
                <div>
                  <p className="text-xs text-slate-500">Applications</p>
                  <p className="text-2xl font-bold text-white">{stats?.appCount ?? 0}</p>
                </div>
              </CardContent>
            </Card>
          </AnimatedSection>
          <AnimatedSection delay={60}>
            <Card className="bg-slate-900 border-slate-800">
              <CardContent className="flex items-center gap-4 py-5">
                <Package className="h-8 w-8 text-purple-400" />
                <div>
                  <p className="text-xs text-slate-500">Products</p>
                  <p className="text-2xl font-bold text-white">{stats?.productCount ?? 0}</p>
                </div>
              </CardContent>
            </Card>
          </AnimatedSection>
          <AnimatedSection delay={120}>
            <Card className="bg-slate-900 border-slate-800">
              <CardContent className="flex items-center gap-4 py-5">
                <GitBranch className="h-8 w-8 text-emerald-400" />
                <div>
                  <p className="text-xs text-slate-500">App→Product</p>
                  <p className="text-2xl font-bold text-white">{stats?.instanceEdges ?? 0}</p>
                </div>
              </CardContent>
            </Card>
          </AnimatedSection>
          <AnimatedSection delay={180}>
            <Card className="bg-slate-900 border-slate-800">
              <CardContent className="flex items-center gap-4 py-5">
                <GitBranch className="h-8 w-8 text-amber-400" />
                <div>
                  <p className="text-xs text-slate-500">Product→Product</p>
                  <p className="text-2xl font-bold text-white">{stats?.dependencyEdges ?? 0}</p>
                </div>
              </CardContent>
            </Card>
          </AnimatedSection>
          <AnimatedSection delay={240}>
            <Card className="bg-slate-900 border-slate-800">
              <CardContent className="flex items-center gap-4 py-5">
                <GitBranch className="h-8 w-8 text-slate-400" />
                <div>
                  <p className="text-xs text-slate-500">App→App</p>
                  <p className="text-2xl font-bold text-white">{stats?.relatedEdges ?? 0}</p>
                </div>
              </CardContent>
            </Card>
          </AnimatedSection>
        </div>
      )}

      {/* Controls & Legend */}
      <AnimatedSection delay={200}>
        <Card className="bg-slate-900 border-slate-800">
          <CardContent className="p-4">
            <div className="flex flex-col lg:flex-row lg:items-center gap-4">
              {/* Filters */}
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs font-medium text-slate-500 uppercase tracking-wider">Nodes</span>
                <button
                  onClick={() => setShowApps((v) => !v)}
                  className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition-colors border ${
                    showApps ? 'bg-blue-500/10 text-blue-400 border-blue-500/20' : 'bg-slate-800 text-slate-500 border-slate-700'
                  }`}
                >
                  {showApps ? <Eye className="h-3 w-3" /> : <EyeOff className="h-3 w-3" />}
                  Applications
                </button>
                <button
                  onClick={() => setShowProducts((v) => !v)}
                  className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition-colors border ${
                    showProducts ? 'bg-purple-500/10 text-purple-400 border-purple-500/20' : 'bg-slate-800 text-slate-500 border-slate-700'
                  }`}
                >
                  {showProducts ? <Eye className="h-3 w-3" /> : <EyeOff className="h-3 w-3" />}
                  Products
                </button>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs font-medium text-slate-500 uppercase tracking-wider">Edges</span>
                <button
                  onClick={() => setShowInstanceEdges((v) => !v)}
                  className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition-colors border ${
                    showInstanceEdges ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-slate-800 text-slate-500 border-slate-700'
                  }`}
                >
                  {showInstanceEdges ? <Eye className="h-3 w-3" /> : <EyeOff className="h-3 w-3" />}
                  App→Product
                </button>
                <button
                  onClick={() => setShowDependencyEdges((v) => !v)}
                  className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition-colors border ${
                    showDependencyEdges ? 'bg-amber-500/10 text-amber-400 border-amber-500/20' : 'bg-slate-800 text-slate-500 border-slate-700'
                  }`}
                >
                  {showDependencyEdges ? <Eye className="h-3 w-3" /> : <EyeOff className="h-3 w-3" />}
                  Product→Product
                </button>
                <button
                  onClick={() => setShowRelatedEdges((v) => !v)}
                  className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition-colors border ${
                    showRelatedEdges ? 'bg-slate-500/10 text-slate-400 border-slate-500/20' : 'bg-slate-800 text-slate-500 border-slate-700'
                  }`}
                >
                  {showRelatedEdges ? <Eye className="h-3 w-3" /> : <EyeOff className="h-3 w-3" />}
                  App→App
                </button>
              </div>

              <div className="flex items-center gap-2 ml-auto">
                <button onClick={zoomIn} className="p-2 rounded-md bg-slate-800 text-slate-300 hover:bg-slate-700 transition-colors" title="Zoom in">
                  <ZoomIn className="h-4 w-4" />
                </button>
                <button onClick={zoomOut} className="p-2 rounded-md bg-slate-800 text-slate-300 hover:bg-slate-700 transition-colors" title="Zoom out">
                  <ZoomOut className="h-4 w-4" />
                </button>
                <button onClick={resetView} className="p-2 rounded-md bg-slate-800 text-slate-300 hover:bg-slate-700 transition-colors" title="Reset view">
                  <RotateCcw className="h-4 w-4" />
                </button>
              </div>
            </div>
          </CardContent>
        </Card>
      </AnimatedSection>

      {/* Graph */}
      <AnimatedSection delay={250}>
        <Card className="bg-slate-900 border-slate-800 overflow-hidden">
          <CardHeader className="pb-2">
            <CardTitle className="text-white flex items-center justify-between">
              <span className="flex items-center gap-2">
                <GitBranch className="h-5 w-5 text-blue-500" />
                Dependency Graph
              </span>
              <span className="flex items-center gap-1 text-xs text-slate-500 font-normal">
                <Move className="h-3 w-3" />
                Drag to pan · Scroll to zoom · Click nodes to navigate
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="flex items-center justify-center" style={{ height: HEIGHT }}>
                <Skeleton className="w-full h-full rounded-none bg-slate-800 animate-pulse-soft" />
              </div>
            ) : (
              <div
                ref={containerRef}
                className="relative overflow-hidden cursor-grab active:cursor-grabbing"
                style={{ height: HEIGHT }}
                onWheel={handleWheel}
                onMouseDown={handleMouseDown}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
                onMouseLeave={handleMouseUp}
              >
                <svg
                  ref={svgRef}
                  width="100%"
                  height={HEIGHT}
                  viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
                  className="bg-slate-950"
                >
                  <g transform={`translate(${transform.x},${transform.y}) scale(${transform.scale})`}>
                    {/* Grid */}
                    <defs>
                      <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
                        <path d="M 40 0 L 0 0 0 40" fill="none" stroke="#1e293b" strokeWidth="0.5" />
                      </pattern>
                    </defs>
                    <rect width={WIDTH} height={HEIGHT} fill="url(#grid)" />

                    {/* Edges */}
                    {visibleEdges.map((edge) => {
                      const src = simNodes.find((n) => n.id === edge.source);
                      const tgt = simNodes.find((n) => n.id === edge.target);
                      if (!src || !tgt) return null;
                      const style = edgeStyles[edge.type];
                      return (
                        <g key={edge.id}>
                          <line
                            x1={src.x}
                            y1={src.y}
                            x2={tgt.x}
                            y2={tgt.y}
                            stroke={style.stroke}
                            strokeWidth={style.width}
                            strokeDasharray={style.dash}
                            opacity={0.6}
                          />
                        </g>
                      );
                    })}

                    {/* Nodes */}
                    {visibleNodes.map((node) => {
                      const color =
                        node.type === 'APPLICATION'
                          ? continuityColors[node.continuityColor || ''] || '#64748b'
                          : categoryColors[node.category || ''] || '#64748b';

                      return (
                        <g
                          key={node.id}
                          transform={`translate(${node.x},${node.y})`}
                          className="cursor-pointer"
                          onMouseEnter={(e) => handleNodeMouseEnter(node, e)}
                          onMouseMove={handleNodeMouseMove}
                          onMouseLeave={() => setHoveredNode(null)}
                          onClick={() => handleNodeClick(node)}
                        >
                          {/* Glow */}
                          <circle
                            r={node.radius + 4}
                            fill={color}
                            opacity={hoveredNode?.id === node.id ? 0.15 : 0}
                            className="transition-opacity duration-200"
                          />
                          {/* Node body */}
                          <circle
                            r={node.radius}
                            fill="#0f172a"
                            stroke={color}
                            strokeWidth={2}
                            className="transition-all duration-200"
                            style={{
                              filter: hoveredNode?.id === node.id ? `drop-shadow(0 0 6px ${color})` : 'none',
                            }}
                          />
                          {/* Icon indicator */}
                          {node.type === 'APPLICATION' ? (
                            <text
                              textAnchor="middle"
                              dominantBaseline="central"
                              fill={color}
                              fontSize={14}
                              fontFamily="sans-serif"
                              pointerEvents="none"
                            >
                              A
                            </text>
                          ) : (
                            <text
                              textAnchor="middle"
                              dominantBaseline="central"
                              fill={color}
                              fontSize={12}
                              fontFamily="sans-serif"
                              pointerEvents="none"
                            >
                              P
                            </text>
                          )}
                          {/* Label */}
                          <text
                            y={node.radius + 14}
                            textAnchor="middle"
                            fill="#cbd5e1"
                            fontSize={10}
                            fontFamily="sans-serif"
                            fontWeight={500}
                            pointerEvents="none"
                          >
                            {node.name.length > 16 ? node.name.slice(0, 14) + '…' : node.name}
                          </text>
                        </g>
                      );
                    })}
                  </g>
                </svg>

                {/* Tooltip */}
                {hoveredNode && (
                  <div
                    className="absolute pointer-events-none z-10 rounded-lg border border-slate-700 bg-slate-900/95 px-3 py-2 shadow-xl backdrop-blur-sm"
                    style={{ left: tooltipPos.x, top: tooltipPos.y }}
                  >
                    <div className="flex items-center gap-2">
                      {hoveredNode.type === 'APPLICATION' ? (
                        <Layers className="h-4 w-4 text-blue-400" />
                      ) : (
                        <Package className="h-4 w-4 text-purple-400" />
                      )}
                      <span className="text-sm font-semibold text-white">{hoveredNode.name}</span>
                    </div>
                    <div className="mt-1 space-y-0.5 text-xs text-slate-400">
                      <p>
                        Type:{' '}
                        <span className="text-slate-300">
                          {hoveredNode.type === 'APPLICATION' ? 'Application' : 'Product'}
                        </span>
                      </p>
                      {hoveredNode.continuityLevel && (
                        <p>
                          Continuity:{' '}
                          <span className="text-slate-300">{hoveredNode.continuityLevel}</span>
                        </p>
                      )}
                      {hoveredNode.category && (
                        <p>
                          Category: <span className="text-slate-300">{hoveredNode.category}</span>
                        </p>
                      )}
                      <p>
                        Instances: <span className="text-slate-300">{hoveredNode.instanceCount ?? 0}</span>
                      </p>
                    </div>
                    <div className="mt-1.5 flex items-center gap-1 text-[10px] text-blue-400">
                      <MousePointerClick className="h-3 w-3" />
                      Click to navigate
                    </div>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </AnimatedSection>

      {/* Legend */}
      <AnimatedSection delay={300}>
        <Card className="bg-slate-900 border-slate-800">
          <CardHeader className="pb-2">
            <CardTitle className="text-white flex items-center gap-2 text-base">
              <Info className="h-4 w-4 text-slate-500" />
              Legend
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {/* Node types */}
              <div className="space-y-2">
                <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">Node Types</p>
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 rounded-full border-2 border-blue-400 bg-slate-900" />
                  <span className="text-sm text-slate-300">Application</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 rounded-full border-2 border-purple-400 bg-slate-900" />
                  <span className="text-sm text-slate-300">Product</span>
                </div>
              </div>

              {/* Continuity colors */}
              <div className="space-y-2">
                <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">Continuity Levels</p>
                {Object.entries(continuityColors).map(([name, color]) => (
                  <div key={name} className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: color }} />
                    <span className="text-sm text-slate-300 capitalize">{name}</span>
                  </div>
                ))}
              </div>

              {/* Edge types */}
              <div className="space-y-2">
                <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">Edge Types</p>
                <div className="flex items-center gap-2">
                  <div className="w-8 h-0.5 bg-slate-400" />
                  <span className="text-sm text-slate-300">App uses Product</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-8 h-0.5 bg-slate-500" style={{ backgroundImage: 'repeating-linear-gradient(90deg, #94a3b8 0, #94a3b8 4px, transparent 4px, transparent 7px)', height: 2 }} />
                  <span className="text-sm text-slate-300">Product depends on Product</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-8 h-0.5 bg-slate-600" style={{ backgroundImage: 'repeating-linear-gradient(90deg, #475569 0, #475569 2px, transparent 2px, transparent 6px)', height: 2 }} />
                  <span className="text-sm text-slate-300">Apps share Product</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </AnimatedSection>
    </div>
  );
}
