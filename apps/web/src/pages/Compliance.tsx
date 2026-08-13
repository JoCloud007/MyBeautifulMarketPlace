import { useMemo } from 'react';
import { useCompliance } from '@/hooks/useApi';
import { useScrollReveal } from '@/hooks/useScrollReveal';
import QueryError from '@/components/QueryError';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  ShieldCheck,
  AlertTriangle,
  XCircle,
  CheckCircle,
  Server,
  Globe,
  Zap,
  Activity,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { useState } from 'react';
import type { ComplianceSeverity, ComplianceStatus, ApplicationCompliance } from '@cloudmarket/shared-types';

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

const statusConfig: Record<ComplianceStatus, { label: string; icon: React.ElementType; badgeClass: string }> = {
  COMPLIANT: { label: 'Compliant', icon: CheckCircle, badgeClass: 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20' },
  AT_RISK: { label: 'At Risk', icon: AlertTriangle, badgeClass: 'bg-amber-500/10 text-amber-500 border-amber-500/20' },
  NON_COMPLIANT: { label: 'Non-Compliant', icon: XCircle, badgeClass: 'bg-red-500/10 text-red-500 border-red-500/20' },
};

const severityConfig: Record<ComplianceSeverity, { color: string; bg: string; label: string }> = {
  CRITICAL: { color: 'text-red-500', bg: 'bg-red-500/10', label: 'Critical' },
  WARNING: { color: 'text-amber-500', bg: 'bg-amber-500/10', label: 'Warning' },
  INFO: { color: 'text-blue-500', bg: 'bg-blue-500/10', label: 'Info' },
};

const continuityColor: Record<string, string> = {
  LOW: 'bg-green-500/10 text-green-500 border-green-500/20',
  MODERATE: 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20',
  SERIOUS: 'bg-orange-500/10 text-orange-500 border-orange-500/20',
  EXTREME: 'bg-red-500/10 text-red-500 border-red-500/20',
};

function ScoreRing({ score }: { score: number }) {
  const circumference = 2 * Math.PI * 18;
  const offset = circumference - (score / 100) * circumference;
  const color = score === 100 ? '#10b981' : score >= 80 ? '#f59e0b' : '#ef4444';

  return (
    <div className="relative flex items-center justify-center w-14 h-14">
      <svg className="w-14 h-14 -rotate-90" viewBox="0 0 40 40">
        <circle cx="20" cy="20" r="18" stroke="currentColor" strokeWidth="3" fill="none" className="text-slate-800" />
        <circle
          cx="20"
          cy="20"
          r="18"
          stroke={color}
          strokeWidth="3"
          fill="none"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          className="transition-all duration-700"
        />
      </svg>
      <span className="absolute text-sm font-bold text-white">{score}</span>
    </div>
  );
}

function ComplianceCard({ compliance }: { compliance: ApplicationCompliance }) {
  const [expanded, setExpanded] = useState(false);
  const status = statusConfig[compliance.status];
  const StatusIcon = status.icon;

  return (
    <div className="rounded-lg border border-slate-800 bg-slate-950/50 overflow-hidden">
      <div
        className="flex items-center gap-4 p-4 cursor-pointer hover:bg-slate-900/50 transition-colors"
        onClick={() => setExpanded(!expanded)}
        role="button"
        aria-expanded={expanded}
      >
        <ScoreRing score={compliance.score} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="text-sm font-semibold text-white">{compliance.applicationName}</h3>
            <Badge variant="outline" className={continuityColor[compliance.continuityLevel.name] || 'bg-slate-500/10 text-slate-400 border-slate-500/20'}>
              {compliance.continuityLevel.name}
            </Badge>
            <Badge variant="outline" className={status.badgeClass}>
              <StatusIcon className="h-3 w-3 mr-1" />
              {status.label}
            </Badge>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            RTO {compliance.continuityLevel.rtoMinutes}m · RPO {compliance.continuityLevel.rpoMinutes}m
            {' · '}
            {compliance.metrics.runningInstances}/{compliance.metrics.totalInstances} running
            {' · '}
            {compliance.metrics.uniqueAZs} AZ{compliance.metrics.uniqueAZs !== 1 ? 's' : ''}
            {compliance.metrics.maxResiliency && ` · ${compliance.metrics.maxResiliency}`}
          </p>
        </div>
        <div className="shrink-0 text-slate-500">
          {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </div>
      </div>

      {expanded && (
        <div className="border-t border-slate-800 px-4 py-3 space-y-3">
          {compliance.gaps.length === 0 ? (
            <div className="flex items-center gap-2 text-sm text-emerald-400">
              <CheckCircle className="h-4 w-4" />
              No gaps detected — fully compliant
            </div>
          ) : (
            <div className="space-y-2">
              {compliance.gaps.map((gap) => {
                const sev = severityConfig[gap.severity];
                return (
                  <div key={gap.id} className={`rounded-md border border-slate-800 px-3 py-2.5 ${sev.bg}`}>
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`text-xs font-semibold uppercase tracking-wider ${sev.color}`}>{sev.label}</span>
                      <span className="text-xs text-slate-400">{gap.category}</span>
                    </div>
                    <p className={`text-sm font-medium ${sev.color}`}>{gap.message}</p>
                    <p className="text-xs text-slate-400 mt-1">{gap.recommendation}</p>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function CompliancePage() {
  const { data: complianceData, isLoading, isError } = useCompliance();
  const [filterStatus, setFilterStatus] = useState<ComplianceStatus | 'ALL'>('ALL');

  const stats = useMemo(() => {
    if (!complianceData) return null;
    const total = complianceData.length;
    const compliant = complianceData.filter((c) => c.status === 'COMPLIANT').length;
    const atRisk = complianceData.filter((c) => c.status === 'AT_RISK').length;
    const nonCompliant = complianceData.filter((c) => c.status === 'NON_COMPLIANT').length;
    const avgScore = total > 0 ? Math.round(complianceData.reduce((sum, c) => sum + c.score, 0) / total) : 0;
    return { total, compliant, atRisk, nonCompliant, avgScore };
  }, [complianceData]);

  const filtered = useMemo(() => {
    if (!complianceData) return [];
    if (filterStatus === 'ALL') return complianceData;
    return complianceData.filter((c) => c.status === filterStatus);
  }, [complianceData, filterStatus]);

  const gapSummary = useMemo(() => {
    if (!complianceData) return null;
    const allGaps = complianceData.flatMap((c) => c.gaps);
    const critical = allGaps.filter((g) => g.severity === 'CRITICAL').length;
    const warning = allGaps.filter((g) => g.severity === 'WARNING').length;
    const info = allGaps.filter((g) => g.severity === 'INFO').length;
    return { total: allGaps.length, critical, warning, info };
  }, [complianceData]);

  if (isError) {
    return <QueryError message="Unable to load compliance data." />;
  }

  return (
    <div className="space-y-6 sm:space-y-8">
      <AnimatedSection>
        <div className="flex flex-col gap-2">
          <h1 className="text-3xl font-bold text-white">Continuity Compliance</h1>
          <p className="text-slate-400">
            Automated RTO/RPO scoring and gap detection across all applications.
          </p>
        </div>
      </AnimatedSection>

      {/* Stats */}
      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-28 rounded-lg bg-slate-800 animate-pulse-soft" />
          ))}
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <AnimatedSection delay={0}>
            <Card className="bg-slate-900 border-slate-800 transition-all duration-300 hover:border-slate-700 hover:-translate-y-0.5">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-slate-400">Average Score</CardTitle>
                <ShieldCheck className="h-4 w-4 text-blue-400" />
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-white">{stats?.avgScore}</div>
                <p className="text-xs text-slate-500 mt-1">Out of 100</p>
              </CardContent>
            </Card>
          </AnimatedSection>
          <AnimatedSection delay={60}>
            <Card className="bg-slate-900 border-slate-800 transition-all duration-300 hover:border-slate-700 hover:-translate-y-0.5">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-slate-400">Compliant</CardTitle>
                <CheckCircle className="h-4 w-4 text-emerald-400" />
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-white">{stats?.compliant}</div>
                <p className="text-xs text-slate-500 mt-1">{stats?.total} applications total</p>
              </CardContent>
            </Card>
          </AnimatedSection>
          <AnimatedSection delay={120}>
            <Card className="bg-slate-900 border-slate-800 transition-all duration-300 hover:border-slate-700 hover:-translate-y-0.5">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-slate-400">At Risk</CardTitle>
                <AlertTriangle className="h-4 w-4 text-amber-400" />
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-white">{stats?.atRisk}</div>
                <p className="text-xs text-slate-500 mt-1">Score 80–99</p>
              </CardContent>
            </Card>
          </AnimatedSection>
          <AnimatedSection delay={180}>
            <Card className="bg-slate-900 border-slate-800 transition-all duration-300 hover:border-slate-700 hover:-translate-y-0.5">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-slate-400">Non-Compliant</CardTitle>
                <XCircle className="h-4 w-4 text-red-400" />
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-white">{stats?.nonCompliant}</div>
                <p className="text-xs text-slate-500 mt-1">Score &lt; 80</p>
              </CardContent>
            </Card>
          </AnimatedSection>
        </div>
      )}

      {/* Gap Summary */}
      <AnimatedSection delay={200}>
        <Card className="bg-slate-900 border-slate-800">
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-2">
              <Activity className="h-5 w-5 text-purple-500" />
              Gap Summary
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="grid gap-3 sm:grid-cols-3">
                {Array.from({ length: 3 }).map((_, i) => (
                  <Skeleton key={i} className="h-16 rounded-lg bg-slate-800 animate-pulse-soft" />
                ))}
              </div>
            ) : (
              <div className="grid gap-3 sm:grid-cols-3">
                <div className="rounded-lg border border-red-500/20 bg-red-500/10 px-4 py-3">
                  <div className="flex items-center gap-2">
                    <XCircle className="h-5 w-5 text-red-500" />
                    <span className="text-2xl font-bold text-red-500">{gapSummary?.critical}</span>
                  </div>
                  <p className="text-xs text-red-400 mt-1">Critical gaps</p>
                </div>
                <div className="rounded-lg border border-amber-500/20 bg-amber-500/10 px-4 py-3">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="h-5 w-5 text-amber-500" />
                    <span className="text-2xl font-bold text-amber-500">{gapSummary?.warning}</span>
                  </div>
                  <p className="text-xs text-amber-400 mt-1">Warnings</p>
                </div>
                <div className="rounded-lg border border-blue-500/20 bg-blue-500/10 px-4 py-3">
                  <div className="flex items-center gap-2">
                    <ShieldCheck className="h-5 w-5 text-blue-500" />
                    <span className="text-2xl font-bold text-blue-500">{gapSummary?.info}</span>
                  </div>
                  <p className="text-xs text-blue-400 mt-1">Recommendations</p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </AnimatedSection>

      {/* Filter + List */}
      <AnimatedSection delay={250}>
        <Card className="bg-slate-900 border-slate-800">
          <CardHeader>
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <CardTitle className="text-white flex items-center gap-2">
                <Server className="h-5 w-5 text-blue-500" />
                Application Compliance
              </CardTitle>
              <div className="flex gap-2">
                {(['ALL', 'COMPLIANT', 'AT_RISK', 'NON_COMPLIANT'] as const).map((s) => (
                  <button
                    key={s}
                    onClick={() => setFilterStatus(s)}
                    className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                      filterStatus === s
                        ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                        : 'bg-slate-800 text-slate-400 border border-slate-700 hover:bg-slate-700'
                    }`}
                  >
                    {s === 'ALL' ? 'All' : statusConfig[s].label}
                  </button>
                ))}
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-3">
                {Array.from({ length: 4 }).map((_, i) => (
                  <Skeleton key={i} className="h-20 rounded-lg bg-slate-800 animate-pulse-soft" />
                ))}
              </div>
            ) : filtered.length === 0 ? (
              <div className="text-center py-8">
                <Globe className="mx-auto h-10 w-10 text-slate-700" />
                <p className="mt-2 text-sm text-slate-500">No applications match the selected filter</p>
              </div>
            ) : (
              <div className="space-y-3">
                {filtered.map((compliance) => (
                  <ComplianceCard key={compliance.applicationId} compliance={compliance} />
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </AnimatedSection>

      {/* Scoring Legend */}
      <AnimatedSection delay={300}>
        <Card className="bg-slate-900 border-slate-800">
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-2">
              <Zap className="h-5 w-5 text-yellow-500" />
              Scoring Rules
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {[
                { name: 'LOW', rto: '24h', rpo: '4h', desc: '≥1 running instance' },
                { name: 'MODERATE', rto: '8h', rpo: '1h', desc: '≥2 instances, HA resiliency' },
                { name: 'SERIOUS', rto: '4h', rpo: '15min', desc: '≥2 instances, Multi-AZ, ≥2 AZs' },
                { name: 'EXTREME', rto: '1h', rpo: '5min', desc: '≥3 instances, Multi-AZ, ≥3 AZs' },
              ].map((tier) => (
                <div key={tier.name} className="rounded-lg border border-slate-800 bg-slate-950/50 p-3">
                  <Badge variant="outline" className={continuityColor[tier.name] || ''}>
                    {tier.name}
                  </Badge>
                  <p className="text-xs text-slate-400 mt-2">
                    RTO {tier.rto} · RPO {tier.rpo}
                  </p>
                  <p className="text-xs text-slate-500 mt-1">{tier.desc}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </AnimatedSection>
    </div>
  );
}
