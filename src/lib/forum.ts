import { supabase } from './supabase';

/** People the signed-in user has blocked; their posts are hidden from them. */
export async function loadBlockedIds(userId: string | undefined): Promise<Set<string>> {
  if (!userId) return new Set();
  const { data } = await supabase.from('blocks').select('blocked_id').eq('blocker_id', userId);
  return new Set((data ?? []).map((r: { blocked_id: string }) => r.blocked_id));
}

export function timeAgo(iso: string): string {
  const s = Math.max(1, Math.round((Date.now() - new Date(iso).getTime()) / 1000));
  if (s < 60) return 'just now';
  const m = Math.round(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.round(h / 24);
  if (d < 30) return `${d}d ago`;
  return new Date(iso).toLocaleDateString();
}
