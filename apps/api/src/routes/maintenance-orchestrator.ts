import { Router } from 'express';
import { ResiliencyLevel, InstanceStatus, HealthStatus, LifecyclePhase, MaintenanceStatus } from '@prisma/client';
import { z } from 'zod';
import { prisma } from '../db';

const router = Router();

// Alert severity and category types
export type AlertSeverity = 'CRITICAL' | 'WARNING' | 'INFO';
export type AlertCategory = 'LIFECYCLE' | 'COMPLIANCE' | 'HEALTH' | 'SCHEDULING' | 'MAINTENANCE';

export interface MaintenanceAlert {
  id: string;
  severity: AlertSeverity;
  category: AlertCategory;
  title: string;
  message: string;
  affectedResource: {
    type: 'APPLICATION' | 'INSTANCE' | 'PRODUCT' | 'MAINTENANCE_WINDOW';
    id: string;
    name: string;
  };
  suggestedAction: string;
  createdAt: string;
  expiresAt?: string;
}

export interface MaintenanceRecommendation {
  id: string;
  priority: number;
  title: string;
  description: string;
  category: AlertCategory;
  affectedApplicationId: string;
  affectedApplicationName: string;
  suggestedWindow: {
    startTime: string;
    endTime: string;
    durationHours: number;
    reason: string;
  };
  rationale: string[];
  estimatedImpact: 'LOW' | 'MEDIUM' | 'HIGH';
}

export interface MaintenanceImpact {
  canProceed: boolean;
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  affectedApplications: {
    applicationId: string;
    applicationName: string;
    continuityLevel: string;
    runningInstances: number;
    impact: string;
  }[];
  complianceImpact: {
    currentScore: number;
    projectedScore: number;
    gapsCreated: string[];
  };
  conflictingWindows: {
    id: string;
    title: string;
    startTime: string;
    endTime: string;
  }[];
  lifecycleWarnings: {
    productId: string;
    productName: string;
    phase: LifecyclePhase;
    warning: string;
  }[];
  recommendations: string[];
}

export interface OrchestratorStats {
  totalAlerts: number;
  criticalAlerts: number;
  warningAlerts: number;
  infoAlerts: number;
  recommendations: number;
  upcomingMaintenanceWindows: number;
  overdueWindows: number;
  lifecycleTransitions30Days: number;
  unhealthyInstances: number;
}

// Impact analysis request schema
const impactSchema = z.object({
  applicationId: z.string().uuid(),
  startTime: z.string().datetime(),
  endTime: z.string().datetime(),
  affectedInstanceIds: z.array(z.string().uuid()).optional(),
});

// Helper: days between dates (safe against invalid inputs)
function daysBetween(a: Date, b: Date): number {
  const aTime = a.getTime();
  const bTime = b.getTime();
  if (isNaN(aTime) || isNaN(bTime)) return Infinity;
  return Math.floor((bTime - aTime) / (1000 * 60 * 60 * 24));
}

