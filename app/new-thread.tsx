import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Banner, Button, Card, Field, Label, Muted, Screen, Segmented } from '@/components/ui';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/lib/supabase';
import type { ForumCategory } from '@/lib/types';

export default function NewThread() {
  const router = useRouter();
  const params = useLocalSearchParams<{ category?: string }>();
  const { profile } = useAuth();
  const [categories, setCategories] = useState<ForumCategory[]>([]);
  const [category, setCategory] = useState(params.category ?? '');
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    supabase.from('forum_categories').select('*').order('sort_order').then(({ data }) => {
      const cats = (data as ForumCategory[]) ?? [];
      setCategories(cats);
      if (!params.category && cats[0]) setCategory(String(cats[0].id));
    });
  }, [params.category]);

  async function post() {
    if (!profile) return;
    if (title.trim().length < 3) { setError('Give your discussion a title of at least 3 characters.'); return; }
    if (!body.trim()) { setError('Write something to start the discussion.'); return; }
    setBusy(true);
    const { data, error: e } = await supabase.from('threads')
      .insert({ category_id: Number(category), author_id: profile.id, title: title.trim(), body: body.trim() })
      .select('id').single();
    setBusy(false);
    if (e || !data) { setError('Your discussion did not post. Try again.'); return; }
    router.replace(`/thread/${data.id}`);
  }

  return (
    <Screen>
      <Card>
        <Label>Where does it go?</Label>
        <Segmented value={category} onChange={setCategory} options={categories.map((c) => ({ value: String(c.id), label: c.name }))} />
        <Field label="Title" value={title} onChangeText={setTitle} maxLength={120} placeholder="Best 2-player game under 30 minutes?" />
        <Field label="Details" value={body} onChangeText={setBody} maxLength={5000} multiline
          style={{ minHeight: 140, textAlignVertical: 'top' }} placeholder="Give people enough to help: what you own, who you play with…" />
        <Muted>Be kind. Posts that break the community rules are removed.</Muted>
        <Banner text={error} tone="error" />
        <Button title="Post discussion" onPress={post} loading={busy} />
      </Card>
    </Screen>
  );
}
