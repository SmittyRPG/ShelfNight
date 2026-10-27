import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useAuth } from './auth';
import { supabase } from './supabase';
import type { Game } from './types';

type DataState = {
  games: Game[];
  gamesLoading: boolean;
  ownedIds: Set<number>;
  ownedGames: Game[];
  toggleOwned: (gameId: number) => Promise<void>;
  addOwned: (gameIds: number[]) => Promise<void>;
  error: string | null;
  reload: () => Promise<void>;
};

const DataContext = createContext<DataState | null>(null);

/** Loads the game catalog and the signed-in user's shelf, and keeps them in sync. */
export function DataProvider({ children }: { children: ReactNode }) {
  const { session } = useAuth();
  const userId = session?.user.id;
  const [games, setGames] = useState<Game[]>([]);
  const [gamesLoading, setGamesLoading] = useState(true);
  const [ownedIds, setOwnedIds] = useState<Set<number>>(new Set());
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setGamesLoading(true);
    setError(null);
    // Supabase returns at most 1,000 rows per request, so load the catalog in pages.
    const all: Game[] = [];
    for (let from = 0; ; from += 1000) {
      const { data, error: gErr } = await supabase.from('games').select('*').order('name').range(from, from + 999);
      if (gErr) { setError('Could not load the game catalog. Check your internet connection.'); break; }
      all.push(...((data as Game[]) ?? []));
      if (!data || data.length < 1000) break;
    }
    setGames(all);
    if (userId) {
      const { data: shelf } = await supabase.from('shelf_items').select('game_id').eq('user_id', userId);
      setOwnedIds(new Set((shelf ?? []).map((r: { game_id: number }) => r.game_id)));
    } else {
      setOwnedIds(new Set());
    }
    setGamesLoading(false);
  }, [userId]);

  useEffect(() => { reload(); }, [reload]);

  const toggleOwned = useCallback(async (gameId: number) => {
    if (!userId) return;
    const has = ownedIds.has(gameId);
    // Update the screen first, then the server; roll back if the server says no.
    setOwnedIds((prev) => { const n = new Set(prev); has ? n.delete(gameId) : n.add(gameId); return n; });
    const { error: e } = has
      ? await supabase.from('shelf_items').delete().eq('user_id', userId).eq('game_id', gameId)
      : await supabase.from('shelf_items').insert({ user_id: userId, game_id: gameId });
    if (e) {
      setOwnedIds((prev) => { const n = new Set(prev); has ? n.add(gameId) : n.delete(gameId); return n; });
      setError('That change did not save. Try again.');
    }
  }, [userId, ownedIds]);

  const addOwned = useCallback(async (gameIds: number[]) => {
    if (!userId || !gameIds.length) return;
    const rows = gameIds.map((game_id) => ({ user_id: userId, game_id }));
    const { error: e } = await supabase.from('shelf_items').upsert(rows, { onConflict: 'user_id,game_id' });
    if (e) { setError('Those games did not save. Try again.'); return; }
    setOwnedIds((prev) => new Set([...prev, ...gameIds]));
  }, [userId]);

  const ownedGames = useMemo(() => games.filter((g) => ownedIds.has(g.id)), [games, ownedIds]);

  return (
    <DataContext.Provider value={{ games, gamesLoading, ownedIds, ownedGames, toggleOwned, addOwned, error, reload }}>
      {children}
    </DataContext.Provider>
  );
}

export function useData() {
  const ctx = useContext(DataContext);
  if (!ctx) throw new Error('useData must be used inside DataProvider');
  return ctx;
}
