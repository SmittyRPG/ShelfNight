-- Lets the catalog hold thousands of games imported from Wikidata.
-- Wikidata often lacks player counts, play time or complexity, so those become optional.
-- Run this once in Supabase → SQL Editor, after 0001_init.sql.

alter table public.games
  alter column min_players drop not null,
  alter column max_players drop not null,
  alter column play_minutes drop not null,
  alter column weight drop not null;

alter table public.games
  add column if not exists wikidata_id text unique,
  add column if not exists source text not null default 'curated'
    check (source in ('curated', 'wikidata', 'community')),
  add column if not exists updated_at timestamptz not null default now();

-- Faster "type to search" once the catalog is large.
create extension if not exists pg_trgm;
create index if not exists games_name_trgm_idx on public.games using gin (name gin_trgm_ops);
