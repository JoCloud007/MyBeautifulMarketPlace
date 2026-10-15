/**
 * Seed — niveaux de resiliency par défaut (idempotent).
 * Crée les 3 niveaux initiaux équivalents à l'ancien enum Postgres :
 *   STANDARD (rank 0, minAz 1), HA (rank 1, minAz 2), MULTI_AZ (rank 2, minAz 2).
 * Rejouable sans effet.
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const LEVELS = [
  { code: 'STANDARD', name: 'Standard', rank: 0, minAz: 1, order: 0, description: 'Single availability zone — no redundancy requirement.' },
  { code: 'HA', name: 'High Availability', rank: 1, minAz: 2, order: 1, description: 'Redundant across at least 2 availability zones.' },
  { code: 'MULTI_AZ', name: 'Multi-AZ', rank: 2, minAz: 2, order: 2, description: 'Full multi-AZ deployment — at least 2 zones, per-line isolation.' },
];

async function main() {
  for (const lvl of LEVELS) {
    await prisma.resiliencyLevelConfig.upsert({
      where: { code: lvl.code },
      update: { name: lvl.name, rank: lvl.rank, minAz: lvl.minAz, order: lvl.order, description: lvl.description },
      create: lvl,
    });
    console.log(`  resiliency level ensured: ${lvl.code} (rank ${lvl.rank}, minAz ${lvl.minAz})`);
  }
  console.log('resiliency levels seeded');
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
