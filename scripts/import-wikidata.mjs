#!/usr/bin/env node
// Imports board and card games from Wikidata (free, public domain) into your Supabase catalog.
//
//   node scripts/import-wikidata.mjs --dry-run   # download and preview only; writes scripts/output/
//   node scripts/import-wikidata.mjs             # download and save to Supabase
//
// Needs Node 18+ and, for a real import, two values in your .env file:
//   EXPO_PUBLIC_SUPABASE_URL=...        (already there)
//   SUPABASE_SERVICE_ROLE_KEY=...       (Supabase → Project Settings → API → service_role "secret")
// The service role key can change anything in your database. Keep it only in .env (which git ignores),
// and never put it in a variable starting with EXPO_PUBLIC_, because those get built into the app.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildGames, planMerge, summarize } from './wikidata/transform.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const outDir = path.join(root, 'scripts', 'output');
const dryRun = process.argv.includes('--dry-run');
const ENDPOINT = 'https://query.wikidata.org/sparql';
const USER_AGENT = 'ShelfNightCatalogImport/0.1 (https://github.com/SmittyRPG/ShelfNight)';

// Board games (Q131436) and card games (Q142714), including their subtypes,
// limited to items that have a BoardGameGeek ID (P2339), which filters out folk and traditional variants.
const CORE_QUERY = `
SELECT ?game ?gameLabel ?bgg ?minP ?maxP ?date ?durAmount ?durUnit WHERE {
  { ?game wdt:P31/wdt:P279* wd:Q131436 . } UNION { ?game wdt:P31/wdt:P279* wd:Q142714 . }
  ?game wdt:P2339 ?bgg .
  ?game rdfs:label ?gameLabel . FILTER(LANG(?gameLabel) = "en")
  OPTIONAL { ?game wdt:P1872 ?minP . }
  OPTIONAL { ?game wdt:P1873 ?maxP . }
  OPTIONAL { ?game wdt:P577 ?date . }
  OPTIONAL { ?game p:P2047/psv:P2047 [ wikibase:quantityAmount ?durAmount ; wikibase:quantityUnit ?durUnit ] . }
}`;

// Genre (P136) and game mechanics (P4151) labels, used to build tags.
const TAG_QUERY = `
SELECT ?game ?tagLabel WHERE {
  ?game wdt:P2339 ?bgg .
  { ?game wdt:P136 ?tag . } UNION { ?game wdt:P4151 ?tag . }
  ?tag rdfs:label ?tagLabel . FILTER(LANG(?tagLabel) = "en")
}`;

function loadEnv() {
  const file = path.join(root, '.env');
  if (!fs.existsSync(file)) return;
  for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
}

async function sparql(query, label) {
  process.stdout.write(`Downloading ${label} from Wikidata… `);
  for (let attempt = 1; attempt <= 3; attempt++) {
    const res = await fetch(ENDPOINT, {
      method: 'POST',
      headers: {
        Accept: 'application/sparql-results+json',
        'Content-Type': 'application/x-www-form-urlencoded',
        'User-Agent': USER_AGENT,
      },
      body: new URLSearchParams({ query }),
    });
    if (res.ok) {
      const json = await res.json();
      console.log(`${json.results.bindings.length.toLocaleString()} rows`);
      return json.results.bindings;
    }
    if ((res.status === 429 || res.status >= 500) && attempt < 3) {
      const wait = Number(res.headers.get('retry-after') ?? 20) * 1000;
      console.log(`busy (HTTP ${res.status}), waiting ${Math.round(wait / 1000)}s…`);
      await new Promise((r) => setTimeout(r, wait));
      continue;
    }
    throw new Error(`Wikidata query failed: HTTP ${res.status} ${(await res.text()).slice(0, 300)}`);
  }
}

