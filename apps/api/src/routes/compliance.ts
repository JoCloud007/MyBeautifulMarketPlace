import { Router } from 'express';
import { ResiliencyLevel, InstanceStatus, HealthStatus, ApprovalStatus } from '@prisma/client';
import { prisma } from '../db';

const router = Router();

export interface ComplianceGap {
  id: string;
  applicationId: string;
  severity: 'CRITICAL' | 'WARNING' | 'INFO';
  category: 'INSTANCE_COUNT' | 'AZ_DISTRIBUTION' | 'RESILIENCY' | 'HEALTH' | 'ENVIRONMENT';
  message: string;
  recommendation: string;
}

export interface ComplianceMetrics {
  totalInstances: number;
  runningInstances: number;
  uniqueAZs: number;
  maxResiliency: ResiliencyLevel | null;
  unhealthyInstances: number;
  degradedInstances: number;
  prdInstances: number;
}

export interface ApplicationCompliance {
  applicationId: string;
  applicationName: string;
  continuityLevel: {
    id: string;
    name: string;
    rtoMinutes: number;
    rpoMinutes: number;
    description: string | null;
    color: string;
  };
  score: number;
  status: 'COMPLIANT' | 'AT_RISK' | 'NON_COMPLIANT';
  gaps: ComplianceGap[];
  metrics: ComplianceMetrics;
}

