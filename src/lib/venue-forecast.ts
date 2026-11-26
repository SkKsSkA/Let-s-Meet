const venuePatterns = {
  venueCoworking: /коворкинг|coworking|co-working/iu,
  venueLoft: /лофт|\blofts?\b|ивент[- ]зал|\bevent (?:hall|space)\b/iu,
  venueLibrary: /библиотек|кітапхана|\blibrar(?:y|ies)\b/iu,
  venueCafe: /кафе|кофейн|ресторан|мейрамхана|\bcaf[eé]|\brestaurant\b/iu,
  venuePark: /парк|саябақ|пикник|\bparks?\b|\bpicnic\b/iu,
  venueSport: /спортзал|спорткомплекс|спорт залы|\bgym\b|\bsports? (?:club|centre|center)\b/iu,
};

type VenueCategory = keyof typeof venuePatterns;

export type VenueForecast = {
  sampleSize: number;
  category?: VenueCategory;
  matches?: number;
  share?: number;
};

export function predictVenue(locations: readonly string[]): VenueForecast {
  const categories = Object.keys(venuePatterns) as VenueCategory[];
  const counts = new Map<VenueCategory, number>();
  let sampleSize = 0;
  for (const location of locations) {
    const matches = categories.filter(category => venuePatterns[category].test(location));
    if (matches.length !== 1) continue;
    const category = matches[0];
    sampleSize += 1;
    counts.set(category, (counts.get(category) ?? 0) + 1);
  }

  const ranking = [...counts].sort(([, a], [, b]) => b - a);
  const [category, matches] = ranking[0] ?? [];
  if (sampleSize < 5 || !category || !matches || matches === ranking[1]?.[1]) {
    return { sampleSize };
  }
  return { sampleSize, category, matches, share: Math.round(100 * matches / sampleSize) };
}
