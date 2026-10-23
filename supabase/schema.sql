-- Afterflow schema. Run this in the Supabase SQL editor.
-- The app uses the service role key and does not expose these tables to the anon key.

create table if not exists profiles (
  id text primary key,
  public_id text not null unique,
  name text not null,
  contact text not null,
  linkedin text not null default '',
  role text not null,
  offers jsonb not null,
  top_offer text not null,
  needs jsonb not null,
  top_need text not null,
  availability text not null,
  trying_to text not null,
  consent_at timestamptz not null,
  created_at timestamptz not null default now(),
  secret_token text not null unique,
  is_demo boolean not null default false
);

create table if not exists matches (
  id text primary key,
  a_id text not null references profiles(id) on delete cascade,
  b_id text not null references profiles(id) on delete cascade,
  score integer not null,
  explanation text not null,
  first_action text not null,
  a_status text not null default 'pending' check (a_status in ('pending', 'accepted', 'declined')),
  b_status text not null default 'pending' check (b_status in ('pending', 'accepted', 'declined')),
  created_at timestamptz not null default now(),
  a_follow_up text check (a_follow_up in ('yes', 'not_yet')),
  a_follow_up_at timestamptz,
  b_follow_up text check (b_follow_up in ('yes', 'not_yet')),
  b_follow_up_at timestamptz,
  met boolean not null default false,
  a_note text not null default '',
  b_note text not null default '',
  a_link text not null default '',
  b_link text not null default '',
  a_time text not null default '',
  b_time text not null default '',
  unique (a_id, b_id)
);

create index if not exists profiles_token_idx on profiles (secret_token);
create index if not exists matches_a_idx on matches (a_id);
create index if not exists matches_b_idx on matches (b_id);

alter table matches add column if not exists a_follow_up text;
alter table matches add column if not exists a_follow_up_at timestamptz;
alter table matches add column if not exists b_follow_up text;
alter table matches add column if not exists b_follow_up_at timestamptz;
alter table profiles add column if not exists public_id text;
alter table profiles add column if not exists linkedin text not null default '';
alter table matches add column if not exists met boolean not null default false;
alter table matches add column if not exists a_note text not null default '';
alter table matches add column if not exists b_note text not null default '';
alter table matches add column if not exists a_link text not null default '';
alter table matches add column if not exists b_link text not null default '';
alter table matches add column if not exists a_time text not null default '';
alter table matches add column if not exists b_time text not null default '';

alter table profiles enable row level security;
alter table matches enable row level security;

-- v4: one question, quiet mute/remove/block, shared notes, delete my card.
-- trying_to now holds the answer to "What's something you're into right now?".
-- Legacy columns (role, offers, score, …) stay and are written empty.
alter table profiles add column if not exists reminders boolean not null default false;
alter table profiles alter column role set default '';
alter table profiles alter column offers set default '[]'::jsonb;
alter table profiles alter column top_offer set default '';
alter table profiles alter column needs set default '[]'::jsonb;
alter table profiles alter column top_need set default '';
alter table profiles alter column availability set default '';
alter table matches add column if not exists state jsonb not null default '{}'::jsonb;
alter table matches alter column score set default 0;
alter table matches alter column explanation set default '';
alter table matches alter column first_action set default '';

create table if not exists blocks (
  blocker_id text not null references profiles(id) on delete cascade,
  blocked_id text not null references profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id)
);
create index if not exists blocks_blocked_idx on blocks (blocked_id);
alter table blocks enable row level security;

-- v4.1: several contact methods (preferred first; `contact` keeps the preferred one so older
-- builds still read it) and a private book of events per person.
alter table profiles add column if not exists contacts jsonb not null default '[]'::jsonb;
create table if not exists event_books (
  profile_id text primary key references profiles(id) on delete cascade,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);
alter table event_books enable row level security;
alter table profiles alter column reminders set default true; -- v4.1c: one gentle reminder on by default (owner-approved, 23 Oct 2026)