// Helper: compute compliance score for an application (simplified from compliance.ts)
async function computeAppCompliance(appId: string): Promise<{ score: number; gaps: string[] }> {
  const app = await prisma.application.findUnique({
    where: { id: appId },
    include: { continuityLevel: true },
  });
  if (!app) return { score: 0, gaps: ['Application not found'] };

  const appInstances = await prisma.instance.findMany({
    where: { applicationId: appId },
    include: { healthChecks: { orderBy: { checkedAt: 'desc' }, take: 1 } },
  });

  const runningInstances = appInstances.filter((i) => i.status === InstanceStatus.RUNNING);
  const uniqueAZs = new Set(runningInstances.map((i) => i.azCode)).size;
  let unhealthy = 0;
  for (const inst of appInstances) {
    const latest = inst.healthChecks[0];
    if (latest && latest.status === HealthStatus.UNHEALTHY) unhealthy++;
  }

  let score = 100;
  const gaps: string[] = [];
  const clName = app.continuityLevel?.name ?? 'LOW';

  if (clName === 'LOW') {
    if (runningInstances.length === 0) { score -= 30; gaps.push('No running instances'); }
    if (unhealthy > 0) { score -= 10; gaps.push(`${unhealthy} unhealthy instance(s)`); }
  } else if (clName === 'MODERATE') {
    if (runningInstances.length < 2) { score -= 25; gaps.push('Insufficient running instances for HA'); }
    if (uniqueAZs < 2 && runningInstances.length >= 2) { score -= 10; gaps.push('Instances in single AZ'); }
    if (unhealthy > 0) { score -= 10; gaps.push(`${unhealthy} unhealthy instance(s)`); }
  } else if (clName === 'SERIOUS') {
    if (runningInstances.length < 2) { score -= 20; gaps.push('Insufficient instances for Multi-AZ'); }
    if (uniqueAZs < 2) { score -= 20; gaps.push('Instances span only 1 AZ'); }
    if (unhealthy > 0) { score -= 10; gaps.push(`${unhealthy} unhealthy PRD instance(s)`); }
  } else if (clName === 'EXTREME') {
    if (runningInstances.length < 3) { score -= 20; gaps.push('Insufficient instances for Active-Active'); }
    if (uniqueAZs < 3) { score -= 20; gaps.push('Instances span fewer than 3 AZs'); }
    if (unhealthy > 0) { score -= 15; gaps.push(`${unhealthy} unhealthy instance(s)`); }
  }

  return { score: Math.max(0, score), gaps };
}

