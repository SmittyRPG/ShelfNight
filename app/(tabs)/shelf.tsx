import { useMemo, useState } from 'react';
import { TextInput } from 'react-native';
import { GameGrid } from '@/components/GameGrid';
import { Banner, Empty, Lede, Loading, Screen, Segmented, Title } from '@/components/ui';
import { useData } from '@/lib/data';
import { useColors } from '@/lib/theme';

type Filter = 'all' | 'owned' | 'not';

export default function Shelf() {
  const c = useColors();
  const { games, ownedIds, gamesLoading, error } = useData();
  const [q, setQ] = useState('');
  const [filter, setFilter] = useState<Filter>('all');

  const list = useMemo(() => {
    const query = q.trim().toLowerCase();
    return games
      .filter((g) => !query || g.name.toLowerCase().includes(query) || g.tags.some((t) => t.includes(query)))
      .filter((g) => filter === 'all' || (filter === 'owned') === ownedIds.has(g.id))
      .sort((a, b) => Number(ownedIds.has(b.id)) - Number(ownedIds.has(a.id)) || a.name.localeCompare(b.name));
  }, [games, ownedIds, q, filter]);

  return (
    <Screen>
      <Title>My shelf</Title>
      <Lede>Tap a game to mark it as owned. You have {ownedIds.size} of {games.length} games in the catalog.</Lede>
      <TextInput value={q} onChangeText={setQ} placeholder="Search games or mechanics" placeholderTextColor={c.muted}
        accessibilityLabel="Search games"
        style={{ borderWidth: 1, borderColor: c.line, backgroundColor: c.surface, color: c.fg, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, fontSize: 16 }} />
      <Segmented<Filter> value={filter} onChange={setFilter}
        options={[{ value: 'all', label: 'All games' }, { value: 'owned', label: 'Owned' }, { value: 'not', label: 'Not owned' }]} />
      <Banner text={error} tone="error" />
      {gamesLoading ? <Loading /> : list.length ? <GameGrid games={list} /> : <Empty>No games match “{q}”.</Empty>}
    </Screen>
  );
}
