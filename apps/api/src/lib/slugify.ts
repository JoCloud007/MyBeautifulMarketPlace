export function slugify(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

export const SLUG_PREFIXES = {
  category: 'cat',
  product: 'prd',
  operatingSystem: 'os',
  zone: 'zon',
  region: 'reg',
} as const;

export function generateSlug(
  prefix: keyof typeof SLUG_PREFIXES,
  name: string
): string {
  return `${SLUG_PREFIXES[prefix]}-${slugify(name)}`;
}
