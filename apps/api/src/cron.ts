import cron from 'node-cron';
import { PrismaClient, LifecyclePhase } from '@prisma/client';

const prisma = new PrismaClient();

/** Update lifecycle phases based on current date */
async function updateLifecyclePhases() {
  const now = new Date();

  // RELEASED -> NORMAL_SUPPORT
  await prisma.productLifecycle.updateMany({
    where: {
      phase: LifecyclePhase.RELEASED,
      normalSupportEnd: { lt: now },
    },
    data: { phase: LifecyclePhase.NORMAL_SUPPORT },
  });

  // NORMAL_SUPPORT -> EXTENDED_SUPPORT
  await prisma.productLifecycle.updateMany({
    where: {
      phase: LifecyclePhase.NORMAL_SUPPORT,
      extendedSupportEnd: { lt: now },
    },
    data: { phase: LifecyclePhase.EXTENDED_SUPPORT },
  });

  // EXTENDED_SUPPORT -> NO_SUPPORT
  await prisma.productLifecycle.updateMany({
    where: {
      phase: LifecyclePhase.EXTENDED_SUPPORT,
      eolDate: { lt: now },
    },
    data: { phase: LifecyclePhase.NO_SUPPORT },
  });

  // NO_SUPPORT -> EOL (30 days after eolDate)
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  await prisma.productLifecycle.updateMany({
    where: {
      phase: LifecyclePhase.NO_SUPPORT,
      eolDate: { lt: thirtyDaysAgo },
    },
    data: { phase: LifecyclePhase.EOL },
  });

  console.log(`[${new Date().toISOString()}] Lifecycle phases updated`);
}

/** Start all cron jobs */
export function startCronJobs() {
  // Update lifecycle phases daily at 2:00 AM
  cron.schedule('0 2 * * *', () => {
    updateLifecyclePhases().catch((err) => {
      console.error('Lifecycle phase update failed:', err);
    });
  });

  console.log('⏰ Cron jobs started');
}