function supabaseClient() {
  const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || url.includes('YOUR-PROJECT-ID')) throw new Error('EXPO_PUBLIC_SUPABASE_URL is missing from .env.');
  if (!key) throw new Error('SUPABASE_SERVICE_ROLE_KEY is missing from .env. See the top of this script.');
  const headers = { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' };
  const rest = `${url.replace(/\/$/, '')}/rest/v1`;
  return {
    async allGames() {
      const rows = [];
      for (let from = 0; ; from += 1000) {
        const res = await fetch(`${rest}/games?select=id,name,bgg_id,wikidata_id,year,min_players,max_players,play_minutes,tags,source&order=id`, {
          headers: { ...headers, Range: `${from}-${from + 999}` },
        });
        if (!res.ok) {
          const text = await res.text();
          if (text.includes('wikidata_id')) throw new Error('Run supabase/migrations/0002_wikidata.sql in the Supabase SQL Editor first.');
          throw new Error(`Reading games failed: HTTP ${res.status} ${text.slice(0, 300)}`);
        }
        const page = await res.json();
        rows.push(...page);
        if (page.length < 1000) return rows;
      }
    },
    async upsert(batch) {
      const res = await fetch(`${rest}/games?on_conflict=wikidata_id`, {
        method: 'POST',
        headers: { ...headers, Prefer: 'resolution=merge-duplicates,return=minimal' },
        body: JSON.stringify(batch.map((g) => ({ ...g, updated_at: new Date().toISOString() }))),
      });
      if (!res.ok) throw new Error(await res.text());
    },
    async patch(id, fields) {
      const res = await fetch(`${rest}/games?id=eq.${id}`, {
        method: 'PATCH',
        headers: { ...headers, Prefer: 'return=minimal' },
        body: JSON.stringify({ ...fields, updated_at: new Date().toISOString() }),
      });
      if (!res.ok) throw new Error(await res.text());
    },
  };
}

async function main() {
  loadEnv();
  const core = await sparql(CORE_QUERY, 'games');
  const tags = await sparql(TAG_QUERY, 'genres and mechanics');
  const games = buildGames(core, tags);
  const stats = summarize(games);
  console.log('\nCleaned catalog:');
  console.table(stats);

  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(path.join(outDir, 'wikidata-games.json'), JSON.stringify(games, null, 2));
  console.log(`Preview saved to scripts/output/wikidata-games.json`);

  if (dryRun) {
    console.log('\nDry run: nothing was saved to Supabase. Run again without --dry-run to import.');
    return;
  }

  const db = supabaseClient();
  const existing = await db.allGames();
  const { upserts, patches } = planMerge(games, existing);
  console.log(`\nYour catalog has ${existing.length.toLocaleString()} games. Adding or refreshing ${upserts.length.toLocaleString()}, filling gaps in ${patches.length}.`);

  let saved = 0;
  const failed = [];
  for (let i = 0; i < upserts.length; i += 500) {
    const batch = upserts.slice(i, i + 500);
    try {
      await db.upsert(batch);
      saved += batch.length;
    } catch {
      // One bad row fails the whole batch; save the rest one at a time.
      for (const g of batch) {
        try { await db.upsert([g]); saved++; } catch (e) { failed.push({ name: g.name, wikidata_id: g.wikidata_id, error: String(e.message ?? e).slice(0, 200) }); }
      }
    }
    process.stdout.write(`\rSaved ${saved.toLocaleString()} of ${upserts.length.toLocaleString()}`);
  }
  console.log();

  for (const p of patches) {
    try { await db.patch(p.id, p.patch); } catch (e) { failed.push({ name: p.name, error: String(e.message ?? e).slice(0, 200) }); }
  }

  if (failed.length) {
    fs.writeFileSync(path.join(outDir, 'import-failures.json'), JSON.stringify(failed, null, 2));
    console.log(`${failed.length} games could not be saved; details in scripts/output/import-failures.json`);
  }
  console.log(`Done. ${saved.toLocaleString()} Wikidata games saved, ${patches.length} existing games filled in.`);
}

main().catch((e) => {
  console.error(`\nImport stopped: ${e.message}`);
  process.exit(1);
});
