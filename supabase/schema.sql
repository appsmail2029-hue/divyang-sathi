-- Metro Assist — PostgreSQL / Supabase schema (optional production target).
--
-- The bundled application runs on local SQLite (data/metro.db) so it works without
-- external credentials. This file mirrors that schema for Supabase deployments.
-- Run it in the Supabase SQL editor, then connect the server with the service-role
-- key only. Never expose the service-role key to the browser.
--
-- SECURITY MODEL
--   * All access from the Next.js server uses the service role and bypasses RLS.
--   * Browser clients receive only SELECT access, scoped to their own station.
--   * No INSERT/UPDATE/DELETE policies are defined: every mutation must pass
--     through the server-side workflow, which enforces duplication, direction,
--     acknowledgement and audit rules.
--   * Link application users to Supabase Auth through users.auth_user_id.

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- Stations and route
-- ---------------------------------------------------------------------------

create table if not exists public.stations (
  id             bigint generated always as identity primary key,
  station_code   text not null unique,
  station_name   text not null unique,
  plus_sequence  integer not null,
  minus_sequence integer not null,
  active_status  boolean not null default true,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  constraint stations_code_format check (station_code ~ '^[A-Za-z0-9_-]{2,12}$'),
  constraint stations_sequences_positive check (plus_sequence > 0 and minus_sequence > 0)
);

-- Normalised mirror used by the application's route engine. plus_sequence /
-- minus_sequence on stations are the two columns required by the station CSV.
create table if not exists public.route_sequences (
  id         bigint generated always as identity primary key,
  station_id bigint not null references public.stations(id) on delete cascade,
  direction  text not null check (direction in ('+', '-')),
  sequence   integer not null,
  unique (station_id, direction),
  unique (direction, sequence)
);

-- ---------------------------------------------------------------------------
-- Accounts and sessions
-- ---------------------------------------------------------------------------

create table if not exists public.users (
  id                   bigint generated always as identity primary key,
  auth_user_id         uuid unique references auth.users(id) on delete set null,
  username             text not null unique,
  password_hash        text not null,
  display_name         text not null,
  role                 text not null check (role in ('admin', 'station')),
  station_id           bigint references public.stations(id),
  is_active            boolean not null default true,
  must_change_password boolean not null default false,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),
  constraint users_station_role check (role = 'admin' or station_id is not null)
);

