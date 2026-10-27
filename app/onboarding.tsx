import { useState, type ReactNode } from 'react';
import { Linking, Pressable, Text, View } from 'react-native';
import { Banner, Button, Card, Field, Lede, Screen, Title } from '@/components/ui';
import { config } from '@/config';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/lib/supabase';
import { useColors } from '@/lib/theme';

function Check({ on, onPress, children }: { on: boolean; onPress: () => void; children: ReactNode }) {
  const c = useColors();
  return (
    <Pressable accessibilityRole="checkbox" accessibilityState={{ checked: on }} onPress={onPress}
      style={{ flexDirection: 'row', gap: 10, alignItems: 'flex-start' }}>
      <View style={{ width: 22, height: 22, borderRadius: 5, borderWidth: 1.5, borderColor: on ? c.accent : c.line, backgroundColor: on ? c.accent : 'transparent', alignItems: 'center', justifyContent: 'center', marginTop: 1 }}>
        {on ? <Text style={{ color: c.accentFg, fontWeight: '800', fontSize: 14 }}>✓</Text> : null}
      </View>
      <Text style={{ color: c.fg, flex: 1, lineHeight: 21 }}>{children}</Text>
    </Pressable>
  );
}

/** Profile creation: required before someone can post in the forums. */
export default function Onboarding() {
  const c = useColors();
  const { session, refreshProfile } = useAuth();
  const [username, setUsername] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [bio, setBio] = useState('');
  const [over13, setOver13] = useState(false);
  const [terms, setTerms] = useState(false);
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState<{ username?: string; displayName?: string; form?: string }>({});

  async function create() {
    const u = username.trim().toLowerCase();
    const d = displayName.trim();
    const next: typeof errors = {};
    if (!/^[a-z0-9_]{3,20}$/.test(u)) next.username = 'Use 3–20 lowercase letters, numbers or underscores.';
    if (!d) next.displayName = 'Add the name other players will see.';
    if (!over13 || !terms) next.form = 'Confirm both boxes to continue.';
    setErrors(next);
    if (Object.keys(next).length || !session) return;

    setBusy(true);
    const { error } = await supabase.from('profiles').insert({
      id: session.user.id,
      username: u,
      display_name: d,
      bio: bio.trim() || null,
      accepted_terms_at: new Date().toISOString(),
    });
    setBusy(false);
    if (error) {
      if (error.code === '23505') setErrors({ username: `@${u} is taken. Try another.` });
      else setErrors({ form: 'Your profile did not save. Try again.' });
      return;
    }
    await refreshProfile();
  }

  return (
    <Screen>
      <Title>Create your profile</Title>
      <Lede>This is how other players will see you in the forums. You can change everything except your username later.</Lede>
      <Card>
        <Field label="Username" value={username} onChangeText={(t) => setUsername(t.replace(/\s/g, ''))}
          placeholder="meeple_mike" autoCapitalize="none" autoCorrect={false} maxLength={20}
          hint="Shown as @username. Letters, numbers and underscores." error={errors.username} />
        <Field label="Display name" value={displayName} onChangeText={setDisplayName} placeholder="Mike" maxLength={40}
          error={errors.displayName} />
        <Field label="About you (optional)" value={bio} onChangeText={setBio} maxLength={280} multiline
          placeholder="Favorite games, how often you play, where you're based…" style={{ minHeight: 80, textAlignVertical: 'top' }}
          hint={`${280 - bio.length} characters left`} />
        <Check on={over13} onPress={() => setOver13(!over13)}>I am 13 or older.</Check>
        <Check on={terms} onPress={() => setTerms(!terms)}>
          I agree to the{' '}
          <Text style={{ color: c.accent, textDecorationLine: 'underline' }} onPress={() => Linking.openURL(config.termsUrl)}>community rules and terms</Text>
          . No harassment, hate or spam. Posts that break the rules are removed and accounts can be banned.
        </Check>
        <Banner text={errors.form} tone="error" />
        <Button title="Create profile" onPress={create} loading={busy} />
      </Card>
    </Screen>
  );
}
