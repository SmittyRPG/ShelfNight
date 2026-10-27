import type { ReactNode } from 'react';
import {
  ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View,
  type StyleProp, type TextInputProps, type ViewStyle,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { radius, useColors } from '@/lib/theme';
import type { Game } from '@/lib/types';

/** A scrolling page with the app background and a centered, readable width on desktop. */
export function Screen({ children, scroll = true }: { children: ReactNode; scroll?: boolean }) {
  const c = useColors();
  const inner = <View style={styles.inner}>{children}</View>;
  return (
    <SafeAreaView edges={['left', 'right']} style={{ flex: 1, backgroundColor: c.bg }}>
      {scroll ? <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">{inner}</ScrollView> : inner}
    </SafeAreaView>
  );
}

export function Title({ children }: { children: ReactNode }) {
  const c = useColors();
  return <Text style={[styles.title, { color: c.fg }]}>{children}</Text>;
}

export function Lede({ children }: { children: ReactNode }) {
  const c = useColors();
  return <Text style={[styles.lede, { color: c.muted }]}>{children}</Text>;
}

export function Label({ children }: { children: ReactNode }) {
  const c = useColors();
  return <Text style={[styles.label, { color: c.fg }]}>{children}</Text>;
}

export function Muted({ children, style }: { children: ReactNode; style?: object }) {
  const c = useColors();
  return <Text style={[{ color: c.muted, fontSize: 13 }, style]}>{children}</Text>;
}

export function Card({ children, style, highlight }: { children: ReactNode; style?: StyleProp<ViewStyle>; highlight?: boolean }) {
  const c = useColors();
  return (
    <View style={[styles.card, { backgroundColor: c.surface, borderColor: highlight ? c.accent : c.line }, style]}>
      {children}
    </View>
  );
}

type ButtonProps = { title: string; onPress: () => void; kind?: 'primary' | 'ghost' | 'danger'; disabled?: boolean; loading?: boolean };
export function Button({ title, onPress, kind = 'primary', disabled, loading }: ButtonProps) {
  const c = useColors();
  const bg = kind === 'primary' ? c.accent : kind === 'danger' ? c.meeple : c.sunk;
  const fg = kind === 'ghost' ? c.fg : c.accentFg;
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      disabled={disabled || loading}
      style={({ pressed }) => [styles.button, { backgroundColor: bg, borderColor: kind === 'ghost' ? c.line : bg, opacity: disabled ? 0.5 : pressed ? 0.85 : 1 }]}
    >
      {loading ? <ActivityIndicator color={fg} /> : <Text style={[styles.buttonText, { color: fg }]}>{title}</Text>}
    </Pressable>
  );
}

export function Field(props: TextInputProps & { label: string; hint?: string; error?: string | null }) {
  const c = useColors();
  const { label, hint, error, style, ...rest } = props;
  return (
    <View style={{ gap: 6 }}>
      <Label>{label}</Label>
      <TextInput
        placeholderTextColor={c.muted}
        style={[styles.input, { color: c.fg, backgroundColor: c.surface, borderColor: error ? c.meeple : c.line }, style]}
        {...rest}
      />
      {error ? <Text style={{ color: c.meeple, fontSize: 13 }}>{error}</Text> : hint ? <Muted>{hint}</Muted> : null}
    </View>
  );
}

/** A row of pill buttons where one is selected. */
export function Segmented<T extends string>({ options, value, onChange }: { options: { value: T; label: string }[]; value: T; onChange: (v: T) => void }) {
  const c = useColors();
  return (
    <View style={styles.seg}>
      {options.map((o) => {
        const on = o.value === value;
        return (
          <Pressable
            key={o.value}
            accessibilityRole="button"
            accessibilityState={{ selected: on }}
            onPress={() => onChange(o.value)}
            style={[styles.pill, { backgroundColor: on ? c.accent : c.surface, borderColor: on ? c.accent : c.line }]}
          >
            <Text style={{ color: on ? c.accentFg : c.fg, fontSize: 14 }}>{o.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export function Banner({ text, tone = 'info' }: { text: string | null | undefined; tone?: 'info' | 'error' }) {
  const c = useColors();
  if (!text) return null;
  return (
    <View style={[styles.banner, { backgroundColor: c.sunk }]}>
      <Text style={{ color: tone === 'error' ? c.meeple : c.fg, fontSize: 14 }}>{text}</Text>
    </View>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  const c = useColors();
  return (
    <View style={[styles.empty, { borderColor: c.line }]}>
      <Text style={{ color: c.muted, textAlign: 'center' }}>{children}</Text>
    </View>
  );
}

// ---------- Game pieces ----------

function hue(name: string) {
  let h = 0;
  for (const ch of name) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return h % 360;
}
function initials(name: string) {
  return name.replace(/[^A-Za-z0-9 ]/g, '').split(/\s+/)
    .filter((w) => w && !/^(the|of|to|a)$/i.test(w)).slice(0, 2).map((w) => w[0]).join('').toUpperCase();
}

/** Colored "box lid" placeholder until real box art is licensed. */
export function GameLid({ name, size = 72 }: { name: string; size?: number }) {
  const h = hue(name);
  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no"
      style={{ width: size, height: size, borderRadius: size > 50 ? 8 : 6, backgroundColor: `hsl(${h}, 52%, 36%)`, alignItems: 'center', justifyContent: 'center', borderBottomWidth: 5, borderBottomColor: `hsl(${h}, 52%, 26%)` }}
    >
      <Text style={{ color: '#fff', fontWeight: '800', fontSize: size * 0.34, letterSpacing: -0.5 }}>{initials(name)}</Text>
    </View>
  );
}

export function GameStats({ game }: { game: Game }) {
  const c = useColors();
  const players = game.min_players === game.max_players ? `${game.min_players}p` : `${game.min_players}–${game.max_players}p`;
  const filled = Math.round(Number(game.weight));
  return (
    <View style={styles.stats}>
      <Text style={[styles.stat, { color: c.muted }]}>{players}</Text>
      <Text style={[styles.stat, { color: c.muted }]}>{game.play_minutes} min</Text>
      <View style={{ flexDirection: 'row', gap: 2 }} accessibilityLabel={`Weight ${Number(game.weight).toFixed(1)} of 5`}>
        {[1, 2, 3, 4, 5].map((i) => (
          <View key={i} style={{ width: 6, height: 10, borderRadius: 2, backgroundColor: i <= filled ? c.fg : c.line }} />
        ))}
      </View>
    </View>
  );
}

export function OwnToggle({ owned, onPress }: { owned: boolean; onPress: () => void }) {
  const c = useColors();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: owned }}
      onPress={onPress}
      style={[styles.own, { backgroundColor: owned ? c.accent : c.sunk, borderColor: owned ? c.accent : c.line }]}
    >
      <Text style={{ color: owned ? c.accentFg : c.fg, fontWeight: '700', fontSize: 13 }}>{owned ? '✓ On my shelf' : '+ I own this'}</Text>
    </Pressable>
  );
}

export function Loading() {
  const c = useColors();
  return <View style={{ padding: 32, alignItems: 'center' }}><ActivityIndicator color={c.accent} /></View>;
}

const styles = StyleSheet.create({
  scroll: { flexGrow: 1 },
  inner: { width: '100%', maxWidth: 960, alignSelf: 'center', paddingHorizontal: 16, paddingTop: 16, paddingBottom: 48, gap: 16 },
  title: { fontSize: 28, fontWeight: '800', letterSpacing: -0.5 },
  lede: { fontSize: 15, lineHeight: 22, marginTop: -8 },
  label: { fontSize: 14, fontWeight: '700' },
  card: { borderWidth: 1, borderRadius: radius.lg, padding: 14, gap: 10 },
  button: { borderRadius: 10, paddingVertical: 12, paddingHorizontal: 16, alignItems: 'center', borderWidth: 1 },
  buttonText: { fontWeight: '700', fontSize: 15 },
  input: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, fontSize: 16 },
  seg: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  pill: { borderWidth: 1, borderRadius: 999, paddingVertical: 6, paddingHorizontal: 12 },
  banner: { borderRadius: 10, padding: 12 },
  empty: { borderWidth: 1, borderStyle: 'dashed', borderRadius: radius.lg, padding: 24 },
  stats: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 12, marginTop: 2 },
  stat: { fontSize: 12, fontVariant: ['tabular-nums'] },
  own: { borderWidth: 1, borderRadius: 8, paddingVertical: 8, alignItems: 'center' },
});
