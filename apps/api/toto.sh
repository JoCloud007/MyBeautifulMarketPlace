#!/bin/sh
set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
JS_FILE="$SCRIPT_DIR/.fix-flavor-tmp.js"

echo "Checking for duplicate Flavor names..."

cat > "$JS_FILE" << 'JSEOF'
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const duplicates = await prisma.$queryRaw`
    SELECT name FROM "Flavor" GROUP BY name HAVING COUNT(*) > 1
  `;

  if (duplicates.length === 0) {
    console.log('No duplicates found.');
    return;
  }

  console.log('Found ' + duplicates.length + ' duplicate name(s): ' + duplicates.map(d => d.name).join(', '));

  for (const { name } of duplicates) {
    const flavors = await prisma.$queryRaw`
      SELECT id, name, "createdAt" FROM "Flavor" WHERE name = ${name} ORDER BY "createdAt" ASC
    `;

    for (let i = 1; i < flavors.length; i++) {
      const newName = name + ' - duplicate-' + i;
      await prisma.$executeRaw`
        UPDATE "Flavor" SET name = ${newName} WHERE id = ${flavors[i].id}
      `;
      console.log('  Renamed: "' + name + '" -> "' + newName + '" (id: ' + flavors[i].id + ')');
    }
  }

  console.log('Done.');
}

main().catch(e => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
JSEOF

node "$JS_FILE"
rm "$JS_FILE"
