// Pure functions for the Wikidata import: turn query results into clean game rows,
// and decide how each one merges with games already in the database.
// No network or database access here, so it can be tested on its own.

const MINUTE = 'Q7727';
const HOUR = 'Q25235';
const SECOND = 'Q11574';

const qid = (uri) => (uri ? String(uri).split('/').pop() : null);
const num = (b) => (b ? Number(b.value) : null);

export const normName = (s) =>
  String(s).toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]/g, '');

function toMinutes(amount, unitUri) {
  if (amount == null || !Number.isFinite(amount)) return null;
  const unit = qid(unitUri);
  if (unit === MINUTE) return amount;
  if (unit === HOUR) return amount * 60;
  if (unit === SECOND) return amount / 60;
  return null; // unknown unit: don't guess
}

const inRange = (n, lo, hi) => (n != null && Number.isFinite(n) && n >= lo && n <= hi ? n : null);

/**
 * Turn Wikidata "genre" and "game mechanics" labels into the app's tags.
 * Known phrases map to the tags the Tonight picker understands; others are kept, lightly cleaned.
 */
const TAG_MAP = [
  [/co-?operative/, 'coop'],
  [/party/, 'party'],
  [/deck[- ]?build/, 'deck building'],
  [/worker placement/, 'worker placement'],
  [/area (control|majority|influence)/, 'area control'],
  [/tile[- ]?(placement|laying)/, 'tile placement'],
  [/engine[- ]?build/, 'engine building'],
  [/route[- ]?build|network/, 'route building'],
  [/set collection/, 'set collection'],
  [/drafting/, 'card drafting'],
  [/roll[- ]and[- ]write|roll[- ]and[- ]move|dice/, 'dice'],
  [/bluff|social deduction|hidden (role|identity)/, 'bluffing'],
  [/deduction/, 'deduction'],
  [/trick[- ]taking/, 'trick-taking'],
  [/push your luck|press your luck/, 'push your luck'],
  [/word/, 'word'],
  [/abstract/, 'abstract'],
  [/war ?game|wargame/, 'war'],
  [/economic/, 'economic'],
  [/family/, 'family'],
  [/legacy|campaign/, 'campaign'],
  [/dungeon/, 'dungeon crawl'],
  [/trading|negotiation/, 'trading'],
  [/racing/, 'racing'],
  [/puzzle/, 'puzzle'],
  [/solitaire|solo/, 'solo'],
];

const GENERIC = new Set(['board game', 'card game', 'tabletop game', 'game', 'german-style board game', 'eurogame', 'strategy game']);

export function toTags(labels, minPlayers) {
  const tags = new Set();
  for (const raw of labels) {
    const l = String(raw).toLowerCase().trim();
    if (!l || GENERIC.has(l)) continue;
    const hit = TAG_MAP.find(([re]) => re.test(l));
    if (hit) tags.add(hit[1]);
    else if (l.length <= 24) tags.add(l.replace(/ (board |card )?game$/, ''));
  }
  if (minPlayers === 1) tags.add('solo');
  if (!tags.has('coop') && !tags.has('party')) tags.add('competitive');
  return [...tags].slice(0, 8);
}

/**
 * Collapse raw SPARQL rows (one row per value combination) into one game per Wikidata item.
 * coreRows: bindings with game, gameLabel, bgg, minP, maxP, date, durAmount, durUnit.
 * tagRows: bindings with game, tagLabel.
 */
