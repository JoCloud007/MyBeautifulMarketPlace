import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../db';

const router = Router();

/**
 * Optional ServiceNow integration.
 *
 * Reads the application list from a ServiceNow instance via the Table API
 * (default table: cmdb_ci_appl) and upserts local Applications. Strictly
 * optional: when not configured, everything degrades gracefully and the
 * manual application management keeps working as before.
 *
 * The password is stored in the ServiceNowConfig row (server-side only);
 * it is never returned by the API and never logged.
 */

const configSchema = z.object({
  instanceUrl: z.string().url().optional(),
  username: z.string().optional(),
  // Optional: when omitted on update, keeps the existing password
  password: z.string().optional(),
  snowTable: z.string().min(1).optional(),
  enabled: z.boolean().optional(),
});

async function getConfig() {
  let config = await prisma.serviceNowConfig.findUnique({ where: { id: 'singleton' } });
  if (!config) {
    config = await prisma.serviceNowConfig.create({ data: { id: 'singleton' } });
  }
  return config;
}

// GET /api/servicenow/status
router.get('/status', async (_req, res, next) => {
  try {
    const config = await getConfig();
    res.json({
      configured: !!(config.instanceUrl && config.username),
      enabled: config.enabled,
      instanceUrl: config.instanceUrl,
      username: config.username,
      snowTable: config.snowTable,
      lastSyncAt: config.lastSyncAt,
      lastSyncStatus: config.lastSyncStatus,
      lastSyncError: config.lastSyncError,
      // never expose the password
    });
  } catch (err) {
    next(err);
  }
});

// PUT /api/servicenow/config
router.put('/config', async (req, res, next) => {
  try {
    const data = configSchema.parse(req.body);
    await getConfig(); // ensure singleton exists
    const updateData: Record<string, unknown> = {};
    if (data.instanceUrl !== undefined) updateData.instanceUrl = data.instanceUrl.replace(/\/$/, '');
    if (data.username !== undefined) updateData.username = data.username;
    if (data.snowTable !== undefined) updateData.snowTable = data.snowTable;
    if (data.enabled !== undefined) updateData.enabled = data.enabled;
    if (data.password !== undefined && data.password.length > 0) updateData.password = data.password;

    await prisma.serviceNowConfig.update({ where: { id: 'singleton' }, data: updateData });
    const config = await getConfig();
    res.json({
      configured: !!(config.instanceUrl && config.username),
      enabled: config.enabled,
      instanceUrl: config.instanceUrl,
      username: config.username,
      snowTable: config.snowTable,
      lastSyncAt: config.lastSyncAt,
      lastSyncStatus: config.lastSyncStatus,
      lastSyncError: config.lastSyncError,
    });
  } catch (err) {
    next(err);
  }
});

// POST /api/servicenow/sync
router.post('/sync', async (_req, res, next) => {
  try {
    const config = await getConfig();
    if (!config.enabled || !config.instanceUrl || !config.username || !config.password) {
      return res.status(400).json({
        error: 'ServiceNow integration is not configured or disabled',
        configured: !!(config.instanceUrl && config.username),
        enabled: config.enabled,
      });
    }

    const url = `${config.instanceUrl}/api/now/table/${config.snowTable}?sysparm_fields=sys_id,name,description&sysparm_limit=1000&sysparm_display_value=true`;
    const auth = Buffer.from(`${config.username}:${config.password}`).toString('base64');

    let records: { sys_id: string; name: string; description?: string }[] = [];
    try {
      const response = await fetch(url, {
        headers: {
          Authorization: `Basic ${auth}`,
          Accept: 'application/json',
        },
        signal: AbortSignal.timeout(15000),
      });
      if (!response.ok) {
        throw new Error(`ServiceNow API returned ${response.status} ${response.statusText}`);
      }
      const payload = (await response.json()) as { result?: { sys_id: string; name: string; description?: string }[] };
      records = payload.result || [];
    } catch (err: any) {
      const message = err?.message || 'Unknown error contacting ServiceNow';
      await prisma.serviceNowConfig.update({
        where: { id: 'singleton' },
        data: { lastSyncAt: new Date(), lastSyncStatus: 'ERROR', lastSyncError: message },
      });
      return res.status(502).json({ error: `ServiceNow sync failed: ${message}`, imported: 0, updated: 0 });
    }

    const defaultContinuityLevel = await prisma.continuityLevel.findFirst({ select: { id: true } });
    if (!defaultContinuityLevel) {
      return res.status(400).json({ error: 'No continuity level exists; seed the database before syncing', imported: 0, updated: 0 });
    }

    let imported = 0;
    let updated = 0;
    for (const record of records) {
      if (!record.sys_id || !record.name) continue;
      const existing = await prisma.application.findUnique({ where: { snowSysId: record.sys_id } });
      if (existing) {
        await prisma.application.update({
          where: { snowSysId: record.sys_id },
          data: { name: record.name, description: record.description ?? existing.description },
        });
        updated++;
      } else {
        // Skip if a manual application already uses the same name
        const nameConflict = await prisma.application.findUnique({ where: { name: record.name } });
        if (nameConflict) continue;
        await prisma.application.create({
          data: {
            name: record.name,
            description: record.description ?? null,
            snowSysId: record.sys_id,
            source: 'SNOW',
            owner: 'ServiceNow',
            continuityLevelId: defaultContinuityLevel.id,
          },
        });
        imported++;
      }
    }

    await prisma.serviceNowConfig.update({
      where: { id: 'singleton' },
      data: { lastSyncAt: new Date(), lastSyncStatus: 'OK', lastSyncError: null },
    });

    res.json({ imported, updated, total: records.length, syncedAt: new Date().toISOString() });
  } catch (err) {
    next(err);
  }
});

export { router as serviceNowRoutes };
