import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';
import { useMemo, useState } from 'react';
import { Image, Platform, Pressable, Text, View } from 'react-native';
import { Banner, Button, Card, Empty, GameLid, GameStats, Lede, Muted, Screen, Title } from '@/components/ui';
import { useData } from '@/lib/data';
import { matchTitle } from '@/lib/recommend';
import { supabase } from '@/lib/supabase';
import { useColors } from '@/lib/theme';
import type { Game } from '@/lib/types';

type Result = { matched: Game[]; unknown: string[] };

export default function Scan() {
  const c = useColors();
  const { games, ownedIds, addOwned } = useData();
  const [photo, setPhoto] = useState<{ uri: string; base64: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ text: string; tone: 'info' | 'error' } | null>(null);
  const [result, setResult] = useState<Result | null>(null);
  const [checked, setChecked] = useState<Set<number>>(new Set());

  async function choose(source: 'camera' | 'library') {
    setMsg(null);
    const perm = source === 'camera'
      ? await ImagePicker.requestCameraPermissionsAsync()
      : await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      setMsg({ text: `Shelf Night needs ${source === 'camera' ? 'camera' : 'photo'} access to scan. You can allow it in your device settings.`, tone: 'error' });
      return;
    }
    const opts: ImagePicker.ImagePickerOptions = { mediaTypes: ['images'], quality: 1 };
    const res = source === 'camera' ? await ImagePicker.launchCameraAsync(opts) : await ImagePicker.launchImageLibraryAsync(opts);
    if (res.canceled || !res.assets[0]) return;
    // Shrink to ~1600px wide: plenty to read box spines, and fast to upload.
    const small = await manipulateAsync(res.assets[0].uri, [{ resize: { width: 1600 } }], { compress: 0.7, format: SaveFormat.JPEG, base64: true });
    if (!small.base64) { setMsg({ text: 'That photo could not be opened. Try another.', tone: 'error' }); return; }
    setPhoto({ uri: small.uri, base64: small.base64 });
    setResult(null);
  }

  async function scan() {
    if (!photo) return;
    setBusy(true);
    setMsg({ text: 'Reading titles from your photo… this can take 20–40 seconds.', tone: 'info' });
    const { data, error } = await supabase.functions.invoke('scan-shelf', { body: { image: photo.base64, mediaType: 'image/jpeg' } });
    setBusy(false);
    if (error) {
      let text = 'The photo could not be read right now. Try again in a minute.';
      try { const body = await (error as { context?: Response }).context?.json(); if (body?.error) text = body.error; } catch { /* keep default */ }
      setMsg({ text, tone: 'error' });
      return;
    }
    const titles: string[] = data?.titles ?? [];
    const seen = new Set<number>();
    const matched: Game[] = [];
    const unknown: string[] = [];
    for (const t of titles) {
      const g = matchTitle(t, games);
      if (g) { if (!seen.has(g.id)) { seen.add(g.id); matched.push(g); } }
      else unknown.push(t);
    }
    setResult({ matched, unknown });
    setChecked(new Set(matched.filter((g) => !ownedIds.has(g.id)).map((g) => g.id)));
    const left = typeof data?.scansLeft === 'number' ? ` ${data.scansLeft} scans left today.` : '';
    setMsg({ text: titles.length ? `Read ${titles.length} titles. Uncheck any that aren't yours, then add them.${left}` : `No readable titles in that photo. Try a closer, brighter shot.${left}`, tone: 'info' });
  }

  async function add() {
    const ids = [...checked];
    await addOwned(ids);
    setMsg({ text: `Added ${ids.length} game${ids.length === 1 ? '' : 's'} to your shelf.`, tone: 'info' });
    setChecked(new Set());
  }

  const toAdd = useMemo(() => [...checked].filter((id) => !ownedIds.has(id)).length, [checked, ownedIds]);

  return (
    <Screen>
      <Title>Scan your shelf</Title>
      <Lede>Take one photo of your games with the spines or covers showing. We read the titles, then you confirm which to add.</Lede>

      <Card>
        {photo ? <Image source={{ uri: photo.uri }} style={{ width: '100%', aspectRatio: 4 / 3, borderRadius: 8 }} resizeMode="contain" accessibilityLabel="Your shelf photo" /> : <Empty>No photo yet. Spines facing out and good light work best.</Empty>}
        <View style={{ flexDirection: 'row', gap: 8 }}>
          {Platform.OS !== 'web' ? <View style={{ flex: 1 }}><Button title="Take photo" kind="ghost" onPress={() => choose('camera')} /></View> : null}
          <View style={{ flex: 1 }}><Button title={Platform.OS === 'web' ? 'Choose photo' : 'From photos'} kind="ghost" onPress={() => choose('library')} /></View>
        </View>
        <Button title="Read titles" onPress={scan} disabled={!photo} loading={busy} />
        <Banner text={msg?.text} tone={msg?.tone} />
      </Card>

      {result ? (
        <View style={{ gap: 8 }}>
          <Text style={{ color: c.fg, fontSize: 18, fontWeight: '800' }}>Found on your shelf</Text>
          {result.matched.length ? result.matched.map((g) => {
            const already = ownedIds.has(g.id);
            const on = already || checked.has(g.id);
            return (
              <Pressable key={g.id} disabled={already} accessibilityRole="checkbox" accessibilityState={{ checked: on, disabled: already }}
                onPress={() => setChecked((p) => { const n = new Set(p); n.has(g.id) ? n.delete(g.id) : n.add(g.id); return n; })}>
                <Card style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10 }}>
                  <View style={{ width: 22, height: 22, borderRadius: 5, borderWidth: 1.5, borderColor: on ? c.accent : c.line, backgroundColor: on ? c.accent : 'transparent', alignItems: 'center', justifyContent: 'center' }}>
                    {on ? <Text style={{ color: c.accentFg, fontWeight: '800' }}>✓</Text> : null}
                  </View>
                  <GameLid name={g.name} size={40} />
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: c.fg, fontWeight: '700' }}>{g.name}{already ? '  · already on shelf' : ''}</Text>
                    <GameStats game={g} />
                  </View>
                </Card>
              </Pressable>
            );
          }) : <Empty>None of the titles matched games in the catalog yet.</Empty>}
          {toAdd ? <Button title={`Add ${toAdd} game${toAdd === 1 ? '' : 's'} to my shelf`} onPress={add} /> : null}
          {result.unknown.length ? <Muted>Also read, but not in the catalog yet: {result.unknown.slice(0, 15).join(', ')}</Muted> : null}
        </View>
      ) : null}
    </Screen>
  );
}
