-- Shelf Night database schema.
-- Run this once in Supabase → SQL Editor (or with `supabase db push`).
-- Every table has row-level security (RLS) so the public app key can only do what these rules allow.

-- ============ Profiles ============
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text not null unique
    check (username ~ '^[a-z0-9_]{3,20}$'),
  display_name text not null check (char_length(display_name) between 1 and 40),
  bio text check (char_length(bio) <= 280),
  role text not null default 'member' check (role in ('member', 'moderator')),
  accepted_terms_at timestamptz not null,
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy "Profiles are visible to signed-in users"
  on public.profiles for select to authenticated using (true);
create policy "People create their own profile"
  on public.profiles for insert to authenticated
  with check (id = auth.uid() and role = 'member');
create policy "People edit their own profile"
  on public.profiles for update to authenticated
  using (id = auth.uid())
  with check (id = auth.uid() and role = (select p.role from public.profiles p where p.id = auth.uid()));

create or replace function public.is_moderator() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role = 'moderator');
$$;

-- ============ Game catalog ============
-- Filled from the seed file now; later from your licensed BoardGameGeek import.
create table public.games (
  id bigint generated always as identity primary key,
  bgg_id integer unique,
  name text not null,
  year integer,
  min_players smallint not null,
  max_players smallint not null,
  play_minutes smallint not null,
  weight numeric(3,2) not null,
  tags text[] not null default '{}',
  created_at timestamptz not null default now()
);
create index games_name_idx on public.games (lower(name));

alter table public.games enable row level security;
create policy "Anyone can read the catalog" on public.games for select using (true);
-- No insert/update policy: only the server (service role) can change the catalog.

-- ============ Shelves ============
create table public.shelf_items (
  user_id uuid not null references auth.users(id) on delete cascade,
  game_id bigint not null references public.games(id) on delete cascade,
  added_at timestamptz not null default now(),
  primary key (user_id, game_id)
);

alter table public.shelf_items enable row level security;
create policy "People see their own shelf" on public.shelf_items for select to authenticated using (user_id = auth.uid());
create policy "People add to their own shelf" on public.shelf_items for insert to authenticated with check (user_id = auth.uid());
create policy "People remove from their own shelf" on public.shelf_items for delete to authenticated using (user_id = auth.uid());

-- ============ Forums ============
create table public.forum_categories (
  id bigint generated always as identity primary key,
  slug text not null unique,
  name text not null,
  description text not null default '',
  sort_order int not null default 0
);
alter table public.forum_categories enable row level security;
create policy "Anyone can read categories" on public.forum_categories for select using (true);

create table public.threads (
  id bigint generated always as identity primary key,
  category_id bigint not null references public.forum_categories(id) on delete cascade,
  author_id uuid not null references public.profiles(id) on delete cascade,
  title text not null check (char_length(title) between 3 and 120),
  body text not null check (char_length(body) between 1 and 5000),
  game_id bigint references public.games(id) on delete set null,
  reply_count int not null default 0,
  is_hidden boolean not null default false,
  last_activity_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);
create index threads_category_idx on public.threads (category_id, last_activity_at desc);

create table public.posts (
  id bigint generated always as identity primary key,
  thread_id bigint not null references public.threads(id) on delete cascade,
  author_id uuid not null references public.profiles(id) on delete cascade,
  body text not null check (char_length(body) between 1 and 5000),
  is_hidden boolean not null default false,
  created_at timestamptz not null default now()
);
create index posts_thread_idx on public.posts (thread_id, created_at);

alter table public.threads enable row level security;
alter table public.posts enable row level security;

create policy "Signed-in users read visible threads" on public.threads for select to authenticated
  using (not is_hidden or author_id = auth.uid() or public.is_moderator());
create policy "Members start threads as themselves" on public.threads for insert to authenticated
  with check (author_id = auth.uid() and exists (select 1 from public.profiles where id = auth.uid()));
