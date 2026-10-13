// Real hospitals near the patient's block, whether or not they are on SwasthSetu
// (server only). Free OpenStreetMap map data, no key needed, no AI.
// Two quick searches run at the same time and their answers are merged:
//  - Nominatim (openstreetmap.org's own search)
//  - Photon (komoot.io, a second search over the same map data)
// Overpass (a slower, more complete search) is tried only if both find nothing.
// Answers are kept in memory for 6 hours per block, so repeat lookups are instant.
// Only the block's centre point is sent, never anything about the patient.
import { findBlock, type Block } from "@/lib/blocks";
import { distanceKm } from "@/lib/match";

export type NearbyOption = {
  name: string;
  address: string;
  phone: string | null;
  distance_km: number;
  url: string; // opens the place on Google Maps (no key needed)
  source: "osm";
};

const MAX_KM = 40; // ignore anything further than this from the block centre
const BOX = 0.3; // search box: about 30 km each way around the block centre
const MAX_RESULTS = 6;
const CACHE_MS = 6 * 60 * 60 * 1000;
const HEADERS = { "User-Agent": "SwasthSetu/1.0 (district health referral app)", "Accept-Language": "en" };

const cache = new Map<string, { at: number; options: NearbyOption[] }>();

const mapLink = (lat: number, lng: number) => `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`;

function option(block: Block, name: string, address: string, phone: string | null, lat: number, lng: number): NearbyOption {
  return {
    name,
    address,
    phone,
    distance_km: Math.round(distanceKm(block, { lat, lng }) * 10) / 10,
    url: mapLink(lat, lng),
    source: "osm",
  };
}

// A short, readable error ("Nominatim took too long", "Photon: answered 429").
function why(source: string, err: unknown): string {
  const msg = err instanceof Error ? `${err.name} ${err.message}` : String(err);
  return /abort|timeout/i.test(msg) ? `${source} took too long` : `${source}: ${err instanceof Error ? err.message : msg}`;
}

async function getJson(url: string, ms: number, init: RequestInit = {}) {
  const res = await fetch(url, { ...init, headers: { ...HEADERS, ...(init.headers ?? {}) }, signal: AbortSignal.timeout(ms) });
  if (!res.ok) throw new Error(`answered ${res.status}`);
  return res.json();
}

async function fromNominatim(block: Block): Promise<NearbyOption[]> {
  const box = [block.lng - BOX, block.lat + BOX, block.lng + BOX, block.lat - BOX].join(",");
  const url = `https://nominatim.openstreetmap.org/search?q=hospital&format=jsonv2&addressdetails=1&limit=30&bounded=1&viewbox=${box}`;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rows = (await getJson(url, 7000)) as any[];
  return rows
    .filter((r) => r.name && ["hospital", "clinic", "doctors"].includes(r.type))
    .map((r) => {
      const a = r.address ?? {};
      const address = [a.road, a.village ?? a.town ?? a.city, a.county ?? a.state_district].filter(Boolean).join(", ");
      return option(block, String(r.name), address, null, Number(r.lat), Number(r.lon));
    });
}

async function fromPhoton(block: Block): Promise<NearbyOption[]> {
  const bbox = [block.lng - BOX, block.lat - BOX, block.lng + BOX, block.lat + BOX].join(",");
  const url =
    `https://photon.komoot.io/api/?q=hospital&lat=${block.lat}&lon=${block.lng}&limit=30&bbox=${bbox}` +
    `&osm_tag=amenity:hospital&osm_tag=amenity:clinic&osm_tag=healthcare:hospital`;
  const data = await getJson(url, 7000);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return ((data.features ?? []) as any[])
    .filter((f) => f.properties?.name && f.geometry?.coordinates)
    .map((f) => {
      const p = f.properties;
      const [lng, lat] = f.geometry.coordinates;
      const address = [p.street, p.city ?? p.district, p.county].filter(Boolean).join(", ");
      return option(block, String(p.name), address, null, lat, lng);
    });
}

async function fromOverpass(block: Block): Promise<NearbyOption[]> {
  const around = `around:25000,${block.lat},${block.lng}`;
  const query = `[out:json][timeout:20];(node["amenity"="hospital"](${around});way["amenity"="hospital"](${around}););out center tags 40;`;
  const data = await getJson("https://overpass-api.de/api/interpreter", 20000, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: `data=${encodeURIComponent(query)}`,
  });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return ((data.elements ?? []) as any[])
    .filter((e) => e.tags?.name && (e.lat ?? e.center?.lat) != null)
    .map((e) => {
      const t = e.tags;
      const address = [t["addr:street"], t["addr:village"] ?? t["addr:city"], t["addr:district"]].filter(Boolean).join(", ");
      return option(block, String(t.name), address, t.phone ?? t["contact:phone"] ?? null, e.lat ?? e.center.lat, e.lon ?? e.center.lon);
    });
}

// Same place found twice ("Civil Hospital, Nadaun" / "Civil Hospital Nadaun"): keep one.
function merge(lists: NearbyOption[][]): NearbyOption[] {
  const out: NearbyOption[] = [];
  const key = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");
  for (const o of lists.flat()) {
    const dup = out.find((x) => key(x.name) === key(o.name));
    if (!dup) out.push(o);
    else if (!dup.address && o.address) dup.address = o.address;
  }
  return out;
}

// Nearest hospitals first. Never throws: an empty list comes with "problem",
// a short reason the page can show.
export async function findNearby(blockName: string): Promise<{ options: NearbyOption[]; problem: string | null }> {
  const block = findBlock(blockName);
  if (!block) return { options: [], problem: `Unknown block "${blockName}".` };
  const hit = cache.get(block.name);
  if (hit && Date.now() - hit.at < CACHE_MS) return { options: hit.options, problem: null };

  const problems: string[] = [];
  const settle = (name: string, p: Promise<NearbyOption[]>) =>
    p.catch((err) => {
      problems.push(why(name, err));
      return [] as NearbyOption[];
    });

  let found = merge(await Promise.all([settle("Nominatim", fromNominatim(block)), settle("Photon", fromPhoton(block))]));
  if (!found.length) found = await settle("Overpass", fromOverpass(block));

  const options = found
    .filter((o) => o.distance_km <= MAX_KM)
    .sort((a, b) => a.distance_km - b.distance_km)
    .slice(0, MAX_RESULTS);
  if (options.length) cache.set(block.name, { at: Date.now(), options });
  const problem = options.length ? null : problems.join("; ") || "No hospitals found on the map near this block.";
  console.log(`[nearby] ${block.name}: ${options.length} found${problem ? ` (${problem})` : ""}`);
  return { options, problem };
}
