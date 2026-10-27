import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { AdSlot } from '@/components/AdSlot';
import { Banner, Button, Card, Empty, Field, Loading, Muted, Screen } from '@/components/ui';
import { useAuth } from '@/lib/auth';
import { loadBlockedIds, timeAgo } from '@/lib/forum';
import { supabase } from '@/lib/supabase';
import { useColors } from '@/lib/theme';
import type { Post, Thread } from '@/lib/types';

const REASONS = ['Spam', 'Harassment or hate', 'Off-topic', 'Something else'];

/** The small menu under each message: report it, block the author, or delete your own. */
function Actions({ authorId, onReport, onBlock, onDelete }: { authorId: string; onReport: (r: string) => void; onBlock: () => void; onDelete: () => void }) {
  const c = useColors();
  const { profile } = useAuth();
  const [open, setOpen] = useState(false);
  const mine = profile?.id === authorId;
  const canDelete = mine || profile?.role === 'moderator';
  const link = (label: string, fn: () => void, danger = false) => (
    <Pressable key={label} accessibilityRole="button" onPress={() => { setOpen(false); fn(); }} hitSlop={6}>
      <Text style={{ color: danger ? c.meeple : c.accent, fontSize: 13, fontWeight: '700' }}>{label}</Text>
    </Pressable>
  );
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 14, marginTop: 4 }}>
      {!mine && !open ? link('Report', () => setOpen(true)) : null}
      {!mine && open ? REASONS.map((r) => link(r, () => onReport(r))) : null}
      {!mine && open ? link('Cancel', () => setOpen(false)) : null}
      {!mine && !open ? link('Block author', onBlock) : null}
      {canDelete && !open ? link('Delete', onDelete, true) : null}
    </View>
  );
}

export default function ThreadScreen() {
  const c = useColors();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { profile } = useAuth();
  const [thread, setThread] = useState<Thread | null>(null);
  const [posts, setPosts] = useState<Post[]>([]);
  const [blocked, setBlocked] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [reply, setReply] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ text: string; tone: 'info' | 'error' } | null>(null);

  const load = useCallback(async () => {
    const [{ data: t }, { data: p }, b] = await Promise.all([
      supabase.from('threads').select('*, author:profiles(username, display_name)').eq('id', Number(id)).maybeSingle(),
      supabase.from('posts').select('*, author:profiles(username, display_name)').eq('thread_id', Number(id)).order('created_at'),
      loadBlockedIds(profile?.id),
    ]);
    setThread(t as Thread | null);
    setPosts((p as Post[]) ?? []);
    setBlocked(b);
    setLoading(false);
  }, [id, profile?.id]);

  useEffect(() => { load(); }, [load]);

  async function send() {
    if (!profile || !reply.trim()) return;
    setBusy(true);
    const { error } = await supabase.from('posts').insert({ thread_id: Number(id), author_id: profile.id, body: reply.trim() });
    setBusy(false);
    if (error) { setMsg({ text: 'Your reply did not post. Try again.', tone: 'error' }); return; }
    setReply(''); setMsg(null); load();
  }

  async function report(target: { thread_id?: number; post_id?: number }, reason: string) {
    if (!profile) return;
    const { error } = await supabase.from('reports').insert({ reporter_id: profile.id, reason, ...target });
    setMsg(error ? { text: 'The report did not send. Try again.', tone: 'error' } : { text: 'Thanks. A moderator will review it.', tone: 'info' });
  }

  async function block(authorId: string) {
    if (!profile) return;
    const { error } = await supabase.from('blocks').insert({ blocker_id: profile.id, blocked_id: authorId });
    if (error && error.code !== '23505') { setMsg({ text: 'Block did not save. Try again.', tone: 'error' }); return; }
    setMsg({ text: "Blocked. You won't see their posts anymore.", tone: 'info' });
    load();
  }

  async function removeThread() {
    const { error } = await supabase.from('threads').delete().eq('id', Number(id));
    if (error) setMsg({ text: 'Could not delete. Try again.', tone: 'error' });
    else router.back();
  }

  async function removePost(postId: number) {
    const { error } = await supabase.from('posts').delete().eq('id', postId);
    if (error) setMsg({ text: 'Could not delete. Try again.', tone: 'error' });
    else load();
  }

  if (loading) return <Screen><Loading /></Screen>;
  if (!thread) return <Screen><Empty>This discussion was removed or doesn't exist.</Empty></Screen>;
  const hiddenAuthor = blocked.has(thread.author_id);
  const visible = posts.filter((p) => !blocked.has(p.author_id));

  const byline = (a: Post['author'], at: string) => (
    <Pressable onPress={() => a && router.push(`/profile/${a.username}`)} accessibilityRole="link">
      <Muted><Text style={{ fontWeight: '700', color: c.fg }}>{a?.display_name ?? 'Someone'}</Text> @{a?.username} · {timeAgo(at)}</Muted>
    </Pressable>
  );

  return (
    <Screen>
      <Stack.Screen options={{ title: thread.title }} />
      <Card>
        <Text style={{ color: c.fg, fontSize: 22, fontWeight: '800' }}>{thread.title}</Text>
        {byline(thread.author, thread.created_at)}
        <Text style={{ color: c.fg, fontSize: 15, lineHeight: 22 }}>{hiddenAuthor ? 'You blocked this author.' : thread.body}</Text>
        <Actions authorId={thread.author_id} onReport={(r) => report({ thread_id: thread.id }, r)} onBlock={() => block(thread.author_id)} onDelete={removeThread} />
      </Card>

      <AdSlot placement="forum" />

      <Muted>{visible.length} {visible.length === 1 ? 'reply' : 'replies'}</Muted>
      {visible.map((p) => (
        <Card key={p.id} style={{ gap: 6 }}>
          {byline(p.author, p.created_at)}
          <Text style={{ color: c.fg, fontSize: 15, lineHeight: 22 }}>{p.body}</Text>
          <Actions authorId={p.author_id} onReport={(r) => report({ post_id: p.id }, r)} onBlock={() => block(p.author_id)} onDelete={() => removePost(p.id)} />
        </Card>
      ))}

      <Card>
        <Field label="Your reply" value={reply} onChangeText={setReply} multiline maxLength={5000}
          style={{ minHeight: 90, textAlignVertical: 'top' }} placeholder="Add to the discussion" />
        <Banner text={msg?.text} tone={msg?.tone} />
        <Button title="Post reply" onPress={send} loading={busy} disabled={!reply.trim()} />
      </Card>
    </Screen>
  );
}
