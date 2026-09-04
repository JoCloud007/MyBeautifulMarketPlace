// Country name → flag emoji mapping
// Supports common country names and ISO codes

const flagMap: Record<string, string> = {
  'france': '🇫🇷',
  'united kingdom': '🇬🇧',
  'uk': '🇬🇧',
  'united states': '🇺🇸',
  'usa': '🇺🇸',
  'us': '🇺🇸',
  'united states of america': '🇺🇸',
  'germany': '🇩🇪',
  'netherlands': '🇳🇱',
  'ireland': '🇮🇪',
  'sweden': '🇸🇪',
  'canada': '🇨🇦',
  'australia': '🇦🇺',
  'japan': '🇯🇵',
  'india': '🇮🇳',
  'singapore': '🇸🇬',
  'brazil': '🇧🇷',
  'south korea': '🇰🇷',
  'korea': '🇰🇷',
  'switzerland': '🇨🇭',
  'italy': '🇮🇹',
  'spain': '🇪🇸',
  'poland': '🇵🇱',
  'belgium': '🇧🇪',
  'austria': '🇦🇹',
  'norway': '🇳🇴',
  'finland': '🇫🇮',
  'denmark': '🇩🇰',
  'portugal': '🇵🇹',
  'czech republic': '🇨🇿',
  'czechia': '🇨🇿',
  'hungary': '🇭🇺',
  'romania': '🇷🇴',
  'greece': '🇬🇷',
  'turkey': '🇹🇷',
  'türkiye': '🇹🇷',
  'israel': '🇮🇱',
  'uae': '🇦🇪',
  'united arab emirates': '🇦🇪',
  'saudi arabia': '🇸🇦',
  'south africa': '🇿🇦',
  'mexico': '🇲🇽',
  'argentina': '🇦🇷',
  'chile': '🇨🇱',
  'colombia': '🇨🇴',
  'peru': '🇵🇪',
  'new zealand': '🇳🇿',
  'indonesia': '🇮🇩',
  'thailand': '🇹🇭',
  'vietnam': '🇻🇳',
  'viet nam': '🇻🇳',
  'malaysia': '🇲🇾',
  'philippines': '🇵🇭',
  'taiwan': '🇹🇼',
  'hong kong': '🇭🇰',
  'china': '🇨🇳',
  'russia': '🇷🇺',
  'russian federation': '🇷🇺',
  'ukraine': '🇺🇦',
  'egypt': '🇪🇬',
  'nigeria': '🇳🇬',
  'kenya': '🇰🇪',
  'morocco': '🇲🇦',
};

export function getCountryFlag(countryName: string): string {
  const normalized = countryName.toLowerCase().trim();
  return flagMap[normalized] || '';
}

// ISO 3166-1 alpha-2 → flag emoji
export function getFlagEmoji(countryCode: string): string {
  const code = countryCode.toUpperCase();
  if (code.length !== 2) return '';
  const offset = 127397;
  return String.fromCodePoint(code.charCodeAt(0) + offset, code.charCodeAt(1) + offset);
}