// GET /api/maintenance-orchestrator/alerts
router.get('/alerts', async (_req, res, next) => {
  try {
    const now = new Date();
    const alerts: MaintenanceAlert[] = [];

    // ── Lifecycle alerts ──
    const osVersions = await prisma.osVersion.findMany({
      include: { os: true },
    });

    for (const v of osVersions) {
      const eolDate = new Date(v.eolDate);
      const extendedEnd = new Date(v.extendedSupportEnd);
      const daysToEol = daysBetween(now, eolDate);
      const daysToExtendedEnd = daysBetween(now, extendedEnd);

      if (v.phase === LifecyclePhase.NO_SUPPORT && daysToEol <= 30 && daysToEol > 0) {
        alerts.push({
          id: `lifecycle-eol-${v.id}`,
          severity: 'CRITICAL',
          category: 'LIFECYCLE',
          title: `OS approaching EOL: ${v.os.name} ${v.version}`,
          message: `${v.os.name} ${v.version} will reach End-of-Life in ${daysToEol} days (${eolDate.toDateString()}).`,
          affectedResource: { type: 'PRODUCT', id: v.osId, name: `${v.os.name} ${v.version}` },
          suggestedAction: 'Plan migration to a supported version before EOL.',
          createdAt: now.toISOString(),
          expiresAt: eolDate.toISOString(),
        });
      }

      if (v.phase === LifecyclePhase.EXTENDED_SUPPORT && daysToExtendedEnd <= 30 && daysToExtendedEnd > 0) {
        alerts.push({
          id: `lifecycle-extended-${v.id}`,
          severity: 'WARNING',
          category: 'LIFECYCLE',
          title: `Extended support ending: ${v.os.name} ${v.version}`,
          message: `Extended support for ${v.os.name} ${v.version} ends in ${daysToExtendedEnd} days.`,
          affectedResource: { type: 'PRODUCT', id: v.osId, name: `${v.os.name} ${v.version}` },
          suggestedAction: 'Upgrade to a version with active support or plan extended maintenance.',
          createdAt: now.toISOString(),
          expiresAt: extendedEnd.toISOString(),
        });
      }

      if (v.phase === LifecyclePhase.EOL) {
        alerts.push({
          id: `lifecycle-eol-reached-${v.id}`,
          severity: 'CRITICAL',
          category: 'LIFECYCLE',
          title: `OS reached EOL: ${v.os.name} ${v.version}`,
          message: `${v.os.name} ${v.version} has reached End-of-Life. No further patches or support available.`,
          affectedResource: { type: 'PRODUCT', id: v.osId, name: `${v.os.name} ${v.version}` },
          suggestedAction: 'Urgent: Migrate to a supported version immediately.',
          createdAt: now.toISOString(),
        });
      }
    }

    // ── Compliance alerts ──
    const applications = await prisma.application.findMany({
      include: { continuityLevel: true },
    });
    const instances = await prisma.instance.findMany({
      include: { healthChecks: { orderBy: { checkedAt: 'desc' }, take: 1 } },
    });

    for (const app of applications) {
      const appInstances = instances.filter((i) => i.applicationId === app.id);
      const runningInstances = appInstances.filter((i) => i.status === InstanceStatus.RUNNING);
      const uniqueAZs = new Set(runningInstances.map((i) => i.azCode)).size;
      let unhealthy = 0;
      for (const inst of appInstances) {
        const latest = inst.healthChecks[0];
        if (latest && latest.status === HealthStatus.UNHEALTHY) unhealthy++;
      }

      const clName = app.continuityLevel?.name ?? 'LOW';
      let criticalGaps = 0;

      if (clName === 'LOW') {
        if (runningInstances.length === 0) criticalGaps++;
      } else if (clName === 'MODERATE') {
        if (runningInstances.length < 2) criticalGaps++;
        if (uniqueAZs < 2 && runningInstances.length >= 2) criticalGaps++;
      } else if (clName === 'SERIOUS') {
        if (runningInstances.length < 2) criticalGaps++;
        if (uniqueAZs < 2) criticalGaps++;
      } else if (clName === 'EXTREME') {
        if (runningInstances.length < 3) criticalGaps++;
        if (uniqueAZs < 3) criticalGaps++;
      }

      if (criticalGaps > 0) {
        alerts.push({
          id: `compliance-${app.id}`,
          severity: 'CRITICAL',
          category: 'COMPLIANCE',
          title: `Compliance gap: ${app.name}`,
          message: `${app.name} (${clName} continuity) has ${criticalGaps} critical infrastructure gap(s).`,
          affectedResource: { type: 'APPLICATION', id: app.id, name: app.name },
          suggestedAction: 'Review compliance dashboard and remediate gaps before scheduling maintenance.',
          createdAt: now.toISOString(),
        });
      }

      if (unhealthy > 0) {
        alerts.push({
          id: `health-${app.id}`,
          severity: 'WARNING',
          category: 'HEALTH',
          title: `${unhealthy} unhealthy instance(s) in ${app.name}`,
          message: `${app.name} has ${unhealthy} instance(s) reporting unhealthy status.`,
          affectedResource: { type: 'APPLICATION', id: app.id, name: app.name },
          suggestedAction: 'Investigate health issues and restore instance health before maintenance.',
          createdAt: now.toISOString(),
        });
      }
    }

    // ── Maintenance window alerts ──
    const windows = await prisma.maintenanceWindow.findMany({
      where: { status: { in: [MaintenanceStatus.SCHEDULED, MaintenanceStatus.IN_PROGRESS] } },
      include: { application: true, instance: true },
    });

    for (const w of windows) {
      const start = new Date(w.startTime);
      const end = new Date(w.endTime);
      if (isNaN(start.getTime()) || isNaN(end.getTime())) continue;

      // Overdue window
      if (end < now && w.status === MaintenanceStatus.SCHEDULED) {
        alerts.push({
          id: `overdue-${w.id}`,
          severity: 'WARNING',
          category: 'MAINTENANCE',
          title: `Overdue maintenance: ${w.title}`,
          message: `Maintenance window "${w.title}" was scheduled to end on ${end.toLocaleString()} but is still marked as SCHEDULED.`,
          affectedResource: {
            type: 'MAINTENANCE_WINDOW',
            id: w.id,
            name: w.title,
          },
          suggestedAction: 'Update the maintenance window status to COMPLETED or CANCELLED, or reschedule.',
          createdAt: now.toISOString(),
        });
      }

      // Window starting soon (within 24h)
      if (start > now && daysBetween(now, start) <= 1 && w.status === MaintenanceStatus.SCHEDULED) {
        alerts.push({
          id: `upcoming-${w.id}`,
          severity: 'INFO',
          category: 'SCHEDULING',
          title: `Maintenance starting soon: ${w.title}`,
          message: `"${w.title}" starts in less than 24 hours (${start.toLocaleString()}).`,
          affectedResource: {
            type: 'MAINTENANCE_WINDOW',
            id: w.id,
            name: w.title,
          },
          suggestedAction: 'Ensure all stakeholders are notified and rollback procedures are ready.',
          createdAt: now.toISOString(),
          expiresAt: start.toISOString(),
        });
      }
    }

    // Overlapping windows
    for (let i = 0; i < windows.length; i++) {
      for (let j = i + 1; j < windows.length; j++) {
        const a = windows[i];
        const b = windows[j];
        const aStart = new Date(a.startTime);
        const aEnd = new Date(a.endTime);
        const bStart = new Date(b.startTime);
        const bEnd = new Date(b.endTime);

        // Check overlap
        if (aStart < bEnd && bStart < aEnd) {
          // Same scope?
          const sameApp = a.applicationId && a.applicationId === b.applicationId;
          const sameInstance = a.instanceId && a.instanceId === b.instanceId;
          if (sameApp || sameInstance) {
            alerts.push({
              id: `overlap-${a.id}-${b.id}`,
              severity: 'WARNING',
              category: 'SCHEDULING',
              title: 'Overlapping maintenance windows',
              message: `"${a.title}" and "${b.title}" overlap between ${new Date(Math.max(aStart.getTime(), bStart.getTime())).toLocaleString()} and ${new Date(Math.min(aEnd.getTime(), bEnd.getTime())).toLocaleString()}.`,
              affectedResource: {
                type: 'MAINTENANCE_WINDOW',
                id: a.id,
                name: `${a.title} + ${b.title}`,
              },
              suggestedAction: 'Reschedule one of the windows to avoid simultaneous maintenance on the same resource.',
              createdAt: now.toISOString(),
            });
          }
        }
      }
    }

    // Sort: CRITICAL first, then by category
    const severityOrder = { CRITICAL: 0, WARNING: 1, INFO: 2 };
    alerts.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity]);

    res.json(alerts);
  } catch (err) {
    next(err);
  }
});

