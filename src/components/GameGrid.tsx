import type { ReactNode } from 'react';
import { Text, View, useWindowDimensions } from 'react-native';
import { Card, GameLid, GameStats, OwnToggle } from '@/components/ui';
import { useData } from '@/lib/data';
import { useColors } from '@/lib/theme';
import type { Game } from '@/lib/types';

/** Responsive grid of game cards with an "I own this" toggle on each. */
export function GameGrid({ games, footer }: { games: Game[]; footer?: (g: Game) => ReactNode }) {
  const c = useColors();
  const { ownedIds, toggleOwned } = useData();
  const { width } = useWindowDimensions();
  const cols = width >= 900 ? 4 : width >= 600 ? 3 : 2;
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginHorizontal: -6 }}>
      {games.map((g) => (
        <View key={g.id} style={{ width: `${100 / cols}%`, padding: 6 }}>
          <Card highlight={ownedIds.has(g.id)} style={{ padding: 10, gap: 8, flex: 1 }}>
            <View style={{ alignItems: 'flex-start' }}><GameLid name={g.name} size={56} /></View>
            <Text style={{ color: c.fg, fontWeight: '700', fontSize: 15 }} numberOfLines={2}>{g.name}</Text>
            <GameStats game={g} />
            {footer?.(g)}
            <View style={{ flex: 1 }} />
            <OwnToggle owned={ownedIds.has(g.id)} onPress={() => toggleOwned(g.id)} />
          </Card>
        </View>
      ))}
    </View>
  );
}
