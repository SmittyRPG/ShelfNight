import { useState } from 'react';
import { Linking, Text, View } from 'react-native';
import { Banner, Button, Card, Field, Label, Muted, Screen } from '@/components/ui';
import { config } from '@/config';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/lib/supabase';
import { useColors } from '@/lib/theme';

export default function Settings() {
  const c = useColors();
  const { profile, session, refreshProfile, signOut } = useAuth();
  const [displayName, setDisplayName] = useState(profile?.display_name ?? '');
  const [bio, setBio] = useState(profile?.bio ?? '');
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ text: string; tone: 'info' | 'error' } | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  async function save() {
    if (!profile) return;
    if (!displayName.trim()) { setMsg({ text: 'Display name cannot be empty.', tone: 'error' }); return; }
    setSaving(true);
    const { error } = await supabase.from('profiles')
      .update({ display_name: displayName.trim(), bio: bio.trim() || null }).eq('id', profile.id);
    setSaving(false);
    if (error) setMsg({ text: 'Changes did not save. Try again.', tone: 'error' });
    else { setMsg({ text: 'Profile saved.', tone: 'info' }); refreshProfile(); }
  }

  async function deleteAccount() {
    setDeleting(true);
    const { error } = await supabase.functions.invoke('delete-account', { method: 'POST' });
    setDeleting(false);
    if (error) { setMsg({ text: `Account deletion failed. Email ${config.supportEmail} and we'll do it for you.`, tone: 'error' }); return; }
    await signOut();
  }

  return (
    <Screen>
      <Card>
        <Label>Signed in as @{profile?.username}</Label>
        <Muted>{session?.user.email}</Muted>
        <Field label="Display name" value={displayName} onChangeText={setDisplayName} maxLength={40} />
        <Field label="About you" value={bio} onChangeText={setBio} maxLength={280} multiline style={{ minHeight: 80, textAlignVertical: 'top' }} />
        <Button title="Save profile" onPress={save} loading={saving} />
        <Banner text={msg?.text} tone={msg?.tone} />
      </Card>

      <Card>
        <Label>About</Label>
        <Text style={{ color: c.accent }} onPress={() => Linking.openURL(config.termsUrl)}>Community rules and terms</Text>
        <Text style={{ color: c.accent }} onPress={() => Linking.openURL(config.privacyUrl)}>Privacy policy</Text>
        <Muted>Support: {config.supportEmail}</Muted>
        <Muted>Game data from Wikidata and the Shelf Night community.</Muted>
      </Card>

      <Button title="Sign out" kind="ghost" onPress={signOut} />

      <Card>
        <Label>Delete account</Label>
        <Muted>This permanently removes your profile, shelf, posts and reports. It cannot be undone.</Muted>
        {confirmDelete ? (
          <View style={{ gap: 8 }}>
            <Button title="Yes, delete everything" kind="danger" onPress={deleteAccount} loading={deleting} />
            <Button title="Keep my account" kind="ghost" onPress={() => setConfirmDelete(false)} />
          </View>
        ) : (
          <Button title="Delete my account" kind="ghost" onPress={() => setConfirmDelete(true)} />
        )}
      </Card>
    </Screen>
  );
}
