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

/** Score one owned game for tonight. Returns null when it can't be played. */
export function scoreTonight(game: Game, input: TonightInput): TonightPick | null {
  const { players, minutes, weight, vibe, newcomers } = input;
  const reasons: Reason[] = [];
  if (players < game.min_players || players > game.max_players) return null;

  let score = 50;
  reasons.push({ ok: true, text: `Plays ${players}` });

  if (game.play_minutes <= minutes) {
    score += 15;
    reasons.push({ ok: true, text: `${game.play_minutes} min fits` });
  } else if (game.play_minutes <= minutes * 1.25) {
    score -= 10;
    reasons.push({ ok: false, text: `Runs a bit long (${game.play_minutes} min)` });
  } else {
    return null;
  }
  if (minutes - game.play_minutes > 60) score -= 6;

  const band = weightBand(game.weight);
  if (weight !== 'any') {
    if (band === weight) {
      score += 15;
      reasons.push({ ok: true, text: `${band[0].toUpperCase()}${band.slice(1)} weight` });
    } else score -= 20;
  }

  if (newcomers) {
    if (game.weight <= 2.0) {
      score += 12;
      reasons.push({ ok: true, text: 'Easy to teach' });
    } else if (game.weight <= 2.5) {
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
  const mid = (game.min_players + game.max_players) / 2;
  score -= Math.abs(players - mid) * 1.5;

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
  return inter / union - Math.abs(a.weight - b.weight) * 0.12 - Math.abs(a.play_minutes - b.play_minutes) / 600;
}

export type Suggestion = { game: Game; because: Game; shared: string[]; score: number };

export function suggestSimilar(all: Game[], ownedIds: Set<number>, limit = 20): Suggestion[] {
  const mine = all.filter((g) => ownedIds.has(g.id));
  if (!mine.length) return [];
  return all
    .filter((g) => !ownedIds.has(g.id))
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

/** Match a title read from a photo to a game in the catalog. */
export function matchTitle(title: string, games: Game[]): Game | undefined {
  const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');
  const n = norm(title);
  if (n.length < 3) return undefined;
  return (
    games.find((g) => norm(g.name) === n) ??
    games.find((g) => norm(g.name.split(':')[0]) === n) ??
    games.find((g) => {
      const gn = norm(g.name);
      return gn.length >= 4 && n.length >= 4 && (n.includes(gn) || gn.includes(n));
    })
  );
}
