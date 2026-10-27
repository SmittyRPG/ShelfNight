import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { Banner, Button, Card, Empty, Lede, Loading, Muted, Screen, Segmented, Title } from '@/components/ui';
import { useAuth } from '@/lib/auth';
import { loadBlockedIds, timeAgo } from '@/lib/forum';
import { supabase } from '@/lib/supabase';
import { useColors } from '@/lib/theme';
import type { ForumCategory, Thread } from '@/lib/types';

export default function Forums() {
  const c = useColors();
  const router = useRouter();
  const { profile } = useAuth();
  const [categories, setCategories] = useState<ForumCategory[]>([]);
  const [category, setCategory] = useState<string>('all');
  const [threads, setThreads] = useState<Thread[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const [{ data: cats }, blocked] = await Promise.all([
      supabase.from('forum_categories').select('*').order('sort_order'),
      loadBlockedIds(profile?.id),
    ]);
    setCategories((cats as ForumCategory[]) ?? []);
    let q = supabase.from('threads').select('*, author:profiles(username, display_name)')
      .order('last_activity_at', { ascending: false }).limit(50);
    if (category !== 'all') q = q.eq('category_id', Number(category));
    const { data, error: e } = await q;
    if (e) setError('Discussions did not load. Pull down or switch tabs to try again.');
    else { setError(null); setThreads(((data as Thread[]) ?? []).filter((t) => !blocked.has(t.author_id))); }
    setLoading(false);
  }, [category, profile?.id]);

  // Reload whenever the tab comes back into view (e.g. after posting).
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const catName = (id: number) => categories.find((x) => x.id === id)?.name ?? '';

  return (
    <Screen>
      <Title>Forums</Title>
      <Lede>Ask for recommendations, settle rules arguments and find a game night near you.</Lede>
      <Button title="Start a discussion" onPress={() => router.push(category === 'all' ? '/new-thread' : `/new-thread?category=${category}`)} />
      <Segmented value={category} onChange={setCategory}
        options={[{ value: 'all', label: 'All' }, ...categories.map((x) => ({ value: String(x.id), label: x.name }))]} />
      <Banner text={error} tone="error" />
      {loading ? <Loading /> : !threads.length ? (
        <Empty>No discussions here yet. Start the first one.</Empty>
      ) : (
        <View style={{ gap: 10 }}>
          {threads.map((t) => (
            <Pressable key={t.id} accessibilityRole="link" onPress={() => router.push(`/thread/${t.id}`)}>
              <Card style={{ gap: 6 }}>
                <Muted>{catName(t.category_id)}</Muted>
                <Text style={{ color: c.fg, fontSize: 16, fontWeight: '700' }} numberOfLines={2}>{t.title}</Text>
                <Text style={{ color: c.muted }} numberOfLines={2}>{t.body}</Text>
                <Muted>
                  {t.author?.display_name ?? 'Someone'} · {t.reply_count} {t.reply_count === 1 ? 'reply' : 'replies'} · {timeAgo(t.last_activity_at)}
                </Muted>
              </Card>
            </Pressable>
          ))}
        </View>
      )}
    </Screen>
  );
}
