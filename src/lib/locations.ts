// Location search powered by the `country-state-city` dataset (250
// countries, all states, ~115k cities) — no hardcoded locations anywhere.
// The heavy city dataset is loaded lazily (dynamic import) on first search,
// so the main bundle stays small.

export interface LocationSuggestion {
  label: string; // "Bengaluru, Karnataka, India"
  value: string; // what the input receives when chosen ("Bengaluru")
  type: 'country' | 'state' | 'city';
  countryCode?: string;
}

interface LocDb {
  countries: { name: string; isoCode: string }[];
  states: { name: string; isoCode: string; countryCode: string }[];
  cities: { name: string; countryCode: string; stateCode: string }[];
}

// Common spelling variants → canonical city name (the dataset uses the
// modern name, e.g. Bengaluru, Mumbai, Kolkata).
const CITY_ALIASES: Record<string, string> = {
  bangalore: 'bengaluru',
  bombay: 'mumbai',
  calcutta: 'kolkata',
  madras: 'chennai',
  peking: 'beijing',
  saigon: 'ho chi minh',
  rangoon: 'yangon',
  ceylon: 'sri lanka',
  bombai: 'mumbai',
  calcuta: 'kolkata',
};

let dbPromise: Promise<LocDb> | null = null;

function loadDb(): Promise<LocDb> {
  if (!dbPromise) {
    dbPromise = import('country-state-city').then((m) => ({
      countries: m.Country.getAllCountries(),
      states: m.State.getAllStates(),
      cities: m.City.getAllCities(),
    }));
  }
  return dbPromise;
}

function normalize(s: string): string {
  return s.toLowerCase().trim().replace(/\s+/g, ' ');
}

function expandAliases(q: string): string[] {
  const out = [q];
  const canonical = CITY_ALIASES[q];
  if (canonical) out.push(canonical);
  return out;
}

// Pure ranking — testable without the dataset. `db` is any shape matching
// LocDb. Order: country prefix, country substring, city prefix, city
// substring. Deduped, capped at `limit`.
export function rankLocations(q: string, db: LocDb, limit = 30): LocationSuggestion[] {
  const query = normalize(q);
  if (!query) return [];
  const queries = expandAliases(query);
  const seen = new Set<string>();
  const out: LocationSuggestion[] = [];
  const push = (s: LocationSuggestion) => {
    if (seen.has(s.label)) return;
    seen.add(s.label);
    out.push(s);
  };
  const startsWithQ = (name: string) => name.startsWith(query) || queries.some((qq) => name.startsWith(qq));
  const includesQ = (name: string) => queries.some((qq) => name.includes(qq));

  for (const country of db.countries) {
    const name = normalize(country.name);
    if (startsWithQ(name)) push({ label: country.name, value: country.name, type: 'country', countryCode: country.isoCode });
  }
  for (const country of db.countries) {
    const name = normalize(country.name);
    if (!startsWithQ(name) && includesQ(name)) push({ label: country.name, value: country.name, type: 'country', countryCode: country.isoCode });
  }

  const stateByName = new Map(db.states.map((s) => [`${s.countryCode}:${s.isoCode}`, s.name]));
  const countryName = new Map(db.countries.map((c) => [c.isoCode, c.name]));
  const labelFor = (city: { name: string; countryCode: string; stateCode: string }): string => {
    const st = stateByName.get(`${city.countryCode}:${city.stateCode}`);
    const co = countryName.get(city.countryCode);
    return [city.name, st, co].filter(Boolean).join(', ');
  };

  for (const city of db.cities) {
    if (startsWithQ(normalize(city.name))) {
      push({ label: labelFor(city), value: city.name, type: 'city', countryCode: city.countryCode });
    }
  }
  if (out.length < limit) {
    for (const city of db.cities) {
      if (!startsWithQ(normalize(city.name)) && includesQ(normalize(city.name))) {
        push({ label: labelFor(city), value: city.name, type: 'city', countryCode: city.countryCode });
      }
    }
  }

  return out.slice(0, limit);
}

export async function searchLocations(query: string, limit = 30): Promise<LocationSuggestion[]> {
  const q = normalize(query);
  if (!q) return [];
  const db = await loadDb();
  return rankLocations(q, db, limit);
}
