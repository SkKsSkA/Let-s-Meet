import "server-only";
import type { User } from "@supabase/supabase-js";
import { getAdminSupabase } from "./supabase/admin";

export function isAnalyticsOwner(user: Pick<User, "id"> | null) {
  return Boolean(user && user.id === process.env.ANALYTICS_OWNER_ID?.trim());
}

interface Entry {
  label: string;
  detail: string;
  count: number;
}

function record(entries: Map<string, Entry>, label: string, detail = "") {
  const normalized = [label, detail].map(value =>
    value.normalize("NFKC").toLowerCase().replace(/["«»“”]/gu, "").replace(/\s+/gu, " ").trim()
  );
  const key = JSON.stringify(normalized);
  const entry = entries.get(key);
  if (entry) entry.count += 1;
  else entries.set(key, { label, detail, count: 1 });
}

function top(entries: Map<string, Entry>) {
  return [...entries.values()].sort((a, b) =>
    b.count - a.count || a.label.localeCompare(b.label) || a.detail.localeCompare(b.detail)
  ).slice(0, 10);
}

export async function getOwnerAnalytics(user: User, lastMonth: boolean) {
  if (!isAnalyticsOwner(user)) return null;
  const db = getAdminSupabase();
  if (!db) return null;
  const end = new Date();
  const since = new Date(end.getTime() - 30 * 86_400_000);
  const kinds = new Map<string, Entry>();
  const venues = new Map<string, Entry>();
  let total = 0;
  let withVenue = 0;
  let cursor = "";

  for (;;) {
    let query = db.from("events").select("id,kind,location_name,address")
      .lte("created_at", end.toISOString()).order("id").limit(500);
    if (lastMonth) query = query.gte("created_at", since.toISOString());
    if (cursor) query = query.gt("id", cursor);
    const { data, error } = await query;
    if (error || !data) return null;
    if (!data.length) break;
    for (const event of data) {
      total += 1;
      record(kinds, event.kind.trim());
      const venue = event.location_name.trim();
      const address = event.address.trim();
      if (venue || address) {
        withVenue += 1;
        record(venues, venue || address, venue ? address : "");
      }
    }
    cursor = data[data.length - 1].id;
  }
  return { total, withVenue, kinds: top(kinds), venues: top(venues) };
}