// GET /api/maintenance-orchestrator/schedule
router.get('/schedule', async (_req, res, next) => {
  try {
    const now = new Date();
    const recommendations: MaintenanceRecommendation[] = [];

    const applications = await prisma.application.findMany({
      include: { continuityLevel: true },
    });
    const instances = await prisma.instance.findMany({
      where: { status: { not: InstanceStatus.TERMINATED } },
      include: { product: true, variant: { include: { osVersion: true } }, healthChecks: { orderBy: { checkedAt: 'desc' }, take: 1 } },
    });
    const existingWindows = await prisma.maintenanceWindow.findMany({
      where: { status: { in: [MaintenanceStatus.SCHEDULED, MaintenanceStatus.IN_PROGRESS] } },
    });

    // Find the next suitable maintenance window for each application
    for (const app of applications) {
      const appInstances = instances.filter((i) => i.applicationId === app.id);
      if (appInstances.length === 0) continue;

      const clName = app.continuityLevel?.name ?? 'LOW';
      const runningInstances = appInstances.filter((i) => i.status === InstanceStatus.RUNNING);
      const unhealthyInstances = appInstances.filter((i) => {
        const latest = i.healthChecks[0];
        return latest && latest.status === HealthStatus.UNHEALTHY;
      });

      // Determine preferred window based on continuity level
      let preferredDay = 0; // Sunday
      let preferredHour = 2; // 2 AM
      let durationHours = 2;
      let blackoutDays = 0; // days ahead to avoid

      if (clName === 'LOW') {
        preferredDay = 0; // Sunday
        preferredHour = 2;
        durationHours = 4;
        blackoutDays = 1;
      } else if (clName === 'MODERATE') {
        preferredDay = 6; // Saturday
        preferredHour = 1;
        durationHours = 3;
        blackoutDays = 3;
      } else if (clName === 'SERIOUS') {
        preferredDay = 6; // Saturday
        preferredHour = 0;
        durationHours = 2;
        blackoutDays = 7;
      } else if (clName === 'EXTREME') {
        preferredDay = 6; // Saturday
        preferredHour = 0;
        durationHours = 1;
        blackoutDays = 14;
      }

      // Find next suitable window
      let candidate = new Date(now);
      candidate.setDate(candidate.getDate() + blackoutDays);
      // Advance to preferred day
      while (candidate.getDay() !== preferredDay) {
        candidate.setDate(candidate.getDate() + 1);
      }
      candidate.setHours(preferredHour, 0, 0, 0);

      // Check for conflicts with existing windows
      let conflict = true;
      let attempts = 0;
      const maxAttempts = 8; // up to 8 weeks ahead

      while (conflict && attempts < maxAttempts) {
        conflict = false;
        const candEnd = new Date(candidate.getTime() + durationHours * 60 * 60 * 1000);

        for (const w of existingWindows) {
          const wStart = new Date(w.startTime);
          const wEnd = new Date(w.endTime);
          if (isNaN(wStart.getTime()) || isNaN(wEnd.getTime())) continue;
          const sameScope = w.applicationId === app.id || appInstances.some((i) => i.id === w.instanceId);

          if (sameScope && candidate < wEnd && wStart < candEnd) {
            conflict = true;
            candidate.setDate(candidate.getDate() + 7); // try next week
            break;
          }
        }
        attempts++;
      }

      const rationale: string[] = [];
      if (clName === 'EXTREME' || clName === 'SERIOUS') {
        rationale.push(`Weekend scheduling preferred for ${clName} continuity level to minimize business impact.`);
      }
      if (unhealthyInstances.length > 0) {
        rationale.push(`${unhealthyInstances.length} unhealthy instance(s) need remediation before maintenance.`);
      }
      if (runningInstances.length === 0) {
        rationale.push('No running instances — maintenance may be needed to restore service.');
      }
      rationale.push(`Optimal window: ${['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][candidate.getDay()]} at ${preferredHour}:00 UTC.`);

      // Estimate impact
      let estimatedImpact: 'LOW' | 'MEDIUM' | 'HIGH' = 'LOW';
      if (clName === 'EXTREME') estimatedImpact = 'HIGH';
      else if (clName === 'SERIOUS') estimatedImpact = 'MEDIUM';
      else if (unhealthyInstances.length > 0) estimatedImpact = 'MEDIUM';

      recommendations.push({
        id: `rec-${app.id}`,
        priority: clName === 'EXTREME' ? 1 : clName === 'SERIOUS' ? 2 : clName === 'MODERATE' ? 3 : 4,
        title: `Maintenance for ${app.name}`,
        description: `Recommended maintenance window for ${app.name} (${clName} continuity, ${runningInstances.length} running instances).`,
        category: 'MAINTENANCE',
        affectedApplicationId: app.id,
        affectedApplicationName: app.name,
        suggestedWindow: {
          startTime: candidate.toISOString(),
          endTime: new Date(candidate.getTime() + durationHours * 60 * 60 * 1000).toISOString(),
          durationHours,
          reason: `Optimal for ${clName} continuity level`,
        },
        rationale,
        estimatedImpact,
      });
    }

    // Sort by priority (lower number = higher priority)
    recommendations.sort((a, b) => a.priority - b.priority);

    res.json(recommendations);
  } catch (err) {
    next(err);
  }
});

