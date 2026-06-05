alter table roommate_profiles
  add column if not exists socials jsonb not null default '[]'::jsonb;

create index if not exists idx_roommate_profiles_socials
  on roommate_profiles using gin (socials);
