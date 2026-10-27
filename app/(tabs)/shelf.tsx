import { useMemo, useState } from 'react';
import { TextInput } from 'react-native';
import { GameGrid } from '@/components/GameGrid';
import { Banner, Button, Empty, Lede, Loading, Muted, Screen, Segmented, Title } from '@/components/ui';
import { useData } from '@/lib/data';
import { useColors } from '@/lib/theme';

type Filter = 'all' | 'owned' | 'not';
const PAGE = 60; // the catalog can hold thousands of games; draw a page at a time

export default function Shelf() {
  const c = useColors();
  const { games, ownedIds, gamesLoading, error } = useData();
  const [q, setQ] = useState('');
  const [filter, setFilter] = useState<Filter>('all');
  const [shown, setShown] = useState(PAGE);

  const list = useMemo(() => {
    const query = q.trim().toLowerCase();
    return games
      .filter((g) => !query || g.name.toLowerCase().includes(query) || g.tags.some((t) => t.includes(query)))
      .filter((g) => filter === 'all' || (filter === 'owned') === ownedIds.has(g.id))
      .sort((a, b) =>
        Number(ownedIds.has(b.id)) - Number(ownedIds.has(a.id)) ||
        // Titles that start with what you typed come first.
        (query ? Number(b.name.toLowerCase().startsWith(query)) - Number(a.name.toLowerCase().startsWith(query)) : 0) ||
        // Hand-checked games before imported ones.
        Number(b.source === 'curated') - Number(a.source === 'curated') ||
        a.name.localeCompare(b.name));
  }, [games, ownedIds, q, filter]);

  return (
    <Screen>
      <Title>My shelf</Title>
      <Lede>Tap a game to mark it as owned. You own {ownedIds.size} of {games.length.toLocaleString()} games in the catalog.</Lede>
      <TextInput value={q} onChangeText={(t) => { setQ(t); setShown(PAGE); }} placeholder="Search games or mechanics" placeholderTextColor={c.muted}
        accessibilityLabel="Search games"
        style={{ borderWidth: 1, borderColor: c.line, backgroundColor: c.surface, color: c.fg, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, fontSize: 16 }} />
      <Segmented<Filter> value={filter} onChange={(f) => { setFilter(f); setShown(PAGE); }}
        options={[{ value: 'all', label: 'All games' }, { value: 'owned', label: 'Owned' }, { value: 'not', label: 'Not owned' }]} />
      <Banner text={error} tone="error" />
      {gamesLoading ? <Loading /> : list.length ? (
        <>
          <GameGrid games={list.slice(0, shown)} />
          {list.length > shown ? (
            <>
              <Muted>Showing {shown.toLocaleString()} of {list.length.toLocaleString()}. Search to find a specific game.</Muted>
              <Button title="Show more" kind="ghost" onPress={() => setShown((n) => n + PAGE)} />
            </>
          ) : null}
        </>
      ) : <Empty>No games match “{q}”.</Empty>}
    </Screen>
  );
}
