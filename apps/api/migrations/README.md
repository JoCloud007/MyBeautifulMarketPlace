# Data Migrations

Ce dossier contient les scripts de migration de données (data fixes) qui ne sont pas des migrations de schéma Prisma.

## Structure

Chaque migration est dans un sous-dossier daté :
```
migrations/
├── YYYY-MM-DD-description/
│   ├── migration.sql      -- Script SQL à exécuter
│   └── run.sh             -- Script shell pour lancer la migration
```

## Exécution

```bash
# Exécuter une migration spécifique
docker compose exec -T db psql -U cloudmarket -d cloudmarket < apps/api/migrations/YYYY-MM-DD-description/migration.sql

# Ou utiliser le script run.sh
docker compose exec api bash bash /app/apps/api/migrations/YYYY-MM-DD-description/run.sh
```
