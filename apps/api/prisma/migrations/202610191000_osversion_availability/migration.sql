-- Per-OS-version availability override (2026-10-19).
-- Additive only: nullable column, NULL = inherit OperatingSystem.availabilityType.
-- Idempotent: safe to run multiple times. No row is inserted, updated or deleted.
ALTER TABLE "OsVersion" ADD COLUMN IF NOT EXISTS "availabilityType" "AvailabilityType";