// POST /api/maintenance-orchestrator/impact
router.post('/impact', async (req, res, next) => {
  try {
    const data = impactSchema.parse(req.body);
    const appId = data.applicationId;
    const startTime = new Date(data.startTime);
    const endTime = new Date(data.endTime);
    const affectedInstanceIds = data.affectedInstanceIds || [];

    const app = await prisma.application.findUnique({
      where: { id: appId },
      include: { continuityLevel: true },
    });
    if (!app) {
      return res.status(404).json({ error: 'Application not found' });
    }

    const appInstances = await prisma.instance.findMany({
      where: { applicationId: appId },
      include: { product: true, variant: { include: { osVersion: true } }, healthChecks: { orderBy: { checkedAt: 'desc' }, take: 1 } },
    });

    const runningInstances = appInstances.filter((i) => i.status === InstanceStatus.RUNNING);
    const instancesToMaintain = affectedInstanceIds.length > 0
      ? appInstances.filter((i) => affectedInstanceIds.includes(i.id))
      : appInstances;

    // Compute current compliance
    const currentCompliance = await computeAppCompliance(appId);

    // Simulate impact: assume maintained instances go down
    const simulatedRunning = runningInstances.filter((i) => !instancesToMaintain.some((m) => m.id === i.id));
    const simulatedGaps: string[] = [];
    let projectedScore = 100;
    const clName = app.continuityLevel?.name ?? 'LOW';

    if (clName === 'LOW') {
      if (simulatedRunning.length === 0) { projectedScore -= 30; simulatedGaps.push('No running instances during maintenance'); }
    } else if (clName === 'MODERATE') {
      if (simulatedRunning.length < 2) { projectedScore -= 25; simulatedGaps.push('HA pair broken during maintenance'); }
    } else if (clName === 'SERIOUS') {
      if (simulatedRunning.length < 2) { projectedScore -= 20; simulatedGaps.push('Multi-AZ requirement violated during maintenance'); }
    } else if (clName === 'EXTREME') {
      if (simulatedRunning.length < 3) { projectedScore -= 20; simulatedGaps.push('Active-Active requirement violated during maintenance'); }
    }

    // Check conflicting windows
    const conflictingWindows = await prisma.maintenanceWindow.findMany({
      where: {
        status: { in: [MaintenanceStatus.SCHEDULED, MaintenanceStatus.IN_PROGRESS] },
        OR: [
          { applicationId: appId },
          { instanceId: { in: appInstances.map((i) => i.id) } },
        ],
      },
    });

    const activeConflicts = conflictingWindows.filter((w) => {
      const wStart = new Date(w.startTime);
      const wEnd = new Date(w.endTime);
      if (isNaN(wStart.getTime()) || isNaN(wEnd.getTime())) return false;
      return startTime < wEnd && wStart < endTime;
    }).map((w) => ({
      id: w.id,
      title: w.title,
      startTime: w.startTime.toISOString(),
      endTime: w.endTime.toISOString(),
    }));

    // Lifecycle warnings for instances in this app
    const lifecycleWarnings = instancesToMaintain
      .filter((i) => i.variant?.osVersion)
      .map((i) => ({
        productId: i.productId,
        productName: i.product.name,
        phase: i.variant!.osVersion!.phase,
        warning: `Instance uses ${i.product.name} with ${i.variant!.osVersion!.version} which is in ${i.variant!.osVersion!.phase} phase.`,
      }));

    // Risk level
    let riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' = 'LOW';
    if (clName === 'EXTREME') riskLevel = 'HIGH';
    else if (clName === 'SERIOUS') riskLevel = 'MEDIUM';
    if (activeConflicts.length > 0) riskLevel = 'CRITICAL';
    if (simulatedRunning.length === 0 && clName !== 'LOW') riskLevel = 'CRITICAL';

    const canProceed = riskLevel !== 'CRITICAL';

    const recommendations: string[] = [];
    if (activeConflicts.length > 0) recommendations.push('Reschedule to avoid conflicts with existing maintenance windows.');
    if (simulatedRunning.length === 0) recommendations.push('Ensure at least one instance remains running during maintenance.');
    if (clName === 'EXTREME') recommendations.push('For EXTREME continuity, use blue-green or rolling maintenance to maintain availability.');
    if (lifecycleWarnings.length > 0) recommendations.push('Consider upgrading instances on EOL or NO_SUPPORT products.');

    const impact: MaintenanceImpact = {
      canProceed,
      riskLevel,
      affectedApplications: [{
        applicationId: app.id,
        applicationName: app.name,
        continuityLevel: app.continuityLevel?.name ?? 'LOW',
        runningInstances: runningInstances.length,
        impact: `Maintenance will affect ${instancesToMaintain.length} instance(s). ${simulatedRunning.length} will remain running.`,
      }],
      complianceImpact: {
        currentScore: currentCompliance.score,
        projectedScore: Math.max(0, projectedScore),
        gapsCreated: simulatedGaps,
      },
      conflictingWindows: activeConflicts,
      lifecycleWarnings,
      recommendations,
    };

    res.json(impact);
  } catch (err) {
    next(err);
  }
});

