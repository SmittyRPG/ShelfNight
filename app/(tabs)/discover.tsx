import { useMemo } from 'react';
import { Text } from 'react-native';
import { AdSlot } from '@/components/AdSlot';
import { GameGrid } from '@/components/GameGrid';
import { Empty, Lede, Loading, Screen, Title } from '@/components/ui';
import { useData } from '@/lib/data';
import { suggestSimilar } from '@/lib/recommend';
import { useColors } from '@/lib/theme';

export default function Discover() {
  const c = useColors();
  const { games, ownedIds, gamesLoading } = useData();
  const suggestions = useMemo(() => suggestSimilar(games, ownedIds, 24), [games, ownedIds]);
  const byId = useMemo(() => new Map(suggestions.map((s) => [s.game.id, s])), [suggestions]);

  return (
    <Screen>
      <Title>More like what you own</Title>
      <Lede>Games you don't have yet, matched on mechanics, length and weight to the ones on your shelf.</Lede>
      {gamesLoading ? <Loading /> : !ownedIds.size ? (
        <Empty>Mark a few games you own first, then come back here.</Empty>
      ) : !suggestions.length ? (
        <Empty>You already own most of the catalog.</Empty>
      ) : (
        <>
          <GameGrid
            games={suggestions.map((s) => s.game)}
            footer={(g) => {
              const s = byId.get(g.id);
              if (!s) return null;
              return (
                <Text style={{ color: c.muted, fontSize: 12 }}>
                  Because you own <Text style={{ fontWeight: '700', color: c.fg }}>{s.because.name}</Text>
                  {s.shared.length ? ` · ${s.shared.join(', ')}` : ''}
                </Text>
              );
            }}
          />
          <AdSlot placement="discover" />
        </>
      )}
    </Screen>
  );
}
