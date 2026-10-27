import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { Banner, Button, Card, Empty, GameLid, Loading, Muted, Screen, Title } from '@/components/ui';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/lib/supabase';
import { useColors } from '@/lib/theme';
import type { Profile, Thread } from '@/lib/types';

export default function ProfileScreen() {
  const c = useColors();
  const { username } = useLocalSearchParams<{ username: string }>();
  const { profile: me } = useAuth();
  const router = useRouter();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [threads, setThreads] = useState<Thread[]>([]);
  const [loading, setLoading] = useState(true);
  const [blocked, setBlocked] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from('profiles').select('*').eq('username', username).maybeSingle();
      const p = data as Profile | null;
      setProfile(p);
      if (p) {
        const { data: t } = await supabase.from('threads').select('*').eq('author_id', p.id)
          .order('created_at', { ascending: false }).limit(20);
        setThreads((t as Thread[]) ?? []);
        if (me) {
          const { data: b } = await supabase.from('blocks').select('blocked_id').eq('blocker_id', me.id).eq('blocked_id', p.id);
          setBlocked(!!b?.length);
        }
      }
      setLoading(false);
    })();
  }, [username, me]);

  async function toggleBlock() {
    if (!me || !profile) return;
    const { error } = blocked
      ? await supabase.from('blocks').delete().eq('blocker_id', me.id).eq('blocked_id', profile.id)
      : await supabase.from('blocks').insert({ blocker_id: me.id, blocked_id: profile.id });
    if (error) { setMsg('That did not save. Try again.'); return; }
    setBlocked(!blocked);
    setMsg(blocked ? `You unblocked @${profile.username}.` : `You blocked @${profile.username}. You won't see their posts.`);
  }

  async function report() {
    if (!me || !profile) return;
    const { error } = await supabase.from('reports').insert({ reporter_id: me.id, reported_user_id: profile.id, reason: 'Profile reported from the app' });
    setMsg(error ? 'The report did not send. Try again.' : 'Thanks. A moderator will review this profile.');
  }

  if (loading) return <Screen><Loading /></Screen>;
  if (!profile) return <Screen><Empty>No player called @{username}.</Empty></Screen>;
  const isMe = me?.id === profile.id;

  return (
    <Screen>
      <Stack.Screen options={{ title: `@${profile.username}` }} />
      <View style={{ flexDirection: 'row', gap: 14, alignItems: 'center' }}>
        <GameLid name={profile.display_name} size={64} />
        <View style={{ flex: 1 }}>
          <Title>{profile.display_name}</Title>
          <Muted>@{profile.username}{profile.role === 'moderator' ? ' · Moderator' : ''} · joined {new Date(profile.created_at).toLocaleDateString()}</Muted>
        </View>
      </View>
      {profile.bio ? <Text style={{ color: c.fg, fontSize: 15, lineHeight: 22 }}>{profile.bio}</Text> : null}
      {isMe ? (
        <Button title="Edit profile" kind="ghost" onPress={() => router.push('/settings')} />
      ) : (
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <View style={{ flex: 1 }}><Button title={blocked ? 'Unblock' : 'Block'} kind="ghost" onPress={toggleBlock} /></View>
          <View style={{ flex: 1 }}><Button title="Report" kind="ghost" onPress={report} /></View>
        </View>
      )}
      <Banner text={msg} />
      <Text style={{ color: c.fg, fontSize: 18, fontWeight: '700' }}>Discussions started</Text>
      {threads.length ? threads.map((t) => (
        <Pressable key={t.id} accessibilityRole="link" onPress={() => router.push(`/thread/${t.id}`)}>
          <Card>
            <Text style={{ color: c.fg, fontWeight: '700' }}>{t.title}</Text>
            <Muted>{t.reply_count} replies</Muted>
          </Card>
        </Pressable>
      )) : <Empty>No discussions yet.</Empty>}
    </Screen>
  );
}