export function buildGames(coreRows, tagRows) {
  const byId = new Map();
  for (const r of coreRows) {
    const id = qid(r.game?.value);
    const name = r.gameLabel?.value?.trim();
    if (!id || !name || /^Q\d+$/.test(name)) continue;
    let g = byId.get(id);
    if (!g) {
      g = { wikidata_id: id, name, bgg_ids: new Set(), mins: [], maxs: [], years: [], durations: [] };
      byId.set(id, g);
    }
    const bgg = num(r.bgg);
    if (bgg && Number.isInteger(bgg) && bgg > 0) g.bgg_ids.add(bgg);
    const mn = inRange(num(r.minP), 1, 20); if (mn) g.mins.push(mn);
    const mx = inRange(num(r.maxP), 1, 100); if (mx) g.maxs.push(mx);
    const y = r.date?.value ? Number(String(r.date.value).replace(/^\+/, '').slice(0, 4)) : null;
    if (inRange(y, 1000, 2100)) g.years.push(y);
    const d = toMinutes(num(r.durAmount), r.durUnit?.value);
    if (inRange(d, 1, 1440)) g.durations.push(Math.round(d));
  }

  const tagsById = new Map();
  for (const r of tagRows) {
    const id = qid(r.game?.value);
    if (!id || !byId.has(id)) continue;
    if (!tagsById.has(id)) tagsById.set(id, new Set());
    if (r.tagLabel?.value) tagsById.get(id).add(r.tagLabel.value);
  }

  const out = [];
  const seenBgg = new Set();
  for (const g of byId.values()) {
    const bgg = g.bgg_ids.size === 1 ? [...g.bgg_ids][0] : g.bgg_ids.size ? Math.min(...g.bgg_ids) : null;
    // Two Wikidata items pointing at the same BGG game are usually duplicates: keep the first.
    if (bgg && seenBgg.has(bgg)) continue;
    if (bgg) seenBgg.add(bgg);
    let min = g.mins.length ? Math.min(...g.mins) : null;
    let max = g.maxs.length ? Math.max(...g.maxs) : null;
    if (min && max && min > max) [min, max] = [max, min];
    out.push({
      wikidata_id: g.wikidata_id,
      bgg_id: bgg,
      name: g.name,
      year: g.years.length ? Math.min(...g.years) : null,
      min_players: min,
      max_players: max,
      play_minutes: g.durations.length ? Math.max(...g.durations) : null,
      weight: null, // Wikidata has no complexity rating; players or curators fill this in later.
      tags: toTags(tagsById.get(g.wikidata_id) ?? [], min),
      source: 'wikidata',
    });
  }
  return out.sort((a, b) => a.name.localeCompare(b.name));
}

/**
 * Decide what to do with each Wikidata game given what's already in the database.
 * - Matches a curated or community game (by wikidata id, BGG id, then exact name):
 *   only fill in fields that are empty. Hand-checked values always win.
 * - Otherwise: upsert it as a Wikidata game (re-running the import refreshes these).
 */
export function planMerge(wdGames, existing) {
  const byWd = new Map(), byBgg = new Map(), byName = new Map();
  for (const e of existing) {
    if (e.wikidata_id) byWd.set(e.wikidata_id, e);
    if (e.bgg_id) byBgg.set(e.bgg_id, e);
    if (!e.wikidata_id) {
      const k = normName(e.name);
      if (!byName.has(k)) byName.set(k, e);
    }
  }

  const upserts = [];
  const patches = [];
  for (const g of wdGames) {
    const match = byWd.get(g.wikidata_id) ?? (g.bgg_id && byBgg.get(g.bgg_id)) ?? byName.get(normName(g.name));
    if (!match || match.source === 'wikidata') {
      // Don't steal a BGG id that already belongs to another row.
      const owner = g.bgg_id ? byBgg.get(g.bgg_id) : undefined;
      const bgg_id = owner && owner.wikidata_id !== g.wikidata_id ? null : g.bgg_id;
      upserts.push({ ...g, bgg_id });
      continue;
    }
    const patch = {};
    for (const k of ['wikidata_id', 'bgg_id', 'year', 'min_players', 'max_players', 'play_minutes']) {
      if ((match[k] === null || match[k] === undefined) && g[k] != null) patch[k] = g[k];
    }
    if (patch.bgg_id && byBgg.has(patch.bgg_id)) delete patch.bgg_id;
    const mergedTags = [...new Set([...(match.tags ?? []), ...g.tags])].slice(0, 10);
    if (mergedTags.length !== (match.tags ?? []).length) patch.tags = mergedTags;
    if (Object.keys(patch).length) patches.push({ id: match.id, name: match.name, patch });
  }
  return { upserts, patches };
}

export function summarize(games) {
  const has = (k) => games.filter((g) => g[k] != null).length;
  return {
    games: games.length,
    withPlayerCounts: games.filter((g) => g.min_players != null && g.max_players != null).length,
    withPlayTime: has('play_minutes'),
    withYear: has('year'),
    withBggId: has('bgg_id'),
    withUsefulTags: games.filter((g) => g.tags.some((t) => t !== 'competitive' && t !== 'solo')).length,
  };
}
