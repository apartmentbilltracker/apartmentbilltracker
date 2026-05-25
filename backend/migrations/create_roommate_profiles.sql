create table if not exists roommate_profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references users(id) on delete cascade,
  display_name text,
  age integer,
  gender text,
  work text,
  preferred_locations text[] default '{}',
  budget numeric,
  move_in_date date,
  facebook_account text,
  bio text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_roommate_profiles_user_id on roommate_profiles(user_id);
create index if not exists idx_roommate_profiles_active on roommate_profiles(is_active);
create index if not exists idx_roommate_profiles_move_in_date on roommate_profiles(move_in_date);