// GET /api/maintenance-orchestrator/stats
router.get('/stats', async (_req, res, next) => {
  try {
    const now = new Date();
    const thirtyDaysFromNow = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

    const [
      totalInstances,
      unhealthyInstances,
      upcomingWindows,
      overdueWindows,
      lifecycleTransitions,
    ] = await Promise.all([
      prisma.instance.count(),
      prisma.healthCheck.count({ where: { status: HealthStatus.UNHEALTHY } }),
      prisma.maintenanceWindow.count({
        where: {
          status: MaintenanceStatus.SCHEDULED,
          startTime: { gte: now },
        },
      }),
      prisma.maintenanceWindow.count({
        where: {
          status: MaintenanceStatus.SCHEDULED,
          endTime: { lt: now },
        },
      }),
      prisma.osVersion.count({
        where: {
          OR: [
            { eolDate: { gte: now, lte: thirtyDaysFromNow } },
            { extendedSupportEnd: { gte: now, lte: thirtyDaysFromNow } },
          ],
        },
      }),
    ]);

    // Count alerts by computing them (simplified)
    const apps = await prisma.application.findMany({ include: { continuityLevel: true } });
    const allInstances = await prisma.instance.findMany({
      include: { healthChecks: { orderBy: { checkedAt: 'desc' }, take: 1 } },
    });

    let criticalAlerts = 0;
    let warningAlerts = 0;
    let infoAlerts = 0;

    for (const app of apps) {
      const appInstances = allInstances.filter((i) => i.applicationId === app.id);
      const running = appInstances.filter((i) => i.status === InstanceStatus.RUNNING);
      const uniqueAZs = new Set(appInstances.map((i) => i.azCode)).size;
      const clName = app.continuityLevel?.name ?? 'LOW';

      if (clName === 'LOW' && running.length === 0) criticalAlerts++;
      if (clName === 'MODERATE' && running.length < 2) criticalAlerts++;
      if (clName === 'SERIOUS' && (running.length < 2 || uniqueAZs < 2)) criticalAlerts++;
      if (clName === 'EXTREME' && (running.length < 3 || uniqueAZs < 3)) criticalAlerts++;

      const unhealthy = appInstances.filter((i) => {
        const latest = i.healthChecks[0];
        return latest && latest.status === HealthStatus.UNHEALTHY;
      }).length;
      if (unhealthy > 0) warningAlerts++;
    }

    // Lifecycle alerts
    const versions = await prisma.osVersion.findMany();
    for (const v of versions) {
      const eol = new Date(v.eolDate);
      const extEnd = new Date(v.extendedSupportEnd);
      if (v.phase === LifecyclePhase.EOL) criticalAlerts++;
      else if (daysBetween(now, eol) <= 30 && daysBetween(now, eol) > 0) criticalAlerts++;
      else if (daysBetween(now, extEnd) <= 30 && daysBetween(now, extEnd) > 0) warningAlerts++;
    }

    infoAlerts = upcomingWindows;

    const stats: OrchestratorStats = {
      totalAlerts: criticalAlerts + warningAlerts + infoAlerts,
      criticalAlerts,
      warningAlerts,
      infoAlerts,
      recommendations: apps.length,
      upcomingMaintenanceWindows: upcomingWindows,
      overdueWindows,
      lifecycleTransitions30Days: lifecycleTransitions,
      unhealthyInstances,
    };

    res.json(stats);
  } catch (err) {
    next(err);
  }
});

export { router as maintenanceOrchestratorRoutes };