-- Only used when the server-side session store is kept in PostgreSQL. When
-- Supabase Auth sessions are used instead this table remains empty.
create table if not exists public.sessions (
  id           bigint generated always as identity primary key,
  token_hash   text not null unique,
  user_id      bigint not null references public.users(id) on delete cascade,
  created_at   timestamptz not null default now(),
  expires_at   timestamptz not null,
  last_seen_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Assistance workflow
-- ---------------------------------------------------------------------------

create table if not exists public.assistance_requests (
  id                    bigint generated always as identity primary key,
  request_code          text not null unique,
  assistance_type       text not null check (assistance_type in ('VISUALLY_IMPAIRED', 'WHEELCHAIR')),
  boarding_station_id   bigint not null references public.stations(id),
  destination_station_id bigint not null references public.stations(id),
  passenger_count       integer not null check (passenger_count between 1 and 30),
  train_number          text not null,
  train_set             text not null,
  direction             text not null check (direction in ('+', '-')),
  status                text not null default 'PENDING'
    check (status in ('PENDING', 'ACKNOWLEDGED', 'DEPARTED', 'IN_TRANSIT', 'ARRIVED', 'COMPLETED')),
  created_by            bigint references public.users(id),
  created_at            timestamptz not null default now(),
  acknowledged_at       timestamptz,
  acknowledged_by       bigint references public.users(id),
  departed_at           timestamptz,
  departed_by           bigint references public.users(id),
  current_station_id    bigint references public.stations(id),
  second_alarm_sent     boolean not null default false,
  second_alarm_at       timestamptz,
  estimated_arrival_at  timestamptz,
  arrived_at            timestamptz,
  completed_at          timestamptz,
  completed_by          bigint references public.users(id),
  constraint requests_distinct_stations check (boarding_station_id <> destination_station_id)
);

create table if not exists public.request_acknowledgements (
  id         bigint generated always as identity primary key,
  request_id text not null references public.assistance_requests(request_code) on delete cascade,
  action     text not null check (action in ('ACKNOWLEDGED', 'COMPLETED')),
  station_id bigint not null references public.stations(id),
  user_id    bigint references public.users(id),
  created_at timestamptz not null default now(),
  unique (request_id, action)
);

create table if not exists public.train_movements (
  id         bigint generated always as identity primary key,
  request_id text not null references public.assistance_requests(request_code) on delete cascade,
  station_id bigint not null references public.stations(id),
  offset     integer not null check (offset >= 0),
  updated_by bigint references public.users(id),
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Other information broadcasts
-- ---------------------------------------------------------------------------

create table if not exists public.other_information (
  info_code          text primary key,
  category           text not null check (category in ('LOST_FOUND', 'SEPARATE_PASSENGER', 'OTHER')),
  description        text not null,
  origin_station_id  bigint not null references public.stations(id),
  image_url          text,
  status             text not null default 'OPEN' check (status in ('OPEN', 'CLOSED')),
  created_by         bigint references public.users(id),
  created_at         timestamptz not null default now(),
  closed_at          timestamptz,
  closed_by          bigint references public.users(id)
);

create table if not exists public.information_acknowledgements (
  id         bigint generated always as identity primary key,
  info_code  text not null references public.other_information(info_code) on delete cascade,
  station_id bigint not null references public.stations(id),
  user_id    bigint references public.users(id),
  created_at timestamptz not null default now(),
  unique (info_code, station_id)
);

-- ---------------------------------------------------------------------------
-- Notifications, audit, settings and push
-- ---------------------------------------------------------------------------

create table if not exists public.notifications (
  id         bigint generated always as identity primary key,
  kind       text not null,
  priority   text not null check (priority in ('NORMAL', 'HIGH', 'CRITICAL')),
  title      text not null,
  body       text not null,
  station_id bigint references public.stations(id) on delete cascade,
  request_id text references public.assistance_requests(request_code) on delete cascade,
  info_id    text references public.other_information(info_code) on delete cascade,
  status     text not null default 'UNREAD' check (status in ('UNREAD', 'READ', 'SILENCED')),
  dedupe_key text unique,
  created_at timestamptz not null default now(),
  read_at    timestamptz,
  read_by    bigint references public.users(id)
);

create table if not exists public.audit_logs (
  id            bigint generated always as identity primary key,
  actor_user_id bigint,
  actor_name    text not null,
  station_id    bigint,
  action        text not null,
  entity        text not null,
  entity_id     text,
  details       text,
  created_at    timestamptz not null default now()
);

create table if not exists public.settings (
  key   text primary key,
  value text not null
);

create table if not exists public.push_subscriptions (
  id         bigint generated always as identity primary key,
  user_id    bigint not null references public.users(id) on delete cascade,
  station_id bigint references public.stations(id) on delete cascade,
  endpoint   text not null unique,
  p256dh     text not null,
  auth       text not null,
  created_at timestamptz not null default now()
);

insert into public.settings (key, value) values
  ('seconds_per_station', '180'),
  ('alarm_volume', '0.8'),
  ('alarm_repeat_seconds', '8'),
  ('browser_notifications', 'true'),
  ('push_enabled', 'true'),
  ('auto_close_notice_days', '7'),
  ('demo_mode', 'true'),
  ('organization_name', 'Delhi Metro — Pink Line')
on conflict (key) do nothing;

-- ---------------------------------------------------------------------------
-- Indexes
-- ---------------------------------------------------------------------------

create index if not exists idx_requests_destination_status on public.assistance_requests(destination_station_id, status);
create index if not exists idx_requests_boarding_status on public.assistance_requests(boarding_station_id, status);
create index if not exists idx_requests_created on public.assistance_requests(created_at);
create index if not exists idx_notifications_station_status on public.notifications(station_id, status, created_at);
create index if not exists idx_movements_request on public.train_movements(request_id, created_at);
create index if not exists idx_audit_created on public.audit_logs(created_at);
create index if not exists idx_info_status on public.other_information(status, created_at);
create index if not exists idx_ack_info on public.information_acknowledgements(info_code);
create index if not exists idx_sessions_user on public.sessions(user_id);

-- ---------------------------------------------------------------------------
-- Row-level security
-- ---------------------------------------------------------------------------

create or replace function public.current_app_user()
returns public.users
language sql
stable
security definer
set search_path = public
as $$
  select * from public.users where auth_user_id = auth.uid() and is_active limit 1;
$$;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((select role = 'admin' from public.current_app_user()), false);
$$;

create or replace function public.current_station_id()
returns bigint
language sql
stable
security definer
set search_path = public
as $$
  select station_id from public.current_app_user();
$$;

alter table public.stations enable row level security;
alter table public.route_sequences enable row level security;
alter table public.users enable row level security;
alter table public.sessions enable row level security;
alter table public.assistance_requests enable row level security;
alter table public.request_acknowledgements enable row level security;
alter table public.train_movements enable row level security;
alter table public.other_information enable row level security;
alter table public.information_acknowledgements enable row level security;
alter table public.notifications enable row level security;
alter table public.audit_logs enable row level security;
alter table public.settings enable row level security;
alter table public.push_subscriptions enable row level security;

drop policy if exists stations_read on public.stations;
create policy stations_read on public.stations
  for select to authenticated using (public.current_app_user() is not null);

drop policy if exists route_read on public.route_sequences;
create policy route_read on public.route_sequences
  for select to authenticated using (public.current_app_user() is not null);

drop policy if exists users_read on public.users;
create policy users_read on public.users
  for select to authenticated
  using (public.is_admin() or id = (public.current_app_user()).id);

drop policy if exists requests_read on public.assistance_requests;
create policy requests_read on public.assistance_requests
  for select to authenticated
  using (
    public.is_admin()
    or boarding_station_id = public.current_station_id()
    or destination_station_id = public.current_station_id()
    or current_station_id = public.current_station_id()
  );

drop policy if exists request_acks_read on public.request_acknowledgements;
create policy request_acks_read on public.request_acknowledgements
  for select to authenticated
  using (public.is_admin() or station_id = public.current_station_id());

drop policy if exists movements_read on public.train_movements;
create policy movements_read on public.train_movements
  for select to authenticated
  using (
    public.is_admin()
    or exists (
      select 1 from public.assistance_requests r
      where r.request_code = train_movements.request_id
        and (r.boarding_station_id = public.current_station_id()
             or r.destination_station_id = public.current_station_id())
    )
  );

drop policy if exists info_read on public.other_information;
create policy info_read on public.other_information
  for select to authenticated using (public.current_app_user() is not null);

drop policy if exists info_acks_read on public.information_acknowledgements;
create policy info_acks_read on public.information_acknowledgements
  for select to authenticated
  using (public.is_admin() or station_id = public.current_station_id());

drop policy if exists notifications_read on public.notifications;
create policy notifications_read on public.notifications
  for select to authenticated
  using (public.is_admin() or station_id = public.current_station_id());

drop policy if exists audit_read on public.audit_logs;
create policy audit_read on public.audit_logs
  for select to authenticated using (public.is_admin());

drop policy if exists settings_read on public.settings;
create policy settings_read on public.settings
  for select to authenticated using (public.is_admin());

drop policy if exists push_subs_read on public.push_subscriptions;
create policy push_subs_read on public.push_subscriptions
  for select to authenticated
  using (public.is_admin() or user_id = (public.current_app_user()).id);

-- Sessions are server-only.
drop policy if exists sessions_deny on public.sessions;
create policy sessions_deny on public.sessions
  for select to authenticated using (false);

-- Realtime for dashboards. This app currently uses server-sent events locally;
-- Supabase Realtime can deliver the same events in a hosted deployment.
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    begin
      alter publication supabase_realtime add table public.notifications;
    exception when duplicate_object then null;
    end;
    begin
      alter publication supabase_realtime add table public.assistance_requests;
    exception when duplicate_object then null;
    end;
    begin
      alter publication supabase_realtime add table public.other_information;
    exception when duplicate_object then null;
    end;
  end if;
end
$$;
