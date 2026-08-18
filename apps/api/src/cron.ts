import cron from 'node-cron';
import { PrismaClient, LifecyclePhase } from '@prisma/client';

const prisma = new PrismaClient();

/** Update OS version lifecycle phases based on current date */
export async function updateLifecyclePhases() {
  const now = new Date();

  // RELEASED -> NORMAL_SUPPORT (version has been released)
  await prisma.osVersion.updateMany({
    where: {
      phase: LifecyclePhase.RELEASED,
      releaseDate: { lte: now },
    },
    data: { phase: LifecyclePhase.NORMAL_SUPPORT },
  });

  // NORMAL_SUPPORT -> EXTENDED_SUPPORT (normal support has ended)
  await prisma.osVersion.updateMany({
    where: {
      phase: LifecyclePhase.NORMAL_SUPPORT,
      normalSupportEnd: { lt: now },
    },
    data: { phase: LifecyclePhase.EXTENDED_SUPPORT },
  });

  // EXTENDED_SUPPORT -> NO_SUPPORT (extended support has ended)
  await prisma.osVersion.updateMany({
    where: {
      phase: LifecyclePhase.EXTENDED_SUPPORT,
      extendedSupportEnd: { lt: now },
    },
    data: { phase: LifecyclePhase.NO_SUPPORT },
  });

  // NO_SUPPORT -> EOL (when eolDate has passed)
  await prisma.osVersion.updateMany({
    where: {
      phase: LifecyclePhase.NO_SUPPORT,
      eolDate: { lt: now },
    },
    data: { phase: LifecyclePhase.EOL },
  });

  console.log(`[${new Date().toISOString()}] OS version lifecycle phases updated`);
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
