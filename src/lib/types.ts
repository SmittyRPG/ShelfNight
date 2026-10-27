export type Game = {
  id: number;
  name: string;
  year: number | null;
  min_players: number;
  max_players: number;
  play_minutes: number;
  weight: number; // 1 (light) to 5 (heavy)
  tags: string[];
  bgg_id: number | null;
};

export type Profile = {
  id: string;
  username: string;
  display_name: string;
  bio: string | null;
  role: 'member' | 'moderator';
  created_at: string;
};

export type ForumCategory = {
  id: number;
  slug: string;
  name: string;
  description: string;
  sort_order: number;
};

export type Thread = {
  id: number;
  category_id: number;
  author_id: string;
  title: string;
  body: string;
  game_id: number | null;
  reply_count: number;
  last_activity_at: string;
  created_at: string;
  author?: Pick<Profile, 'username' | 'display_name'> | null;
};

export type Post = {
  id: number;
  thread_id: number;
  author_id: string;
  body: string;
  created_at: string;
  author?: Pick<Profile, 'username' | 'display_name'> | null;
};