create policy "Authors edit their threads" on public.threads for update to authenticated
  using (author_id = auth.uid()) with check (author_id = auth.uid() and is_hidden = false);
create policy "Moderators hide threads" on public.threads for update to authenticated
  using (public.is_moderator());
create policy "Authors or moderators delete threads" on public.threads for delete to authenticated
  using (author_id = auth.uid() or public.is_moderator());

create policy "Signed-in users read visible posts" on public.posts for select to authenticated
  using (not is_hidden or author_id = auth.uid() or public.is_moderator());
create policy "Members reply as themselves" on public.posts for insert to authenticated
  with check (author_id = auth.uid() and exists (select 1 from public.profiles where id = auth.uid()));
create policy "Authors or moderators delete posts" on public.posts for delete to authenticated
  using (author_id = auth.uid() or public.is_moderator());
create policy "Moderators hide posts" on public.posts for update to authenticated
  using (public.is_moderator());

-- Keep reply counts and "last activity" up to date.
create or replace function public.on_post_change() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    update public.threads set reply_count = reply_count + 1, last_activity_at = now() where id = new.thread_id;
  elsif tg_op = 'DELETE' then
    update public.threads set reply_count = greatest(reply_count - 1, 0) where id = old.thread_id;
  end if;
  return null;
end $$;
create trigger posts_count after insert or delete on public.posts
  for each row execute function public.on_post_change();

-- ============ Safety: reports and blocks (required by the App Store and Google Play) ============
create table public.reports (
  id bigint generated always as identity primary key,
  reporter_id uuid not null references public.profiles(id) on delete cascade,
  thread_id bigint references public.threads(id) on delete cascade,
  post_id bigint references public.posts(id) on delete cascade,
  reported_user_id uuid references public.profiles(id) on delete cascade,
  reason text not null check (char_length(reason) between 1 and 500),
  status text not null default 'open' check (status in ('open', 'actioned', 'dismissed')),
  created_at timestamptz not null default now(),
  check (thread_id is not null or post_id is not null or reported_user_id is not null)
);
alter table public.reports enable row level security;
create policy "Members file reports" on public.reports for insert to authenticated with check (reporter_id = auth.uid());
create policy "Reporters and moderators read reports" on public.reports for select to authenticated
  using (reporter_id = auth.uid() or public.is_moderator());
create policy "Moderators resolve reports" on public.reports for update to authenticated using (public.is_moderator());

-- Auto-hide anything that collects 3 separate reports until a moderator looks at it.
create or replace function public.auto_hide_reported() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.post_id is not null and
     (select count(distinct reporter_id) from public.reports where post_id = new.post_id and status = 'open') >= 3 then
    update public.posts set is_hidden = true where id = new.post_id;
  end if;
  if new.thread_id is not null and
     (select count(distinct reporter_id) from public.reports where thread_id = new.thread_id and status = 'open') >= 3 then
    update public.threads set is_hidden = true where id = new.thread_id;
  end if;
  return null;
end $$;
create trigger reports_auto_hide after insert on public.reports
  for each row execute function public.auto_hide_reported();

create table public.blocks (
  blocker_id uuid not null references public.profiles(id) on delete cascade,
  blocked_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id),
  check (blocker_id <> blocked_id)
);
alter table public.blocks enable row level security;
create policy "People see their own blocks" on public.blocks for select to authenticated using (blocker_id = auth.uid());
create policy "People block others" on public.blocks for insert to authenticated with check (blocker_id = auth.uid());
create policy "People unblock others" on public.blocks for delete to authenticated using (blocker_id = auth.uid());

-- ============ Photo scan usage (for the daily limit) ============
create table public.scan_log (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  titles_found int not null default 0,
  created_at timestamptz not null default now()
);
create index scan_log_user_day_idx on public.scan_log (user_id, created_at desc);
alter table public.scan_log enable row level security;
create policy "People see their own scans" on public.scan_log for select to authenticated using (user_id = auth.uid());
-- Inserts happen only from the scan-shelf server function (service role).