// GET /api/compliance
router.get('/', async (_req, res, next) => {
  try {
    const applications = await prisma.application.findMany({
      include: { continuityLevel: true },
    });

    const instances = await prisma.instance.findMany({
      take: 5000,
      include: {
        application: true,
        healthChecks: { orderBy: { checkedAt: 'desc' }, take: 1 },
      },
    });

    const forecasts = await prisma.forecast.findMany({
      include: { lines: true },
    });

    const results: ApplicationCompliance[] = applications.map((app) => {
      const appInstances = instances.filter((i) => i.applicationId === app.id);
      const appForecasts = forecasts.filter((f) => f.applicationId === app.id && f.status === ApprovalStatus.APPROVED);

      const runningInstances = appInstances.filter((i) => i.status === InstanceStatus.RUNNING);
      const uniqueAZs = new Set(runningInstances.map((i) => i.azCode)).size;
      const prdInstances = appInstances.filter((i) => i.environment === 'PRD');

      // Determine max resiliency from APPROVED forecast lines only
      const allResiliencies = appForecasts.flatMap((f) => f.lines.map((l) => l.resiliency));
      const maxResiliency = allResiliencies.length > 0
        ? allResiliencies.includes(ResiliencyLevel.MULTI_AZ)
          ? ResiliencyLevel.MULTI_AZ
          : allResiliencies.includes(ResiliencyLevel.HA)
            ? ResiliencyLevel.HA
            : ResiliencyLevel.STANDARD
        : null;

      // Health status per instance (latest check)
      let unhealthyInstances = 0;
      let degradedInstances = 0;
      for (const inst of appInstances) {
        const latest = inst.healthChecks[0];
        if (latest) {
          if (latest.status === HealthStatus.UNHEALTHY) unhealthyInstances++;
          if (latest.status === HealthStatus.DEGRADED) degradedInstances++;
        } else if (inst.status === InstanceStatus.RUNNING) {
          // No health checks for a running instance is a monitoring gap
          unhealthyInstances++;
        }
      }

      const metrics: ComplianceMetrics = {
        totalInstances: appInstances.length,
        runningInstances: runningInstances.length,
        uniqueAZs,
        maxResiliency,
        unhealthyInstances,
        degradedInstances,
        prdInstances: prdInstances.length,
      };

      const gaps: ComplianceGap[] = [];
      let score = 100;
      const clName = app.continuityLevel?.name ?? 'LOW';

      // ── LOW ──
      if (clName === 'LOW') {
        if (runningInstances.length === 0) {
          gaps.push({
            id: `${app.id}-no-running`,
            applicationId: app.id,
            severity: 'CRITICAL',
            category: 'INSTANCE_COUNT',
            message: 'No running instances',
            recommendation: 'Provision at least one instance for this application',
          });
          score -= 30;
        }
        if (unhealthyInstances > 0) {
          gaps.push({
            id: `${app.id}-unhealthy`,
            applicationId: app.id,
            severity: 'WARNING',
            category: 'HEALTH',
            message: `${unhealthyInstances} unhealthy instance(s)`,
            recommendation: 'Investigate and restore instance health',
          });
          score -= 10;
        }
      }

      // ── MODERATE ──
      if (clName === 'MODERATE') {
        if (runningInstances.length < 2) {
          gaps.push({
            id: `${app.id}-insufficient-instances`,
            applicationId: app.id,
            severity: 'CRITICAL',
            category: 'INSTANCE_COUNT',
            message: `Only ${runningInstances.length} running instance(s) — MODERATE requires HA pair`,
            recommendation: 'Provision at least 2 running instances for high availability',
          });
          score -= 25;
        }
        if (maxResiliency !== ResiliencyLevel.HA && maxResiliency !== ResiliencyLevel.MULTI_AZ) {
          gaps.push({
            id: `${app.id}-no-ha`,
            applicationId: app.id,
            severity: 'WARNING',
            category: 'RESILIENCY',
            message: 'No HA resiliency configured in forecasts',
            recommendation: 'Set forecast line resiliency to HA or MULTI_AZ',
          });
          score -= 15;
        }
        if (uniqueAZs < 2 && runningInstances.length >= 2) {
          gaps.push({
            id: `${app.id}-single-az`,
            applicationId: app.id,
            severity: 'WARNING',
            category: 'AZ_DISTRIBUTION',
            message: 'HA instances are in a single availability zone',
            recommendation: 'Distribute instances across at least 2 AZs',
          });
          score -= 10;
        }
        if (unhealthyInstances > 0) {
          gaps.push({
            id: `${app.id}-unhealthy`,
            applicationId: app.id,
            severity: 'WARNING',
            category: 'HEALTH',
            message: `${unhealthyInstances} unhealthy instance(s)`,
            recommendation: 'Investigate and restore instance health',
          });
          score -= 10;
        }
      }

      // ── SERIOUS ──
      if (clName === 'SERIOUS') {
        if (runningInstances.length < 2) {
          gaps.push({
            id: `${app.id}-insufficient-instances`,
            applicationId: app.id,
            severity: 'CRITICAL',
            category: 'INSTANCE_COUNT',
            message: `Only ${runningInstances.length} running instance(s) — SERIOUS requires Multi-AZ`,
            recommendation: 'Provision at least 2 running instances across multiple AZs',
          });
          score -= 20;
        }
        if (maxResiliency !== ResiliencyLevel.MULTI_AZ) {
          gaps.push({
            id: `${app.id}-no-multi-az`,
            applicationId: app.id,
            severity: 'CRITICAL',
            category: 'RESILIENCY',
            message: 'MULTI_AZ resiliency not configured in forecasts',
            recommendation: 'Set forecast line resiliency to MULTI_AZ',
          });
          score -= 20;
        }
        if (uniqueAZs < 2) {
          gaps.push({
            id: `${app.id}-single-az`,
            applicationId: app.id,
            severity: 'CRITICAL',
            category: 'AZ_DISTRIBUTION',
            message: `Instances span only ${uniqueAZs} AZ — SERIOUS requires Multi-AZ`,
            recommendation: 'Distribute instances across at least 2 availability zones',
          });
          score -= 20;
        }
        if (unhealthyInstances > 0 && prdInstances.length > 0) {
          gaps.push({
            id: `${app.id}-unhealthy-prd`,
            applicationId: app.id,
            severity: 'WARNING',
            category: 'HEALTH',
            message: `${unhealthyInstances} unhealthy instance(s) in production`,
            recommendation: 'Restore health or fail over to healthy instances',
          });
          score -= 10;
        }
      }

      // ── EXTREME ──
      if (clName === 'EXTREME') {
        if (runningInstances.length < 3) {
          gaps.push({
            id: `${app.id}-insufficient-instances`,
            applicationId: app.id,
            severity: 'CRITICAL',
            category: 'INSTANCE_COUNT',
            message: `Only ${runningInstances.length} running instance(s) — EXTREME requires Active-Active (≥3)`,
            recommendation: 'Provision at least 3 running instances',
          });
          score -= 20;
        }
        if (maxResiliency !== ResiliencyLevel.MULTI_AZ) {
          gaps.push({
            id: `${app.id}-no-multi-az`,
            applicationId: app.id,
            severity: 'CRITICAL',
            category: 'RESILIENCY',
            message: 'MULTI_AZ resiliency not configured',
            recommendation: 'Set all forecast line resiliency to MULTI_AZ',
          });
          score -= 15;
        }
        if (uniqueAZs < 3) {
          gaps.push({
            id: `${app.id}-insufficient-azs`,
            applicationId: app.id,
            severity: 'CRITICAL',
            category: 'AZ_DISTRIBUTION',
            message: `Instances span only ${uniqueAZs} AZ(s) — EXTREME requires ≥3`,
            recommendation: 'Distribute instances across at least 3 availability zones',
          });
          score -= 20;
        }
        if (unhealthyInstances > 0) {
          gaps.push({
            id: `${app.id}-unhealthy`,
            applicationId: app.id,
            severity: 'CRITICAL',
            category: 'HEALTH',
            message: `${unhealthyInstances} unhealthy instance(s)`,
            recommendation: 'Immediately restore health or trigger failover',
          });
          score -= 15;
        }
        if (degradedInstances > 0) {
          gaps.push({
            id: `${app.id}-degraded`,
            applicationId: app.id,
            severity: 'WARNING',
            category: 'HEALTH',
            message: `${degradedInstances} degraded instance(s)`,
            recommendation: 'Investigate performance degradation before it becomes critical',
          });
          score -= 10;
        }
        if (prdInstances.some((i) => i.status === InstanceStatus.STOPPED)) {
          gaps.push({
            id: `${app.id}-stopped-prd`,
            applicationId: app.id,
            severity: 'WARNING',
            category: 'ENVIRONMENT',
            message: 'Stopped instance(s) in production environment',
            recommendation: 'Restart stopped production instances or decommission them',
          });
          score -= 10;
        }
      }

      // General info gaps (all tiers)
      if (appInstances.length > 0 && prdInstances.length === 0) {
        gaps.push({
          id: `${app.id}-no-prd`,
          applicationId: app.id,
          severity: 'INFO',
          category: 'ENVIRONMENT',
          message: 'No instances in production environment',
          recommendation: 'Consider promoting instances to PRD for production workloads',
        });
      }

      score = Math.max(0, Math.min(100, score));

      const status: ApplicationCompliance['status'] =
        score === 100 ? 'COMPLIANT' : score >= 80 ? 'AT_RISK' : 'NON_COMPLIANT';

      return {
        applicationId: app.id,
        applicationName: app.name,
        continuityLevel: app.continuityLevel,
        score,
        status,
        gaps,
        metrics,
      };
    });

    // Sort by score ascending (worst first)
    results.sort((a, b) => a.score - b.score);

    res.json(results);
  } catch (err) {
    next(err);
  }
});

export { router as complianceRoutes };
