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
