import type { Game } from './types';

export type Weight = 'any' | 'light' | 'medium' | 'heavy';
export type Vibe = 'any' | 'coop' | 'competitive' | 'party';

export type TonightInput = {
  players: number;
  minutes: number;
  weight: Weight;
  vibe: Vibe;
  newcomers: boolean;
};

export type Reason = { ok: boolean; text: string };
export type TonightPick = { game: Game; score: number; reasons: Reason[] };

export function weightBand(w: number): Exclude<Weight, 'any'> {
  if (w < 2.2) return 'light';
  if (w < 3.2) return 'medium';
  return 'heavy';
}

/**
 * Score one owned game for tonight. Returns null when it can't be played.
 * Imported games may be missing details; unknowns never rule a game out,
 * they just score a little lower and say so.
 */
export function scoreTonight(game: Game, input: TonightInput): TonightPick | null {
  const { players, minutes, weight, vibe, newcomers } = input;
  const reasons: Reason[] = [];
  const { min_players: minP, max_players: maxP, play_minutes: time, weight: w } = game;

  let score = 50;
  if (minP == null && maxP == null) {
    score -= 8;
    reasons.push({ ok: false, text: 'Player count unknown' });
  } else {
    if ((minP != null && players < minP) || (maxP != null && players > maxP)) return null;
    reasons.push({ ok: true, text: `Plays ${players}` });
  }

  if (time == null) {
    score -= 8;
    reasons.push({ ok: false, text: 'Length unknown' });
  } else if (time <= minutes) {
    score += 15;
    reasons.push({ ok: true, text: `${time} min fits` });
    if (minutes - time > 60) score -= 6;
  } else if (time <= minutes * 1.25) {
    score -= 10;
    reasons.push({ ok: false, text: `Runs a bit long (${time} min)` });
  } else {
    return null;
  }

  if (weight !== 'any') {
    if (w == null) score -= 10;
    else if (weightBand(w) === weight) {
      score += 15;
      reasons.push({ ok: true, text: `${weight[0].toUpperCase()}${weight.slice(1)} weight` });
    } else score -= 20;
  }

  if (newcomers) {
    if (w == null) {
      reasons.push({ ok: false, text: 'Complexity unknown' });
    } else if (w <= 2.0) {
      score += 12;
      reasons.push({ ok: true, text: 'Easy to teach' });
    } else if (w <= 2.5) {
      reasons.push({ ok: false, text: 'Short teach needed' });
    } else {
      score -= 25;
      reasons.push({ ok: false, text: 'Tough for newcomers' });
    }
  }

  const tags = game.tags;
  if (vibe === 'coop') {
    if (tags.includes('coop')) { score += 20; reasons.push({ ok: true, text: 'Everyone on one team' }); }
    else score -= 15;
  }
  if (vibe === 'competitive') {
    if (tags.includes('competitive')) { score += 12; reasons.push({ ok: true, text: 'Head to head' }); }
    else score -= 15;
  }
  if (vibe === 'party') {
    if (tags.includes('party')) { score += 22; reasons.push({ ok: true, text: 'Big laughs' }); }
    else score -= 10;
  }

  // Games play best near the middle of their player range.
  if (minP != null && maxP != null) score -= Math.abs(players - (minP + maxP) / 2) * 1.5;

  return { game, score, reasons };
}

export function pickTonight(owned: Game[], input: TonightInput): TonightPick[] {
  return owned
    .map((g) => scoreTonight(g, input))
    .filter((x): x is TonightPick => x !== null)
    .sort((a, b) => b.score - a.score);
}

const IGNORE = new Set(['competitive']);

/** How alike two games are, roughly 0..1. Uses tags, weight and length. */
export function similarity(a: Game, b: Game): number {
  const A = new Set(a.tags.filter((t) => !IGNORE.has(t)));
  const B = new Set(b.tags.filter((t) => !IGNORE.has(t)));
  const inter = [...A].filter((t) => B.has(t)).length;
  const union = new Set([...A, ...B]).size || 1;
  const weightGap = a.weight != null && b.weight != null ? Math.abs(a.weight - b.weight) * 0.12 : 0.05;
  const timeGap = a.play_minutes != null && b.play_minutes != null ? Math.abs(a.play_minutes - b.play_minutes) / 600 : 0.05;
  return inter / union - weightGap - timeGap;
}

export type Suggestion = { game: Game; because: Game; shared: string[]; score: number };

export function suggestSimilar(all: Game[], ownedIds: Set<number>, limit = 20): Suggestion[] {
  const mine = all.filter((g) => ownedIds.has(g.id));
  if (!mine.length) return [];
  return all
    // Only suggest games with enough detail to be useful.
    .filter((g) => !ownedIds.has(g.id) && g.tags.some((t) => !IGNORE.has(t) && t !== 'solo'))
    .map((g) => {
      let best = mine[0];
      let bestScore = -Infinity;
      for (const m of mine) {
        const s = similarity(g, m);
        if (s > bestScore) { bestScore = s; best = m; }
      }
      const shared = g.tags.filter((t) => !IGNORE.has(t) && best.tags.includes(t)).slice(0, 2);
      return { game: g, because: best, shared, score: bestScore };
    })
    .filter((x) => x.score > 0.05)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}

/**
 * Match a title read from a photo to a game in the catalog.
 * Exact name first, then the name before a colon, then the closest partial match
 * (hand-checked games win ties, then the closest length).
 */
export function matchTitle(title: string, games: Game[]): Game | undefined {
  const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');
  const n = norm(title);
  if (n.length < 2) return undefined;
  const prefer = (list: Game[]) =>
    list.sort((a, b) =>
      Number(b.source === 'curated') - Number(a.source === 'curated') ||
      Math.abs(norm(a.name).length - n.length) - Math.abs(norm(b.name).length - n.length))[0];

  const exact = games.filter((g) => norm(g.name) === n);
  if (exact.length) return prefer(exact);
  const beforeColon = games.filter((g) => norm(g.name.split(':')[0]) === n);
  if (beforeColon.length) return prefer(beforeColon);
  if (n.length < 5) return undefined; // short words match too many games
  const partial = games.filter((g) => {
    const gn = norm(g.name);
    return gn.length >= 5 && (n.includes(gn) || gn.includes(n)) && Math.min(gn.length, n.length) / Math.max(gn.length, n.length) >= 0.6;
  });
  return partial.length ? prefer(partial) : undefined;
}
