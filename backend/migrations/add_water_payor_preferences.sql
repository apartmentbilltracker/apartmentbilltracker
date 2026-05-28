alter table room_members
  add column if not exists water_split_mode text not null default 'all_payors',
  add column if not exists water_split_payor_ids uuid[] not null default '{}';

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'room_members_water_split_mode_check'
  ) then
    alter table room_members
      add constraint room_members_water_split_mode_check
      check (water_split_mode in ('all_payors', 'specific_payors'))
      not valid;
  end if;
end $$;

create index if not exists idx_room_members_water_split_mode
  on room_members(water_split_mode);
