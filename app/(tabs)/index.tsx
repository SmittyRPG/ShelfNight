import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, Switch, Text, View } from 'react-native';
import { AdSlot } from '@/components/AdSlot';
import { Button, Card, Empty, GameLid, GameStats, Label, Lede, Loading, Muted, Screen, Segmented, Title } from '@/components/ui';
import { useData } from '@/lib/data';
import { pickTonight, type TonightInput, type Vibe, type Weight } from '@/lib/recommend';
import { useColors } from '@/lib/theme';

const TIMES = [15, 30, 45, 60, 90, 120, 180];

function Stepper({ value, onChange, min, max, label }: { value: number; onChange: (n: number) => void; min: number; max: number; label: string }) {
  const c = useColors();
  const btn = (txt: string, next: number, a11y: string) => (
    <Pressable accessibilityRole="button" accessibilityLabel={a11y} disabled={next < min || next > max}
      onPress={() => onChange(next)}
      style={{ width: 44, height: 44, borderRadius: 10, borderWidth: 1, borderColor: c.line, backgroundColor: c.sunk, alignItems: 'center', justifyContent: 'center', opacity: next < min || next > max ? 0.4 : 1 }}>
      <Text style={{ color: c.fg, fontSize: 22, fontWeight: '700' }}>{txt}</Text>
    </Pressable>
  );
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }} accessibilityLabel={`${label}: ${value}`}>
      {btn('−', value - 1, `Fewer ${label.toLowerCase()}`)}
      <Text style={{ color: c.fg, fontSize: 30, fontWeight: '800', minWidth: 56, textAlign: 'center', fontVariant: ['tabular-nums'] }}>{value}</Text>
      {btn('+', value + 1, `More ${label.toLowerCase()}`)}
    </View>
  );
}

export default function Tonight() {
  const c = useColors();
  const router = useRouter();
  const { ownedGames, gamesLoading } = useData();
  const [input, setInput] = useState<TonightInput>({ players: 4, minutes: 60, weight: 'any', vibe: 'any', newcomers: false });
  const set = <K extends keyof TonightInput>(k: K, v: TonightInput[K]) => setInput((p) => ({ ...p, [k]: v }));
  const picks = useMemo(() => pickTonight(ownedGames, input), [ownedGames, input]);

  return (
    <Screen>
      <Title>What should we play tonight?</Title>
      <Lede>Tell us who's at the table and how long you have. We pick from the games you own.</Lede>

      <Card>
        <Label>Players</Label>
        <Stepper label="Players" value={input.players} min={1} max={12} onChange={(n) => set('players', n)} />
        <Label>Time we have</Label>
        <Segmented
          options={TIMES.map((t) => ({ value: String(t), label: t >= 180 ? '3h+' : t >= 60 ? `${t / 60}h${t % 60 ? ' 30' : ''}` : `${t}m` }))}
          value={String(input.minutes)} onChange={(v) => set('minutes', Number(v))} />
        <Label>How heavy?</Label>
        <Segmented<Weight> value={input.weight} onChange={(v) => set('weight', v)}
          options={[{ value: 'any', label: 'Any' }, { value: 'light', label: 'Light' }, { value: 'medium', label: 'Medium' }, { value: 'heavy', label: 'Heavy' }]} />
        <Label>Vibe</Label>
        <Segmented<Vibe> value={input.vibe} onChange={(v) => set('vibe', v)}
          options={[{ value: 'any', label: 'Anything' }, { value: 'coop', label: 'Team up' }, { value: 'competitive', label: 'Compete' }, { value: 'party', label: 'Party' }]} />
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <Text style={{ color: c.fg, flex: 1 }}>Someone is new to board games</Text>
          <Switch value={input.newcomers} onValueChange={(v) => set('newcomers', v)} trackColor={{ true: c.accent, false: c.line }} />
        </View>
      </Card>

      {gamesLoading ? <Loading /> : !ownedGames.length ? (
        <>
          <Empty>Your shelf is empty. Add the games you own and we'll pick for you.</Empty>
          <Button title="Scan my shelf with a photo" onPress={() => router.push('/scan')} />
          <Button title="Pick games from the list" kind="ghost" onPress={() => router.push('/shelf')} />
        </>
      ) : !picks.length ? (
        <Empty>None of your {ownedGames.length} games fit {input.players} players in {input.minutes} minutes with these settings. Try loosening the weight or vibe.</Empty>
      ) : (
        <View style={{ gap: 12 }}>
          <Muted>{picks.length} of your {ownedGames.length} games work tonight</Muted>
          {picks.slice(0, 5).map((p, i) => (
            <Card key={p.game.id} highlight={i === 0} style={{ flexDirection: 'row', gap: 14 }}>
              <GameLid name={p.game.name} size={72} />
              <View style={{ flex: 1, gap: 4 }}>
                <Muted>{i === 0 ? 'Top pick' : `#${i + 1}`}</Muted>
                <Text style={{ color: c.fg, fontSize: 18, fontWeight: '800' }}>{p.game.name}</Text>
                <GameStats game={p.game} />
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 4 }}>
                  {p.reasons.map((r) => (
                    <Text key={r.text} style={{ fontSize: 12, color: c.fg, backgroundColor: c.sunk, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6, overflow: 'hidden' }}>
                      <Text style={{ color: r.ok ? c.good : c.warn, fontWeight: '800' }}>{r.ok ? '✓ ' : '~ '}</Text>{r.text}
                    </Text>
                  ))}
                </View>
              </View>
            </Card>
          ))}
          <AdSlot placement="tonight" />
        </View>
      )}
    </Screen>
  );
}
